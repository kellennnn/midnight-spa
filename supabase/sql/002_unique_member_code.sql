-- 防止兩個不同會員抽到同一組 member_code（開卡時是隨機亂數產生，
-- 會員數一多，撞號機率就不再是「幾乎不會發生」了）。
--
-- 加上這條限制之後，資料庫會直接拒絕重複的 member_code，前端配合
-- 重試邏輯（member.tsx 的 handleRegister）會自動重抽一組再試一次，
-- 客人完全不會感覺到。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'members_member_code_key'
  ) then
    alter table members add constraint members_member_code_key unique (member_code);
  end if;
end $$;
