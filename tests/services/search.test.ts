import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/db/client.js", () => ({ db: {} }));

import { buildSearchQuery } from "../../src/services/search.js";

describe("buildSearchQuery", () => {
  it("returns empty filters for no input", () => {
    const query = buildSearchQuery({});
    expect(query).toEqual({});
  });

  it("parses location filter", () => {
    const query = buildSearchQuery({ location: "taipei" });
    expect(query.location).toBe("taipei");
  });

  it("parses date range", () => {
    const query = buildSearchQuery({ dateFrom: "2026-04-01", dateTo: "2026-04-07" });
    expect(query.dateFrom).toBeDefined();
    expect(query.dateTo).toBeDefined();
  });

  it("parses keyword", () => {
    const query = buildSearchQuery({ keyword: "笑笑羊" });
    expect(query.keyword).toBe("笑笑羊");
  });
});
