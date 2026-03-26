import { redirect, fail } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, escapeRooms, groupMembers } from "@escape-group/db/schema";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, "/auth/facebook");
  if (!locals.user.phone) redirect(302, "/verify-phone");
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) redirect(302, "/auth/facebook");
    if (!locals.user.phone) return fail(403, { error: "請先完成手機驗證" });

    const formData = await request.formData();
    const mode = formData.get("mode") as string;
    const roomName = formData.get("roomName") as string;
    const roomStudio = formData.get("roomStudio") as string;
    const roomUrl = formData.get("roomUrl") as string;
    const roomLocation = formData.get("roomLocation") as string;
    const minPlayers = Number(formData.get("minPlayers")) || null;
    const maxPlayers = Number(formData.get("maxPlayers")) || null;
    const datetime = formData.get("datetime") as string;
    const maxMembers = Number(formData.get("maxMembers"));
    const minCredit = Number(formData.get("minCredit")) || 0;
    const autoAccept = formData.get("autoAccept") === "on";

    if (!mode || !["host", "match", "gather"].includes(mode)) {
      return fail(400, { error: "請選擇開團模式" });
    }
    if (!maxMembers || maxMembers < 2) {
      return fail(400, { error: "人數至少 2 人" });
    }

    // Create escape room if name provided
    let escapeRoomId: string | null = null;
    if (roomName) {
      const [room] = await db
        .insert(escapeRooms)
        .values({
          name: roomName,
          studio: roomStudio || null,
          url: roomUrl || null,
          location: roomLocation || null,
          minPlayers,
          maxPlayers,
          createdBy: locals.user.id,
        })
        .returning({ id: escapeRooms.id });
      escapeRoomId = room.id;
    }

    const [group] = await db
      .insert(groups)
      .values({
        mode: mode as "host" | "match" | "gather",
        escapeRoomId,
        hostId: locals.user.id,
        datetime: datetime ? new Date(datetime) : null,
        maxMembers,
        minCredit,
        autoAccept,
      })
      .returning();

    // Auto-add host as member
    await db.insert(groupMembers).values({
      groupId: group.id,
      userId: locals.user.id,
      status: "accepted",
    });

    redirect(303, `/groups/${group.id}`);
  },
};
