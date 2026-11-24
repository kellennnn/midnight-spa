-- 人員管理：人員資料（名字、編號、標籤、自訂文字、預設時段、照片、排序、上架/下架）
-- 從 content.json 搬進資料庫，改在後台「人員管理」編輯，按儲存就生效，不用再改檔案、等部署。
--
-- 這份 SQL 做五件事：
--   1. 新增 therapists 人員表，並把目前 content.json 裡的 20 位人員原封不動匯入
--      （用 on conflict do nothing，重跑這份 SQL 不會蓋掉後台改過的資料）。
--      id 沿用 016 班表用的固定代號（t01、t02…），新增人員時由系統自動編下一號，
--      名字、編號可以隨意改，班表跟預約都靠 id 對應，不受影響。
--   2. 人員不做真的刪除，而是「下架」（active = false）：下架後首頁、會員預約、
--      班表都不會出現，但舊的預約紀錄還對得到人，之後也可以重新上架。
--   3. 公開讀取函式 get_public_therapists()：首頁、會員頁用，只回傳上架中的人員。
--   4. 員工權限多一個「編輯人員」（can_edit_therapists），授權函式跟著多一個參數。
--   5. 照片上傳：建立公開的 Storage bucket「therapist-photos」，只有 owner 或有
--      「編輯人員」權限的帳號能上傳 / 刪除，任何人都能看（網站要顯示）。
--      這是本專案唯一一個前端直接寫入（Storage 上傳檔案）的地方，權限一樣由
--      伺服器端的 RLS policy 把關，不是靠前端。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

-- 1) 人員表
create table if not exists therapists (
  id text primary key,
  no text not null,
  name text not null,
  tags text[] not null default '{}',
  photos text[] not null default '{}',
  note text not null default '',
  default_start time,
  default_end time,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 開了 RLS 但不給任何直接讀寫的政策：讀取走下面的函式，寫入走後台安全函式
alter table therapists enable row level security;

insert into therapists (id, no, name, tags, photos, note, default_start, default_end, sort_order)
values
  ('t01', '987號', 'Mona', array['氣質型', '手法細膩', '熟客推薦']::text[], array['/photos/85709.jpg']::text[], '每一次相遇，都是為了讓您好好休息。今晚，把疲憊交給我。', '14:00', '02:00', 1),
  ('t02', '512號', '夜微', array['溫柔細膩', '深層筋膜', '芳療專精']::text[], array['/photos/therapist-2.jpg']::text[], '', '10:00', '20:00', 2),
  ('t03', '306號', '月宸', array['力道沉穩', '肩頸救星', '熟客指名']::text[], array['/photos/therapist-3.jpg']::text[], '', '18:00', '06:00', 3),
  ('t04', '148號', '星彌', array['專業細心', '手法俐落', '熱石專門']::text[], array['/photos/therapist-4.jpg']::text[], '', '12:00', '22:00', 4),
  ('t05', '275號', '語彤', array['親切耐心', '肩頸放鬆', '新客首選']::text[], array['/photos/therapist-5.jpg']::text[], '', '11:00', '21:00', 5),
  ('t06', '630號', '心妍', array['手法輕柔', '舒壓入門', '細心叮嚀']::text[], array['/photos/therapist-6.jpg']::text[], '', '15:00', '01:00', 6),
  ('t07', '419號', '芸熙', array['經驗豐富', '力道適中', '回客率高']::text[], array['/photos/therapist-7.jpg']::text[], '', '09:00', '19:00', 7),
  ('t08', '852號', '若涵', array['細膩專注', '全身舒壓', '態度親切']::text[], array['/photos/therapist-8.jpg']::text[], '', '16:00', '02:00', 8),
  ('t09', '901號', '詩敏', array['資深芳療師', '深層筋膜專精', '客製化調理']::text[], array['/photos/therapist-9.jpg']::text[], '', '13:00', '23:00', 9),
  ('t10', '366號', '雅築', array['進階手技', '精油調香師', '熟客首選']::text[], array['/photos/therapist-10.jpg']::text[], '', '17:00', '03:00', 10),
  ('t11', '528號', '靜姝', array['資深經驗', '筋膜放鬆專精', '力道精準']::text[], array['/photos/therapist-11.jpg']::text[], '', '12:00', '22:00', 11),
  ('t12', '743號', '允熙', array['高人氣指定', '深度舒緩', '細膩手法']::text[], array['/photos/therapist-12.jpg']::text[], '', '19:00', '05:00', 12),
  ('t13', '214號', '芷晴', array['國際認證', '芳療專業', '客製調理']::text[], array['/photos/therapist-13.jpg']::text[], '', '10:00', '20:00', 13),
  ('t14', '687號', '沐薇', array['資深指定', '深層舒緩', '細心體貼']::text[], array['/photos/therapist-14.jpg']::text[], '', '14:00', '00:00', 14),
  ('t15', '359號', '婉清', array['進階筋膜釋壓', '精準力道', '熟客推薦']::text[], array['/photos/therapist-15.jpg']::text[], '', '11:00', '21:00', 15),
  ('t16', '792號', '憶柔', array['資深芳療', '全方位調理', '高評價指定']::text[], array['/photos/therapist-16.jpg']::text[], '', '18:00', '04:00', 16),
  ('t17', '633號', '芊語', array['深層舒壓', '客製手法', '新進指定']::text[], array['/photos/therapist-17.jpg']::text[], '', '10:00', '20:00', 17),
  ('t18', '217號', '若薇', array['進階筋膜', '細膩專注', '熟客推薦']::text[], array['/photos/therapist-18.jpg']::text[], '', '16:00', '02:00', 18),
  ('t19', '958號', '詩涵', array['資深芳療', '全身舒緩', '親切耐心']::text[], array['/photos/therapist-19.jpg']::text[], '', '12:00', '22:00', 19),
  ('t20', '471號', '映彤', array['深度按摩', '肩頸專精', '熟客首選']::text[], array['/photos/therapist-20.jpg']::text[], '', '18:00', '04:00', 20)
on conflict (id) do nothing;

-- 2) 員工權限：編輯人員

