import { describe, it, expect } from "vitest";
import { buildGroupCard } from "../../../src/line/flex/group-card.js";

describe("buildGroupCard", () => {
  const baseInput = {
    id: "test-group-id",
    roomName: "笑笑羊牧場",
    studio: "密室逃脫工作室",
    location: "taipei" as const,
    datetime: new Date("2026-04-05T14:00:00+08:00"),
    maxMembers: 6,
    currentMembers: 3,
    hostName: "小明",
  };

  it("returns a valid Flex Message object", () => {
    const card = buildGroupCard(baseInput);
    expect(card.type).toBe("flex");
    expect(card.altText).toContain("笑笑羊牧場");
  });

  it("shows remaining spots", () => {
    const card = buildGroupCard(baseInput);
    const json = JSON.stringify(card);
    expect(json).toContain("還差 3 人");
  });

  it("shows location label", () => {
    const card = buildGroupCard(baseInput);
    const json = JSON.stringify(card);
    expect(json).toContain("台北");
  });

  it("handles missing optional fields", () => {
    const card = buildGroupCard({
      ...baseInput,
      studio: null,
      location: null,
      datetime: null,
    });
    expect(card.type).toBe("flex");
  });
});
