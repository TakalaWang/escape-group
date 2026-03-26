// In-memory verification code store for MVP
// TODO: Replace with Twilio SMS in production
const pendingCodes = new Map<string, { code: string; userId: string; expiresAt: number }>();

export function generateVerificationCode(userId: string, phone: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
  pendingCodes.set(phone, {
    code,
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  // In production, send SMS via Twilio here
  console.log(`[DEV] Verification code for ${phone}: ${code}`);
  return code;
}

export function verifyCode(
  phone: string,
  code: string,
  userId: string
): { success: boolean; error?: string } {
  const pending = pendingCodes.get(phone);
  if (!pending) return { success: false, error: "No pending verification" };
  if (pending.userId !== userId) return { success: false, error: "User mismatch" };
  if (pending.expiresAt < Date.now()) {
    pendingCodes.delete(phone);
    return { success: false, error: "Code expired" };
  }
  if (pending.code !== code) return { success: false, error: "Invalid code" };

  pendingCodes.delete(phone);
  return { success: true };
}