alter table admin_users
  add column if not exists can_edit_therapists boolean not null default false;

create or replace function is_therapist_editor(check_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_users
    where id = check_id and (role = 'owner' or can_edit_therapists)
  );
$$;

-- 授權函式多一個 p_can_edit_therapists 參數，先拿掉 016 的 6 個參數版本
drop function if exists admin_grant_access(text, boolean, boolean, boolean, boolean, boolean);

create or replace function admin_grant_access(
  p_email text,
  p_can_view boolean default true,
  p_can_edit_basic boolean default false,
  p_can_edit_preferences boolean default false,
  p_can_delete boolean default false,
  p_can_edit_schedule boolean default false,
  p_can_edit_therapists boolean default false
) returns setof admin_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
begin
  if not is_owner_user() then
    raise exception '只有 owner 能授權其他人';
  end if;

  select id into v_target_id from auth.users where email = p_email;

  if v_target_id is null then
    raise exception '找不到這個 email 的登入帳號，請先去 Supabase 後台 Authentication -> Users 建立這個人的帳號';
  end if;

  insert into admin_users (
    id, email, role, can_view, can_edit_basic, can_edit_preferences, can_delete, can_edit_schedule, can_edit_therapists
  )
  values (
    v_target_id, p_email, 'staff', p_can_view, p_can_edit_basic, p_can_edit_preferences, p_can_delete,
    p_can_edit_schedule, p_can_edit_therapists
  )
  on conflict (id) do update set
    email = excluded.email,
    can_view = excluded.can_view,
    can_edit_basic = excluded.can_edit_basic,
    can_edit_preferences = excluded.can_edit_preferences,
    can_delete = excluded.can_delete,
    can_edit_schedule = excluded.can_edit_schedule,
    can_edit_therapists = excluded.can_edit_therapists;

  return query select * from admin_users where id = v_target_id;
end;
$$;

grant execute on function admin_grant_access(text, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- 3) 讀取

-- 首頁、會員頁：只回傳上架中的人員，照排序
create or replace function get_public_therapists()
returns setof therapists
language sql
stable
security definer
set search_path = public
as $$
  select * from therapists where active order by sort_order, id;
$$;

