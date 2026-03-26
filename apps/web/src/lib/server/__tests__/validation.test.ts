import { describe, it, expect } from "vitest";
import { sanitizeUrl, sanitizeText, isValidPhone, cleanPhone } from "../validation";

describe("sanitizeUrl", () => {
  it("allows https URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com/");
  });

  it("allows http URLs", () => {
    expect(sanitizeUrl("http://example.com/path")).toBe("http://example.com/path");
  });

  it("rejects javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects invalid URLs", () => {
    expect(sanitizeUrl("not a url")).toBeNull();
  });

  it("returns null for empty/null input", () => {
    expect(sanitizeUrl(null)).toBeNull();
    expect(sanitizeUrl(undefined)).toBeNull();
    expect(sanitizeUrl("")).toBeNull();
    expect(sanitizeUrl("  ")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com/");
  });
});

describe("sanitizeText", () => {
  it("trims and returns text", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });

  it("respects maxLength", () => {
    expect(sanitizeText("abcdefgh", 5)).toBe("abcde");
  });

  it("returns null for empty input", () => {
    expect(sanitizeText(null)).toBeNull();
    expect(sanitizeText("")).toBeNull();
    expect(sanitizeText("   ")).toBeNull();
  });

  it("defaults to 500 char limit", () => {
    const long = "a".repeat(600);
    expect(sanitizeText(long)?.length).toBe(500);
  });
});

describe("isValidPhone", () => {
  it("accepts valid Taiwan mobile numbers", () => {
    expect(isValidPhone("0912345678")).toBe(true);
    expect(isValidPhone("0923456789")).toBe(true);
  });

  it("accepts numbers with dashes/spaces", () => {
    expect(isValidPhone("09-1234-5678")).toBe(true);
    expect(isValidPhone("09 1234 5678")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isValidPhone("0812345678")).toBe(false);
    expect(isValidPhone("091234567")).toBe(false);
    expect(isValidPhone("09123456789")).toBe(false);
    expect(isValidPhone("abc")).toBe(false);
  });
});

describe("cleanPhone", () => {
  it("removes dashes and spaces", () => {
    expect(cleanPhone("09-1234-5678")).toBe("0912345678");
    expect(cleanPhone("09 1234 5678")).toBe("0912345678");
  });
});
