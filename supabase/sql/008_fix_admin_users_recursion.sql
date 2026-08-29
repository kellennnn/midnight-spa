-- 修正「infinite recursion detected in policy for relation admin_users」錯誤。
--
-- 007 那份 SQL 裡，admin_users 表自己的 RLS 規則內容又去查詢 admin_users 自己
-- （例如「檢查你是不是 owner」這個判斷式，本身就是去查 admin_users），
-- Postgres 發現這樣會無限繞圈，直接擋下來。
--
-- 修法：把「檢查你是不是已登記的管理員 / owner」包成兩支 SECURITY DEFINER
-- 函式，函式內部查 admin_users 的時候不會再觸發 RLS 規則檢查，
-- 規則本身改成呼叫這兩支函式，就不會再繞圈。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

create or replace function is_admin_user(check_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admin_users where id = check_id);
$$;

create or replace function is_owner_user(check_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admin_users where id = check_id and role = 'owner');
$$;

drop policy if exists "admin users can view roster" on admin_users;
create policy "admin users can view roster"
  on admin_users for select
  to authenticated
  using (is_admin_user());

drop policy if exists "owner can manage roster" on admin_users;
create policy "owner can manage roster"
  on admin_users for all
  to authenticated
  using (is_owner_user())
  with check (is_owner_user());

-- members 表的讀取規則原本就沒有自己查自己的問題（它查的是 admin_users，
-- 不是 members），這裡順便一起改用同一支函式，維持風格一致、以後好維護。
drop policy if exists "admins with view permission can read members" on members;
create policy "admins with view permission can read members"
  on members for select
  to authenticated
  using (
    is_owner_user()
    or exists (select 1 from admin_users where id = auth.uid() and can_view)
  );
