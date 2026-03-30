import { validateSignature } from "@line/bot-sdk";

export function verifySignature(body: string, signature: string, channelSecret: string): boolean {
  return validateSignature(body, channelSecret, signature);
}
