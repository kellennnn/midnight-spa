// 班表 / 預約時段共用的時間計算，首頁、會員頁、後台都用這一份。
// 規則跟 supabase/sql/016_therapist_schedule.sql 一致：
//   - 全部用台灣時間的「牆上時間」計算，不做時區換算。
//   - 結束時間 <= 開始時間 = 跨夜班，做到隔天，班表算在開始那天。
//   - 每筆預約固定佔 BOOKING_BLOCK_MINUTES 分鐘（要改的話 SQL 那邊也要一起改）。
//   - 營業日以凌晨 5 點為界：凌晨 0~5 點還算前一天的營業日。

export const BOOKING_BLOCK_MINUTES = 60;
const BUSINESS_DAY_CUTOFF_MINUTES = 5 * 60;
const SLOT_STEP_MINUTES = 30;

export type ShiftRow = {
  therapist_id: string;
  shift_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM 或 HH:MM:SS
  end_time: string;
};

export type BusySlot = {
  therapist_id: string;
  preferred_date: string;
  preferred_time: string;
};

// 30 分鐘一格的時間選項（00:00 ~ 23:30）
export const HALF_HOUR_OPTIONS = Array.from({ length: 48 }, (_, i) => minutesToHM(i * 30));

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHM(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// "HH:MM:SS" -> "HH:MM"
export function shortTime(t: string): string {
  return t.slice(0, 5);
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * 86400000).toISOString().slice(0, 10);
}

// 一個日期 + 時間換算成「從 1970 起算的分鐘數」，方便比大小
export function absMinutes(date: string, hm: string): number {
  return dayNumber(date) * 1440 + hmToMinutes(hm);
}

export function shiftInterval(s: ShiftRow): [number, number] {
  const start = absMinutes(s.shift_date, shortTime(s.start_time));
  let end = absMinutes(s.shift_date, shortTime(s.end_time));
  if (end <= start) end += 1440;
  return [start, end];
}

export function taipeiNow(): { date: string; minutes: number; abs: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return { date, minutes, abs: absMinutes(date, minutesToHM(minutes)) };
}

// 現在算哪一天的營業日（凌晨 5 點前算前一天）
export function businessDate(now = taipeiNow()): string {
  return now.minutes < BUSINESS_DAY_CUTOFF_MINUTES ? addDays(now.date, -1) : now.date;
}

// 做到半夜 12 點以後（跨夜）的算晚班，當天就下班的算早班
// （跟 content.json 原本手動標的早晚班一致，例如 13:00-23:00 早班、14:00-00:00 晚班）
export function shiftKind(s: Pick<ShiftRow, 'start_time' | 'end_time'>): '早班' | '晚班' {
  return hmToMinutes(shortTime(s.end_time)) <= hmToMinutes(shortTime(s.start_time)) ? '晚班' : '早班';
}

export function shiftLabel(s: Pick<ShiftRow, 'start_time' | 'end_time'>): string {
  return `${shortTime(s.start_time)} - ${shortTime(s.end_time)}`;
}

// content.json 裡的預設時段字串（"14:00 - 02:00"）拆成開始 / 結束
export function parseScheduleText(text: string | undefined): { start: string; end: string } | null {
  const match = text?.match(/(\d{1,2}:\d{2})\s*[-–~]\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  const pad = (hm: string) => hm.padStart(5, '0');
  return { start: pad(match[1]), end: pad(match[2]) };
}

// 某位人員從 start 開始的 BOOKING_BLOCK_MINUTES 分鐘內是否有空
export function isTherapistFree(
  therapistId: string,
  start: number,
  shifts: ShiftRow[],
  busy: BusySlot[],
): boolean {
  const end = start + BOOKING_BLOCK_MINUTES;
  const onShift = shifts.some((s) => {
    if (s.therapist_id !== therapistId) return false;
    const [from, to] = shiftInterval(s);
    return from <= start && end <= to;
  });
  if (!onShift) return false;
  return !busy.some((b) => {
    if (b.therapist_id !== therapistId) return false;
    const bStart = absMinutes(b.preferred_date, b.preferred_time);
    return bStart < end && start < bStart + BOOKING_BLOCK_MINUTES;
  });
}

// 某一天（日曆日）可以預約的時段。therapistId 為 null = 不指定人員，只要有任何一位有空就算
export function availableSlots(
  date: string,
  therapistId: string | null,
  shifts: ShiftRow[],
  busy: BusySlot[],
  nowAbs = taipeiNow().abs,
): string[] {
  const ids = therapistId ? [therapistId] : Array.from(new Set(shifts.map((s) => s.therapist_id)));
  const slots: string[] = [];
  for (let m = 0; m < 1440; m += SLOT_STEP_MINUTES) {
    const start = absMinutes(date, minutesToHM(m));
    if (start <= nowAbs) continue;
    if (ids.some((id) => isTherapistFree(id, start, shifts, busy))) slots.push(minutesToHM(m));
  }
  return slots;
}
