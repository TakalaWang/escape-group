import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user
      ? {
          id: locals.user.id,
          displayName: locals.user.displayName,
          avatarUrl: locals.user.avatarUrl,
          creditScore: locals.user.creditScore,
          phone: locals.user.phone,
          isFlagged: locals.user.isFlagged,
        }
      : null,
  };
};
