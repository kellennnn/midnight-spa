# Lounge Spa（midnight-spa）

深夜經營的 SPA 會館官網 + LINE 會員卡系統。給進到這個 repo 的 Claude 看的專案筆記，省得每次重新摸索一次。

## 這是什麼

一個三頁式的 Vite + React 網站：

- **`/`** — 對外行銷首頁（品牌介紹、人員陣容、服務項目、FAQ），文案由 [src/content.json](src/content.json) 驅動；**人員資料**跟**今天誰上班**則是從資料庫讀（見下方「人員與班表」）。
- **`/member`** — 會員卡系統，透過 **LINE LIFF** 登入，客人可以開卡、看會員 QR Code、送出預約請求。
- **`/admin`** — 店家後台，透過 **Supabase Auth（email/password）** 登入，管理會員資料、消費紀錄、預約確認、班表、人員、員工權限、掃碼核銷。

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
    schedule.ts        # 班表 / 預約時段的時間計算（跨夜班、營業日、可預約時段），首頁、會員頁、後台共用
    therapists.ts      # 人員資料讀取（useTherapists），讀不到資料庫時退回 content.json；首頁、會員頁、後台共用
    ScheduleManager.tsx  # 後台「班表管理」分頁（一週一張表排班），admin.tsx 引用
    TherapistManager.tsx # 後台「人員管理」分頁（新增 / 編輯 / 上傳照片 / 排序 / 上下架），admin.tsx 引用
    utils.ts     # cn()，clsx + tailwind-merge
    BrandMark.tsx  # 品牌 logo（<img src="/brand-mark.png">，不是手繪 SVG）
  content.json   # 首頁文案：服務項目、FAQ、公告跑馬燈等，改文案改這裡就好，不用碰 index.tsx（人員資料已搬到資料庫，這裡的 therapists 只剩備援用途）
  routeTree.gen.ts  # TanStack Router 自動產生，git 不追蹤，跑 npm run dev/build 會自動重新產生
supabase/sql/    # 手動維護的 SQL migration（見下方「資料庫」）
scripts/         # PowerShell 小工具（產生佔位圖片等本機用途，跟部署無關）
```

路徑別名 `@/` 指向 `src/`（設定在 [vite.config.ts](vite.config.ts) 和 [tsconfig.json](tsconfig.json)）。`index.tsx` 有在用；`member.tsx`／`admin.tsx` 目前是用相對路徑 `../lib/...`，兩種寫法都碰得到，新增檔案時两種都能用，不用特地統一。

## 資料庫與安全性架構（很重要，改後台/會員功能前一定要懂這個）

**核心規則：前端永遠不直接對資料表做 insert / update / delete，一律呼叫 Supabase 的 SECURITY DEFINER RPC 函式。**

這個 repo 的 git 歷史踩過一次真的資安漏洞（`anon` 角色可以整表 SELECT 撈走所有會員真實姓名/電話/生日），修完之後就定下這條規矩，之後每一支新寫入邏輯都照這個模式做：

- 會員端（`/member`，用 `line_user_id` 當身分依據，因為沒有 Supabase Auth session）：
  `register_member`、`get_member_by_line_id`、`update_member_nickname`、`submit_booking_request`、`get_my_bookings`、`cancel_my_booking`、`get_public_schedule`、`get_busy_slots`、`get_public_therapists`
- 後台端（`/admin`，用 Supabase Auth session + `admin_users` 表的權限欄位 `can_view`/`can_edit_basic`/`can_edit_preferences`/`can_delete`/`can_edit_schedule`/`can_edit_therapists` 把關）：
  `admin_update_basic`、`admin_update_preferences`、`admin_delete_member`、`admin_add_session_log`、`admin_delete_session_log`、`admin_grant_access`、`admin_update_booking_status`、`admin_redeem_booking`、`admin_upsert_shifts`、`admin_delete_shifts`、`admin_copy_week`、`admin_list_therapists`、`admin_upsert_therapist`、`admin_reorder_therapists`
  （後台的**讀取**倒是直接 `supabase.from('members').select('*')` 這樣查，因為 RLS policy 已經把 `authenticated` 角色的讀取權限開給有 `can_view` 的帳號了——只有寫入才強制走 RPC）

每支函式內部都會再檢查一次身分／權限／欄位合法性，就算有人繞過前端 UI 直接打 API，也改不了別人的資料。加新功能時**照抄這個模式**，不要為了方便直接開放前端寫表。

唯一的例外是人員照片：後台直接用 `supabase.storage` 上傳到公開 bucket `therapist-photos`（Storage 沒辦法走 RPC），權限一樣由伺服器端 `storage.objects` 的 RLS policy 把關（只有 owner / `can_edit_therapists` 能寫），見 017。

Rate limit：開卡跟送預約請求都有伺服器端頻率限制（防機器人洗資料），門檻設得很寬鬆不影響正常客人，邏輯在 [supabase/sql/015_rate_limits.sql](supabase/sql/015_rate_limits.sql)。

### 人員與班表（[016_therapist_schedule.sql](supabase/sql/016_therapist_schedule.sql)、[017_therapists.sql](supabase/sql/017_therapists.sql)）

- 人員資料（編號、名字、標籤、自訂文字、照片、預設時段、排序、上下架）存在 `therapists` 表，在後台「人員管理」編輯，馬上生效。人員不刪除，只「下架」（`active = false`），舊預約還對得到人。
- 班表存在 `therapist_shifts`（一位人員一天一筆，沒資料 = 休假），在後台「班表管理」排。
- **全部用固定代號 `therapist_id`（`t01`、`t02`…）對應**，新增人員時資料庫自動編下一號。老闆會常改名字跟編號，所以名字 / 編號可以隨便改，id 不會變。預約表的 `therapist_id` 也是存這個，撞單檢查一律用 id，`therapist_preference` 只是送出當下的名字（顯示用）。
- `content.json` 的 `therapists` 只剩備援：資料庫讀不到時（例如 SQL 還沒跑）才會用，不會跟著後台的修改更新。
- 時間規則（SQL 跟 [src/lib/schedule.ts](src/lib/schedule.ts) 要一致）：台灣時間牆上時間；結束 <= 開始 = 跨夜班，算在開始那天；每筆預約固定佔 60 分鐘（`booking_block_minutes()` / `BOOKING_BLOCK_MINUTES`）；營業日以凌晨 5 點為界；跨夜的班算晚班、當天下班的算早班。
- 會員送預約時伺服器端檢查：有排班、沒被**已確認**的預約佔掉（待確認的不佔位）；後台按「確認」時再檢查一次撞單。
- 首頁讀不到班表、或今天完全沒人排班時，改用每個人的預設時段當今天的班，網站不會變成全部休假。

### Migration 管理方式（沒有用 supabase CLI）

[supabase/sql/](supabase/sql/) 底下是照編號累加的純 SQL 檔（`001_...` 到 `017_...`），**每一份都是手動貼到 Supabase 後台的 SQL Editor 執行**，不是用 `supabase migration` 指令跑的，這個專案也沒有 `supabase/config.toml`。之後要改資料庫結構：

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
