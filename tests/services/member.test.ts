import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db with transaction support
const mockTx = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
};

// Chain helpers - supports both .limit() and direct resolve (for count queries)
function chainSelect(rows: any[]) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  // .where() returns the chain (thenable as resolved rows for count queries, and has .limit for regular)
  const whereResult = Object.assign(Promise.resolve(rows), { limit: chain.limit });
  chain.where.mockReturnValue(whereResult);
  mockTx.select.mockReturnValue(chain);
  return chain;
}

function chainInsert() {
  const chain = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  mockTx.insert.mockReturnValue(chain);
  return chain;
}

function chainDelete() {
  const chain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  mockTx.delete.mockReturnValue(chain);
  return chain;
}

function chainUpdate() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  mockTx.update.mockReturnValue(chain);
  return chain;
}

vi.mock("../../src/db/client.js", () => ({
  db: {
    transaction: vi.fn(async (fn: any) => fn(mockTx)),
  },
}));

import { joinGroup, leaveGroup, kickMember } from "../../src/services/member.js";

describe("joinGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when group does not exist", async () => {
    chainSelect([]);
    const result = await joinGroup("group-1", "user-1");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns cancelled for cancelled group", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = { from: vi.fn().mockReturnThis(), where: vi.fn() };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              {
                id: "g1",
                status: "cancelled",
                hostId: "host-1",
                prefilledMembers: 1,
                maxMembers: 4,
              },
            ]),
        });
      }
      return chain;
    });

    const result = await joinGroup("g1", "user-1");
    expect(result).toEqual({ ok: false, reason: "cancelled" });
  });

  it("returns is_host when user is host", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = { from: vi.fn().mockReturnThis(), where: vi.fn() };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: "g1", status: "open", hostId: "user-1", prefilledMembers: 1, maxMembers: 4 },
            ]),
        });
      }
      return chain;
    });

    const result = await joinGroup("g1", "user-1");
    expect(result).toEqual({ ok: false, reason: "is_host" });
  });

  it("returns already_joined when user already a member", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = { from: vi.fn().mockReturnThis(), where: vi.fn() };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: "g1", status: "open", hostId: "host-1", prefilledMembers: 1, maxMembers: 4 },
            ]),
        });
      } else if (callCount === 2) {
        chain.where.mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "member-1" }]) });
      }
      return chain;
    });

    const result = await joinGroup("g1", "user-1");
    expect(result).toEqual({ ok: false, reason: "already_joined" });
  });

  it("returns full when group is at capacity", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn(),
        limit: vi.fn(),
      };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: "g1", status: "open", hostId: "host-1", prefilledMembers: 1, maxMembers: 4 },
            ]),
        });
      } else if (callCount === 2) {
        chain.where.mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      } else if (callCount === 3) {
        // count query: awaits .where() directly (no .limit())
        chain.where.mockReturnValue(Promise.resolve([{ count: 3 }]));
      }
      return chain;
    });

    const result = await joinGroup("g1", "user-1");
    expect(result).toEqual({ ok: false, reason: "full" });
  });

  it("successfully joins and marks full when reaching capacity", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn(),
        limit: vi.fn(),
      };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: "g1", status: "open", hostId: "host-1", prefilledMembers: 1, maxMembers: 3 },
            ]),
        });
      } else if (callCount === 2) {
        chain.where.mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      } else if (callCount === 3) {
        chain.where.mockReturnValue(Promise.resolve([{ count: 1 }]));
      }
      return chain;
    });
    chainInsert();
    chainUpdate();

    const result = await joinGroup("g1", "user-1");
    expect(result).toEqual({ ok: true, groupFull: true, groupId: "g1" });
    expect(mockTx.insert).toHaveBeenCalled();
    expect(mockTx.update).toHaveBeenCalled();
  });

  it("successfully joins without marking full", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn(),
        limit: vi.fn(),
      };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: "g1", status: "open", hostId: "host-1", prefilledMembers: 1, maxMembers: 6 },
            ]),
        });
      } else if (callCount === 2) {
        chain.where.mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      } else if (callCount === 3) {
        chain.where.mockReturnValue(Promise.resolve([{ count: 1 }]));
      }
      return chain;
    });
    chainInsert();

    const result = await joinGroup("g1", "user-1");
    expect(result).toEqual({ ok: true, groupFull: false, groupId: "g1" });
    expect(mockTx.insert).toHaveBeenCalled();
    expect(mockTx.update).not.toHaveBeenCalled();
  });
});

describe("leaveGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when group does not exist", async () => {
    chainSelect([]);
    const result = await leaveGroup("g1", "user-1");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns not_member when user is not a member", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = { from: vi.fn().mockReturnThis(), where: vi.fn() };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "g1", status: "open" }]),
        });
      } else {
        chain.where.mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
      }
      return chain;
    });

    const result = await leaveGroup("g1", "user-1");
    expect(result).toEqual({ ok: false, reason: "not_member" });
  });

  it("successfully leaves and reopens full group", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = { from: vi.fn().mockReturnThis(), where: vi.fn() };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "g1", status: "full" }]),
        });
      } else {
        chain.where.mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "member-1" }]) });
      }
      return chain;
    });
    chainDelete();
    chainUpdate();

    const result = await leaveGroup("g1", "user-1");
    expect(result).toEqual({ ok: true });
    expect(mockTx.delete).toHaveBeenCalled();
    expect(mockTx.update).toHaveBeenCalled();
  });
});

describe("kickMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_host when user is not the host", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = { from: vi.fn().mockReturnThis(), where: vi.fn() };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "g1", hostId: "host-1", status: "open" }]),
        });
      }
      return chain;
    });

    const result = await kickMember("g1", "member-1", "not-host");
    expect(result).toEqual({ ok: false, reason: "not_host" });
  });

  it("successfully kicks a member", async () => {
    let callCount = 0;
    mockTx.select.mockImplementation(() => {
      callCount++;
      const chain: any = { from: vi.fn().mockReturnThis(), where: vi.fn() };
      if (callCount === 1) {
        chain.where.mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "g1", hostId: "host-1", status: "open" }]),
        });
      } else {
        chain.where.mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "member-1" }]) });
      }
      return chain;
    });
    chainDelete();

    const result = await kickMember("g1", "member-1", "host-1");
    expect(result).toEqual({ ok: true });
    expect(mockTx.delete).toHaveBeenCalled();
  });
});
