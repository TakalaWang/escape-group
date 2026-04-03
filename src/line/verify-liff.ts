interface VerifyResponse {
  scope: string;
  client_id: string;
  expires_in: number;
}

interface ErrorResponse {
  error: string;
  error_description: string;
}

export async function verifyLiffToken(accessToken: string): Promise<string | null> {
  const res = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) return null;

  const data = (await res.json()) as VerifyResponse | ErrorResponse;
  if ("error" in data) return null;
  if (data.expires_in <= 0) return null;

  // Get user profile with the access token
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) return null;

  const profile = (await profileRes.json()) as { userId: string };
  return profile.userId;
}
