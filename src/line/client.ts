import { messagingApi } from "@line/bot-sdk";

let _client: messagingApi.MessagingApiClient | null = null;

export function getLineClient(): messagingApi.MessagingApiClient {
  if (!_client) {
    _client = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    });
  }
  return _client;
}

let _botBasicId: string | null = null;

export async function getBotBasicId(): Promise<string> {
  if (!_botBasicId) {
    const client = getLineClient();
    const info = await client.getBotInfo();
    _botBasicId = info.basicId;
  }
  return _botBasicId;
}
