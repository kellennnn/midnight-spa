-- 班表搬進資料庫：每天誰上班、幾點到幾點，改在後台「班表管理」排，
-- 不用再手動改 content.json。這份 SQL 做四件事：
--
--   1. 新增 therapist_shifts 班表表：一位人員一天一筆（沒有資料 = 那天休假）。
--      人員本身的名字、編號、照片、標籤、介紹還是寫在 content.json，這裡只用
--      每位人員固定不變的代號 therapist_id（content.json 裡的 "id"，例如 "t01"）
--      對應。名字、編號以後怎麼改都沒關係，只有 id 不能改、不能重複。
--      預約表也多一欄 therapist_id，撞單檢查一律用 id 比對；
--      原本的 therapist_preference 繼續存「送出當下的名字」，給後台跟通知顯示用。
--   2. 公開讀取函式：首頁（今天誰上班）跟會員頁（預約時可以選哪些人、哪些時段）
--      用的。只回傳班表跟「已確認預約佔掉的時段」，不含任何會員資料。
--   3. 會員送出預約時，伺服器端檢查：指定的人員那個時段有排班、而且沒有被
--      其他已確認的預約佔掉；不指定人員的話，至少要有一位人員有空。
--      後台按「確認」時也會再檢查一次同一位人員有沒有撞單。
--      送出預約的函式因此多一個 p_therapist_id 參數；舊版（6 個參數）保留成
--      「請重新整理頁面」的提示，避免有人開著舊網頁送出沒檢查過的預約。
--   4. 員工權限多一個「編輯班表」（can_edit_schedule），owner 可以只開這一項
--      給排班的小幫手，不用連會員資料都給。
--
-- 時間規則：
--   - 全部用台灣時間（Asia/Taipei）。
--   - 跨夜班：結束時間 <= 開始時間代表做到隔天，例如 18:00 - 04:00
--     是當天 18:00 做到隔天凌晨 4:00，這筆班表算在「開始那天」。
--   - 每筆預約固定佔 60 分鐘（50 分鐘療程 + 10 分鐘整理）。要改長度的話，
--     下面 booking_block_minutes() 跟前端 src/lib/schedule.ts 的
--     BOOKING_BLOCK_MINUTES 要一起改。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

-- 1) 班表表
create table if not exists therapist_shifts (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  updated_at timestamptz not null default now(),
  constraint therapist_shifts_therapist_date_key unique (therapist_id, shift_date),
  constraint therapist_shifts_not_zero_length check (start_time <> end_time)
);

create index if not exists therapist_shifts_date_idx on therapist_shifts (shift_date);

-- 預約記下是哪一位人員（固定代號），舊的預約這欄會是空的，不影響
alter table bookings
  add column if not exists therapist_id text;

create index if not exists bookings_therapist_id_date_idx on bookings (therapist_id, preferred_date);

-- 開了 RLS 但不給任何直接讀寫的政策：讀取走下面的公開函式，寫入走後台安全函式
alter table therapist_shifts enable row level security;

-- 2) 共用小工具

create or replace function booking_block_minutes()
returns int
language sql
immutable
as $$
  select 60;
$$;

-- 一筆班表換算成實際的開始 / 結束時間點（跨夜班的結束時間加一天）
create or replace function shift_start_at(s therapist_shifts)
returns timestamp
language sql
immutable
as $$
  select s.shift_date + s.start_time;
$$;

create or replace function shift_end_at(s therapist_shifts)
returns timestamp
language sql
immutable
as $$
  select s.shift_date + s.end_time
    + case when s.end_time <= s.start_time then interval '1 day' else interval '0' end;
$$;

-- 指定人員在某個時間點開始的 60 分鐘內，有沒有排班 + 沒被已確認的預約佔掉
-- （p_ignore_booking_id：後台確認某筆預約時，要排除那筆預約自己）
create or replace function therapist_is_free(
  p_therapist_id text,
  p_start timestamp,
  p_ignore_booking_id uuid default null
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from therapist_shifts s
      where s.therapist_id = p_therapist_id
        and s.shift_date between (p_start::date - 1) and p_start::date
        and shift_start_at(s) <= p_start
        and p_start + make_interval(mins => booking_block_minutes()) <= shift_end_at(s)
    )
    and not exists (
      select 1 from bookings b
      where b.therapist_id = p_therapist_id
        and b.status = 'confirmed'
        and b.preferred_time is not null
        and (p_ignore_booking_id is null or b.id <> p_ignore_booking_id)
        and b.preferred_date between (p_start::date - 1) and (p_start::date + 1)
        and (b.preferred_date + b.preferred_time::time) < p_start + make_interval(mins => booking_block_minutes())
        and p_start < (b.preferred_date + b.preferred_time::time) + make_interval(mins => booking_block_minutes())
    );
