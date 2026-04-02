# Consolidate Shared Code Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate duplicated code across Flex message builders and LIFF pages, making the codebase more maintainable.

**Architecture:** Extract shared constants (LOCATION_LABELS, colors), shared utilities (formatDate, buildProgressBar) into dedicated modules. Extract common LIFF CSS/JS into shared files referenced by both HTML pages. Fix the unused `buildLeaveRequestNotification` to actually be used.

**Tech Stack:** TypeScript, LINE Flex Messages, static HTML/CSS/JS

---

### Task 1: Extract shared Flex constants and utilities

**Files:**

- Create: `src/line/flex/shared.ts`
- Modify: `src/line/flex/group-card.ts`
- Modify: `src/line/flex/summary.ts`
- Modify: `src/line/flex/my-groups.ts`
- Modify: `src/line/flex/subscription-menu.ts`
- Modify: `src/line/flex/notifications.ts`

**Step 1: Create `src/line/flex/shared.ts`**

```typescript
import type { messagingApi } from "@line/bot-sdk";

export const LOCATION_LABELS: Record<string, string> = {
  keelung: "基隆",
  taipei: "台北",
  new_taipei: "新北",
  taoyuan: "桃園",
  hsinchu: "新竹",
  miaoli: "苗栗",
  taichung: "台中",
  changhua: "彰化",
  nantou: "南投",
  yunlin: "雲林",
  chiayi: "嘉義",
  tainan: "台南",
  kaohsiung: "高雄",
  pingtung: "屏東",
  yilan: "宜蘭",
  hualien: "花蓮",
  taitung: "台東",
  penghu: "澎湖",
  kinmen: "金門",
  matsu: "馬祖",
};

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "募集中", color: "#16A34A", bg: "#F0FDF4" },
  full: { label: "已額滿", color: "#2563EB", bg: "#EFF6FF" },
  completed: { label: "已完成", color: "#6B7280", bg: "#F3F4F6" },
  cancelled: { label: "已取消", color: "#DC2626", bg: "#FEF2F2" },
};

export function formatDate(date: Date): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = days[date.getDay()];
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${m}/${d}(${day}) ${h}:${min}`;
}

export function buildProgressBar(
  current: number,
  max: number,
  margin?: string
): messagingApi.FlexComponent {
  const filled = Math.min(current, max);
  const empty = max - filled;
  const boxes: messagingApi.FlexComponent[] = [];
  for (let i = 0; i < filled; i++) {
    boxes.push({
      type: "box",
      layout: "vertical",
      contents: [],
      flex: 1,
      height: "6px",
      backgroundColor: "#06C755",
      cornerRadius: "3px",
    });
  }
  for (let i = 0; i < empty; i++) {
    boxes.push({
      type: "box",
      layout: "vertical",
      contents: [],
      flex: 1,
      height: "6px",
      backgroundColor: "#E8E8E8",
      cornerRadius: "3px",
    });
  }
  return {
    type: "box",
    layout: "horizontal",
    contents: boxes,
    spacing: "xs",
    ...(margin ? { margin } : {}),
  };
}
```

**Step 2: Update `src/line/flex/group-card.ts`**

- Remove lines 3-24 (local LOCATION_LABELS) — re-export from shared
- Remove lines 41-49 (local formatDate)
- Remove lines 51-86 (local buildProgressBar)
- Add import: `import { LOCATION_LABELS, formatDate, buildProgressBar } from "./shared.js";`
- Keep the `export { LOCATION_LABELS }` re-export at bottom (app.ts imports it from here)
- Change `buildProgressBar(current, max)` call at line 165 to `buildProgressBar(current, max, "lg")`

**Step 3: Update `src/line/flex/summary.ts`**

- Remove lines 17-38 (local LOCATION_LABELS)
- Remove lines 40-48 (local formatDate)
- Add import: `import { LOCATION_LABELS, formatDate } from "./shared.js";`

**Step 4: Update `src/line/flex/my-groups.ts`**

- Remove lines 12-20 (local formatDate)
- Remove lines 22-27 (local STATUS_CONFIG)
- Add import: `import { formatDate, STATUS_CONFIG } from "./shared.js";`

**Step 5: Update `src/line/flex/subscription-menu.ts`**

- Remove lines 3-24 (local LOCATION_LABELS)
- Add import: `import { LOCATION_LABELS } from "./shared.js";`

**Step 6: Update `src/line/flex/notifications.ts`**

- Remove lines 3-30 (local buildProgressBar)
- Add import: `import { buildProgressBar } from "./shared.js";`
- Replace `(buildProgressBar(current, max) as any).contents` with `(buildProgressBar(current, max) as any).contents` (keep same — the shared version without margin matches the old behavior)

**Step 7: Verify**

Run: `pnpm check && pnpm test && pnpm format:check`
Expected: All pass

**Step 8: Commit**

```bash
git add src/line/flex/shared.ts src/line/flex/group-card.ts src/line/flex/summary.ts src/line/flex/my-groups.ts src/line/flex/subscription-menu.ts src/line/flex/notifications.ts
git commit -m "refactor: extract shared Flex constants and utilities"
```

---

### Task 2: Use `buildLeaveRequestNotification` in postback handler

**Files:**

- Modify: `src/line/flex/notifications.ts` — update to accept postback data params
- Modify: `src/handlers/postback.ts` — use the builder instead of inline Flex

**Step 1: Update `buildLeaveRequestNotification` in notifications.ts**

The current function has empty `data: ""` in button actions. Update it to accept the IDs needed:

```typescript
export function buildLeaveRequestNotification(
  memberName: string,
  groupName: string,
  groupId: string,
  memberDbId: string,
  memberLineUserId: string
): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `${memberName} 想退出「${groupName}」`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          { type: "text", text: `${memberName} 想退出`, size: "sm", weight: "bold" },
          { type: "text", text: `「${groupName}」`, size: "sm", color: "#888888", margin: "xs" },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        paddingAll: "12px",
        paddingTop: "0px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#06C755",
            height: "sm",
            action: {
              type: "postback",
              label: "同意 ✓",
              data: `action=approve_leave&groupId=${groupId}&userId=${memberDbId}`,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "拒絕 ✗",
              data: `action=reject_leave&groupId=${groupId}&memberId=${memberLineUserId}`,
            },
          },
        ],
      },
    },
  };
}
```

**Step 2: Update postback.ts `leave` case**

Replace the 60-line inline Flex at lines 160-223 with:

```typescript
import { buildLeaveRequestNotification } from "../line/flex/notifications.js";
// ... in case "leave":
if (host) {
  await client.pushMessage({
    to: host.lineUserId,
    messages: [
      buildLeaveRequestNotification(
        user.displayName,
        group.roomName,
        groupId,
        user.id,
        user.lineUserId
      ),
    ],
  });
}
```

**Step 3: Verify**

Run: `pnpm check && pnpm test && pnpm format:check`

**Step 4: Commit**

```bash
git add src/line/flex/notifications.ts src/handlers/postback.ts
git commit -m "refactor: use buildLeaveRequestNotification instead of inline Flex"
```

---

### Task 3: Extract shared LIFF CSS

**Files:**

- Create: `public/liff/shared/style.css`
- Modify: `public/liff/create-group/index.html`
- Modify: `public/liff/search/index.html`

**Step 1: Create `public/liff/shared/style.css`**

Extract the common CSS that both pages share:

```css
/* Reset */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang TC", sans-serif;
  background: #f5f6f8;
  color: #1a1a1a;
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0);
  overscroll-behavior: contain;
}

