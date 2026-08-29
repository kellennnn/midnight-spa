-- 員工權限管理：owner（你）永遠是最大權限；staff（小幫手）的權限由 owner
-- 逐項勾選開關。原本「只要能登入 /admin 就有全部會員資料的讀寫權限」的設計
-- 到這裡結束，改成每個帳號的權限都要在 admin_users 這張表裡明確設定。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run
-- 執行完之後，還有一個「把你自己設成 owner」的手動步驟，寫在檔案最下面。

-- 1) 員工權限表
create table if not exists admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  can_view boolean not null default false,
  can_edit_basic boolean not null default false,
  can_edit_preferences boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

-- 任何已經在名單裡的帳號都能看到整張名單（知道誰有什麼權限），
-- 但只有 owner 能新增/修改/刪除名單
drop policy if exists "admin users can view roster" on admin_users;
create policy "admin users can view roster"
  on admin_users for select
  to authenticated
  using (exists (select 1 from admin_users au where au.id = auth.uid()));

drop policy if exists "owner can manage roster" on admin_users;
create policy "owner can manage roster"
  on admin_users for all
  to authenticated
  using (exists (select 1 from admin_users au where au.id = auth.uid() and au.role = 'owner'))
  with check (exists (select 1 from admin_users au where au.id = auth.uid() and au.role = 'owner'));

-- 2) 把 members 表原本「只要登入就能整表讀寫」的政策收回，
--    讀取改成要有 can_view 權限（owner 一定有），寫入完全走下面的安全函式，
--    不再開放直接 update / delete。
drop policy if exists "authenticated staff full read" on members;
drop policy if exists "authenticated staff full update" on members;
drop policy if exists "authenticated staff can delete" on members;

create policy "admins with view permission can read members"
  on members for select
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and (au.role = 'owner' or au.can_view)
    )
  );

-- 3) 三支依權限把關的安全函式，取代直接 update / delete members

create or replace function admin_update_basic(
  p_id uuid,
  p_real_name text,
  p_phone text,
  p_birth_month int,
  p_birth_day int,
  p_birth_year int,
  p_vip_level text
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
        vip_level = p_vip_level
    where id = p_id
    returning *;
end;
$$;

grant execute on function admin_update_basic(uuid, text, text, int, int, int, text) to authenticated;

create or replace function admin_update_preferences(
  p_id uuid,
  p_pressure_preference text,
  p_focus_areas text[],
  p_avoid_areas text[],
  p_aroma_preference text[],
  p_interaction_style text
) returns setof members
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from admin_users au
    where au.id = auth.uid() and (au.role = 'owner' or au.can_edit_preferences)
  ) then
    raise exception '沒有編輯體驗偏好的權限';
  end if;

  return query
    update members
    set pressure_preference = p_pressure_preference,
        focus_areas = p_focus_areas,
        avoid_areas = p_avoid_areas,
        aroma_preference = p_aroma_preference,
        interaction_style = p_interaction_style
    where id = p_id
    returning *;
end;
$$;

grant execute on function admin_update_preferences(uuid, text, text[], text[], text[], text) to authenticated;

create or replace function admin_delete_member(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from admin_users au
    where au.id = auth.uid() and (au.role = 'owner' or au.can_delete)
  ) then
    raise exception '沒有刪除會員的權限';
  end if;

  delete from members where id = p_id;
end;
$$;

grant execute on function admin_delete_member(uuid) to authenticated;

-- 4) owner 專用：用 email 授權小幫手，不用自己去查 UID
create or replace function admin_grant_access(
  p_email text,
  p_can_view boolean default true,
  p_can_edit_basic boolean default false,
  p_can_edit_preferences boolean default false,
  p_can_delete boolean default false
) returns setof admin_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
begin
  if not exists (
    select 1 from admin_users au where au.id = auth.uid() and au.role = 'owner'
  ) then
    raise exception '只有 owner 能授權其他人';
  end if;

  select id into v_target_id from auth.users where email = p_email;

  if v_target_id is null then
    raise exception '找不到這個 email 的登入帳號，請先去 Supabase 後台 Authentication -> Users 建立這個人的帳號';
  end if;

  insert into admin_users (id, email, role, can_view, can_edit_basic, can_edit_preferences, can_delete)
  values (v_target_id, p_email, 'staff', p_can_view, p_can_edit_basic, p_can_edit_preferences, p_can_delete)
  on conflict (id) do update set
    email = excluded.email,
    can_view = excluded.can_view,
    can_edit_basic = excluded.can_edit_basic,
    can_edit_preferences = excluded.can_edit_preferences,
    can_delete = excluded.can_delete;

  return query select * from admin_users where id = v_target_id;
end;
$$;

grant execute on function admin_grant_access(text, boolean, boolean, boolean, boolean) to authenticated;

-- =====================================================================
-- 5) 手動步驟：把你自己設成 owner（這一步一定要做，不然沒有人能用後台）
--
-- 去 Supabase 後台 -> Authentication -> Users，找到你自己登入 /admin 用的
-- 那個帳號，複製它的 UID（一長串英數字），把下面這行的
-- 'YOUR-UID-HERE' 跟 'you@example.com' 換成你的實際資料，
-- 單獨選取這一行執行：
--
-- insert into admin_users (id, email, role, can_view, can_edit_basic, can_edit_preferences, can_delete)
-- values ('YOUR-UID-HERE', 'you@example.com', 'owner', true, true, true, true);
-- =====================================================================
