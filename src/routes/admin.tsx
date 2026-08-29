import { createFileRoute } from '@tanstack/react-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import {
  PRESSURE_OPTIONS,
  FOCUS_AREA_OPTIONS,
  AVOID_AREA_OPTIONS,
  AROMA_OPTIONS,
  INTERACTION_OPTIONS,
  toggleInArray,
  SinglePillGroup,
  MultiPillGroup,
} from '../lib/preferenceOptions';
import {
  Search,
  LogOut,
  Pencil,
  X,
  Check,
  ScanLine,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  UserPlus,
  Users,
  UserPlus2,
  AlertTriangle,
  Receipt,
  Plus,
  Camera,
  Clock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const Route = createFileRoute('/admin')({
  component: AdminComponent,
});

interface MemberRow {
  id: string;
  line_user_id: string;
  member_code: string;
  display_name: string;
  real_name: string;
  phone: string;
  birth_month: number | null;
  birth_day: number | null;
  birth_year: number | null;
  vip_level: string;
  nickname_locked: boolean;
  pressure_preference: string | null;
  focus_areas: string[];
  avoid_areas: string[];
  aroma_preference: string[];
  interaction_style: string | null;
  created_at: string;
  staff_notes: string | null;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  no_show_count: number;
  cancellation_count: number;
}

interface SessionLog {
  id: string;
  member_id: string;
  session_at: string;
  service_item: string | null;
  notes: string | null;
  therapist: string | null;
  amount: number | null;
}

interface AdminUser {
  id: string;
  email: string | null;
  role: 'owner' | 'staff';
  can_view: boolean;
  can_edit_basic: boolean;
  can_edit_preferences: boolean;
  can_delete: boolean;
}

function formatBirthday(m: Pick<MemberRow, 'birth_month' | 'birth_day' | 'birth_year'>) {
  if (!m.birth_month || !m.birth_day) return '未填寫';
  return `${m.birth_year ? m.birth_year + '/' : ''}${m.birth_month}/${m.birth_day}`;
}

function memberPreferenceTags(m: MemberRow) {
  return [m.pressure_preference, m.interaction_style, ...m.focus_areas, ...m.avoid_areas, ...m.aroma_preference].filter(
    Boolean
  ) as string[];
}

function daysSince(dateStr?: string) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

// 掃到的內容可能是完整的 /admin?code=MID-xxxxxx 網址（正式用），
// 也可能就是單純的代碼文字（相容舊資料），兩種都要能解析出代碼本身。
function extractMemberCode(scanned: string) {
  try {
    const url = new URL(scanned);
    const code = url.searchParams.get('code');
    if (code) return code;
  } catch {
    // 不是網址格式，當作代碼本身直接使用
  }
  return scanned.trim();
}

function QrScannerPanel({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const elementId = 'qr-reader';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          onScan(extractMemberCode(decodedText));
        },
        () => {
          // 每一幀掃不到都會呼叫一次，這是正常情況，不用理會
        }
      )
      .catch((err) => {
        console.error(err);
        setScanError('無法啟動相機，請確認已允許瀏覽器使用相機權限。');
      });

    return () => {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {});
    };
  }, []);

  return (
    <div className="rounded-xl border border-[#2a2b36] bg-[#0e0f14] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#f5e6c8] flex items-center gap-1.5">
          <Camera size={16} /> 相機掃描
        </p>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-200 cursor-pointer">
          <X size={16} />
        </button>
      </div>
      {scanError && <p className="text-xs text-red-400 mb-2">{scanError}</p>}
      <div id={elementId} className="rounded-lg overflow-hidden max-w-sm mx-auto" />
      <p className="text-[11px] text-neutral-500 mt-2 text-center">把客人的會員卡 QR Code 對準鏡頭</p>
    </div>
  );
}

