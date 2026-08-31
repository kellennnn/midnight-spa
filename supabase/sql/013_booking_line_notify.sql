-- 預約被確認/婉拒/取消時，用 LINE Messaging API 推播訊息通知「客人本人」
-- （之前 011 做的 Telegram 通知是給你自己看新預約用的，這個是反過來，
-- 通知客人他的預約結果）。
--
-- 這裡用的是 LINE 的 Messaging API「Channel Access Token」，跟會員卡登入
-- 用的 LIFF／LINE Login 是不同的東西，不能共用，要另外去 LINE 那邊申請。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

alter table notification_settings
  add column if not exists line_channel_access_token text;

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
