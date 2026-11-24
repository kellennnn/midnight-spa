// 後台「人員管理」：新增 / 編輯人員（編號、名字、標籤、自訂文字、預設時段、照片）、調整顯示順序、上架 / 下架。
// 寫入走 admin_upsert_therapist / admin_reorder_therapists 安全函式（見 supabase/sql/017_therapists.sql），
// 照片上傳到 Supabase Storage 的 therapist-photos bucket，權限都在伺服器端檢查。
import { useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Star, X } from 'lucide-react';
import { supabase } from './supabase';
import { HALF_HOUR_OPTIONS, shiftKind, shortTime } from './schedule';
import { firstPhoto, useTherapists, type TherapistProfile } from './therapists';

const PHOTO_BUCKET = 'therapist-photos';
const MAX_PHOTO_EDGE = 1200;

type Draft = {
  id: string | null; // null = 新增
  no: string;
  name: string;
  tagsText: string;
  note: string;
  defaultStart: string; // '' = 不設定
  defaultEnd: string;
  photos: string[];
  active: boolean;
};

function toDraft(t: TherapistProfile | null): Draft {
  return {
    id: t?.id ?? null,
    no: t?.no ?? '',
    name: t?.name ?? '',
    tagsText: t?.tags.join('、') ?? '',
    note: t?.note ?? '',
    defaultStart: t?.default_start ? shortTime(t.default_start) : '',
    defaultEnd: t?.default_end ? shortTime(t.default_end) : '',
    photos: t?.photos ?? [],
    active: t?.active ?? true,
  };
}

function parseTags(text: string): string[] {
  return text
    .split(/[、,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// 手機拍的原圖動輒好幾 MB，上傳前先縮到最長邊 1200px 的 JPEG，網站也會載得比較快
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('圖片轉檔失敗'))), 'image/jpeg', 0.85),
  );
}

const inputClass =
  'w-full rounded-lg border border-neutral-700 bg-[#1c2f4a] px-2.5 py-2 text-sm text-neutral-100 focus:border-[#d4af37] focus:outline-none';

