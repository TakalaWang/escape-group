import { describe, it, expect } from "vitest";
import { findBestOverlap, computeEventTime, MIN_MATCH_SIZE } from "../matching";

function makeRequest(startHour: number, endHour: number, id = "r") {
  const base = new Date("2026-04-01T00:00:00Z");
  return {
    timeRangeStart: new Date(base.getTime() + startHour * 3600000),
    timeRangeEnd: new Date(base.getTime() + endHour * 3600000),
    id,
  };
}

describe("findBestOverlap", () => {
  it("returns empty when fewer than minSize requests", () => {
    const requests = [makeRequest(10, 18), makeRequest(12, 20)];
    expect(findBestOverlap(requests, 4, 8)).toEqual([]);
  });

  it("finds overlapping group when all overlap", () => {
    const requests = [
      makeRequest(10, 18, "a"),
      makeRequest(12, 20, "b"),
      makeRequest(14, 22, "c"),
      makeRequest(11, 19, "d"),
    ];
    const result = findBestOverlap(requests, 4, 8);
    expect(result).toHaveLength(4);
  });

  it("excludes non-overlapping requests", () => {
    const requests = [
      makeRequest(10, 14, "a"), // 10-14
      makeRequest(11, 15, "b"), // 11-15
      makeRequest(12, 16, "c"), // 12-16
      makeRequest(13, 17, "d"), // 13-17
      makeRequest(20, 24, "e"), // 20-24 — no overlap
    ];
    const result = findBestOverlap(requests, 4, 8);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.id)).not.toContain("e");
  });

  it("caps at maxSize", () => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      makeRequest(10, 20, `r${i}`)
    );
    const result = findBestOverlap(requests, 4, 6);
    expect(result).toHaveLength(6);
  });

  it("picks the largest overlapping group", () => {
    const requests = [
      // Cluster A: 3 people (too small)
      makeRequest(1, 5, "a1"),
      makeRequest(2, 6, "a2"),
      makeRequest(3, 7, "a3"),
      // Cluster B: 5 people (winner)
      makeRequest(10, 18, "b1"),
      makeRequest(11, 19, "b2"),
      makeRequest(12, 20, "b3"),
      makeRequest(13, 21, "b4"),
      makeRequest(14, 22, "b5"),
    ];
    const result = findBestOverlap(requests, 4, 8);
    expect(result).toHaveLength(5);
    expect(result.every((r) => r.id.startsWith("b"))).toBe(true);
  });

  it("returns empty when no group meets minSize", () => {
    const requests = [
      makeRequest(1, 3, "a"),
      makeRequest(5, 7, "b"),
      makeRequest(9, 11, "c"),
      makeRequest(13, 15, "d"),
    ];
    expect(findBestOverlap(requests, 4, 8)).toEqual([]);
  });
});

describe("computeEventTime", () => {
  it("computes common window and midpoint", () => {
    const group = [
      makeRequest(10, 18),
      makeRequest(12, 20),
      makeRequest(14, 16),
    ];
    const { commonStart, commonEnd, eventTime } = computeEventTime(group);

    // Common window: max(10,12,14)=14 to min(18,20,16)=16
    expect(commonStart.getUTCHours()).toBe(14);
    expect(commonEnd.getUTCHours()).toBe(16);
    // Midpoint: 15:00
    expect(eventTime.getUTCHours()).toBe(15);
  });
});

describe("MIN_MATCH_SIZE", () => {
  it("is 4", () => {
    expect(MIN_MATCH_SIZE).toBe(4);
  });
});
