-- 011 的新預約 Telegram 通知第一次呼叫時剛好卡在 pg_net 預設 5 秒逾時
-- （查完 net._http_response 紀錄確認：trigger 有正確觸發、設定也讀取正確，
-- 純粹是第一次連線比較慢），這裡把逾時時間拉長到 10 秒更保險。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

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
      body := jsonb_build_object('chat_id', v_chat_id, 'text', v_text),
      timeout_milliseconds := 10000
    );
  exception when others then
    -- 通知失敗不能讓預約新增失敗，安靜吞掉就好
    null;
  end;

  return new;
end;
$$;