export function TherapistManager({ canEdit }: { canEdit: boolean }) {
  const { therapists, fromDb, loading, reload } = useTherapists('admin');
  const active = therapists.filter((t) => t.active);
  const inactive = therapists.filter((t) => !t.active);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const save = async () => {
    if (!draft) return;
    if (!draft.no.trim() || !draft.name.trim()) {
      alert('編號跟名字都要填');
      return;
    }
    if (!!draft.defaultStart !== !!draft.defaultEnd || (draft.defaultStart && draft.defaultStart === draft.defaultEnd)) {
      alert('預設時段的上下班時間要一起選，而且不能一樣');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('admin_upsert_therapist', {
      p_id: draft.id,
      p_no: draft.no.trim(),
      p_name: draft.name.trim(),
      p_tags: parseTags(draft.tagsText),
      p_photos: draft.photos,
      p_note: draft.note.trim(),
      p_default_start: draft.defaultStart || null,
      p_default_end: draft.defaultEnd || null,
      p_active: draft.active,
    });
    setSaving(false);
    if (error) {
      alert('儲存失敗：' + error.message);
      return;
    }
    setDraft(null);
    reload();
  };

  const setActive = async (t: TherapistProfile, value: boolean) => {
    const message = value
      ? `把 ${t.no} ${t.name} 重新上架？會再出現在網站、預約跟班表裡。`
      : `把 ${t.no} ${t.name} 下架？網站、會員預約、班表都不會再出現這位人員（資料跟舊的預約紀錄會保留，之後可以重新上架）。`;
    if (!window.confirm(message)) return;
    const { error } = await supabase.rpc('admin_upsert_therapist', {
      p_id: t.id,
      p_no: t.no,
      p_name: t.name,
      p_tags: t.tags,
      p_photos: t.photos,
      p_note: t.note,
      p_default_start: t.default_start,
      p_default_end: t.default_end,
      p_active: value,
    });
    if (error) {
      alert('更新失敗：' + error.message);
      return;
    }
    reload();
  };

  const move = async (index: number, delta: -1 | 1) => {
    const order = active.map((t) => t.id);
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    const { error } = await supabase.rpc('admin_reorder_therapists', {
      p_ids: [...order, ...inactive.map((t) => t.id)],
    });
    if (error) {
      alert('調整順序失敗：' + error.message);
      return;
    }
    reload();
  };

  const uploadPhotos = async (files: FileList | null) => {
    if (!draft || !files || files.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const blob = await shrinkImage(file);
        const path = `${draft.id ?? 'new'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        uploaded.push(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
      } catch (err: any) {
        alert(`「${file.name}」上傳失敗：${err.message || err}`);
      }
    }
    setUploading(false);
    if (uploaded.length > 0) setDraft((d) => (d ? { ...d, photos: [...d.photos, ...uploaded] } : d));
  };

  const updatePhotos = (fn: (photos: string[]) => string[]) =>
    setDraft((d) => (d ? { ...d, photos: fn(d.photos) } : d));

  const renderRow = (t: TherapistProfile, index: number) => (
    <div
      key={t.id}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs ${t.active ? 'bg-[#152236]' : 'bg-[#101a2a] opacity-70'}`}
    >
      {t.active && canEdit && (
        <div className="flex flex-col">
          <button
            onClick={() => move(index, -1)}
            disabled={index === 0}
            aria-label="往前移"
            className="text-neutral-500 hover:text-[#d4af37] disabled:opacity-20 cursor-pointer"
          >
            <ArrowUp size={14} />
          </button>
          <button
            onClick={() => move(index, 1)}
            disabled={index === active.length - 1}
            aria-label="往後移"
            className="text-neutral-500 hover:text-[#d4af37] disabled:opacity-20 cursor-pointer"
          >
            <ArrowDown size={14} />
          </button>
        </div>
      )}
      <img src={firstPhoto(t)} alt={t.name} className="h-14 w-11 shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-neutral-100">
          <span className="text-neutral-500">{t.no}</span> {t.name}
          {!t.active && <span className="ml-2 text-[10px] text-red-300">已下架</span>}
        </p>
        <p className="truncate text-neutral-400">
          {t.tags.length > 0 ? t.tags.join('・') : '（沒有標籤）'}
          {t.default_start && t.default_end && (
            <span className="ml-2 text-neutral-500">
              預設 {shortTime(t.default_start)}–{shortTime(t.default_end)}（
              {shiftKind({ start_time: t.default_start, end_time: t.default_end })}）
            </span>
          )}
        </p>
        {t.note && <p className="truncate text-neutral-500">「{t.note}」</p>}
      </div>
      {canEdit && (
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <button
            onClick={() => setDraft(toDraft(t))}
            className="flex items-center gap-1 text-[#d4af37] hover:text-[#f5e6c8] cursor-pointer"
          >
            <Pencil size={12} /> 編輯
          </button>
          <button
            onClick={() => setActive(t, !t.active)}
            className={`cursor-pointer ${t.active ? 'text-red-300 hover:text-red-200' : 'text-green-400 hover:text-green-300'}`}
          >
            {t.active ? '下架' : '重新上架'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {!loading && !fromDb && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          讀不到資料庫裡的人員資料（可能是 017 那份 SQL 還沒執行），下面暫時顯示 content.json 的資料，現在修改不會生效。
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-neutral-500">
          這裡改的名字、編號、標籤、照片，網站跟會員預約會馬上跟著更新；排好的班表、舊的預約不受影響。
        </p>
        {canEdit && (
          <button
            onClick={() => setDraft(toDraft(null))}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa8024] px-3 py-2 text-xs font-semibold text-black cursor-pointer"
          >
            <Plus size={14} /> 新增人員
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500">載入中...</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] tracking-widest text-neutral-400">上架中（{active.length} 位，照網站上的顯示順序）</p>
          {active.map((t, i) => renderRow(t, i))}

          {inactive.length > 0 && (
            <div className="pt-3">
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="text-[11px] tracking-widest text-neutral-400 hover:text-neutral-200 cursor-pointer"
              >
                {showInactive ? '▾' : '▸'} 已下架（{inactive.length} 位）
              </button>
              {showInactive && <div className="mt-2 space-y-2">{inactive.map((t, i) => renderRow(t, i))}</div>}
            </div>
          )}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setDraft(null)}>
          <div
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-[#2b4670] bg-gradient-to-b from-[#152236] to-[#0d1726] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-[#f5e6c8]">{draft.id ? `編輯 ${draft.no} ${draft.name}` : '新增人員'}</p>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] text-neutral-400">
                編號
                <input
                  value={draft.no}
                  onChange={(e) => setDraft({ ...draft, no: e.target.value })}
                  placeholder="例如：888號"
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[11px] text-neutral-400">
                名字
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="例如：小月"
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            </div>

            <label className="block text-[11px] text-neutral-400">
              標籤（用頓號或空格分開，最多 6 個）
              <input
                value={draft.tagsText}
                onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })}
                placeholder="例如：氣質型、手法細膩、熟客推薦"
                className={`mt-1 ${inputClass}`}
              />
            </label>

            <label className="block text-[11px] text-neutral-400">
              自訂文字（顯示在卡片底部，留空就不顯示）
              <textarea
                value={draft.note}
                maxLength={300}
                rows={3}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                className={`mt-1 resize-none ${inputClass}`}
              />
            </label>

            <div>
              <p className="text-[11px] text-neutral-400">預設時段（排班時「套用預設時段」會用這個）</p>
              <div className="mt-1 grid grid-cols-2 gap-3">
                {(
                  [
                    ['上班', 'defaultStart'],
                    ['下班', 'defaultEnd'],
                  ] as const
                ).map(([label, key]) => (
                  <select
                    key={key}
                    aria-label={label}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">{label}：不設定</option>
                    {HALF_HOUR_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {label} {t}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] text-neutral-400">照片（第一張是卡片封面，點 ★ 設成封面）</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.photos.map((url, i) => (
                  <div key={url} className="relative h-24 w-[72px]">
                    <img src={url} alt="" className="h-24 w-[72px] rounded object-cover" />
                    {i === 0 ? (
                      <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[9px] text-[#f5e6c8]">封面</span>
                    ) : (
                      <button
                        onClick={() => updatePhotos((p) => [url, ...p.filter((x) => x !== url)])}
                        aria-label="設成封面"
                        className="absolute left-1 top-1 rounded bg-black/70 p-0.5 text-[#d4af37] cursor-pointer"
                      >
                        <Star size={11} />
                      </button>
                    )}
                    <button
                      onClick={() => updatePhotos((p) => p.filter((x) => x !== url))}
                      aria-label="移除照片"
                      className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-red-300 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <label
                  className={`flex h-24 w-[72px] flex-col items-center justify-center gap-1 rounded border border-dashed border-[#2b4670] text-[10px] text-neutral-400 ${
                    uploading ? 'opacity-50' : 'hover:border-[#d4af37] cursor-pointer'
                  }`}
                >
                  <ImagePlus size={16} />
                  {uploading ? '上傳中...' : '上傳照片'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading}
                    className="hidden"
                    onChange={(e) => {
                      uploadPhotos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={save}
                disabled={saving || uploading}
                className="flex-1 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa8024] py-2 text-xs font-semibold text-black disabled:opacity-50 cursor-pointer"
              >
                {saving ? '儲存中...' : draft.id ? '儲存' : '新增'}
              </button>
              <button
                onClick={() => setDraft(null)}
                disabled={saving}
                className="flex-1 rounded-lg border border-neutral-700 py-2 text-xs text-neutral-400 cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
