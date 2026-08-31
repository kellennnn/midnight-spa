-- 會員預約功能（方案一：會員送出預約「請求」，後台人工確認/婉拒，
-- 不做即時鎖時段，跟現在用 LINE 私訊喬時間的習慣比較接近）。
--
-- 包含：
--   1. bookings 表：會員送出的預約請求（想要的日期/時段/項目/指定師傅/備註）
--   2. 會員端安全函式：送出預約、查詢自己的預約、取消自己「待確認」的預約
--   3. 後台：能看 can_view 的人可以看，能編輯基本資料 can_edit_basic 的人可以
--      確認/婉拒（沿用既有權限，不另外多加一種權限開關）
--   4. notification_settings 表 + 一個 Telegram Bot 通知的 trigger：
--      有新預約送出時，自動用 pg_net 打一支 HTTP request 給 Telegram Bot API，
--      推播訊息到你的 Telegram。Bot Token / Chat ID 存在資料表裡，用後台的
--      「通知設定」表單填，不用寫死在這份 SQL 裡、也不用重新執行這份檔案。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

-- 1) 預約請求表
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  preferred_date date not null,
  preferred_time text,
  service_item text not null,
  therapist_preference text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  staff_note text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table bookings enable row level security;

-- 後台查看：跟查看會員資料同一個權限（can_view / owner）
drop policy if exists "admins with view permission can read bookings" on bookings;
create policy "admins with view permission can read bookings"
  on bookings for select
  to authenticated
  using (
    is_owner_user()
    or exists (select 1 from admin_users where id = auth.uid() and can_view)
  );

-- 2) 會員端安全函式（anon 呼叫，內部一律用 line_user_id 核對身分，不會撈到別人的資料）

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
begin
  select id into v_member_id from members where line_user_id = p_line_user_id limit 1;
  if v_member_id is null then
    raise exception '找不到會員資料，請先完成會員註冊';
  end if;

  return query
    insert into bookings (member_id, preferred_date, preferred_time, service_item, therapist_preference, note)
    values (v_member_id, p_preferred_date, p_preferred_time, p_service_item, p_therapist_preference, p_note)
    returning *;
end;
$$;

grant execute on function submit_booking_request(text, date, text, text, text, text) to anon;

create or replace function get_my_bookings(p_line_user_id text)
returns setof bookings
language sql
security definer
set search_path = public
stable
as $$
  select b.* from bookings b
  join members m on m.id = b.member_id
  where m.line_user_id = p_line_user_id
  order by b.created_at desc;
$$;

grant execute on function get_my_bookings(text) to anon;

create or replace function cancel_my_booking(p_id uuid, p_line_user_id text)
returns setof bookings
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update bookings b
    set status = 'cancelled'
    from members m
    where b.id = p_id
      and b.member_id = m.id
      and m.line_user_id = p_line_user_id
      and b.status = 'pending'
    returning b.*;
end;
$$;

grant execute on function cancel_my_booking(uuid, text) to anon;

-- 3) 後台確認/婉拒：跟編輯基本資料同一個權限（can_edit_basic / owner）
create or replace function admin_update_booking_status(
  p_id uuid,
  p_status text,
  p_staff_note text default null
) returns setof bookings
language plpgsql
security definer
set search_path = public
as $$
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

  return query
    update bookings
    set status = p_status,
        staff_note = coalesce(p_staff_note, staff_note),
        confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end
    where id = p_id
    returning *;
end;
$$;

grant execute on function admin_update_booking_status(uuid, text, text) to authenticated;

-- 4) 通知設定（Telegram Bot Token / Chat ID），只有 owner 看得到、改得了
create table if not exists notification_settings (
  id int primary key default 1 check (id = 1),
  telegram_bot_token text,
  telegram_chat_id text,
  updated_at timestamptz not null default now()
);

insert into notification_settings (id) values (1) on conflict (id) do nothing;

alter table notification_settings enable row level security;

drop policy if exists "owner can view notification settings" on notification_settings;
create policy "owner can view notification settings"
  on notification_settings for select
  to authenticated
  using (is_owner_user());

drop policy if exists "owner can update notification settings" on notification_settings;
create policy "owner can update notification settings"
  on notification_settings for update
  to authenticated
  using (is_owner_user())
  with check (is_owner_user());

-- 5) 新預約自動推播到 Telegram
--    用 pg_net 這個 Supabase 內建的擴充功能，從資料庫直接打 HTTP request，
--    不需要另外架伺服器或寫後端程式。如果還沒填 Bot Token / Chat ID，
--    或是推播失敗，都不會影響會員送出預約（用 exception 包起來吞掉錯誤）。
create extension if not exists pg_net with schema extensions;

create or replace function notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_chat_id text;
  v_member_name text;
  v_text text;
begin
  select telegram_bot_token, telegram_chat_id
    into v_token, v_chat_id
    from notification_settings where id = 1;

  if v_token is null or v_token = '' or v_chat_id is null or v_chat_id = '' then
    return new;
  end if;

  select coalesce(real_name, display_name) into v_member_name
    from members where id = new.member_id;

  v_text := '📅 新的預約請求' || chr(10)
    || '會員：' || coalesce(v_member_name, '未知') || chr(10)
    || '日期：' || new.preferred_date || chr(10)
    || '時段：' || coalesce(new.preferred_time, '未指定') || chr(10)
    || '項目：' || new.service_item || chr(10)
    || '指定師傅：' || coalesce(new.therapist_preference, '不指定') || chr(10)
    || '備註：' || coalesce(new.note, '無') || chr(10)
    || '請至後台「預約管理」確認';

  begin
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('chat_id', v_chat_id, 'text', v_text)
    );
  exception when others then
    -- 通知失敗不能讓預約新增失敗，安靜吞掉就好
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_booking on bookings;
create trigger trg_notify_new_booking
  after insert on bookings
  for each row execute function notify_new_booking();
