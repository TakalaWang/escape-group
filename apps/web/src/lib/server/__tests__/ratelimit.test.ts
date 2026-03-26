import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, getRateLimitKey, _resetStore } from "../ratelimit";

beforeEach(() => {
  _resetStore();
});

describe("rateLimit", () => {
  it("allows requests within limit", () => {
    const result = rateLimit("test-key", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("tracks count across calls", () => {
    rateLimit("test-key", 5);
    rateLimit("test-key", 5);
    const result = rateLimit("test-key", 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks after limit exceeded", () => {
    for (let i = 0; i < 5; i++) {
      rateLimit("test-key", 5);
    }
    const result = rateLimit("test-key", 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("isolates different keys", () => {
    for (let i = 0; i < 5; i++) {
      rateLimit("key-a", 5);
    }
    const resultA = rateLimit("key-a", 5);
    const resultB = rateLimit("key-b", 5);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });
});

describe("getRateLimitKey", () => {
  it("prefers userId", () => {
    expect(getRateLimitKey("user-1", "1.2.3.4")).toBe("user-1");
  });

  it("falls back to IP", () => {
    expect(getRateLimitKey(null, "1.2.3.4")).toBe("1.2.3.4");
  });

  it("falls back to anonymous", () => {
    expect(getRateLimitKey(null, undefined)).toBe("anonymous");
  });
});
