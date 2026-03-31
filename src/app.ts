import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, eq, sql } from "drizzle-orm";
import { verifySignature } from "./line/verify.js";
import { handleWebhookEvents } from "./handlers/webhook.js";
import { validateCreateGroupInput, createGroup } from "./services/group.js";
import { upsertUserFromLiff } from "./services/user.js";
import { searchGroups, buildSearchQuery } from "./services/search.js";
import { buildGroupCard } from "./line/flex/group-card.js";
import { getLineClient } from "./line/client.js";
import { db } from "./db/client.js";
import { groupMembers, groups, groups as groupsTable, subscriptions, users } from "./db/schema.js";

const app = new Hono().basePath("/api");

app.use("/groups", cors());
app.use("/groups/*", cors());
app.use("/my-groups", cors());
app.use("/subscriptions/*", cors());
app.use("/subscriptions", cors());
app.use("/my-joined-groups", cors());

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
    const body = await c.req.json();
    const lineUserId = body.lineUserId as string;
    const displayName = body.displayName as string;
    if (!lineUserId) return c.json({ error: "Missing lineUserId" }, 400);

    const validation = validateCreateGroupInput(body);
    if (!validation.ok) return c.json({ error: validation.error }, 400);

    const user = await upsertUserFromLiff(lineUserId, displayName || "Unknown");
    const group = await createGroup(user.id, body);

    // Send card to host (can long-press to forward to OpenChat)
    const client = getLineClient();
    const cardData = {
      ...group,
      hostName: user.displayName,
      currentMembers: group.prefilledMembers,
      price: group.price,
    };
    try {
      const hostCard = buildGroupCard(cardData);
      await client.pushMessage({
        to: lineUserId,
        messages: [{ type: "text", text: "開團成功！長按下方卡片可以轉發到聊天室 👇" }, hostCard],
      });
    } catch (err) {
      console.error("Failed to send card to host:", err);
    }

    // Notify admins
    const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
    for (const adminId of adminIds) {
      if (adminId === lineUserId) continue; // Skip if host is admin
      try {
        await client.pushMessage({ to: adminId, messages: [buildGroupCard(cardData)] });
      } catch (err) {
        console.error("Failed to notify admin:", err);
      }
    }

    // Notify subscribers
    try {
      const allSubs = await db
        .select({
          userId: subscriptions.userId,
          type: subscriptions.type,
          value: subscriptions.value,
          lineUserId: users.lineUserId,
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.userId, users.id));

      const lineClient = getLineClient();
      const notified = new Set<string>();

      for (const sub of allSubs) {
        if (sub.lineUserId === lineUserId || notified.has(sub.lineUserId)) continue;

        let matches = false;
        if (sub.type === "location" && body.location === sub.value) matches = true;
        if (sub.type === "keyword") {
          const kw = sub.value.toLowerCase();
          if (body.roomName?.toLowerCase().includes(kw) || body.studio?.toLowerCase().includes(kw))
            matches = true;
        }
        if (sub.type === "price" && body.price != null) {
          const [pMin, pMax] = sub.value.split("-").map(Number);
          if ((!pMin || body.price >= pMin) && (!pMax || body.price <= pMax)) matches = true;
        }
        if (sub.type === "weekday" && body.datetime) {
          const groupDate = new Date(body.datetime);
          const dayOfWeek = groupDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
          const subscribedDays = sub.value.split(",").map(Number);
          if (subscribedDays.includes(dayOfWeek)) matches = true;
        }

        if (!matches) continue;
        notified.add(sub.lineUserId);

        try {
          await lineClient.pushMessage({
            to: sub.lineUserId,
            messages: [
              {
                type: "text",
                text: `🔔 新團通知：「${body.roomName}」${body.studio ? ` (${body.studio})` : ""}${body.price ? ` ${body.price}元/人` : ""} 正在揪人！`,
              },
            ],
          });
        } catch (e) {
          console.error("Failed to notify subscriber:", e);
        }
      }
    } catch (err) {
      console.error("Subscriber notification failed:", err);
    }

    // Build Flex card for shareTargetPicker
    const flexCard = buildGroupCard({
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
      ? await db.select({ id: users.id, displayName: users.displayName }).from(users)
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
    const body = await c.req.json();
    const { lineUserId, type, value } = body;
    if (!lineUserId || !type || !value) return c.json({ error: "Missing fields" }, 400);

    const { upsertUserFromLiff } = await import("./services/user.js");
    const user = await upsertUserFromLiff(lineUserId, body.displayName || "Unknown");

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
      ? await db.select({ id: users.id, displayName: users.displayName }).from(users)
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

// Cancel group
app.post("/groups/:id/cancel", async (c) => {
  try {
    const body = await c.req.json();
    const lineUserId = body.lineUserId;
    if (!lineUserId) return c.json({ error: "Missing userId" }, 400);

    const user = await upsertUserFromLiff(lineUserId, "");

    const { cancelGroup } = await import("./services/group.js");
    await cancelGroup(c.req.param("id"), user.id);
    return c.json({ status: "ok" });
  } catch (err) {
    return c.json({ error: "Failed" }, 500);
  }
});

// Kick member
app.post("/groups/:id/kick", async (c) => {
  try {
    const body = await c.req.json();
    const { lineUserId, memberId } = body;
    if (!lineUserId || !memberId) return c.json({ error: "Missing fields" }, 400);

    const user = await upsertUserFromLiff(lineUserId, "");

    const { kickMember } = await import("./services/member.js");
    const result = await kickMember(c.req.param("id"), memberId, user.id);
    if (!result.ok) return c.json({ error: result.reason }, 400);
    return c.json({ status: "ok" });
  } catch (err) {
    return c.json({ error: "Failed" }, 500);
  }
});

// Leave group from LIFF
app.post("/groups/:id/leave", async (c) => {
  try {
    const body = await c.req.json();
    const lineUserId = body.lineUserId;
    if (!lineUserId) return c.json({ error: "Missing userId" }, 400);

    const user = await upsertUserFromLiff(lineUserId, "");

    const { leaveGroup } = await import("./services/member.js");
    const result = await leaveGroup(c.req.param("id"), user.id);
    if (!result.ok) return c.json({ error: result.reason }, 400);
    return c.json({ status: "ok" });
  } catch (err) {
    return c.json({ error: "Failed" }, 500);
  }
});

// Join group from LIFF
app.post("/groups/:id/join", async (c) => {
  try {
    const body = await c.req.json();
    const lineUserId = body.lineUserId;
    if (!lineUserId) return c.json({ error: "Missing userId" }, 400);

    const user = await upsertUserFromLiff(lineUserId, body.displayName || "");

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

    // Notify host of new member
    try {
      const { getGroupById } = await import("./services/group.js");
      const group = await getGroupById(c.req.param("id"));
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

    return c.json({ status: "ok" });
  } catch (err) {
    return c.json({ error: "Failed" }, 500);
  }
});

export default app;
