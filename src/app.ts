import { Hono } from "hono";
import { verifySignature } from "./line/verify.js";
import { handleWebhookEvents } from "./handlers/webhook.js";
import { validateCreateGroupInput, createGroup } from "./services/group.js";
import { upsertUser } from "./services/user.js";
import { isGroupMember } from "./services/access.js";
import { searchGroups, buildSearchQuery } from "./services/search.js";
import { buildGroupCard } from "./line/flex/group-card.js";
import { getLineClient } from "./line/client.js";

const app = new Hono().basePath("/api");

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
    if (!lineUserId) return c.json({ error: "Missing lineUserId" }, 400);

    const lineGroupId = process.env.LINE_GROUP_ID;
    if (lineGroupId) {
      try {
        if (!(await isGroupMember(lineGroupId, lineUserId))) {
          return c.json({ error: "Not a group member" }, 403);
        }
      } catch (err) {
        console.error("Access check failed, skipping:", err);
      }
    }

    const validation = validateCreateGroupInput(body);
    if (!validation.ok) return c.json({ error: validation.error }, 400);

    const user = await upsertUser(lineUserId);
    const group = await createGroup(user.id, body);

    if (lineGroupId) {
      try {
        const card = buildGroupCard({
          ...group,
          hostName: user.displayName,
          currentMembers: group.prefilledMembers,
        });
        const client = getLineClient();
        await client.pushMessage({ to: lineGroupId, messages: [card] });
      } catch (err) {
        console.error("Failed to push announcement:", err);
      }
    }

    return c.json({ id: group.id, status: "created" }, 201);
  } catch (err) {
    console.error("Create group error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
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

export default app;