$$;

-- 3) 公開讀取（首頁、會員頁用，anon 可呼叫）

create or replace function get_public_schedule(p_from date, p_to date)
returns table (
  therapist_id text,
  shift_date date,
  start_time time,
  end_time time
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_to < p_from or p_to - p_from > 62 then
    raise exception '查詢的日期範圍不合法';
  end if;

  return query
    select s.therapist_id, s.shift_date, s.start_time, s.end_time
    from therapist_shifts s
    where s.shift_date between p_from and p_to
    order by s.shift_date, s.start_time;
end;
$$;

grant execute on function get_public_schedule(date, date) to anon, authenticated;

-- 已確認預約佔掉的時段：只回傳人員代號跟時間，不含會員是誰
create or replace function get_busy_slots(p_from date, p_to date)
returns table (
  therapist_id text,
  preferred_date date,
  preferred_time text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_to < p_from or p_to - p_from > 62 then
    raise exception '查詢的日期範圍不合法';
  end if;

  return query
    select b.therapist_id, b.preferred_date, b.preferred_time
    from bookings b
    where b.status = 'confirmed'
      and b.therapist_id is not null
      and b.preferred_time is not null
      and b.preferred_date between p_from and p_to;
end;
$$;

grant execute on function get_busy_slots(date, date) to anon, authenticated;

-- 4) 員工權限：編輯班表

alter table admin_users
  add column if not exists can_edit_schedule boolean not null default false;

create or replace function is_schedule_editor(check_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_users
    where id = check_id and (role = 'owner' or can_edit_schedule)
  );
$$;

-- 授權函式多一個 p_can_edit_schedule 參數。參數數量不同在 Postgres 算是
-- 另一支函式，所以要先把舊的 5 個參數版本拿掉，不然前端呼叫會分不清楚。
drop function if exists admin_grant_access(text, boolean, boolean, boolean, boolean);

create or replace function admin_grant_access(
  p_email text,
  p_can_view boolean default true,
  p_can_edit_basic boolean default false,
  p_can_edit_preferences boolean default false,
  p_can_delete boolean default false,
  p_can_edit_schedule boolean default false
) returns setof admin_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
begin
  if not is_owner_user() then
    raise exception '只有 owner 能授權其他人';
  end if;

  select id into v_target_id from auth.users where email = p_email;

  if v_target_id is null then
    raise exception '找不到這個 email 的登入帳號，請先去 Supabase 後台 Authentication -> Users 建立這個人的帳號';
  end if;

  insert into admin_users (id, email, role, can_view, can_edit_basic, can_edit_preferences, can_delete, can_edit_schedule)
  values (v_target_id, p_email, 'staff', p_can_view, p_can_edit_basic, p_can_edit_preferences, p_can_delete, p_can_edit_schedule)
  on conflict (id) do update set
    email = excluded.email,
    can_view = excluded.can_view,
    can_edit_basic = excluded.can_edit_basic,
    can_edit_preferences = excluded.can_edit_preferences,
    can_delete = excluded.can_delete,
    can_edit_schedule = excluded.can_edit_schedule;

  return query select * from admin_users where id = v_target_id;
end;
$$;

grant execute on function admin_grant_access(text, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- 5) 後台排班安全函式（owner 或有 can_edit_schedule 的員工）

-- 一次新增 / 更新多筆班表。p_shifts 是陣列，每筆長這樣：
-- {"therapist_id": "t01", "shift_date": "2026-11-25", "start_time": "14:00", "end_time": "02:00"}
create or replace function admin_upsert_shifts(p_shifts jsonb)
returns setof therapist_shifts
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_schedule_editor() then
    raise exception '沒有編輯班表的權限';
  end if;

  if jsonb_typeof(p_shifts) <> 'array' or jsonb_array_length(p_shifts) > 500 then
    raise exception '班表資料格式不正確';
  end if;

  return query
    insert into therapist_shifts (therapist_id, shift_date, start_time, end_time)
    select
      x->>'therapist_id',
      (x->>'shift_date')::date,
      (x->>'start_time')::time,
      (x->>'end_time')::time
    from jsonb_array_elements(p_shifts) as x
    on conflict (therapist_id, shift_date) do update set
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      updated_at = now()
    returning *;
end;
$$;

grant execute on function admin_upsert_shifts(jsonb) to authenticated;

-- 刪除班表（= 設成休假）。p_therapist_id 給 null 代表這段日期內所有人
create or replace function admin_delete_shifts(
  p_therapist_id text,
  p_from date,
  p_to date
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_schedule_editor() then
    raise exception '沒有編輯班表的權限';
  end if;

  if p_to < p_from or p_to - p_from > 62 then
    raise exception '日期範圍不合法';
  end if;

  delete from therapist_shifts
  where shift_date between p_from and p_to
    and (p_therapist_id is null or therapist_id = p_therapist_id);
end;
$$;

grant execute on function admin_delete_shifts(text, date, date) to authenticated;

-- 把某一週（7 天）的班表整份複製到另一週，目標週原本排的會先清掉
create or replace function admin_copy_week(p_from_start date, p_to_start date)
returns setof therapist_shifts
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_schedule_editor() then
    raise exception '沒有編輯班表的權限';
  end if;

  delete from therapist_shifts
  where shift_date between p_to_start and p_to_start + 6;

  return query
    insert into therapist_shifts (therapist_id, shift_date, start_time, end_time)
    select s.therapist_id, s.shift_date + (p_to_start - p_from_start), s.start_time, s.end_time
    from therapist_shifts s
    where s.shift_date between p_from_start and p_from_start + 6
    returning *;
end;
$$;

grant execute on function admin_copy_week(date, date) to authenticated;

-- 6) 會員送出預約：多加「班表 / 撞單」檢查，並記下人員代號 p_therapist_id。
--    開卡檢查、頻率限制跟 015 版本一樣原封不動保留。
--    p_therapist_preference 存送出當下的人員名字（顯示用），p_therapist_id 才是
--    判斷是哪一位人員的依據；兩個都不給代表「不指定人員」。
create or replace function submit_booking_request(
  p_line_user_id text,
  p_preferred_date date,
  p_preferred_time text,
  p_service_item text,
  p_therapist_preference text,
  p_note text,
  p_therapist_id text
) returns setof bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_pending_count int;
  v_recent_count int;
  v_start timestamp;
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

  if p_preferred_time is null or p_preferred_time !~ '^\d{2}:\d{2}$' then
    raise exception '請選擇預約時段';
  end if;

  v_start := p_preferred_date + p_preferred_time::time;

  if v_start < (now() at time zone 'Asia/Taipei') then
    raise exception '這個時段已經過了，請選擇其他時段';
  end if;

  if v_start > (now() at time zone 'Asia/Taipei') + interval '31 days' then
    raise exception '目前只開放預約 30 天內的時段';
  end if;

  if p_therapist_id is not null and p_therapist_id <> '' then
    if not therapist_is_free(p_therapist_id, v_start) then
      raise exception '%', coalesce(nullif(p_therapist_preference, ''), '這位人員') || ' 這個時段沒有排班或已經被預約，請選擇其他時段';
    end if;
  else
    if not exists (
      select 1 from therapist_shifts s
      where s.shift_date between (v_start::date - 1) and v_start::date
        and therapist_is_free(s.therapist_id, v_start)
    ) then
      raise exception '這個時段沒有可以安排的人員，請選擇其他時段';
    end if;
  end if;

  return query
    insert into bookings (member_id, preferred_date, preferred_time, service_item, therapist_preference, therapist_id, note)
    values (
      v_member_id, p_preferred_date, p_preferred_time, p_service_item,
      case when nullif(p_therapist_id, '') is null then null else nullif(p_therapist_preference, '') end,
      nullif(p_therapist_id, ''),
      p_note
    )
    returning *;
end;
$$;

grant execute on function submit_booking_request(text, date, text, text, text, text, text) to anon;

-- 舊版 6 個參數的送出函式：只有開著舊網頁、還沒重新整理的人會呼叫到，
-- 直接請他重新整理，不讓沒經過班表檢查的預約進來。
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
begin
  raise exception '預約系統已更新，請重新整理頁面後再送出預約';
end;
$$;

grant execute on function submit_booking_request(text, date, text, text, text, text) to anon;

-- 7) 後台確認預約：確認前檢查同一位人員同一時段有沒有其他已確認的預約。
--    其餘內容（權限檢查、LINE 推播通知客人）跟 013 版本一樣。
create or replace function admin_update_booking_status(
  p_id uuid,
  p_status text,
  p_staff_note text default null
) returns setof bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings;
  v_existing bookings;
  v_line_user_id text;
  v_line_token text;
  v_msg text;
