import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, eq, sql, inArray } from "drizzle-orm";
import { verifySignature } from "./line/verify.js";
import { verifyLiffToken } from "./line/verify-liff.js";
import { handleWebhookEvents } from "./handlers/webhook.js";
import { createGroup } from "./services/group.js";
import { upsertUserFromLiff } from "./services/user.js";
import { searchGroups, buildSearchQuery } from "./services/search.js";
import {
  buildGroupCard,
  buildShareableGroupCard,
  LOCATION_LABELS,
} from "./line/flex/group-card.js";
import { getLineClient } from "./line/client.js";
import { db } from "./db/client.js";
import { groupMembers, groups, groups as groupsTable, subscriptions, users } from "./db/schema.js";
import { notifyAdmins, notifySubscribers } from "./services/notification.js";
import { LIFF_SEARCH_URL, LIFF_CREATE_URL, ALLOWED_ORIGINS } from "./constants.js";
import { formatDate } from "./line/flex/shared.js";
import {
  CreateGroupSchema,
  UpdateGroupSchema,
  SubscriptionSchema,
  KickMemberSchema,
} from "./schemas.js";
import type { ZodSchema } from "zod";

const app = new Hono().basePath("/api");

const corsMiddleware = cors({ origin: ALLOWED_ORIGINS });
app.use("/groups", corsMiddleware);
app.use("/groups/*", corsMiddleware);
app.use("/my-groups", corsMiddleware);
app.use("/subscriptions/*", corsMiddleware);
app.use("/subscriptions", corsMiddleware);
app.use("/my-joined-groups", corsMiddleware);

// Run a promise after response is sent (survives serverless function lifecycle).
// Falls back to fire-and-forget if executionCtx is not available (local dev).
function runInBackground(c: any, promise: Promise<unknown>): void {
  try {
    c.executionCtx?.waitUntil(promise);
  } catch {
    // Local dev or no executionCtx available
    promise.catch(() => {});
  }
}

// Parse JSON body with Zod schema. Returns the data or a 400 Response.
async function parseBody<T>(c: any, schema: ZodSchema<T>): Promise<T | Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.join(".");
    const message = path ? `${path}: ${firstIssue.message}` : firstIssue.message;
    return c.json({ error: message }, 400);
  }
  return result.data;
}

// LIFF token auth middleware for mutation endpoints
async function requireLiffAuth(c: any): Promise<{ userId: string } | Response> {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing authorization header" }, 401);
  }
  const token = authHeader.slice(7);
  const lineUserId = await verifyLiffToken(token);
  if (!lineUserId) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  return { userId: lineUserId };
}

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/webhook", async (c) => {
  const signature = c.req.header("x-line-signature");
  if (!signature) return c.json({ error: "Missing signature" }, 401);

  const body = await c.req.text();
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) return c.json({ error: "Server misconfigured" }, 500);

  if (!verifySignature(body, signature, channelSecret)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const parsed = JSON.parse(body);
  await handleWebhookEvents(parsed.events);

  return c.json({ status: "ok" });
});

