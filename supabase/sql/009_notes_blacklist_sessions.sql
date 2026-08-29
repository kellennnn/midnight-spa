-- 三個功能一起加：
--   1. 師傅專用備註欄（staff_notes，自由文字）
--   2. 黑名單機制（is_blacklisted + blacklist_reason，前台掃碼/查詢會跳紅色警示）
--   3. 消費與服務紀錄表（session_logs：日期時間、服務項目、服務按摩師、金額）
--
-- 權限沿用既有的 can_edit_basic（能編輯基本資料的人，也能編輯備註/黑名單/
-- 新增消費紀錄），can_view 的人可以查看消費紀錄，不用另外多開一種權限。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

-- 1) members 表新增欄位
alter table members
  add column if not exists staff_notes text,
  add column if not exists is_blacklisted boolean not null default false,
  add column if not exists blacklist_reason text;

-- 2) 消費與服務紀錄表
create table if not exists session_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  session_at timestamptz not null default now(),
  service_item text,
  therapist text,
  amount numeric,
  created_at timestamptz not null default now()
);

alter table session_logs enable row level security;

-- 查看：跟查看會員資料同一個權限（can_view / owner）
drop policy if exists "admins with view permission can read session logs" on session_logs;
create policy "admins with view permission can read session logs"
  on session_logs for select
  to authenticated
  using (
    is_owner_user()
    or exists (select 1 from admin_users where id = auth.uid() and can_view)
  );

-- 新增/刪除：跟編輯基本資料同一個權限（can_edit_basic / owner）
drop policy if exists "admins with edit permission can write session logs" on session_logs;
create policy "admins with edit permission can write session logs"
  on session_logs for insert
  to authenticated
  with check (
    is_owner_user()
    or exists (select 1 from admin_users where id = auth.uid() and can_edit_basic)
  );

drop policy if exists "admins with edit permission can delete session logs" on session_logs;
create policy "admins with edit permission can delete session logs"
  on session_logs for delete
  to authenticated
  using (
    is_owner_user()
    or exists (select 1 from admin_users where id = auth.uid() and can_edit_basic)
  );

-- 3) admin_update_basic 補上備註跟黑名單欄位（既有呼叫方式不受影響，
--    新參數都有預設值）
create or replace function admin_update_basic(
  p_id uuid,
  p_real_name text,
  p_phone text,
  p_birth_month int,
  p_birth_day int,
  p_birth_year int,
  p_vip_level text,
  p_staff_notes text default null,
  p_is_blacklisted boolean default false,
  p_blacklist_reason text default null
) returns setof members
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from admin_users au
    where au.id = auth.uid() and (au.role = 'owner' or au.can_edit_basic)
  ) then
    raise exception '沒有編輯基本資料的權限';
  end if;

  return query
    update members
    set real_name = p_real_name,
        phone = p_phone,
        birth_month = p_birth_month,
        birth_day = p_birth_day,
        birth_year = p_birth_year,
        vip_level = p_vip_level,
        staff_notes = p_staff_notes,
        is_blacklisted = p_is_blacklisted,
        blacklist_reason = p_blacklist_reason
    where id = p_id
    returning *;
end;
$$;

grant execute on function admin_update_basic(uuid, text, text, int, int, int, text, text, boolean, text) to authenticated;

-- 4) 消費紀錄的新增/刪除也走安全函式（跟其他寫入操作維持同一套模式）
create or replace function admin_add_session_log(
  p_member_id uuid,
  p_session_at timestamptz,
  p_service_item text,
  p_therapist text,
  p_amount numeric
) returns setof session_logs
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from admin_users au
    where au.id = auth.uid() and (au.role = 'owner' or au.can_edit_basic)
  ) then
    raise exception '沒有新增消費紀錄的權限';
  end if;

  return query
    insert into session_logs (member_id, session_at, service_item, therapist, amount)
    values (p_member_id, p_session_at, p_service_item, p_therapist, p_amount)
    returning *;
end;
$$;

grant execute on function admin_add_session_log(uuid, timestamptz, text, text, numeric) to authenticated;

create or replace function admin_delete_session_log(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from admin_users au
    where au.id = auth.uid() and (au.role = 'owner' or au.can_edit_basic)
  ) then
    raise exception '沒有刪除消費紀錄的權限';
  end if;

  delete from session_logs where id = p_id;
end;
$$;

grant execute on function admin_delete_session_log(uuid) to authenticated;
