-- 讓已登入的管理員（authenticated 身份，也就是能登入 /admin 後台的人）
-- 可以刪除會員資料，給 /admin 後台的「刪除」按鈕用。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

create policy "authenticated staff can delete"
  on members for delete
  to authenticated
  using (true);