app.post("/groups", async (c) => {
  try {
    const auth = await requireLiffAuth(c);
    if (auth instanceof Response) return auth;
    const lineUserId = auth.userId;

    const body = await parseBody(c, CreateGroupSchema);
    if (body instanceof Response) return body;

    // Extra validation: prefilledMembers < maxMembers
    const prefilled = body.prefilledMembers ?? 1;
    if (prefilled >= body.maxMembers) {
      return c.json({ error: "已有人數必須小於人數上限" }, 400);
    }

    const user = await upsertUserFromLiff(lineUserId, body.displayName || "Unknown");
    const group = await createGroup(user.id, body);

    const client = getLineClient();
    const cardData = {
      ...group,
      hostName: user.displayName,
      currentMembers: group.prefilledMembers,
      price: group.price,
    };

    // Send host card with share/copy buttons
    try {
      const locationLabel = body.location ? (LOCATION_LABELS[body.location] ?? body.location) : "";
      const dateStr = body.datetime ? formatDate(new Date(body.datetime)) : "";
      const detailParts = [
        locationLabel,
        body.duration ? `${body.duration}分` : "",
        body.price ? `$${body.price}/人` : "",
      ].filter(Boolean);
      const clipText = `🎯 ${group.roomName}${body.studio ? `（${body.studio}）` : ""}\n📅 ${dateStr}${detailParts.length ? `\n📍 ${detailParts.join(" · ")}` : ""}\n👥 ${group.prefilledMembers}/${body.maxMembers}人\n\n👉 點此加入：\n${LIFF_SEARCH_URL}?join=${group.id}`;

      const hostCard = {
        type: "flex" as const,
        altText: `✅ 開團成功：${group.roomName}`,
        contents: {
          ...JSON.parse(JSON.stringify(buildGroupCard(cardData).contents)),
          footer: {
            type: "box",
            layout: "vertical",
            paddingAll: "12px",
            paddingTop: "0px",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#06C755",
                height: "sm",
                action: {
                  type: "uri",
                  label: "分享卡片 📤（好友/群組）",
                  uri: `${LIFF_CREATE_URL}?share=${group.id}`,
                },
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "clipboard",
                  label: "複製文字 📋（貼到社群）",
                  clipboardText: clipText,
                },
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "postback",
                  label: "複製全部團 📋",
                  data: "action=copy_all_groups",
                  displayText: "複製全部團",
                },
              },
            ],
          },
        },
      };
      await client.pushMessage({ to: lineUserId, messages: [hostCard as any] });
    } catch (err) {
      console.error("Failed to send card to host:", err);
    }

    // Notify admins and subscribers in background (survives after response is sent)
    runInBackground(
      c,
      notifyAdmins(lineUserId, cardData).catch((e) =>
        console.error("Admin notification failed:", e)
      )
    );
    runInBackground(
      c,
      notifySubscribers(cardData, body, lineUserId).catch((e) =>
        console.error("Subscriber notification failed:", e)
      )
    );

    const flexCard = buildShareableGroupCard({
      ...group,
      hostName: user.displayName,
      currentMembers: group.prefilledMembers,
      price: group.price,
    });

    return c.json({ id: group.id, status: "created", flexCard }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Create group error:", message, err);
    return c.json({ error: message }, 500);
  }
});

// Get single group's Flex card for sharing
app.get("/groups/:id/card", async (c) => {
  const { getGroupById, getGroupMemberCount } = await import("./services/group.js");
  const group = await getGroupById(c.req.param("id"));
  if (!group) return c.json({ error: "Not found" }, 404);

  const [host] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, group.hostId))
    .limit(1);

  const memberCount = await getGroupMemberCount(group.id);
  const card = buildShareableGroupCard({
    ...group,
    hostName: host?.displayName ?? "Unknown",
    currentMembers: group.prefilledMembers + memberCount,
    price: group.price,
  });

  return c.json({ flexCard: card });
});

// Text summary for sharing to OpenChat
app.get("/summary-text", async (c) => {
  const { buildTextSummary } = await import("./cron/daily-summary.js");
  const openGroups = await db
    .select({
      id: groups.id,
      roomName: groups.roomName,
      studio: groups.studio,
      location: groups.location,
      datetime: groups.datetime,
      duration: groups.duration,
      minMembers: groups.minMembers,
      maxMembers: groups.maxMembers,
      prefilledMembers: groups.prefilledMembers,
      price: groups.price,
      hostId: groups.hostId,
      memberCount: sql`(SELECT count(*)::int FROM group_members WHERE group_members.group_id = ${groups.id})`,
    })
    .from(groups)
    .where(eq(groups.status, "open"))
    .orderBy(groups.datetime, groups.createdAt);

  const hostIds = [...new Set(openGroups.map((g) => g.hostId))];
  const hosts =
    hostIds.length > 0
      ? await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, hostIds))
      : [];
  const hostMap = new Map(hosts.map((h) => [h.id, h.displayName]));

  const summaryGroups = openGroups.map((g: any) => ({
    ...g,
    currentMembers: g.prefilledMembers + (g.memberCount ?? 0),
    hostName: hostMap.get(g.hostId),
  }));

  const { buildSummaryCards } = await import("./line/flex/summary.js");
  const text = buildTextSummary(summaryGroups);
  const cards = buildSummaryCards(summaryGroups);

  return c.json({ text, flex: cards });
});

