// 人員資料：從資料庫的 therapists 表讀（後台「人員管理」編輯，見 supabase/sql/017_therapists.sql）。
// 讀不到資料庫（例如 017 還沒執行、或連線失敗）時，退回 content.json 裡的人員清單，網站不會空掉；
// 但 content.json 那份不會跟著後台的修改更新，只是備援。
import { useCallback, useEffect, useState } from 'react';
import content from '@/content.json';
import { supabase } from './supabase';
import { parseScheduleText } from './schedule';

export type TherapistProfile = {
  id: string; // 固定代號（t01、t02…），班表跟預約都靠它對應，新增時由資料庫自動編號
  no: string;
  name: string;
  tags: string[];
  photos: string[];
  note: string;
  default_start: string | null; // 預設時段（HH:MM:SS），排班時「套用預設時段」用
  default_end: string | null;
  sort_order: number;
  active: boolean;
};

// 還沒放照片的人員先用這張
export const PLACEHOLDER_PHOTO = '/photos/hero-ripple.jpg';

export function firstPhoto(t: Pick<TherapistProfile, 'photos'>): string {
  return t.photos[0] || PLACEHOLDER_PHOTO;
}

type ContentTherapist = {
  id: string;
  no: string;
  name: string;
  tags: string[];
  photos: string[];
  note?: string;
  schedule?: string;
};

export const FALLBACK_THERAPISTS: TherapistProfile[] = (content.therapists as ContentTherapist[]).map((t, i) => {
  const hours = parseScheduleText(t.schedule);
  return {
    id: t.id,
    no: t.no,
    name: t.name,
    tags: t.tags,
    photos: t.photos,
    note: t.note ?? '',
    default_start: hours?.start ?? null,
    default_end: hours?.end ?? null,
    sort_order: i + 1,
    active: true,
  };
});

// mode = 'public'：首頁、會員頁用，只有上架中的人員；
// mode = 'admin'：後台用，包含已下架的人員（需要登入後台）
export function useTherapists(mode: 'public' | 'admin' = 'public') {
  const [list, setList] = useState<TherapistProfile[] | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc(mode === 'admin' ? 'admin_list_therapists' : 'get_public_therapists');
    if (error) {
      console.warn('讀取人員資料失敗，改用 content.json 的資料', error);
      setList(null);
    } else {
      setList((data as TherapistProfile[]) ?? []);
    }
    setLoading(false);
  }, [mode]);

  useEffect(() => {
    reload();
  }, [reload]);

  const fromDb = list !== null && (mode === 'admin' || list.length > 0);
  return { therapists: fromDb ? list! : FALLBACK_THERAPISTS, fromDb, loading, reload };
}
