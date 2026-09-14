# Lounge Spa（midnight-spa）

深夜經營的 SPA 會館官網 + LINE 會員卡系統。給進到這個 repo 的 Claude 看的專案筆記，省得每次重新摸索一次。

## 這是什麼

一個三頁式的 Vite + React 網站：

- **`/`** — 對外行銷首頁（品牌介紹、人員陣容、服務項目、FAQ），純靜態內容由 [src/content.json](src/content.json) 驅動，不接資料庫。
- **`/member`** — 會員卡系統，透過 **LINE LIFF** 登入，客人可以開卡、看會員 QR Code、送出預約請求。
- **`/admin`** — 店家後台，透過 **Supabase Auth（email/password）** 登入，管理會員資料、消費紀錄、預約確認、員工權限、掃碼核銷。

沒有自己的後端伺服器——所有資料庫邏輯都寫在 Supabase 裡（Postgres + RLS + SQL 函式），前端直接用 `@supabase/supabase-js` 呼叫。

## 技術棧

React 18 + TypeScript + Vite + TanStack Router（file-based routing，`src/routes/*.tsx` 對應到路徑）+ Tailwind CSS + Supabase（DB/Auth）+ LINE LIFF（會員登入）+ recharts（後台圖表）+ html5-qrcode（後台掃碼）+ qrcode.react（產生會員 QR Code）。

## 常用指令

```
npm run dev       # 本機開發，http://localhost:5173
npm run build     # 正式編譯，輸出到 dist/
npm run preview   # 預覽編譯結果
npm run lint      # eslint
```

## 專案結構

```
src/
  routes/
    __root.tsx   # 根路由，只負責 <HeadContent /> + <Outlet />
    index.tsx    # 首頁，讀 content.json 渲染，有明/暗主題切換
    member.tsx   # 會員頁（LIFF 登入 + 開卡 + 會員卡 + 預約）
    admin.tsx    # 後台（Supabase Auth 登入後的所有店家管理功能，2000+ 行單檔）
  lib/
    supabase.ts        # createClient，讀 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    preferenceOptions.tsx  # 開卡表單跟後台共用的「體驗偏好」選項清單（力道/加強部位/香氣/互動風格），兩邊共用同一份定義
    utils.ts     # cn()，clsx + tailwind-merge
    BrandMark.tsx  # 品牌 logo（<img src="/brand-mark.png">，不是手繪 SVG）
  content.json   # 首頁全部文案：人員陣容、服務項目、FAQ、公告跑馬燈等，改文案改這裡就好，不用碰 index.tsx
  routeTree.gen.ts  # TanStack Router 自動產生，git 不追蹤，跑 npm run dev/build 會自動重新產生
supabase/sql/    # 手動維護的 SQL migration（見下方「資料庫」）
scripts/         # PowerShell 小工具（產生佔位圖片等本機用途，跟部署無關）
```

路徑別名 `@/` 指向 `src/`（設定在 [vite.config.ts](vite.config.ts) 和 [tsconfig.json](tsconfig.json)）。`index.tsx` 有在用；`member.tsx`／`admin.tsx` 目前是用相對路徑 `../lib/...`，兩種寫法都碰得到，新增檔案時两種都能用，不用特地統一。

## 資料庫與安全性架構（很重要，改後台/會員功能前一定要懂這個）

**核心規則：前端永遠不直接對資料表做 insert / update / delete，一律呼叫 Supabase 的 SECURITY DEFINER RPC 函式。**

這個 repo 的 git 歷史踩過一次真的資安漏洞（`anon` 角色可以整表 SELECT 撈走所有會員真實姓名/電話/生日），修完之後就定下這條規矩，之後每一支新寫入邏輯都照這個模式做：

- 會員端（`/member`，用 `line_user_id` 當身分依據，因為沒有 Supabase Auth session）：
  `register_member`、`get_member_by_line_id`、`update_member_nickname`、`submit_booking_request`、`get_my_bookings`、`cancel_my_booking`
- 後台端（`/admin`，用 Supabase Auth session + `admin_users` 表的權限欄位 `can_view`/`can_edit_basic`/`can_edit_preferences`/`can_delete` 把關）：
  `admin_update_basic`、`admin_update_preferences`、`admin_delete_member`、`admin_add_session_log`、`admin_delete_session_log`、`admin_grant_access`、`admin_update_booking_status`、`admin_redeem_booking`
  （後台的**讀取**倒是直接 `supabase.from('members').select('*')` 這樣查，因為 RLS policy 已經把 `authenticated` 角色的讀取權限開給有 `can_view` 的帳號了——只有寫入才強制走 RPC）