app.get("/groups", async (c) => {
  const params = {
    location: c.req.query("location"),
    dateFrom: c.req.query("dateFrom"),
    dateTo: c.req.query("dateTo"),
    keyword: c.req.query("keyword"),
  };
  const filters = buildSearchQuery(params);
  const results = await searchGroups(filters);
  return c.json(results);
});

// Get user's subscriptions
app.get("/subscriptions", async (c) => {
  const lineUserId = c.req.query("userId");
  if (!lineUserId) return c.json({ error: "Missing userId" }, 400);

  const [user] = await db.select().from(users).where(eq(users.lineUserId, lineUserId)).limit(1);
  if (!user) return c.json([]);

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
  return c.json(subs);
});

// Add subscription
app.post("/subscriptions", async (c) => {
  try {
    const auth = await requireLiffAuth(c);
    if (auth instanceof Response) return auth;

    const body = await parseBody(c, SubscriptionSchema);
    if (body instanceof Response) return body;
    const { type, value } = body;

    const { upsertUserFromLiff } = await import("./services/user.js");
    const user = await upsertUserFromLiff(auth.userId, body.displayName || "Unknown");

    // Check duplicate
    const existing = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, user.id),
          eq(subscriptions.type, type),
          eq(subscriptions.value, value)
        )
      )
      .limit(1);
    if (existing.length > 0) return c.json({ error: "Already subscribed" }, 409);

    // For price type, replace existing
    if (type === "price") {
      await db
        .delete(subscriptions)
        .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.type, "price")));
    }

    const [sub] = await db
      .insert(subscriptions)
      .values({ userId: user.id, type, value })
      .returning();
    return c.json(sub, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// Delete subscription
app.delete("/subscriptions/:id", async (c) => {
  const auth = await requireLiffAuth(c);
  if (auth instanceof Response) return auth;

  const id = c.req.param("id");
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  return c.json({ status: "ok" });
});

// Get user's hosted groups
app.get("/my-groups", async (c) => {
  const lineUserId = c.req.query("userId");
  if (!lineUserId) return c.json({ error: "Missing userId" }, 400);

  const user = await upsertUserFromLiff(lineUserId, "");

  const { getGroupsByHost } = await import("./services/group.js");
  const groups = await getGroupsByHost(user.id);
  return c.json(groups);
});

// Get groups user has joined (as member, not host)
app.get("/my-joined-groups", async (c) => {
  const lineUserId = c.req.query("userId");
  if (!lineUserId) return c.json({ error: "Missing userId" }, 400);

  const [user] = await db.select().from(users).where(eq(users.lineUserId, lineUserId)).limit(1);
  if (!user) return c.json([]);

  const joined = await db
    .select({
      id: groupsTable.id,
      roomName: groupsTable.roomName,
      studio: groupsTable.studio,
      location: groupsTable.location,
      datetime: groupsTable.datetime,
      duration: groupsTable.duration,
      maxMembers: groupsTable.maxMembers,
      prefilledMembers: groupsTable.prefilledMembers,
      price: groupsTable.price,
      status: groupsTable.status,
      hostId: groupsTable.hostId,
      memberCount: sql<number>`(SELECT count(*)::int FROM group_members WHERE group_members.group_id = ${groupsTable.id})`,
    })
    .from(groupMembers)
    .innerJoin(groupsTable, eq(groupMembers.groupId, groupsTable.id))
    .where(eq(groupMembers.userId, user.id));

  const hostIds = [...new Set(joined.map((g) => g.hostId))];
  const hosts =
    hostIds.length > 0
      ? await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, hostIds))
      : [];
  const hostMap = new Map(hosts.map((h) => [h.id, h.displayName]));

  return c.json(
    joined.map((g) => ({
      ...g,
      currentMembers: g.prefilledMembers + (g.memberCount ?? 0),
      hostName: hostMap.get(g.hostId) ?? "Unknown",
    }))
  );
});