/* Section cards */
.section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #06c755;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

/* Loading */
.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e0e0e0;
  border-top-color: #06c755;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.loading-text {
  margin-top: 12px;
  font-size: 14px;
  color: #999;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Toast */
.toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: #1a1a1a;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  opacity: 0;
  transition: all 0.3s;
  z-index: 50;
  pointer-events: none;
}
.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Dark mode — shared */
@media (prefers-color-scheme: dark) {
  body {
    background: #1a1a1a;
    color: #e5e5e5;
  }
  .section {
    background: #2a2a2a;
    box-shadow: none;
  }
  .section-title {
    border-bottom-color: #333;
  }
  .loading-text {
    color: #666;
  }
  .toast {
    background: #e5e5e5;
    color: #1a1a1a;
  }
}
```

**Step 2: Update both HTML files**

Add `<link rel="stylesheet" href="../shared/style.css" />` in `<head>`, then remove the duplicated CSS blocks from each file. Keep only page-specific styles in the inline `<style>` tags.

For **create-group**: Keep header, form-group, label, input/select/textarea, submit-area, button, .error, .success-overlay styles. Remove the base/loading/animation/dark-mode-base rules.

For **search**: Keep header (dark gradient), filter/chip, date-row, price-row, result-card, join-btn, search-btn, clear-btn styles. Remove the base/loading/animation/dark-mode-base rules.

**Step 3: Verify both LIFF pages load correctly**

Run: `pnpm dev` and open both LIFF pages in browser to verify CSS loads.

**Step 4: Run format**

Run: `pnpm format && pnpm format:check`

**Step 5: Commit**

```bash
git add public/liff/shared/style.css public/liff/create-group/index.html public/liff/search/index.html
git commit -m "refactor: extract shared LIFF CSS into shared/style.css"
```

---

### Task 4: Extract shared LIFF JavaScript utilities

**Files:**

- Create: `public/liff/shared/utils.js`
- Modify: `public/liff/create-group/index.html`
- Modify: `public/liff/search/index.html`

**Step 1: Create `public/liff/shared/utils.js`**

```javascript
const API = "https://escape-group.vercel.app/api";
const DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const LOCATIONS = {
  北部: {
    keelung: "基隆",
    taipei: "台北",
    new_taipei: "新北",
    taoyuan: "桃園",
    hsinchu: "新竹",
    miaoli: "苗栗",
  },
  中部: { taichung: "台中", changhua: "彰化", nantou: "南投", yunlin: "雲林", chiayi: "嘉義" },
  南部: { tainan: "台南", kaohsiung: "高雄", pingtung: "屏東" },
  "東部+離島": {
    yilan: "宜蘭",
    hualien: "花蓮",
    taitung: "台東",
    penghu: "澎湖",
    kinmen: "金門",
    matsu: "馬祖",
  },
};
const ALL_LOC = Object.values(LOCATIONS).reduce((a, r) => ({ ...a, ...r }), {});

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}(${DAYS[dt.getDay()]}) ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

function esc(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2000);
}
```

**Step 2: Reference in both HTML files**

Add `<script src="../shared/utils.js"></script>` before each page's `<script>` block.

Remove from each page:

- `const API = ...`
- `const DAYS = ...` (search)
- `const LOCATIONS = ...` and `const ALL_LOC = ...` (search)
- `function fmtDate(...)` (search)
- `function esc(...)` (search)
- `function toast(...)` (search)

Create-group doesn't use all of these, but having them available doesn't hurt.

**Step 3: Verify**

Run: `pnpm dev`, test both LIFF pages.

**Step 4: Commit**

```bash
git add public/liff/shared/utils.js public/liff/create-group/index.html public/liff/search/index.html
git commit -m "refactor: extract shared LIFF JS utilities"
```
