-- 擴充開卡表單：生日拆成月／日（必填）＋年（選填），並新增四組體驗偏好標籤欄位。
--
-- ⚠️ 注意：這段會把舊的單一 birthday 欄位換成 birth_month / birth_day / birth_year
-- 三個欄位。如果 members 表裡已經有真實客人的生日資料，直接執行最後那行
-- drop column 會讓那些舊生日資料永久消失，麻煩先去 Table Editor 確認一下
-- 有沒有需要保留的真實資料，沒有的話再執行。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

alter table members
  add column if not exists birth_month smallint,
  add column if not exists birth_day smallint,
  add column if not exists birth_year smallint,
  add column if not exists pressure_preference text,
  add column if not exists focus_areas text[] not null default '{}',
  add column if not exists avoid_areas text[] not null default '{}',
  add column if not exists aroma_preference text[] not null default '{}',
  add column if not exists interaction_style text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'members_birth_month_check') then
    alter table members add constraint members_birth_month_check
      check (birth_month is null or birth_month between 1 and 12);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'members_birth_day_check') then
    alter table members add constraint members_birth_day_check
      check (birth_day is null or birth_day between 1 and 31);
  end if;
end $$;

-- 確認沒有需要保留的舊資料後再執行這行
alter table members drop column if exists birthday;
