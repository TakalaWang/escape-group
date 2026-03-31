import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifySignature } from "./line/verify.js";
import { handleWebhookEvents } from "./handlers/webhook.js";
import { validateCreateGroupInput, createGroup } from "./services/group.js";
import { upsertUserFromLiff } from "./services/user.js";
import { searchGroups, buildSearchQuery } from "./services/search.js";
import { buildGroupCard } from "./line/flex/group-card.js";
import { getLineClient } from "./line/client.js";

const app = new Hono().basePath("/api");

app.use("/groups", cors());

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

    const groupChatId = process.env.LINE_GROUP_ID;
    if (groupChatId) {
      try {
        const card = buildGroupCard({
          ...group,
          hostName: user.displayName,
          currentMembers: group.prefilledMembers,
        });
        const client = getLineClient();
        await client.pushMessage({ to: groupChatId, messages: [card] });
      } catch (err) {
        console.error("Failed to push announcement:", err);
      }
    }

    return c.json({ id: group.id, status: "created" }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Create group error:", message, err);
    return c.json({ error: message }, 500);
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
