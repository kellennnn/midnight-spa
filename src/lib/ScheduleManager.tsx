// 後台「班表管理」：一週一張表，橫列是人員、直欄是日期，點格子設定當天上班時間或休假。
// 讀取走 get_public_schedule，寫入走 admin_upsert_shifts / admin_delete_shifts / admin_copy_week
// 這幾支安全函式（見 supabase/sql/016_therapist_schedule.sql），權限在伺服器端檢查。
// 人員清單來自 content.json，用每個人固定的 id 對應班表，所以名字 / 編號改了也不影響已排的班。
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, CalendarCheck, AlertTriangle } from 'lucide-react';
import content from '@/content.json';
import { supabase } from './supabase';
import {
  addDays,
  businessDate,
  HALF_HOUR_OPTIONS,
  parseScheduleText,
  shiftKind,
  shortTime,
  type ShiftRow,
} from './schedule';

type TherapistInfo = { id?: string; no: string; name: string; schedule?: string };

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function weekStartOf(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(date, -((weekday + 6) % 7)); // 週一開始
}

function dayLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}/${d}（${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
}

export function ScheduleManager({ canEdit }: { canEdit: boolean }) {
  const allTherapists = content.therapists as TherapistInfo[];
  const therapists = allTherapists.filter((t): t is TherapistInfo & { id: string } => !!t.id);

  // content.json 的 id 漏填或重複時提醒，避免班表默默對錯人
  const idProblems = useMemo(() => {
    const missing = allTherapists.filter((t) => !t.id).map((t) => `${t.no} ${t.name}`);
    const seen = new Map<string, string[]>();
    allTherapists.forEach((t) => {
      if (t.id) seen.set(t.id, [...(seen.get(t.id) || []), `${t.no} ${t.name}`]);
    });
    const duplicated = [...seen.entries()].filter(([, names]) => names.length > 1);
    return { missing, duplicated };
  }, [allTherapists]);

  const today = businessDate();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(today));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ therapist: TherapistInfo & { id: string }; date: string } | null>(null);
  const [editStart, setEditStart] = useState('14:00');
  const [editEnd, setEditEnd] = useState('02:00');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_public_schedule', { p_from: days[0], p_to: days[6] });
    if (error) {
      console.error(error);
      alert('讀取班表失敗：' + error.message);
    } else {
      setShifts(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [weekStart]);

  const shiftOf = (therapistId: string, date: string) =>
    shifts.find((s) => s.therapist_id === therapistId && s.shift_date === date);

  const openEditor = (therapist: TherapistInfo & { id: string }, date: string) => {
    if (!canEdit) return;
    const current = shiftOf(therapist.id, date);
    const fallback = parseScheduleText(therapist.schedule);
    setEditStart(current ? shortTime(current.start_time) : fallback?.start ?? '14:00');
    setEditEnd(current ? shortTime(current.end_time) : fallback?.end ?? '02:00');
    setEditing({ therapist, date });
  };

  const upsert = async (rows: { therapist_id: string; shift_date: string; start_time: string; end_time: string }[]) => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_upsert_shifts', { p_shifts: rows });
    setBusy(false);
    if (error) {
      alert('儲存班表失敗：' + error.message);
      return false;
    }
    await load();
    return true;
  };

  const saveCell = async (wholeWeek: boolean) => {
    if (!editing) return;
    if (editStart === editEnd) {
      alert('開始跟結束時間不能一樣');
      return;
    }
    const targetDays = wholeWeek ? days : [editing.date];
    const ok = await upsert(
      targetDays.map((date) => ({
        therapist_id: editing.therapist.id,
        shift_date: date,
        start_time: editStart,
        end_time: editEnd,
      })),
    );
    if (ok) setEditing(null);
  };

  const setDayOff = async () => {
    if (!editing) return;
    setBusy(true);
    const { error } = await supabase.rpc('admin_delete_shifts', {
      p_therapist_id: editing.therapist.id,
      p_from: editing.date,
      p_to: editing.date,
    });
    setBusy(false);
    if (error) {
      alert('設定休假失敗：' + error.message);
      return;
    }
    setEditing(null);
    load();
  };

  const copyLastWeek = async () => {
    if (!window.confirm(`把上一週（${dayLabel(addDays(weekStart, -7))} 起）的班表複製到這一週？這一週已經排好的班會被覆蓋。`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('admin_copy_week', { p_from_start: addDays(weekStart, -7), p_to_start: weekStart });
    setBusy(false);
    if (error) {
      alert('複製失敗：' + error.message);
      return;
    }
    load();
  };

  const fillDefaults = async () => {
    const rows = therapists.flatMap((t) => {
      const parsed = parseScheduleText(t.schedule);
      if (!parsed) return [];
      return days.map((date) => ({ therapist_id: t.id, shift_date: date, start_time: parsed.start, end_time: parsed.end }));
    });
    if (rows.length === 0) {
      alert('content.json 裡沒有可以套用的預設時段');
      return;
    }
    if (!window.confirm('這一週每位人員、每一天都套用 content.json 裡的預設時段？已經排好的會被覆蓋，休假要之後再一格一格設定。')) return;
    upsert(rows);
  };

  return (
    <div className="space-y-4">
      {(idProblems.missing.length > 0 || idProblems.duplicated.length > 0) && (
        <div className="flex gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertTriangle size={16} className="shrink-0" />
          <div className="space-y-1">
            {idProblems.missing.length > 0 && (
              <p>這些人員在 content.json 裡沒有 id，暫時無法排班：{idProblems.missing.join('、')}</p>
            )}
            {idProblems.duplicated.map(([id, names]) => (
              <p key={id}>
                id「{id}」重複了：{names.join('、')}。每個人的 id 都要不一樣，不然班表會對錯人。
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-lg border border-[#2b4670] p-1.5 text-neutral-300 hover:text-[#f5e6c8] cursor-pointer"
            aria-label="上一週"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-[#f5e6c8]">
            {dayLabel(days[0])} – {dayLabel(days[6])}
          </span>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-lg border border-[#2b4670] p-1.5 text-neutral-300 hover:text-[#f5e6c8] cursor-pointer"
            aria-label="下一週"
          >
            <ChevronRight size={16} />
          </button>
          {weekStart !== weekStartOf(today) && (
            <button
              onClick={() => setWeekStart(weekStartOf(today))}
              className="text-xs text-[#d4af37] hover:text-[#f5e6c8] cursor-pointer"
            >
              回到本週
            </button>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copyLastWeek}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-[#2b4670] px-3 py-1.5 text-xs text-neutral-200 hover:border-[#d4af37] disabled:opacity-50 cursor-pointer"
            >
              <Copy size={13} /> 複製上週班表
            </button>
            <button
              onClick={fillDefaults}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-[#2b4670] px-3 py-1.5 text-xs text-neutral-200 hover:border-[#d4af37] disabled:opacity-50 cursor-pointer"
            >
              <CalendarCheck size={13} /> 本週全部套用預設時段
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-neutral-500">
        {canEdit ? '點格子設定當天的上班時間或休假。' : '你目前只能查看班表，沒有編輯權限。'}
        結束時間比開始時間早代表跨夜（例如 18:00 – 04:00 做到隔天凌晨）。沒有排班的格子 = 休假，那天客人不能預約這位人員。
      </p>

      <div className="overflow-x-auto rounded-xl border border-[#2b4670]">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-[#152236] text-neutral-400">
            <tr>
              <th className="sticky left-0 z-10 bg-[#152236] px-3 py-2.5 text-left font-medium">人員</th>
              {days.map((date) => (
                <th
                  key={date}
                  className={`px-2 py-2.5 text-center font-medium ${date === today ? 'text-[#d4af37]' : ''}`}
                >
                  {dayLabel(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {therapists.map((t) => (
              <tr key={t.id} className="border-t border-[#203658]">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0f1a2b] px-3 py-2 text-neutral-200">
                  <span className="text-neutral-500">{t.no}</span> {t.name}
                </td>
                {days.map((date) => {
                  const s = shiftOf(t.id, date);
                  return (
                    <td key={date} className={`px-1.5 py-1.5 text-center ${date === today ? 'bg-[#d4af37]/5' : ''}`}>
                      <button
                        onClick={() => openEditor(t, date)}
                        disabled={!canEdit || loading}
                        className={`w-full rounded-md border px-1.5 py-1.5 whitespace-nowrap transition-colors ${
                          s
                            ? shiftKind(s) === '早班'
                              ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                              : 'border-[#d4af37]/30 bg-[#d4af37]/10 text-[#f5e6c8]'
                            : 'border-transparent text-neutral-600'
                        } ${canEdit ? 'hover:border-[#d4af37] cursor-pointer' : 'cursor-default'}`}
                      >
                        {s ? `${shortTime(s.start_time)}–${shortTime(s.end_time)}` : '休'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !busy && setEditing(null)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl border border-[#2b4670] bg-gradient-to-b from-[#152236] to-[#0d1726] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-sm font-semibold text-[#f5e6c8]">
                {editing.therapist.no} {editing.therapist.name}
              </p>
              <p className="text-xs text-neutral-400">{dayLabel(editing.date)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['上班', editStart, setEditStart],
                  ['下班', editEnd, setEditEnd],
                ] as const
              ).map(([label, value, setter]) => (
                <label key={label} className="text-[11px] text-neutral-400">
                  {label}
                  <select
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-[#1c2f4a] px-2.5 py-2 text-sm text-neutral-100 focus:border-[#d4af37] focus:outline-none"
                  >
                    {HALF_HOUR_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {editEnd <= editStart && editStart !== editEnd && (
              <p className="text-[11px] text-[#d4af37]">跨夜班：做到隔天 {editEnd}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => saveCell(false)}
                disabled={busy}
                className="rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa8024] py-2 text-xs font-semibold text-black disabled:opacity-50 cursor-pointer"
              >
                {busy ? '處理中...' : '儲存這一天'}
              </button>
              <button
                onClick={() => saveCell(true)}
                disabled={busy}
                className="rounded-lg border border-[#d4af37]/50 py-2 text-xs text-[#f5e6c8] disabled:opacity-50 cursor-pointer"
              >
                這一週每天都用這個時段
              </button>
              <div className="flex gap-2">
                <button
                  onClick={setDayOff}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-red-500/40 py-2 text-xs text-red-300 disabled:opacity-50 cursor-pointer"
                >
                  設為休假
                </button>
                <button
                  onClick={() => setEditing(null)}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-neutral-700 py-2 text-xs text-neutral-400 cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
