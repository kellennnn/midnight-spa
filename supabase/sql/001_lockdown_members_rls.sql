-- 修補 members 表的資安漏洞：目前 anon（前端公開）角色可以直接整表 SELECT，
-- 任何人只要拿到公開的 anon key 就能撈走所有會員的真實姓名／電話／生日。
--
-- 這份 SQL 把 anon 的直接存取權收回，改成只能透過下面兩支「安全函式」
-- （security definer）存取，函式內部強制用 line_user_id 過濾，不可能整表撈取。
-- 另外開放 authenticated（管理員登入後）角色的整表存取，給 /admin 後台用。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

-- 0) 如果你還沒執行過先前加 nickname_locked 欄位的 SQL，這裡順便一起補上
--    （已經加過的話這行會直接跳過，不會報錯）
alter table members
  add column if not exists nickname_locked boolean not null default false;

-- 1) 確保有開 RLS
alter table members enable row level security;

-- 2) 清掉舊的、過於寬鬆的政策（如果名稱不同，去 Table Editor -> members -> RLS
--    看實際的政策名稱，把下面的名字換成你看到的那個再執行 drop）
drop policy if exists "Enable read access for all users" on members;
drop policy if exists "members can update own nickname" on members;
drop policy if exists "Enable insert for anon" on members;
drop policy if exists "Enable update for anon" on members;

-- 3) anon 只能新增會員（開卡），不能直接 SELECT / UPDATE 整張表
create policy "anon can register as new member"
  on members for insert
  to anon
  with check (true);

-- 4) authenticated（你之後手動建立的管理員帳號登入後）可以整表查看/編輯，給 /admin 後台用
create policy "authenticated staff full read"
  on members for select
  to authenticated
  using (true);

create policy "authenticated staff full update"
  on members for update
  to authenticated
  using (true)
  with check (true);

-- 5) 安全函式：只能用 line_user_id 查「一筆」自己的資料，不可能整表撈
create or replace function get_member_by_line_id(p_line_user_id text)
returns setof members
language sql
security definer
set search_path = public
as $$
  select * from members where line_user_id = p_line_user_id limit 1;
$$;

grant execute on function get_member_by_line_id(text) to anon;

-- 6) 安全函式：改暱稱，伺服器端強制檢查「還沒改過」且「id 與 line_user_id 都要對得上」，
--    不再只靠前端擋，前端就算被繞過也改不了別人的資料、也改不了第二次
create or replace function update_member_nickname(p_id uuid, p_line_user_id text, p_new_name text)
returns setof members
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update members
    set display_name = p_new_name, nickname_locked = true
    where id = p_id
      and line_user_id = p_line_user_id
      and nickname_locked = false
    returning *;
end;
$$;

grant execute on function update_member_nickname(uuid, text, text) to anon;