grant execute on function get_public_therapists() to anon, authenticated;

-- 後台：包含已下架的人員，任何後台帳號都能看（排班、預約管理要對照名字）
create or replace function admin_list_therapists()
returns setof therapists
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin_user() then
    raise exception '沒有後台權限';
  end if;

  return query select * from therapists order by active desc, sort_order, id;
end;
$$;

grant execute on function admin_list_therapists() to authenticated;

-- 4) 後台編輯（owner 或有 can_edit_therapists 的員工）

-- 新增 / 修改一位人員。p_id 給 null = 新增，系統自動編下一個代號（t21、t22…）
create or replace function admin_upsert_therapist(
  p_id text,
  p_no text,
  p_name text,
  p_tags text[],
  p_photos text[],
  p_note text,
  p_default_start time,
  p_default_end time,
  p_active boolean default true
) returns setof therapists
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := nullif(trim(p_id), '');
  v_next int;
begin
  if not is_therapist_editor() then
    raise exception '沒有編輯人員的權限';
  end if;

  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_no), '') = '' then
    raise exception '名字跟編號都要填';
  end if;

  if coalesce(array_length(p_tags, 1), 0) > 6 then
    raise exception '標籤最多 6 個';
  end if;

  if coalesce(array_length(p_photos, 1), 0) > 10 then
    raise exception '照片最多 10 張';
  end if;

  if length(coalesce(p_note, '')) > 300 then
    raise exception '自訂文字最多 300 個字';
  end if;

  if (p_default_start is null) <> (p_default_end is null)
     or (p_default_start is not null and p_default_start = p_default_end) then
    raise exception '預設時段的上下班時間要一起填，而且不能一樣';
  end if;

  if v_id is null then
    -- 鎖住人員表避免兩個人同時新增拿到同一個代號
    lock table therapists in share row exclusive mode;
    select coalesce(max((substring(id from '^t(\d+)$'))::int), 0) + 1 into v_next from therapists;
    v_id := 't' || lpad(v_next::text, 2, '0');

    return query
      insert into therapists (id, no, name, tags, photos, note, default_start, default_end, sort_order, active)
      values (
        v_id, trim(p_no), trim(p_name), coalesce(p_tags, '{}'), coalesce(p_photos, '{}'), coalesce(p_note, ''),
        p_default_start, p_default_end,
        (select coalesce(max(sort_order), 0) + 1 from therapists),
        coalesce(p_active, true)
      )
      returning *;
  else
    if not exists (select 1 from therapists where id = v_id) then
      raise exception '找不到這位人員';
    end if;

    return query
      update therapists set
        no = trim(p_no),
        name = trim(p_name),
        tags = coalesce(p_tags, '{}'),
        photos = coalesce(p_photos, '{}'),
        note = coalesce(p_note, ''),
        default_start = p_default_start,
        default_end = p_default_end,
        active = coalesce(p_active, true),
        updated_at = now()
      where id = v_id
      returning *;
  end if;
end;
$$;

grant execute on function admin_upsert_therapist(text, text, text, text[], text[], text, time, time, boolean) to authenticated;

-- 調整顯示順序：照傳進來的 id 順序重新編 sort_order
create or replace function admin_reorder_therapists(p_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_therapist_editor() then
    raise exception '沒有編輯人員的權限';
  end if;

  update therapists t
  set sort_order = x.ord, updated_at = now()
  from unnest(p_ids) with ordinality as x(id, ord)
  where t.id = x.id;
end;
$$;

grant execute on function admin_reorder_therapists(text[]) to authenticated;

-- 5) 照片上傳：公開 bucket，只有有權限的後台帳號能寫
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('therapist-photos', 'therapist-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "therapist editors can upload photos" on storage.objects;
create policy "therapist editors can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'therapist-photos' and public.is_therapist_editor());

drop policy if exists "therapist editors can update photos" on storage.objects;
create policy "therapist editors can update photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'therapist-photos' and public.is_therapist_editor())
  with check (bucket_id = 'therapist-photos' and public.is_therapist_editor());

drop policy if exists "therapist editors can delete photos" on storage.objects;
create policy "therapist editors can delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'therapist-photos' and public.is_therapist_editor());
