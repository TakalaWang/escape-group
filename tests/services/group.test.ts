import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/db/client.js", () => ({ db: {} }));

import { validateCreateGroupInput } from "../../src/services/group.js";

describe("validateCreateGroupInput", () => {
  it("accepts valid input", () => {
    const result = validateCreateGroupInput({
      roomName: "笑笑羊牧場",
      studio: "密室逃脫工作室",
      location: "taipei",
      datetime: "2026-04-05T14:00:00+08:00",
      maxMembers: 6,
      prefilledMembers: 1,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing roomName", () => {
    const result = validateCreateGroupInput({
      roomName: "",
      maxMembers: 6,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects maxMembers < 2", () => {
    const result = validateCreateGroupInput({
      roomName: "test",
      maxMembers: 1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects prefilledMembers >= maxMembers", () => {
    const result = validateCreateGroupInput({
      roomName: "test",
      maxMembers: 4,
      prefilledMembers: 4,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts input without optional fields", () => {
    const result = validateCreateGroupInput({
      roomName: "test room",
      maxMembers: 6,
    });
    expect(result.ok).toBe(true);
  });
});
