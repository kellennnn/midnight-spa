-- 未滿 18 歲不能開卡。前端已經會擋（member.tsx 的 handleRegister），
-- 這裡在資料庫端也擋一次，避免有人繞過網頁介面直接呼叫 API 插入資料。
--
-- 用 trigger 而不是 check constraint，是因為算年齡要用到「今天日期」，
-- Postgres 的 check constraint 不允許用會隨時間變動的函式（例如
-- current_date），只有 trigger 可以。
--
-- 執行方式：Supabase 後台 -> SQL Editor -> 貼上整段 -> Run

create or replace function check_member_is_adult()
returns trigger
language plpgsql
as $$
declare
  v_age int;
begin
  if new.birth_year is null or new.birth_month is null or new.birth_day is null then
    raise exception 'birth_year, birth_month and birth_day are all required';
  end if;

  v_age := extract(year from age(current_date, make_date(new.birth_year, new.birth_month, new.birth_day)));

  if v_age < 18 then
    raise exception 'Members must be at least 18 years old';
  end if;

  return new;
end;
$$;

drop trigger if exists members_check_adult on members;

create trigger members_check_adult
  before insert on members
  for each row
  execute function check_member_is_adult();
