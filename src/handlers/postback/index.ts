import type { PostbackEvent } from "@line/bot-sdk";
import { getLineClient } from "../../line/client.js";
import { upsertUser } from "../../services/user.js";
import { getGroupsByHost, getJoinedGroups } from "../../services/group.js";
import { buildMyGroupsCard, buildJoinedGroupsCard } from "../../line/flex/my-groups.js";
import {
  handleJoin,
  handleCancelGroup,
  handleLeave,
  handleApproveLeave,
  handleRejectLeave,
  handleManageMembers,
  handleKick,
} from "./group-actions.js";
import {
  handleSubMenu,
  handleSubLocation,
  handleSubKeyword,
  handleSubPrice,
  handleSubscribe,
  handleMySubscriptions,
  handleUnsub,
} from "./subscription-actions.js";
import {
  handleSearch,
  handleSearchLocation,
  handleSearchKeyword,
  handleCopyAllGroups,
} from "./search-actions.js";

export async function handlePostback(event: PostbackEvent): Promise<void> {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get("action");
  const userId = event.source.userId;
  if (!userId) return;

  const client = getLineClient();

  switch (action) {
    case "join":
      return handleJoin(event, data, client);
    case "cancel_group":
      return handleCancelGroup(event, data, client);
    case "leave":
      return handleLeave(event, data, client);
    case "approve_leave":
      return handleApproveLeave(event, data, client);
    case "reject_leave":
      return handleRejectLeave(event, data, client);
    case "manage_members":
      return handleManageMembers(event, data, client);
    case "kick":
      return handleKick(event, data, client);

    case "sub_menu":
      return handleSubMenu(event, client);
    case "sub_location":
      return handleSubLocation(event, client);
    case "sub_keyword":
      return handleSubKeyword(event, client);
    case "sub_price":
      return handleSubPrice(event, client);
    case "subscribe":
      return handleSubscribe(event, data, client);
    case "my_subscriptions":
      return handleMySubscriptions(event, client);
    case "unsub":
      return handleUnsub(event, data, client);

    case "search":
      return handleSearch(event, data, client);
    case "search_location":
      return handleSearchLocation(event, client);
    case "search_keyword":
      return handleSearchKeyword(event, client);
    case "copy_all_groups":
      return handleCopyAllGroups(event, client);

    case "my_groups": {
      const user = await upsertUser(userId);
      const [myGroups, joined] = await Promise.all([
        getGroupsByHost(user.id),
        getJoinedGroups(user.id),
      ]);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [buildMyGroupsCard(myGroups), buildJoinedGroupsCard(joined)],
      });
      break;
    }
  }
}
