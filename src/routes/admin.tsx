import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Search, LogOut, Pencil, X, Check } from 'lucide-react';

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
  birthday: string;
  vip_level: string;
  nickname_locked: boolean;
}

function AdminComponent() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MemberRow>>({});
  const [saving, setSaving] = useState(false);

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
    if (session) {
      loadMembers();
    }
  }, [session]);

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
  };

  const startEdit = (m: MemberRow) => {
    setEditingId(m.id);
    setEditForm({
      real_name: m.real_name,
      phone: m.phone,
      birthday: m.birthday,
      vip_level: m.vip_level,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { data, error } = await supabase
      .from('members')
      .update(editForm)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      alert('儲存失敗：' + error.message);
      console.error(error);
    } else {
      setMembers((prev) => prev.map((m) => (m.id === id ? data : m)));
      setEditingId(null);
      setEditForm({});
    }
    setSaving(false);
  };

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

  return (
    <main className="min-h-screen bg-[#07080a] text-neutral-200 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif tracking-widest text-[#f5e6c8] text-xl font-bold">
            會員管理
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer"
          >
            <LogOut size={14} /> 登出
          </button>
        </div>

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

        {membersLoading ? (
          <p className="text-sm text-neutral-500">載入中...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#2a2b36]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#14151a] text-neutral-400 text-xs">
                  <th className="text-left px-3 py-2.5 font-medium">會員代碼</th>
                  <th className="text-left px-3 py-2.5 font-medium">暱稱</th>
                  <th className="text-left px-3 py-2.5 font-medium">真實姓名</th>
                  <th className="text-left px-3 py-2.5 font-medium">電話</th>
                  <th className="text-left px-3 py-2.5 font-medium">生日</th>
                  <th className="text-left px-3 py-2.5 font-medium">VIP 等級</th>
                  <th className="text-right px-3 py-2.5 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center px-3 py-8 text-neutral-500">
                      沒有符合的會員資料
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const isEditing = editingId === m.id;
                    return (
                      <tr key={m.id} className="border-t border-[#1e1f28]">
                        <td className="px-3 py-2.5 font-mono text-xs text-[#d4af37]">{m.member_code}</td>
                        <td className="px-3 py-2.5">{m.display_name}</td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
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
                          {isEditing ? (
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
                          {isEditing ? (
                            <input
                              type="date"
                              value={editForm.birthday ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, birthday: e.target.value }))}
                              className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1 text-xs"
                            />
                          ) : (
                            m.birthday
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              value={editForm.vip_level ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, vip_level: e.target.value }))}
                              className="w-full bg-[#1b1c24] border border-neutral-700 rounded px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className="text-[#d4af37]">{m.vip_level}</span>
                          )}
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
                            <button
                              onClick={() => startEdit(m)}
                              className="text-neutral-400 hover:text-[#d4af37] cursor-pointer"
                              title="編輯"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