// Get group members
app.get("/groups/:id/members", async (c) => {
  const groupId = c.req.param("id");
  const { getGroupMembers } = await import("./services/group.js");
  const members = await getGroupMembers(groupId);
  return c.json(members);
});

// Get single group data (for edit form)
app.get("/groups/:id", async (c) => {
  const { getGroupById } = await import("./services/group.js");
  const group = await getGroupById(c.req.param("id"));
  if (!group) return c.json({ error: "Not found" }, 404);
  return c.json(group);
});

// Update group
app.put("/groups/:id", async (c) => {
  try {
    const auth = await requireLiffAuth(c);
    if (auth instanceof Response) return auth;

    const body = await parseBody(c, UpdateGroupSchema);
    if (body instanceof Response) return body;

    const user = await upsertUserFromLiff(auth.userId, "");
    const { getGroupById, updateGroup, getGroupMembers } = await import("./services/group.js");
    const group = await getGroupById(c.req.param("id"));
    if (!group) return c.json({ error: "Not found" }, 404);
    if (group.hostId !== user.id) return c.json({ error: "Not host" }, 403);

    const updates: Record<string, any> = {};
    if (body.roomName !== undefined) updates.roomName = body.roomName.trim();
    if (body.studio !== undefined) updates.studio = body.studio?.trim() || null;
    if (body.location !== undefined) updates.location = body.location || null;
    if (body.datetime !== undefined)
      updates.datetime = body.datetime ? new Date(body.datetime) : null;
    if (body.duration !== undefined) updates.duration = body.duration ?? null;
    if (body.minMembers !== undefined) updates.minMembers = body.minMembers ?? null;
    if (body.maxMembers !== undefined) updates.maxMembers = body.maxMembers;
    if (body.prefilledMembers !== undefined) updates.prefilledMembers = body.prefilledMembers;
    if (body.price !== undefined) updates.price = body.price ?? null;
    if (body.note !== undefined) updates.note = body.note?.trim() || null;

    const updated = await updateGroup(c.req.param("id"), updates);

    // Build change summary for notification
    const changes: string[] = [];
    if (
      body.datetime !== undefined &&
      group.datetime?.toISOString() !== updates.datetime?.toISOString()
    ) {
      if (updates.datetime) {
        changes.push(`📅 時間 → ${formatDate(updates.datetime)}`);
      }
    }
    if (body.maxMembers !== undefined && body.maxMembers !== group.maxMembers)
      changes.push(`👥 人數上限 → ${body.maxMembers}`);
    if (body.price !== undefined && body.price !== group.price)
      changes.push(`💰 費用 → $${body.price}/人`);
    if (body.roomName !== undefined && body.roomName.trim() !== group.roomName)
      changes.push(`🎯 名稱 → ${body.roomName.trim()}`);
    if (body.duration !== undefined && body.duration !== group.duration)
      changes.push(`⏱ 時長 → ${body.duration}分`);

    // Notify members if there are changes
    if (changes.length > 0) {
      try {
        const members = await getGroupMembers(c.req.param("id"));
        const lineClient = getLineClient();
        const text = `📢 「${updated.roomName}」已更新：\n${changes.join("\n")}`;
        for (const member of members) {
          try {
            await lineClient.pushMessage({
              to: member.lineUserId,
              messages: [{ type: "text", text }],
            });
          } catch (e) {
            /* skip failed */
          }
        }
      } catch (e) {
        console.error("Failed to notify members of update:", e);
      }
    }

    return c.json({ status: "ok", group: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Update group error:", message);
    return c.json({ error: message }, 500);
  }
});

// Cancel group
app.post("/groups/:id/cancel", async (c) => {
  try {
    const auth = await requireLiffAuth(c);
    if (auth instanceof Response) return auth;

    const user = await upsertUserFromLiff(auth.userId, "");

    const { cancelGroup } = await import("./services/group.js");
    await cancelGroup(c.req.param("id"), user.id);
    return c.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// Kick member
app.post("/groups/:id/kick", async (c) => {
  try {
    const auth = await requireLiffAuth(c);
    if (auth instanceof Response) return auth;

    const body = await parseBody(c, KickMemberSchema);
    if (body instanceof Response) return body;
    const { memberId } = body;

    const user = await upsertUserFromLiff(auth.userId, "");

    const { kickMember } = await import("./services/member.js");
    const result = await kickMember(c.req.param("id"), memberId, user.id);
    if (!result.ok) return c.json({ error: result.reason }, 400);
    return c.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// Leave group from LIFF
app.post("/groups/:id/leave", async (c) => {
  try {
    const auth = await requireLiffAuth(c);
    if (auth instanceof Response) return auth;

    const user = await upsertUserFromLiff(auth.userId, "");

    const { leaveGroup } = await import("./services/member.js");
    const result = await leaveGroup(c.req.param("id"), user.id);
    if (!result.ok) return c.json({ error: result.reason }, 400);
    return c.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// Cron: daily summary
app.post("/cron/daily-summary", async (c) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || c.req.header("authorization") !== `Bearer ${cronSecret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const { runDailySummary } = await import("./cron/daily-summary.js");
    await runDailySummary();
    return c.json({ status: "ok" });
  } catch (err) {
    console.error("Daily summary cron failed:", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// Cron: reminders
app.post("/cron/reminders", async (c) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || c.req.header("authorization") !== `Bearer ${cronSecret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const { runReminders } = await import("./cron/reminders.js");
    await runReminders();
    return c.json({ status: "ok" });
  } catch (err) {
    console.error("Reminders cron failed:", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// Join group from LIFF
app.post("/groups/:id/join", async (c) => {
  try {
    const auth = await requireLiffAuth(c);
    if (auth instanceof Response) return auth;

    const body = await c.req.json();
    const user = await upsertUserFromLiff(auth.userId, body.displayName || "");

    const { joinGroup } = await import("./services/member.js");
    const result = await joinGroup(c.req.param("id"), user.id);

    if (!result.ok) {
      const msgs: Record<string, string> = {
        not_found: "找不到這個團",
        full: "已額滿",
        already_joined: "你已經加入了",
        cancelled: "已取消",
        is_host: "你是團主",
      };
      return c.json({ error: msgs[result.reason] || result.reason }, 400);
    }

    // Get group info for response + host notification
    const { getGroupById, getGroupMemberCount } = await import("./services/group.js");
    const group = await getGroupById(c.req.param("id"));
    const memberCount = group ? await getGroupMemberCount(c.req.param("id")) : 0;
    const currentMembers = (group?.prefilledMembers ?? 1) + memberCount;

    // Notify host (non-blocking, don't let failure block response)
    try {
      if (group) {
        const [host] = await db.select().from(users).where(eq(users.id, group.hostId)).limit(1);
        if (host) {
          const lineClient = getLineClient();
          await lineClient.pushMessage({
            to: host.lineUserId,
            messages: [
              {
                type: "text",
                text: `有人加入你的團「${group.roomName}」！目前${result.groupFull ? "已滿員" : "持續募集中"}。`,
              },
            ],
          });
        }
      }
    } catch (e) {
      console.error("Failed to notify host:", e);
    }

    // Return group info + botBasicId for LIFF UX
    let botBasicId = "";
    try {
      const { getBotBasicId } = await import("./line/client.js");
      botBasicId = await getBotBasicId();
    } catch (e) {
      /* non-critical */
    }

    return c.json({
      status: "ok",
      botBasicId,
      groupName: group?.roomName ?? "",
      currentMembers,
      maxMembers: group?.maxMembers ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Join group error:", message);
    return c.json({ error: message }, 500);
  }
});

export default app;
