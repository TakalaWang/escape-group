/**
 * Updates the Rich Menu to use postback actions for "我的團" and "訂閱".
 * Run: npx tsx scripts/update-richmenu.ts
 */

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN is required");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function main() {
  // 1. Get current rich menus
  const listRes = await fetch("https://api.line.me/v2/bot/richmenu/list", { headers });
  const { richmenus } = (await listRes.json()) as any;
  console.log(`Found ${richmenus.length} rich menus`);

  // 2. Get current default
  const defaultRes = await fetch("https://api.line.me/v2/bot/user/all/richmenu", { headers });
  const defaultMenu = defaultRes.ok ? ((await defaultRes.json()) as any).richMenuId : null;
  console.log(`Current default: ${defaultMenu || "none"}`);

  // 3. Find existing menu to get its image
  const existingMenu = richmenus[0];
  if (!existingMenu) {
    console.error("No existing rich menu found. Create one first.");
    process.exit(1);
  }

  // 4. Download existing image
  const imgRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${existingMenu.richMenuId}/content`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  console.log(`Downloaded image: ${imgBuffer.length} bytes`);

  // 5. Create new rich menu with postback actions
  const newMenu = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: "密室揪團選單 v2",
    chatBarText: "選單",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: {
          type: "uri",
          label: "開團",
          uri: "https://liff.line.me/2009659299-rbF8C1zz",
        },
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: {
          type: "uri",
          label: "找團",
          uri: "https://liff.line.me/2009659299-kwXd0ja5",
        },
      },
      {
        bounds: { x: 0, y: 843, width: 1250, height: 843 },
        action: {
          type: "postback",
          label: "我的團",
          data: "action=my_groups",
        },
      },
      {
        bounds: { x: 1250, y: 843, width: 1250, height: 843 },
        action: {
          type: "postback",
          label: "訂閱",
          data: "action=sub_menu",
        },
      },
    ],
  };

  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers,
    body: JSON.stringify(newMenu),
  });
  const { richMenuId } = (await createRes.json()) as any;
  console.log(`Created new rich menu: ${richMenuId}`);

  // 6. Upload image to new menu
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "image/png",
      },
      body: imgBuffer,
    }
  );
  console.log(`Image upload: ${uploadRes.status}`);

  // 7. Set as default
  const setDefaultRes = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
    { method: "POST", headers }
  );
  console.log(`Set default: ${setDefaultRes.status}`);

  // 8. Delete old menu
  if (existingMenu.richMenuId !== richMenuId) {
    const deleteRes = await fetch(
      `https://api.line.me/v2/bot/richmenu/${existingMenu.richMenuId}`,
      { method: "DELETE", headers }
    );
    console.log(`Deleted old menu: ${deleteRes.status}`);
  }

  console.log("Done! Rich menu updated.");
}

main().catch(console.error);
