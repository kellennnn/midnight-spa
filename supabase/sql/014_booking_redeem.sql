-- 預約核銷：客人到店完成療程後，店員在後台按「核銷」，
-- 系統自動把這筆預約轉成一筆消費紀錄（session_logs），
-- 日期／服務項目／指定師傅直接沿用預約資料，店員只要補填金額即可，
-- 不用再跑去該會員的資料另外手動新增一次。
--
-- 只有「已確認（confirmed）」的預約可以核銷，核銷後狀態變成「已完成
-- （completed）」，避免核銷到還沒確認、或已經婉拒/取消的預約。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

alter table bookings
  add column if not exists redeemed_at timestamptz;

alter table bookings drop constraint if exists bookings_status_check;
alter table bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed'));

create or replace function admin_redeem_booking(
  p_id uuid,
  p_amount numeric,
  p_therapist text default null,
  p_notes text default null
) returns setof bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings;
begin
  if not exists (
    select 1 from admin_users au
    where au.id = auth.uid() and (au.role = 'owner' or au.can_edit_basic)
  ) then
    raise exception '沒有核銷預約的權限';
  end if;

  select * into v_booking from bookings where id = p_id;

  if v_booking.id is null then
    raise exception '找不到這筆預約';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception '只有已確認的預約可以核銷';
  end if;

  insert into session_logs (member_id, session_at, service_item, therapist, amount, notes)
  values (
    v_booking.member_id,
    now(),
    v_booking.service_item,
    coalesce(p_therapist, v_booking.therapist_preference),
    p_amount,
    coalesce(p_notes, '由預約核銷自動建立（原預約日期：' || v_booking.preferred_date || '）')
  );

  return query
    update bookings
    set status = 'completed', redeemed_at = now()
    where id = p_id
    returning *;
end;
$$;

grant execute on function admin_redeem_booking(uuid, numeric, text, text) to authenticated;