begin
  if not exists (
    select 1 from admin_users au
    where au.id = auth.uid() and (au.role = 'owner' or au.can_edit_basic)
  ) then
    raise exception '沒有處理預約的權限';
  end if;

  if p_status not in ('pending', 'confirmed', 'declined', 'cancelled') then
    raise exception '不合法的預約狀態';
  end if;

  if p_status = 'confirmed' then
    select * into v_existing from bookings where id = p_id;
    if v_existing.therapist_id is not null
       and v_existing.preferred_time is not null
       and exists (
         select 1 from bookings b
         where b.id <> v_existing.id
           and b.therapist_id = v_existing.therapist_id
           and b.status = 'confirmed'
           and b.preferred_time is not null
           and b.preferred_date between v_existing.preferred_date - 1 and v_existing.preferred_date + 1
           and (b.preferred_date + b.preferred_time::time)
               < (v_existing.preferred_date + v_existing.preferred_time::time) + make_interval(mins => booking_block_minutes())
           and (v_existing.preferred_date + v_existing.preferred_time::time)
               < (b.preferred_date + b.preferred_time::time) + make_interval(mins => booking_block_minutes())
       ) then
      raise exception '%', coalesce(v_existing.therapist_preference, '這位人員') || ' 在這個時段已經有其他確認的預約，無法重複確認';
    end if;
  end if;

  update bookings
    set status = p_status,
        staff_note = coalesce(p_staff_note, staff_note),
        confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end
    where id = p_id
    returning * into v_booking;

  if v_booking.id is not null then
    select m.line_user_id into v_line_user_id from members m where m.id = v_booking.member_id;
    select line_channel_access_token into v_line_token from notification_settings where id = 1;

    if v_line_token is not null and v_line_token <> '' and v_line_user_id is not null then
      if p_status = 'confirmed' then
        v_msg := '🎉 您的預約已確認！' || chr(10)
          || '日期：' || v_booking.preferred_date || chr(10)
          || '時段：' || coalesce(v_booking.preferred_time, '未指定') || chr(10)
          || '項目：' || v_booking.service_item
          || case when v_booking.staff_note is not null and v_booking.staff_note <> ''
               then chr(10) || '備註：' || v_booking.staff_note else '' end
          || chr(10) || '期待您的光臨！';
      elsif p_status = 'declined' then
        v_msg := '很抱歉，您預約的時段目前無法安排。' || chr(10)
          || '日期：' || v_booking.preferred_date
          || case when v_booking.staff_note is not null and v_booking.staff_note <> ''
               then chr(10) || '原因：' || v_booking.staff_note else '' end
          || chr(10) || '請至會員頁面重新選擇時段，謝謝您的體諒。';
      elsif p_status = 'cancelled' then
        v_msg := '您原訂 ' || v_booking.preferred_date || ' 的預約已被取消，如有疑問請與我們聯繫。';
      end if;

      if v_msg is not null then
        begin
          perform net.http_post(
            url := 'https://api.line.me/v2/bot/message/push',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_line_token
            ),
            body := jsonb_build_object(
              'to', v_line_user_id,
              'messages', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_msg))
            ),
            timeout_milliseconds := 10000
          );
        exception when others then
          -- 通知失敗不能讓確認/婉拒動作失敗，安靜吞掉就好
          null;
        end;
      end if;
    end if;
  end if;

  return query select * from bookings where id = p_id;
end;
$$;

grant execute on function admin_update_booking_status(uuid, text, text) to authenticated;
