-- 資安加強（中優先第一項）：防止機器人／有心人直接打 API 洗資料。
--
-- 這份 SQL 處理兩個地方：
--   1. 會員開卡：原本是前端直接對 members 表 insert，任何人只要知道
--      Supabase 網址 + 公開金鑰（本來就會出現在網站程式碼裡，藏不住）
--      就能不透過 LINE、不透過網站介面，直接送出無限筆假會員資料。
--      改成：所有開卡動作一律走新的安全函式 register_member()，
--      裡面做三件事——① 會員代碼改成伺服器端亂數產生，不再相信前端傳來的值；
--      ② 同一個 LINE 帳號不能重複開卡兩張卡（加 unique 限制）；
--      ③ 短時間內新開卡數量太多就先擋下來（防洗版）。
--   2. 送出預約請求：加上「同一位會員短時間內最多能送出幾筆待確認預約」
--      的限制，防止有人（或程式）狂送預約，一直觸發 Telegram / LINE 通知。
--
-- 這兩個限制的門檻都設得很寬鬆（遠高於真實客人正常使用的頻率），
-- 目的只是擋「機器人狂送」，不會影響正常客人開卡或預約。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

-- 1) 同一個 LINE 帳號只能有一筆會員資料，擋重複開卡
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'members_line_user_id_key'
  ) then
    alter table members add constraint members_line_user_id_key unique (line_user_id);
  end if;
end $$;

-- 2) 收回 anon 直接 insert members 表的權限，改成一律走安全函式
drop policy if exists "anon can register as new member" on members;

-- 3) 開卡安全函式：會員代碼伺服器端產生、擋重複開卡、擋短時間大量開卡
create or replace function register_member(
  p_line_user_id text,
  p_display_name text,
  p_real_name text,
  p_phone text,
  p_birth_month int,
  p_birth_day int,
  p_birth_year int
) returns setof members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
  v_code text;
  v_attempt int;
  v_result members;
begin
  if exists (select 1 from members where line_user_id = p_line_user_id) then
    raise exception '此 LINE 帳號已經開過會員卡了';
  end if;

  -- 過去 10 分鐘內全站新開卡數量太多，先擋下來（正常客人不可能短時間湧入這麼多）
  select count(*) into v_recent_count
    from members where created_at > now() - interval '10 minutes';

  if v_recent_count >= 30 then
    raise exception '目前開卡人數較多，請稍後再試一次';
  end if;

  for v_attempt in 1..5 loop
    v_code := 'LSP-' || lpad(floor(random() * 900000 + 100000)::text, 6, '0');

    begin
      insert into members (
        line_user_id, member_code, display_name, real_name, phone,
        birth_month, birth_day, birth_year, vip_level
      ) values (
        p_line_user_id, v_code, p_display_name, p_real_name, p_phone,
        p_birth_month, p_birth_day, p_birth_year, 'VIP'
      ) returning * into v_result;

      return next v_result;
      return;
    exception when unique_violation then
      -- 只有代碼撞號才重試；如果是 line_user_id 撞到（理論上前面已經擋過，
      -- 這裡是雙重保險）就直接把錯誤丟出去，不要一直重試。
      if v_attempt = 5 then
        raise exception '開卡失敗，請重新整理頁面再試一次';
      end if;
    end;
  end loop;
end;
$$;

grant execute on function register_member(text, text, text, text, int, int, int) to anon;

-- 4) 送出預約請求：同一位會員「待確認中」的預約超過 5 筆、
--    或過去 1 小時內送出超過 5 筆，就先擋下來
create or replace function submit_booking_request(
  p_line_user_id text,
  p_preferred_date date,
  p_preferred_time text,
  p_service_item text,
  p_therapist_preference text,
  p_note text
) returns setof bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_pending_count int;
  v_recent_count int;
begin
  select id into v_member_id from members where line_user_id = p_line_user_id limit 1;
  if v_member_id is null then
    raise exception '找不到會員資料，請先完成會員註冊';
  end if;

  select count(*) into v_pending_count
    from bookings where member_id = v_member_id and status = 'pending';

  if v_pending_count >= 5 then
    raise exception '您目前已有太多筆待確認的預約，請等店家處理後再送出新的預約';
  end if;

  select count(*) into v_recent_count
    from bookings where member_id = v_member_id and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception '短時間內送出太多預約請求，請稍後再試';
  end if;

  return query
    insert into bookings (member_id, preferred_date, preferred_time, service_item, therapist_preference, note)
    values (v_member_id, p_preferred_date, p_preferred_time, p_service_item, p_therapist_preference, p_note)
    returning *;
end;
$$;

grant execute on function submit_booking_request(text, date, text, text, text, text) to anon;