每支函式內部都會再檢查一次身分／權限／欄位合法性，就算有人繞過前端 UI 直接打 API，也改不了別人的資料。加新功能時**照抄這個模式**，不要為了方便直接開放前端寫表。

Rate limit：開卡跟送預約請求都有伺服器端頻率限制（防機器人洗資料），門檻設得很寬鬆不影響正常客人，邏輯在 [supabase/sql/015_rate_limits.sql](supabase/sql/015_rate_limits.sql)。

### Migration 管理方式（沒有用 supabase CLI）

[supabase/sql/](supabase/sql/) 底下是照編號累加的純 SQL 檔（`001_...` 到 `015_...`），**每一份都是手動貼到 Supabase 後台的 SQL Editor 執行**，不是用 `supabase migration` 指令跑的，這個專案也沒有 `supabase/config.toml`。之後要改資料庫結構：

1. 新增一份 `0XX_描述.sql`（編號接續最後一個），檔案開頭寫清楚「這份在幹嘛」+「執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run」（照抄現有檔案的開頭格式）
2. 提醒使用者去 Supabase 後台手動執行，**我自己沒有 Supabase 的資料庫直接存取權**，不能替他跑這段
3. 不要去改舊的編號檔案，永遠用新檔案疊加變更（就算是修正舊的東西，也是新開一個 `0XX_fix_...sql`，這個 repo 目前的慣例就是這樣，例如 004 修正 001 的政策範圍、008 修正 007 的遞迴問題）

## 環境變數

`.env.local`（git 忽略，不會進版控）需要三個變數，程式碼裡實際用到的只有這三個：

```
VITE_LIFF_ID=...            # src/routes/member.tsx 用，LINE LIFF App ID
VITE_SUPABASE_URL=...       # src/lib/supabase.ts
VITE_SUPABASE_ANON_KEY=...  # src/lib/supabase.ts
```

這三個值也存在 Vercel 專案的 Environment Variables 裡，換一台電腦開發時可以用 `vercel link` + `vercel env pull .env.local` 拉下來，不用手動複製貼上。

## 部署

**Vercel 上目前只有一個在用的專案：`loungespa`**，跟這個 GitHub repo（`kellennnn/midnight-spa`）連動，push 到 `main` 會自動部署。

- 網站首頁：https://lounge-spa.vercel.app
- 會員頁：https://lounge-spa.vercel.app/member
- 後台：https://lounge-spa.vercel.app/admin

（曾經存在過第二個叫 `midnight-spa` 的 Vercel 專案，沒有連 git、是閒置的，已經刪除了，如果看到舊筆記提到它可以忽略。）

`vercel.json` 只有一條 SPA rewrite 規則（全部導回 `index.html`，交給 TanStack Router 處理路由），沒有其他特殊部署設定。

## 樣式慣例（目前混用兩套，不用特地統一）

- **`index.tsx`（首頁）**：用 Tailwind 語意化 token（`bg-background`、`text-primary`...），對應到 [src/index.css](src/index.css) 裡用 oklch 定義的 CSS 變數，有 `.light` class 切換明/暗主題（存在 `localStorage` 的 `midnight-spa-theme`）。
- **`member.tsx` / `admin.tsx`**：直接寫死深色系 hex 色碼（`#0a1420` 深藍底、`#d4af37` 香檳金），沒有明亮模式，也沒有用 `bg-primary` 這種語意化 class。

兩邊風格不一樣是因為做的時間點不同，不是誰寫錯了——加新功能時跟著該檔案原本的風格寫就好，不用跨檔案硬套同一套。

## 已知技術債 / 不用特地修的事

- `admin.tsx` 單檔 2200+ 行，build 時會跳出 chunk 超過 500KB 的警告（[vite.config.ts](vite.config.ts) 目前沒有特別 code-split 它）。除非使用者主動要求優化 bundle size，不用主動動手拆分。
- `node_modules` 裡偶爾會看到 `sharp` / `@img/*` 這類不在 `package.json` 裡的 extraneous 套件，跟專案程式碼無關，不用理會、不用刪。

## CLI 工具

這台電腦上 `gh`（GitHub CLI）和 `vercel` CLI 都已經裝好、登入過（帳號分別是 `kellennnn` / `kellenshen6639-8927`）。需要開 PR、查 Vercel 部署狀態/log、拉環境變數，都可以直接用這兩個工具，不用先問能不能用。

Supabase CLI 沒有裝，這個專案目前的工作流程也用不到它（見上方「Migration 管理方式」）。