function AdminComponent() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [myAccess, setMyAccess] = useState<AdminUser | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MemberRow>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const [sessionsOpenId, setSessionsOpenId] = useState<string | null>(null);
  const [sessionLogs, setSessionLogs] = useState<Record<string, SessionLog[]>>({});
  const [sessionLogsLoading, setSessionLogsLoading] = useState(false);
  const [newLogForm, setNewLogForm] = useState({
    session_at: new Date().toISOString().slice(0, 16),
    service_item: '',
    therapist: '',
    amount: '',
    notes: '',
  });
  const [addingLog, setAddingLog] = useState(false);
  const [lastVisitMap, setLastVisitMap] = useState<Record<string, string>>({});
  const [chartRangeMonths, setChartRangeMonths] = useState<6 | 12 | 24 | 0>(6); // 0 = 全部時間

  const [showRoster, setShowRoster] = useState(false);
  const [adminRoster, setAdminRoster] = useState<AdminUser[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantForm, setGrantForm] = useState({
    can_view: true,
    can_edit_basic: false,
    can_edit_preferences: false,
    can_delete: false,
  });
  const [granting, setGranting] = useState(false);

  const isOwner = myAccess?.role === 'owner';
  const canView = isOwner || !!myAccess?.can_view;
  const canEditBasic = isOwner || !!myAccess?.can_edit_basic;
  const canEditPreferences = isOwner || !!myAccess?.can_edit_preferences;
  const canDelete = isOwner || !!myAccess?.can_delete;
  const canEditAny = canEditBasic || canEditPreferences;

  useEffect(() => {
    // 從會員卡 QR code 掃進來的話，網址會帶 ?code=MID-xxxxxx，直接帶入搜尋欄，
    // 不用管理員自己手動打字找人。
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      setScannedCode(code);
      setSearch(code);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setMyAccess(null);
      return;
    }

    const loadMyAccess = async () => {
      setAccessLoading(true);
      const { data, error } = await supabase.from('admin_users').select('*').eq('id', session.user.id).maybeSingle();
      if (error) console.error(error);
      setMyAccess(data ?? null);
      setAccessLoading(false);
    };

    loadMyAccess();
  }, [session]);

  useEffect(() => {
    if (myAccess && canView) {
      loadMembers();
      loadLastVisits();
    }
  }, [myAccess]);

  useEffect(() => {
    if (isOwner) {
      loadRoster();
    }
  }, [isOwner]);

  const loadMembers = async () => {
    setMembersLoading(true);
    const { data, error } = await supabase.from('members').select('*');
    if (error) {
      console.error(error);
      alert('讀取會員資料失敗：' + error.message);
    } else {
      setMembers(data || []);
    }
    setMembersLoading(false);
  };

  const loadLastVisits = async () => {
    const { data, error } = await supabase.from('session_logs').select('member_id, session_at');
    if (error) {
      console.error(error);
      return;
    }
    const map: Record<string, string> = {};
    (data || []).forEach((row) => {
      if (!map[row.member_id] || row.session_at > map[row.member_id]) {
        map[row.member_id] = row.session_at;
      }
    });
    setLastVisitMap(map);
  };

  const loadRoster = async () => {
    setRosterLoading(true);
    const { data, error } = await supabase.from('admin_users').select('*').order('created_at');
    if (error) {
      console.error(error);
    } else {
      setAdminRoster(data || []);
    }
    setRosterLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError('登入失敗：帳號或密碼錯誤');
    }
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMembers([]);
    setMyAccess(null);
  };

  const startEdit = (m: MemberRow) => {
    setEditingId(m.id);
    setEditForm({
      real_name: m.real_name,
      phone: m.phone,
      birth_month: m.birth_month,
      birth_day: m.birth_day,
      birth_year: m.birth_year,
      vip_level: m.vip_level,
      staff_notes: m.staff_notes,
      is_blacklisted: m.is_blacklisted,
      blacklist_reason: m.blacklist_reason,
      no_show_count: m.no_show_count,
      cancellation_count: m.cancellation_count,
      pressure_preference: m.pressure_preference,
      focus_areas: m.focus_areas,
      avoid_areas: m.avoid_areas,
      aroma_preference: m.aroma_preference,
      interaction_style: m.interaction_style,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    let updated: MemberRow | null = null;
    let hadError = false;

    if (canEditBasic) {
      const { data, error } = await supabase.rpc('admin_update_basic', {
        p_id: id,
        p_real_name: editForm.real_name ?? '',
        p_phone: editForm.phone ?? '',
        p_birth_month: editForm.birth_month ?? null,
        p_birth_day: editForm.birth_day ?? null,
        p_birth_year: editForm.birth_year ?? null,
        p_vip_level: editForm.vip_level ?? '',
        p_staff_notes: editForm.staff_notes ?? null,
        p_is_blacklisted: editForm.is_blacklisted ?? false,
        p_blacklist_reason: editForm.blacklist_reason ?? null,
        p_no_show_count: editForm.no_show_count ?? 0,
        p_cancellation_count: editForm.cancellation_count ?? 0,
      });
      if (error) {
        alert('儲存基本資料失敗：' + error.message);
        console.error(error);
        hadError = true;
      } else if (data && data.length > 0) {
        updated = data[0];
      }
    }

    if (!hadError && canEditPreferences) {
      const { data, error } = await supabase.rpc('admin_update_preferences', {
        p_id: id,
        p_pressure_preference: editForm.pressure_preference ?? null,
        p_focus_areas: editForm.focus_areas ?? [],
        p_avoid_areas: editForm.avoid_areas ?? [],
        p_aroma_preference: editForm.aroma_preference ?? [],
        p_interaction_style: editForm.interaction_style ?? null,
      });
      if (error) {
        alert('儲存體驗偏好失敗：' + error.message);
        console.error(error);
        hadError = true;
      } else if (data && data.length > 0) {
        updated = data[0];
      }
    }

    if (updated) {
      const finalRow = updated;
      setMembers((prev) => prev.map((m) => (m.id === id ? finalRow : m)));
    }
    if (!hadError) {
      setEditingId(null);
      setEditForm({});
    }
    setSaving(false);
  };

  const handleDelete = async (m: MemberRow) => {
    const confirmed = window.confirm(
      `確定要刪除「${m.real_name || m.display_name}」（${m.member_code}）的會員資料嗎？此動作無法復原。`
    );
    if (!confirmed) return;

    setDeletingId(m.id);
    const { error } = await supabase.rpc('admin_delete_member', { p_id: m.id });

    if (error) {
      alert('刪除失敗：' + error.message);
      console.error(error);
    } else {
      setMembers((prev) => prev.filter((row) => row.id !== m.id));
      if (editingId === m.id) {
        setEditingId(null);
        setEditForm({});
      }
    }
    setDeletingId(null);
  };

  const toggleSessions = async (memberId: string) => {
    if (sessionsOpenId === memberId) {
      setSessionsOpenId(null);
      return;
    }
    setSessionsOpenId(memberId);
    setNewLogForm({
      session_at: new Date().toISOString().slice(0, 16),
      service_item: '',
      therapist: '',
      amount: '',
      notes: '',
    });

    if (!sessionLogs[memberId]) {
      setSessionLogsLoading(true);
      const { data, error } = await supabase
        .from('session_logs')
        .select('*')
        .eq('member_id', memberId)
        .order('session_at', { ascending: false });

      if (error) {
        console.error(error);
        alert('讀取消費紀錄失敗：' + error.message);
      } else {
        setSessionLogs((prev) => ({ ...prev, [memberId]: data || [] }));
      }
      setSessionLogsLoading(false);
    }
  };

  const handleAddLog = async (memberId: string, e: React.FormEvent) => {
    e.preventDefault();
    setAddingLog(true);

    const { data, error } = await supabase.rpc('admin_add_session_log', {
      p_member_id: memberId,
      p_session_at: new Date(newLogForm.session_at).toISOString(),
      p_service_item: newLogForm.service_item || null,
      p_therapist: newLogForm.therapist || null,
      p_amount: newLogForm.amount ? Number(newLogForm.amount) : null,
      p_notes: newLogForm.notes || null,
    });

    if (error) {
      alert('新增消費紀錄失敗：' + error.message);
      console.error(error);
    } else if (data && data.length > 0) {
      setSessionLogs((prev) => ({
        ...prev,
        [memberId]: [data[0], ...(prev[memberId] || [])].sort(
          (a, b) => new Date(b.session_at).getTime() - new Date(a.session_at).getTime()
        ),
      }));
      setNewLogForm({
        session_at: new Date().toISOString().slice(0, 16),
        service_item: '',
        therapist: '',
        amount: '',
        notes: '',
      });
    }
    setAddingLog(false);
  };

  const handleDeleteLog = async (memberId: string, logId: string) => {
    const confirmed = window.confirm('確定要刪除這筆消費紀錄嗎？');
    if (!confirmed) return;

    const { error } = await supabase.rpc('admin_delete_session_log', { p_id: logId });
    if (error) {
      alert('刪除失敗：' + error.message);
      console.error(error);
    } else {
      setSessionLogs((prev) => ({
        ...prev,
        [memberId]: (prev[memberId] || []).filter((l) => l.id !== logId),
      }));
    }
  };

  const updateRosterField = (id: string, field: keyof AdminUser, value: boolean) => {
    setAdminRoster((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const saveRosterRow = async (row: AdminUser) => {
    const { error } = await supabase
      .from('admin_users')
      .update({
        can_view: row.can_view,
        can_edit_basic: row.can_edit_basic,
        can_edit_preferences: row.can_edit_preferences,
        can_delete: row.can_delete,
      })
      .eq('id', row.id);

    if (error) {
      alert('儲存權限失敗：' + error.message);
      console.error(error);
    } else {
      alert('已更新 ' + (row.email || row.id) + ' 的權限');
    }
  };

  const removeRosterRow = async (row: AdminUser) => {
    const confirmed = window.confirm(`確定要移除 ${row.email || row.id} 的後台權限嗎？`);
    if (!confirmed) return;

    const { error } = await supabase.from('admin_users').delete().eq('id', row.id);
    if (error) {
      alert('移除失敗：' + error.message);
      console.error(error);
    } else {
      setAdminRoster((prev) => prev.filter((r) => r.id !== row.id));
    }
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGranting(true);
    const { error } = await supabase.rpc('admin_grant_access', {
      p_email: grantEmail.trim(),
      p_can_view: grantForm.can_view,
      p_can_edit_basic: grantForm.can_edit_basic,
      p_can_edit_preferences: grantForm.can_edit_preferences,
      p_can_delete: grantForm.can_delete,
    });

    if (error) {
      alert('授權失敗：' + error.message);
      console.error(error);
    } else {
      setGrantEmail('');
      setGrantForm({ can_view: true, can_edit_basic: false, can_edit_preferences: false, can_delete: false });
      loadRoster();
    }
    setGranting(false);
  };

  const scannedMatch = scannedCode ? members.find((m) => m.member_code === scannedCode) : null;

  const now = new Date();
  const thisMonthCount = members.filter((m) => {
    const d = new Date(m.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const monthlyChartData = (() => {
    let monthsBack: number = chartRangeMonths;
    if (monthsBack === 0) {
      // 全部時間：從最早的會員建立月份開始算
      const earliest = members.reduce<Date | null>((min, m) => {
        if (!m.created_at) return min;
        const d = new Date(m.created_at);
        return !min || d < min ? d : min;
      }, null);
      monthsBack = earliest
        ? (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth())
        : 0;
    }
    const buckets: { key: string; label: string; 新增會員: number }[] = [];
    for (let i = monthsBack; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}月` : `${d.getFullYear()}/${d.getMonth() + 1}`;
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label, 新增會員: 0 });
    }
    members.forEach((m) => {
      if (!m.created_at) return;
      const d = new Date(m.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.新增會員 += 1;
    });
    return buckets;
  })();

  const filtered = members.filter((m) => {
    const q = search.trim();
    if (!q) return true;
    return [m.display_name, m.real_name, m.phone, m.member_code].some((v) =>
      (v || '').toLowerCase().includes(q.toLowerCase())
    );
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-neutral-400">
        載入中...
      </div>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#07080a] text-neutral-200 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-gradient-to-b from-[#14151a] to-[#0c0d10] border border-[#2a2b36] rounded-2xl shadow-2xl p-6 space-y-4"
        >
          <h1 className="font-serif tracking-widest text-[#f5e6c8] text-lg font-bold text-center">
            MIDNIGHT SPA 管理後台
          </h1>

          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">管理員帳號</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">密碼</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          {loginError && <p className="text-xs text-red-400">{loginError}</p>}

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full bg-gradient-to-r from-[#d4af37] to-[#aa8024] hover:brightness-110 text-black font-semibold py-2.5 rounded-lg text-sm tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            {loggingIn ? '登入中...' : '登入'}
          </button>
        </form>
      </main>
    );
  }

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-neutral-400">
        載入中...
      </div>
    );
  }

  if (!myAccess) {
    return (
      <main className="min-h-screen bg-[#07080a] text-neutral-200 flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-sm text-neutral-400">你的帳號尚未被授權使用這個後台，請聯絡管理者。</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer"
        >
          <LogOut size={14} /> 登出
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07080a] text-neutral-200 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif tracking-widest text-[#f5e6c8] text-xl font-bold">
            會員管理
          </h1>
          <div className="flex items-center gap-4">
            {canView && (
              <button
                onClick={() => setScannerOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[#d4af37] hover:text-[#f5e6c8] cursor-pointer"
              >
                <Camera size={14} /> {scannerOpen ? '關閉相機掃描' : '相機掃描'}
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setShowRoster((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[#d4af37] hover:text-[#f5e6c8] cursor-pointer"
              >
                <ShieldCheck size={14} /> {showRoster ? '關閉員工權限管理' : '員工權限管理'}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              <LogOut size={14} /> 登出
            </button>
          </div>
        </div>

        {canView && !membersLoading && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-xl border border-[#2a2b36] bg-gradient-to-r from-[#1c1e29] to-[#101117] px-5 py-5 sm:col-span-1">
              <Users size={30} className="text-[#d4af37] shrink-0" />
              <div>
                <p className="text-xs text-neutral-400 tracking-widest uppercase">會員總數</p>
                <p className="text-3xl font-bold text-[#f5e6c8] mt-1 leading-none">{members.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-[#2a2b36] bg-gradient-to-r from-[#1c1e29] to-[#101117] px-5 py-5 sm:col-span-1">
              <UserPlus2 size={30} className="text-[#d4af37] shrink-0" />
              <div>
                <p className="text-xs text-neutral-400 tracking-widest uppercase">本月新開卡</p>
                <p className="text-3xl font-bold text-[#f5e6c8] mt-1 leading-none">{thisMonthCount}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#2a2b36] bg-[#0e0f14] px-5 py-4 sm:col-span-1">
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-xs text-neutral-400 tracking-widest uppercase shrink-0">開卡趨勢</p>
                <div className="flex items-center gap-1">
                  {([
                    { v: 6, label: '6月' },
                    { v: 12, label: '12月' },
                    { v: 24, label: '24月' },
                    { v: 0, label: '全部' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setChartRangeMonths(opt.v)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                        chartRangeMonths === opt.v
                          ? 'border-[#d4af37] text-[#f5e6c8] bg-[#d4af3722]'
                          : 'border-[#2a2b36] text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <ResponsiveContainer width="100%" height={90} minWidth={Math.max(monthlyChartData.length * 34, 200)}>
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2b36" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#8a8a94', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#14151a', border: '1px solid #2a2b36', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#f5e6c8' }}
                      cursor={{ fill: '#d4af3712' }}
                    />
                    <Bar dataKey="新增會員" fill="#d4af37" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {scannerOpen && (
          <QrScannerPanel
            onClose={() => setScannerOpen(false)}
            onScan={(code) => {
              setScannerOpen(false);
              setScannedCode(code);
              setSearch(code);
            }}
          />
        )}

        {isOwner && showRoster && (
          <div className="rounded-xl border border-[#2a2b36] bg-[#0e0f14] p-4 space-y-4">
            <h2 className="text-sm font-semibold text-[#f5e6c8]">員工權限管理</h2>

            <form onSubmit={handleGrant} className="flex flex-wrap items-end gap-3 border-b border-[#1e1f28] pb-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] text-neutral-400 mb-1 block">
                  員工 Email（要先在 Supabase 後台建好這個人的登入帳號）
                </label>
                <input
                  type="email"
                  required
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                />
              </div>
              {(
                [
                  ['can_view', '查看會員'],
                  ['can_edit_basic', '編輯基本資料'],
                  ['can_edit_preferences', '編輯體驗偏好'],
                  ['can_delete', '刪除會員'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={grantForm[field]}
                    onChange={(e) => setGrantForm((f) => ({ ...f, [field]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
              <button
                type="submit"
                disabled={granting}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa8024] text-black font-semibold disabled:opacity-50 cursor-pointer"
              >
                <UserPlus size={14} /> {granting ? '處理中...' : '授權 / 更新'}
              </button>
            </form>

            {rosterLoading ? (
              <p className="text-xs text-neutral-500">載入中...</p>
            ) : (
              <div className="space-y-2">
                {adminRoster.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 text-xs bg-[#14151a] rounded-lg px-3 py-2.5"
                  >
                    <span className="min-w-[160px] text-neutral-200">
                      {row.email || row.id}
                      {row.role === 'owner' && (
                        <span className="ml-1.5 text-[10px] text-[#d4af37]">(擁有者)</span>
                      )}
                    </span>
                    {row.role === 'owner' ? (
                      <span className="text-neutral-500">最大權限，不可調整</span>
                    ) : (
                      <>
                        {(
                          [
                            ['can_view', '查看會員'],
                            ['can_edit_basic', '編輯基本資料'],
                            ['can_edit_preferences', '編輯體驗偏好'],
                            ['can_delete', '刪除會員'],
                          ] as const
                        ).map(([field, label]) => (
                          <label key={field} className="flex items-center gap-1.5 text-neutral-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row[field]}
                              onChange={(e) => updateRosterField(row.id, field, e.target.checked)}
                            />
                            {label}
                          </label>
                        ))}
                        <button
                          onClick={() => saveRosterRow(row)}
                          className="text-green-400 hover:text-green-300 cursor-pointer ml-auto"
                        >
                          儲存
                        </button>
                        <button
                          onClick={() => removeRosterRow(row)}
                          className="text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          移除
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {scannedCode && !membersLoading && (
          scannedMatch ? (
            <div
              className={`flex items-center gap-4 rounded-xl border p-5 ${
                scannedMatch.is_blacklisted
                  ? 'border-red-500/60 bg-gradient-to-r from-red-950/40 to-[#101117]'
                  : 'border-[#d4af37]/50 bg-gradient-to-r from-[#1c1e29] to-[#101117]'
              }`}
            >
              {scannedMatch.is_blacklisted ? (
                <AlertTriangle size={28} className="shrink-0 text-red-400" />
              ) : (
                <CheckCircle2 size={28} className="shrink-0 text-[#d4af37]" />
              )}
              <div className="flex-1">
                {scannedMatch.is_blacklisted ? (
                  <p className="text-xs tracking-widest text-red-400">⚠ 黑名單會員，請留意</p>
                ) : (
                  <p className="text-xs tracking-widest text-[#d4af37]">掃碼核銷成功</p>
                )}
                <p className="mt-1 text-lg font-semibold text-neutral-100">
                  {scannedMatch.real_name || scannedMatch.display_name}
                  <span className="ml-2 text-sm font-normal text-[#d4af37]">{scannedMatch.vip_level}</span>
                </p>
                <p className="mt-0.5 font-mono text-xs text-neutral-500">{scannedMatch.member_code}</p>
                {scannedMatch.is_blacklisted && scannedMatch.blacklist_reason && (
                  <p className="mt-1.5 text-sm text-red-300">原因：{scannedMatch.blacklist_reason}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setScannedCode('');
                  setSearch('');
                  window.history.replaceState({}, '', '/admin');
                }}
                className="text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer"
              >
                清除
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
              <ScanLine size={20} className="shrink-0 text-red-400" />
              <p className="text-sm text-red-300">
                掃到的會員代碼「{scannedCode}」查無資料，可能是偽造或已失效的 QR code。
              </p>
            </div>
          )
        )}

        {!canView ? (
          <p className="text-sm text-neutral-500">你目前沒有查看會員資料的權限，請聯絡管理者。</p>
        ) : (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="搜尋暱稱、姓名、電話或會員代碼"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            {search.trim() && !membersLoading && (
              <p className="text-xs text-neutral-500">
                符合搜尋條件：{filtered.length} / {members.length} 位
              </p>
            )}

            {membersLoading ? (
              <p className="text-sm text-neutral-500">載入中...</p>
            ) : (
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-[#2a2b36]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#14151a] text-neutral-400 text-xs">
                      <th className="text-left px-3 py-2.5 font-medium">會員代碼</th>
                      <th className="text-left px-3 py-2.5 font-medium">暱稱</th>
                      <th className="text-left px-3 py-2.5 font-medium">真實姓名</th>
                      <th className="text-left px-3 py-2.5 font-medium">電話</th>
                      <th className="text-left px-3 py-2.5 font-medium">生日</th>
                      <th className="text-left px-3 py-2.5 font-medium">VIP 等級</th>
                      <th className="text-left px-3 py-2.5 font-medium">體驗偏好</th>
                      <th className="text-right px-3 py-2.5 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center px-3 py-8 text-neutral-500">
                          沒有符合的會員資料
                        </td>
                      </tr>
                    ) : (
                      filtered.map((m) => {
                        const isEditing = editingId === m.id;
                        const idleDays = daysSince(lastVisitMap[m.id]);
                        return (
                          <Fragment key={m.id}>
                          <tr className={`border-t border-[#1e1f28] ${m.is_blacklisted ? 'bg-red-950/20' : ''}`}>
                            <td className="px-3 py-2.5 font-mono text-xs text-[#d4af37]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {m.member_code}
                                {m.is_blacklisted && (
                                  <span
                                    title={m.blacklist_reason || '黑名單'}
                                    className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/40"
                                  >
                                    <AlertTriangle size={10} /> 黑名單
                                  </span>
                                )}
                                {idleDays !== null && idleDays >= 45 && (
                                  <span
                                    title={`上次到店 ${idleDays} 天前`}
                                    className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/40"
                                  >
                                    <Clock size={10} /> 久未到店 {idleDays}天
                                  </span>
                                )}
                                {m.no_show_count >= 2 && (
                                  <span
                                    title="建議下次預約先收訂金"
                                    className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/40"
                                  >
                                    <AlertTriangle size={10} /> 爽約 {m.no_show_count} 次
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">{m.display_name}</td>
                            <td className="px-3 py-2.5">
                              {isEditing && canEditBasic ? (
                                <input
                                  value={editForm.real_name ?? ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, real_name: e.target.value }))}
                                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1 text-xs"
                                />
                              ) : (
                                m.real_name
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {isEditing && canEditBasic ? (
                                <input
                                  value={editForm.phone ?? ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1 text-xs"
                                />
                              ) : (
                                m.phone
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {isEditing && canEditBasic ? (
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    placeholder="年"
                                    value={editForm.birth_year ?? ''}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        birth_year: e.target.value ? Number(e.target.value) : null,
                                      }))
                                    }
                                    className="w-14 bg-[#1b1c24] border border-neutral-700 rounded px-1.5 py-1 text-xs"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    placeholder="月"
                                    value={editForm.birth_month ?? ''}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        birth_month: e.target.value ? Number(e.target.value) : null,
                                      }))
                                    }
                                    className="w-12 bg-[#1b1c24] border border-neutral-700 rounded px-1.5 py-1 text-xs"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    placeholder="日"
                                    value={editForm.birth_day ?? ''}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        birth_day: e.target.value ? Number(e.target.value) : null,
                                      }))
                                    }
                                    className="w-12 bg-[#1b1c24] border border-neutral-700 rounded px-1.5 py-1 text-xs"
                                  />
                                </div>
                              ) : (
                                formatBirthday(m)
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {isEditing && canEditBasic ? (
                                <input
                                  value={editForm.vip_level ?? ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, vip_level: e.target.value }))}
                                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1 text-xs"
                                />
                              ) : (
                                <span className="text-[#d4af37]">{m.vip_level}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 max-w-[220px]">
                              <div className="flex flex-wrap gap-1">
                                {memberPreferenceTags(m).length === 0 ? (
                                  <span className="text-neutral-600">—</span>
                                ) : (
                                  memberPreferenceTags(m).map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[10px] px-1.5 py-0.5 rounded-full border border-[#d4af37]/30 text-[#d4af37] bg-[#d4af37]/5 whitespace-nowrap"
                                    >
                                      {tag}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => saveEdit(m.id)}
                                    disabled={saving}
                                    className="text-green-400 hover:text-green-300 cursor-pointer disabled:opacity-50"
                                    title="儲存"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="text-neutral-500 hover:text-neutral-300 cursor-pointer"
                                    title="取消"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-3">
                                  <button
                                    onClick={() => toggleSessions(m.id)}
                                    className="text-neutral-400 hover:text-[#d4af37] cursor-pointer"
                                    title="消費紀錄"
                                  >
                                    <Receipt size={14} />
                                  </button>
                                  {canEditAny && (
                                    <button
                                      onClick={() => startEdit(m)}
                                      className="text-neutral-400 hover:text-[#d4af37] cursor-pointer"
                                      title="編輯"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDelete(m)}
                                      disabled={deletingId === m.id}
                                      className="text-neutral-400 hover:text-red-400 cursor-pointer disabled:opacity-50"
                                      title="刪除"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                          {isEditing && canEditBasic && (
                            <tr className="border-t border-[#1e1f28] bg-[#111218]">
                              <td colSpan={8} className="px-3 py-4">
                                <div className="grid gap-4 sm:grid-cols-4">
                                  <div className="sm:col-span-2">
                                    <p className="text-[11px] text-neutral-400 mb-2">師傅專用備註</p>
                                    <textarea
                                      value={editForm.staff_notes ?? ''}
                                      onChange={(e) => setEditForm((f) => ({ ...f, staff_notes: e.target.value }))}
                                      placeholder="例如：左肩有舊傷不能壓太重、喜歡喝溫水"
                                      rows={2}
                                      className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-[#d4af37] resize-none"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-neutral-400 mb-2">黑名單</p>
                                    <label className="flex items-center gap-1.5 text-xs text-red-300 cursor-pointer mb-2">
                                      <input
                                        type="checkbox"
                                        checked={editForm.is_blacklisted ?? false}
                                        onChange={(e) => setEditForm((f) => ({ ...f, is_blacklisted: e.target.checked }))}
                                      />
                                      列入黑名單
                                    </label>
                                    {editForm.is_blacklisted && (
                                      <input
                                        value={editForm.blacklist_reason ?? ''}
                                        onChange={(e) => setEditForm((f) => ({ ...f, blacklist_reason: e.target.value }))}
                                        placeholder="原因（例如：多次無故爽約）"
                                        className="w-full bg-[#1b1c24] border border-red-500/40 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-red-400"
                                      />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-neutral-400 mb-2">爽約 / 取消次數</p>
                                    <div className="flex items-center gap-2">
                                      <div>
                                        <label className="text-[10px] text-neutral-500 block mb-1">爽約</label>
                                        <input
                                          type="number"
                                          min={0}
                                          value={editForm.no_show_count ?? 0}
                                          onChange={(e) =>
                                            setEditForm((f) => ({ ...f, no_show_count: Number(e.target.value) }))
                                          }
                                          className="w-16 bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-neutral-500 block mb-1">取消</label>
                                        <input
                                          type="number"
                                          min={0}
                                          value={editForm.cancellation_count ?? 0}
                                          onChange={(e) =>
                                            setEditForm((f) => ({ ...f, cancellation_count: Number(e.target.value) }))
                                          }
                                          className="w-16 bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          {isEditing && canEditPreferences && (
                            <tr className="border-t border-[#1e1f28] bg-[#111218]">
                              <td colSpan={8} className="px-3 py-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <div>
                                    <p className="text-[11px] text-neutral-400 mb-2">力道偏好</p>
                                    <SinglePillGroup
                                      options={PRESSURE_OPTIONS}
                                      value={editForm.pressure_preference ?? ''}
                                      onChange={(v) => setEditForm((f) => ({ ...f, pressure_preference: v }))}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-neutral-400 mb-2">店內互動風格</p>
                                    <SinglePillGroup
                                      options={INTERACTION_OPTIONS}
                                      value={editForm.interaction_style ?? ''}
                                      onChange={(v) => setEditForm((f) => ({ ...f, interaction_style: v }))}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-neutral-400 mb-2">希望加強部位</p>
                                    <MultiPillGroup
                                      options={FOCUS_AREA_OPTIONS}
                                      value={editForm.focus_areas ?? []}
                                      onToggle={(v) =>
                                        setEditForm((f) => ({ ...f, focus_areas: toggleInArray(f.focus_areas ?? [], v) }))
                                      }
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-neutral-400 mb-2">希望避開部位</p>
                                    <MultiPillGroup
                                      options={AVOID_AREA_OPTIONS}
                                      value={editForm.avoid_areas ?? []}
                                      onToggle={(v) =>
                                        setEditForm((f) => ({ ...f, avoid_areas: toggleInArray(f.avoid_areas ?? [], v) }))
                                      }
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <p className="text-[11px] text-neutral-400 mb-2">芳療香氣偏好</p>
                                    <MultiPillGroup
                                      options={AROMA_OPTIONS}
                                      value={editForm.aroma_preference ?? []}
                                      onToggle={(v) =>
                                        setEditForm((f) => ({
                                          ...f,
                                          aroma_preference: toggleInArray(f.aroma_preference ?? [], v),
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          {sessionsOpenId === m.id && (
                            <tr className="border-t border-[#1e1f28] bg-[#111218]">
                              <td colSpan={8} className="px-3 py-4">
                                <p className="text-[11px] text-neutral-400 uppercase tracking-widest mb-3">消費與服務紀錄</p>

                                {canEditBasic && (
                                  <form
                                    onSubmit={(e) => handleAddLog(m.id, e)}
                                    className="flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-[#1e1f28]"
                                  >
                                    <div>
                                      <label className="text-[10px] text-neutral-500 block mb-1">日期時間</label>
                                      <input
                                        type="datetime-local"
                                        required
                                        value={newLogForm.session_at}
                                        onChange={(e) => setNewLogForm((f) => ({ ...f, session_at: e.target.value }))}
                                        className="bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-neutral-500 block mb-1">服務項目</label>
                                      <input
                                        value={newLogForm.service_item}
                                        onChange={(e) => setNewLogForm((f) => ({ ...f, service_item: e.target.value }))}
                                        placeholder="例如：全身指壓 90 分"
                                        className="bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs w-40"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-neutral-500 block mb-1">服務按摩師</label>
                                      <input
                                        value={newLogForm.therapist}
                                        onChange={(e) => setNewLogForm((f) => ({ ...f, therapist: e.target.value }))}
                                        placeholder="例如：小雨"
                                        className="bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs w-24"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-neutral-500 block mb-1">消費金額</label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={newLogForm.amount}
                                        onChange={(e) => setNewLogForm((f) => ({ ...f, amount: e.target.value }))}
                                        placeholder="0"
                                        className="bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs w-20"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-neutral-500 block mb-1">備註</label>
                                      <input
                                        value={newLogForm.notes}
                                        onChange={(e) => setNewLogForm((f) => ({ ...f, notes: e.target.value }))}
                                        placeholder="選填"
                                        className="bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs w-32"
                                      />
                                    </div>
                                    <button
                                      type="submit"
                                      disabled={addingLog}
                                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa8024] text-black font-semibold disabled:opacity-50 cursor-pointer"
                                    >
                                      <Plus size={13} /> {addingLog ? '新增中...' : '新增'}
                                    </button>
                                  </form>
                                )}

                                {sessionLogsLoading && !sessionLogs[m.id] ? (
                                  <p className="text-xs text-neutral-500">載入中...</p>
                                ) : (sessionLogs[m.id] || []).length === 0 ? (
                                  <p className="text-xs text-neutral-600">尚無消費紀錄</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {(sessionLogs[m.id] || []).map((log) => (
                                      <div
                                        key={log.id}
                                        className="flex items-center gap-3 text-xs bg-[#14151a] rounded-lg px-3 py-2"
                                      >
                                        <span className="text-neutral-400 shrink-0">
                                          {new Date(log.session_at).toLocaleString('zh-TW', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                        <span className="text-neutral-200 flex-1" title={log.notes || undefined}>
                                          {log.service_item || '—'}
                                          {log.notes && <span className="text-neutral-500"> ・{log.notes}</span>}
                                        </span>
                                        <span className="text-neutral-400">{log.therapist || '—'}</span>
                                        <span className="text-[#d4af37] font-semibold w-16 text-right">
                                          {log.amount != null ? `$${log.amount}` : '—'}
                                        </span>
                                        {canDelete && (
                                          <button
                                            onClick={() => handleDeleteLog(m.id, log.id)}
                                            className="text-neutral-500 hover:text-red-400 cursor-pointer"
                                            title="刪除這筆紀錄"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {!membersLoading && (
              <div className="sm:hidden space-y-3">
                {filtered.length === 0 ? (
                  <p className="text-center text-neutral-500 text-sm py-8">沒有符合的會員資料</p>
                ) : (
                  filtered.map((m) => {
                    const isEditing = editingId === m.id;
                    const idleDays = daysSince(lastVisitMap[m.id]);
                    const hasWarning = m.is_blacklisted || (idleDays !== null && idleDays >= 45) || m.no_show_count >= 2;

                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl border p-4 space-y-3 ${
                          m.is_blacklisted ? 'border-red-500/40 bg-red-950/20' : 'border-[#2a2b36] bg-[#0e0f14]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-[11px] text-[#d4af37]">{m.member_code}</p>
                            <p className="text-sm font-semibold text-neutral-100 mt-0.5">
                              {m.real_name || m.display_name}
                            </p>
                            <p className="text-xs text-neutral-500">{m.display_name}</p>
                          </div>
                          <span className="text-xs text-[#d4af37] bg-[#d4af37]/10 px-2 py-1 rounded-full shrink-0">
                            {m.vip_level}
                          </span>
                        </div>

                        {hasWarning && (
                          <div className="flex flex-wrap gap-1.5">
                            {m.is_blacklisted && (
                              <span
                                title={m.blacklist_reason || '黑名單'}
                                className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/40"
                              >
                                <AlertTriangle size={10} /> 黑名單
                              </span>
                            )}
                            {idleDays !== null && idleDays >= 45 && (
                              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/40">
                                <Clock size={10} /> 久未到店 {idleDays}天
                              </span>
                            )}
                            {m.no_show_count >= 2 && (
                              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/40">
                                <AlertTriangle size={10} /> 爽約 {m.no_show_count} 次
                              </span>
                            )}
                          </div>
                        )}

                        {!isEditing && (
                          <>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-neutral-500">電話</p>
                                <p className="text-neutral-200">{m.phone || '—'}</p>
                              </div>
                              <div>
                                <p className="text-neutral-500">生日</p>
                                <p className="text-neutral-200">{formatBirthday(m)}</p>
                              </div>
                            </div>

                            {memberPreferenceTags(m).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {memberPreferenceTags(m).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full border border-[#d4af37]/30 text-[#d4af37] bg-[#d4af37]/5"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-4 pt-2 border-t border-[#1e1f28]">
                              <button
                                onClick={() => toggleSessions(m.id)}
                                className="flex items-center gap-1 text-xs text-neutral-400 cursor-pointer"
                              >
                                <Receipt size={13} /> 消費紀錄
                              </button>
                              {canEditAny && (
                                <button
                                  onClick={() => startEdit(m)}
                                  className="flex items-center gap-1 text-xs text-neutral-400 cursor-pointer"
                                >
                                  <Pencil size={13} /> 編輯
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(m)}
                                  disabled={deletingId === m.id}
                                  className="flex items-center gap-1 text-xs text-neutral-400 cursor-pointer disabled:opacity-50"
                                >
                                  <Trash2 size={13} /> 刪除
                                </button>
                              )}
                            </div>
                          </>
                        )}

                        {isEditing && (
                          <div className="space-y-3 pt-1">
                            {canEditBasic && (
                              <div className="space-y-2">
                                <input
                                  value={editForm.real_name ?? ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, real_name: e.target.value }))}
                                  placeholder="真實姓名"
                                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2.5 py-1.5 text-xs"
                                />
                                <input
                                  value={editForm.phone ?? ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                                  placeholder="電話"
                                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2.5 py-1.5 text-xs"
                                />
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    placeholder="年"
                                    value={editForm.birth_year ?? ''}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        birth_year: e.target.value ? Number(e.target.value) : null,
                                      }))
                                    }
                                    className="w-1/3 bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    placeholder="月"
                                    value={editForm.birth_month ?? ''}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        birth_month: e.target.value ? Number(e.target.value) : null,
                                      }))
                                    }
                                    className="w-1/3 bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    placeholder="日"
                                    value={editForm.birth_day ?? ''}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        birth_day: e.target.value ? Number(e.target.value) : null,
                                      }))
                                    }
                                    className="w-1/3 bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs"
                                  />
                                </div>
                                <input
                                  value={editForm.vip_level ?? ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, vip_level: e.target.value }))}
                                  placeholder="VIP 等級"
                                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2.5 py-1.5 text-xs"
                                />
                                <textarea
                                  value={editForm.staff_notes ?? ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, staff_notes: e.target.value }))}
                                  placeholder="師傅專用備註"
                                  rows={2}
                                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2.5 py-1.5 text-xs resize-none"
                                />
                                <div className="flex gap-1.5">
                                  <div className="flex-1">
                                    <label className="text-[10px] text-neutral-500 block mb-0.5">爽約次數</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={editForm.no_show_count ?? 0}
                                      onChange={(e) =>
                                        setEditForm((f) => ({ ...f, no_show_count: Number(e.target.value) }))
                                      }
                                      className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[10px] text-neutral-500 block mb-0.5">取消次數</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={editForm.cancellation_count ?? 0}
                                      onChange={(e) =>
                                        setEditForm((f) => ({ ...f, cancellation_count: Number(e.target.value) }))
                                      }
                                      className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1.5 text-xs"
                                    />
                                  </div>
                                </div>
                                <label className="flex items-center gap-1.5 text-xs text-red-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editForm.is_blacklisted ?? false}
                                    onChange={(e) => setEditForm((f) => ({ ...f, is_blacklisted: e.target.checked }))}
                                  />
                                  列入黑名單
                                </label>
                                {editForm.is_blacklisted && (
                                  <input
                                    value={editForm.blacklist_reason ?? ''}
                                    onChange={(e) => setEditForm((f) => ({ ...f, blacklist_reason: e.target.value }))}
                                    placeholder="黑名單原因"
                                    className="w-full bg-[#1b1c24] border border-red-500/40 rounded px-2.5 py-1.5 text-xs"
                                  />
                                )}
                              </div>
                            )}

                            {canEditPreferences && (
                              <div className="space-y-3 pt-2 border-t border-[#1e1f28]">
                                <div>
                                  <p className="text-[11px] text-neutral-400 mb-1.5">力道偏好</p>
                                  <SinglePillGroup
                                    options={PRESSURE_OPTIONS}
                                    value={editForm.pressure_preference ?? ''}
                                    onChange={(v) => setEditForm((f) => ({ ...f, pressure_preference: v }))}
                                  />
                                </div>
                                <div>
                                  <p className="text-[11px] text-neutral-400 mb-1.5">店內互動風格</p>
                                  <SinglePillGroup
                                    options={INTERACTION_OPTIONS}
                                    value={editForm.interaction_style ?? ''}
                                    onChange={(v) => setEditForm((f) => ({ ...f, interaction_style: v }))}
                                  />
                                </div>
                                <div>
                                  <p className="text-[11px] text-neutral-400 mb-1.5">希望加強部位</p>
                                  <MultiPillGroup
                                    options={FOCUS_AREA_OPTIONS}
                                    value={editForm.focus_areas ?? []}
                                    onToggle={(v) =>
                                      setEditForm((f) => ({ ...f, focus_areas: toggleInArray(f.focus_areas ?? [], v) }))
                                    }
                                  />
                                </div>
                                <div>
                                  <p className="text-[11px] text-neutral-400 mb-1.5">希望避開部位</p>
                                  <MultiPillGroup
                                    options={AVOID_AREA_OPTIONS}
                                    value={editForm.avoid_areas ?? []}
                                    onToggle={(v) =>
                                      setEditForm((f) => ({ ...f, avoid_areas: toggleInArray(f.avoid_areas ?? [], v) }))
                                    }
                                  />
                                </div>
                                <div>
                                  <p className="text-[11px] text-neutral-400 mb-1.5">芳療香氣偏好</p>
                                  <MultiPillGroup
                                    options={AROMA_OPTIONS}
                                    value={editForm.aroma_preference ?? []}
                                    onToggle={(v) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        aroma_preference: toggleInArray(f.aroma_preference ?? [], v),
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-2 border-t border-[#1e1f28]">
                              <button
                                onClick={() => saveEdit(m.id)}
                                disabled={saving}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa8024] text-black font-semibold disabled:opacity-50 cursor-pointer"
                              >
                                <Check size={13} /> {saving ? '儲存中...' : '儲存'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 cursor-pointer"
                              >
                                <X size={13} /> 取消
                              </button>
                            </div>
                          </div>
                        )}

                        {sessionsOpenId === m.id && (
                          <div className="pt-3 border-t border-[#1e1f28] space-y-3">
                            <p className="text-[11px] text-neutral-400 uppercase tracking-widest">消費與服務紀錄</p>

                            {canEditBasic && (
                              <form onSubmit={(e) => handleAddLog(m.id, e)} className="space-y-2 pb-3 border-b border-[#1e1f28]">
                                <input
                                  type="datetime-local"
                                  required
                                  value={newLogForm.session_at}
                                  onChange={(e) => setNewLogForm((f) => ({ ...f, session_at: e.target.value }))}
                                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2.5 py-1.5 text-xs"
                                />
                                <div className="flex gap-1.5">
                                  <input
                                    value={newLogForm.service_item}
                                    onChange={(e) => setNewLogForm((f) => ({ ...f, service_item: e.target.value }))}
                                    placeholder="服務項目"
                                    className="flex-1 bg-[#1b1c24] border border-neutral-700 rounded px-2.5 py-1.5 text-xs"
                                  />
                                  <input
                                    value={newLogForm.therapist}
                                    onChange={(e) => setNewLogForm((f) => ({ ...f, therapist: e.target.value }))}
                                    placeholder="按摩師"
                                    className="w-24 bg-[#1b1c24] border border-neutral-700 rounded px-2.5 py-1.5 text-xs"
                                  />
                                </div>
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    value={newLogForm.amount}
                                    onChange={(e) => setNewLogForm((f) => ({ ...f, amount: e.target.value }))}
                                    placeholder="金額"
                                    className="w-20 bg-[#1b1c24] border border-neutral-700 rounded px-2.5 py-1.5 text-xs"
                                  />
                                  <input
                                    value={newLogForm.notes}
                                    onChange={(e) => setNewLogForm((f) => ({ ...f, notes: e.target.value }))}
                                    placeholder="備註（選填）"
                                    className="flex-1 bg-[#1b1c24] border border-neutral-700 rounded px-2.5 py-1.5 text-xs"
                                  />
                                </div>
                                <button
                                  type="submit"
                                  disabled={addingLog}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa8024] text-black font-semibold disabled:opacity-50 cursor-pointer"
                                >
                                  <Plus size={13} /> {addingLog ? '新增中...' : '新增紀錄'}
                                </button>
                              </form>
                            )}

                            {sessionLogsLoading && !sessionLogs[m.id] ? (
                              <p className="text-xs text-neutral-500">載入中...</p>
                            ) : (sessionLogs[m.id] || []).length === 0 ? (
                              <p className="text-xs text-neutral-600">尚無消費紀錄</p>
                            ) : (
                              <div className="space-y-1.5">
                                {(sessionLogs[m.id] || []).map((log) => (
                                  <div key={log.id} className="text-xs bg-[#14151a] rounded-lg px-3 py-2 space-y-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-neutral-400">
                                        {new Date(log.session_at).toLocaleString('zh-TW', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      <span className="text-[#d4af37] font-semibold">
                                        {log.amount != null ? `$${log.amount}` : '—'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-neutral-200">
                                        {log.service_item || '—'}
                                        {log.therapist ? `・${log.therapist}` : ''}
                                      </span>
                                      {canDelete && (
                                        <button
                                          onClick={() => handleDeleteLog(m.id, log.id)}
                                          className="text-neutral-500 hover:text-red-400 cursor-pointer"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
                                    {log.notes && <p className="text-neutral-500">{log.notes}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
