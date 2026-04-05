// Verify LIFF access token by fetching user profile.
// /v2/profile returns 401 for invalid/expired tokens, so a separate verify call is unnecessary.
export async function verifyLiffToken(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const profile = (await res.json()) as { userId: string };
  return profile.userId;
}
