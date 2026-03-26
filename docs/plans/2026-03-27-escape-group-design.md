# 密室揪團平台 — escape-group

## 產品定位

解決密室逃脫揪人、防跳車問題的開團平台。

## 核心功能（MVP）

### 身份驗證

- Facebook OAuth 登入
- SMS 手機號碼驗證（雙重綁定）
- 綁定完成後才能開團 / 報名

### 開團模式

1. **團主制** — 指定密室、時間、人數，其他人報名加入
2. **配對制** — 填入想玩的密室 + 可接受時間，系統自動配對
3. **先湊人再選** — 先成團，再投票決定密室和時間

### 防跳車機制

- 信用分數制（新用戶起始 100 分）
- 正常出席 +2 / 跳車 -20 / 被檢舉 -10（需多人檢舉觸發）
- 團主可設定最低信用門檻
- 低於門檻全站警示標記

### 黑名單

- 社群等級黑名單
- 多人檢舉跳車自動降低信用

### 密室資料

- 團主開團時手動填入（名稱、工作室、連結、地點、人數範圍）
- 不串接第三方網站資料

## 使用者流程

### 註冊 / 登入

1. FB OAuth 登入
2. 首次登入綁定手機號碼（SMS 驗證碼）
3. 完成後解鎖開團 / 報名功能

### 團主開團

1. 選擇模式（團主制 / 配對制 / 先湊人再選）
2. 團主制：填入密室資訊、時間、地點、需要人數、最低信用門檻 → 發布
3. 配對制：填入想玩的密室 + 可接受時間範圍 → 系統配對
4. 先湊人再選：設定人數 + 時間範圍 → 人到齊後投票選密室

### 報名

1. 瀏覽公開團列表（可篩選地區、時間）
2. 報名 → 團主可設定自動接受或需審核
3. 人滿自動截止

### 活動結束後

1. 團主確認出席狀態（到場 / 跳車 / 請假）
2. 跳車 → 扣信用分數，成員可額外檢舉
3. 正常出席 → 信用分數加分

## 技術架構

### 技術棧

- **框架**：SvelteKit（monorepo）
- **資料庫**：PostgreSQL
- **ORM**：Drizzle
- **認證**：Facebook OAuth 2.0 + SMS（Twilio 或類似服務）
- **部署**：Vercel 或 Cloudflare Pages

### Monorepo 結構

```
apps/
  web/            → SvelteKit 主應用（前端 + API routes）
packages/
  db/             → Drizzle schema、migrations
  shared/         → 共用型別、工具函式
```

### 資料模型

```
users
  - id
  - fb_id
  - phone
  - display_name
  - credit_score    (default: 100)
  - is_flagged      (信用過低警示)
  - created_at

escape_rooms
  - id
  - name            (密室名稱)
  - studio          (工作室名稱)
  - url             (外部連結)
  - location        (地點 / 地區)
  - min_players
  - max_players
  - created_by      (填入者)

groups
  - id
  - mode            ('host' | 'match' | 'gather')
  - escape_room_id  (nullable, 先湊人模式可為空)
  - host_id
  - datetime        (活動時間)
  - time_range_start (配對/湊人模式用)
  - time_range_end
  - max_members
  - min_credit      (最低信用門檻)
  - auto_accept     (自動接受報名)
  - status          ('open' | 'full' | 'confirmed' | 'completed' | 'cancelled')
  - created_at

group_members
  - id
  - group_id
  - user_id
  - status          ('pending' | 'accepted' | 'attended' | 'no_show' | 'excused')
  - joined_at

reports
  - id
  - reporter_id
  - reported_user_id
  - group_id
  - reason
  - created_at
```

## MVP 不做的功能

- 金流 / 押金制
- 站內聊天（先導流到 LINE）
- 自建密室資料庫 / 爬蟲
- 劇本殺等其他類型（未來擴充）
