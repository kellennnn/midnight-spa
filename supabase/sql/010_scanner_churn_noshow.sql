-- 三件事：
--   1. session_logs 補上 notes 欄位（跟你建議的 service_records 對齊）
--   2. 會員新增「爽約次數 / 取消次數」計數器
--   3. admin_update_basic 補上這兩個計數器欄位
--
-- 「久未到店」預警不用改資料庫，前端直接從 session_logs 的 session_at
-- 算最後到店日期，這裡不用另外存一個欄位。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

alter table session_logs
  add column if not exists notes text;

alter table members
  add column if not exists no_show_count int not null default 0,
  add column if not exists cancellation_count int not null default 0;

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
  p_blacklist_reason text default null,
  p_no_show_count int default 0,
  p_cancellation_count int default 0
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
        blacklist_reason = p_blacklist_reason,
        no_show_count = greatest(0, p_no_show_count),
        cancellation_count = greatest(0, p_cancellation_count)
    where id = p_id
    returning *;
end;
$$;

grant execute on function admin_update_basic(uuid, text, text, int, int, int, text, text, boolean, text, int, int) to authenticated;

-- session_logs 的新增函式也補上 notes 參數
create or replace function admin_add_session_log(
  p_member_id uuid,
  p_session_at timestamptz,
  p_service_item text,
  p_therapist text,
  p_amount numeric,
  p_notes text default null
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
    insert into session_logs (member_id, session_at, service_item, therapist, amount, notes)
    values (p_member_id, p_session_at, p_service_item, p_therapist, p_amount, p_notes)
    returning *;
end;
$$;

grant execute on function admin_add_session_log(uuid, timestamptz, text, text, numeric, text) to authenticated;
