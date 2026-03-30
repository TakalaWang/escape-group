import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../src/app.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `https://${req.headers.host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      req.on("end", () => resolve(data));
    });
  }

  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    body,
  });

  const response = await app.fetch(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}
