-- 修正開卡失敗「new row violates row-level security policy」的問題。
--
-- 原本的 insert 政策只開放給 anon 角色。如果同一個瀏覽器先登入過 /admin
-- 後台（authenticated 身份），Supabase 的登入狀態會留在瀏覽器裡，導致
-- 之後在同一個瀏覽器測試 /member 開卡時，送出的請求其實是用
-- authenticated 身份、不是訪客身份，而 authenticated 完全沒有 insert
-- 權限，就被 RLS 擋下來。
--
-- 這裡把 insert 政策改成 anon 和 authenticated 都適用（本來就是任何人
-- 都該能開卡的邏輯，管理員身份也不該被排除）。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

drop policy if exists "anon can register as new member" on members;

create policy "anyone can register as new member"
  on members for insert
  to public
  with check (true);
