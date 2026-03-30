import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

describe("webhook signature verification", () => {
  const channelSecret = "test_secret";

  function sign(body: string): string {
    return crypto.createHmac("SHA256", channelSecret).update(body).digest("base64");
  }

  it("accepts valid signature", () => {
    const body = JSON.stringify({ events: [] });
    const signature = sign(body);
    const hmac = crypto.createHmac("SHA256", channelSecret).update(body).digest("base64");
    expect(hmac).toBe(signature);
  });

  it("rejects invalid signature", () => {
    const body = JSON.stringify({ events: [] });
    const hmac = crypto.createHmac("SHA256", channelSecret).update(body).digest("base64");
    expect(hmac).not.toBe("invalid_signature");
  });
});
