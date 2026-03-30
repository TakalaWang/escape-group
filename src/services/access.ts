import { getLineClient } from "../line/client.js";

let memberCache: { ids: Set<string>; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function getGroupMemberIds(groupId: string): Promise<Set<string>> {
  if (memberCache && Date.now() < memberCache.expiresAt) {
    return memberCache.ids;
  }

  const client = getLineClient();
  const ids = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await client.getGroupMembersIds(groupId, continuationToken);
    for (const id of response.memberIds) {
      ids.add(id);
    }
    continuationToken = response.next ?? undefined;
  } while (continuationToken);

  memberCache = { ids, expiresAt: Date.now() + CACHE_TTL };
  return ids;
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const members = await getGroupMemberIds(groupId);
  return members.has(userId);
}
