import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { Sparkles, Crown, Phone, Calendar, User, CheckCircle2, Pencil } from 'lucide-react';

export const Route = createFileRoute('/member')({
  component: MemberComponent,
});

interface MemberProfile {
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

function MemberComponent() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [lineProfile, setLineProfile] = useState<{ userId: string; displayName: string; pictureUrl?: string } | null>(null);

  const [realName, setRealName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSubmitting, setNicknameSubmitting] = useState(false);

  useEffect(() => {
    const initLiff = async () => {
      let realProfile: { userId: string; displayName: string; pictureUrl?: string } | null = null;

      try {
        const liffId = import.meta.env.VITE_LIFF_ID;

        if (liffId) {
          await liff.init({ liffId });

          if (liff.isLoggedIn()) {
            const userProfile = await liff.getProfile();
            realProfile = {
              userId: userProfile.userId,
              displayName: userProfile.displayName,
              pictureUrl: userProfile.pictureUrl,
            };
          }
        }
      } catch (err) {
        console.warn('LIFF Init (Local Test Fallback):', err);
      }

      // 拿到真實 LINE 使用者就一定用他的身份查詢；只有完全拿不到 LIFF 資訊
      // （例如電腦本地預覽）才 fallback 成測試帳號，避免新客人被誤判成 dev_test_user_001。
      const activeProfile = realProfile || {
        userId: 'dev_test_user_001',
        displayName: '體驗貴賓 (電腦預覽)',
      };
      setLineProfile(activeProfile);

      // 用安全函式查詢，伺服器端只會回傳這個 line_user_id 對應的單一筆資料，
      // 不會有機會撈到別人的會員資料（詳見 supabase/sql/001_lockdown_members_rls.sql）。
      const { data, error } = await supabase.rpc('get_member_by_line_id', {
        p_line_user_id: activeProfile.userId,
      });

      if (error) {
        console.error('get_member_by_line_id failed:', error);
      } else if (data && data.length > 0) {
        setProfile(data[0]);
      }

      setLoading(false);
    };

    initLiff();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineProfile) {
      alert('無法取得使用者資訊，請重新整理！');
      return;
    }

    setSubmitting(true);
    try {
      const randomCode = 'MID-' + Math.floor(100000 + Math.random() * 900000);

      const newMember = {
        line_user_id: lineProfile.userId,
        member_code: randomCode,
        display_name: lineProfile.displayName,
        real_name: realName,
        phone: phone,
        birthday: birthday,
        vip_level: 'VIP',
      };

      // anon 角色現在只有 insert 權限、沒有 select 權限，insert 後沒辦法直接
      // .select() 讀回那一列，所以改成用安全函式 get_member_by_line_id 另外撈一次。
      const { error: insertError } = await supabase.from('members').insert([newMember]);

      if (insertError) {
        alert('開卡失敗：' + insertError.message);
        console.error(insertError);
      } else {
        const { data, error } = await supabase.rpc('get_member_by_line_id', {
          p_line_user_id: lineProfile.userId,
        });

        if (error || !data || data.length === 0) {
          alert('開卡成功，但讀取會員卡失敗，請重新整理頁面');
          console.error(error);
        } else {
          setProfile(data[0]);
        }
      }
    } catch (err: any) {
      alert('連線失敗：' + (err.message || '請檢查網路與資料庫設定'));
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || profile.nickname_locked) return;

    const trimmed = nicknameInput.trim();
    if (!trimmed) return;

    setNicknameSubmitting(true);
    try {
      // 安全函式在伺服器端強制檢查 id + line_user_id 都要對得上，而且還沒改過，
      // 就算有人繞過前端 UI 直接呼叫，也改不了別人的資料、也改不了第二次。
      const { data, error } = await supabase.rpc('update_member_nickname', {
        p_id: profile.id,
        p_line_user_id: profile.line_user_id,
        p_new_name: trimmed,
      });

      if (error) {
        alert('更新暱稱失敗：' + error.message);
        console.error(error);
      } else if (data && data.length > 0) {
        setProfile(data[0]);
        setEditingNickname(false);
      } else {
        alert('暱稱已經修改過一次了，無法再次修改。');
        setEditingNickname(false);
      }
    } catch (err: any) {
      alert('連線失敗：' + (err.message || '請稍後再試'));
      console.error(err);
    } finally {
      setNicknameSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center text-[#d4af37]">
        <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="tracking-widest text-sm text-neutral-400">正在連接 MIDNIGHT VIP 系統...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#07080a] text-neutral-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-b from-[#14151a] to-[#0c0d10] border border-[#2a2b36] rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            {lineProfile?.pictureUrl ? (
              <img src={lineProfile.pictureUrl} alt="Avatar" className="w-10 h-10 rounded-full border border-[#d4af37]/40 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1e2029] border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
                <User size={20} />
              </div>
            )}
            <div>
              <h1 className="font-serif tracking-widest text-[#f5e6c8] text-lg font-bold">MIDNIGHT SPA</h1>
              <p className="text-xs text-neutral-500 tracking-wider">VIP EXCLUSIVE PASS</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[#d4af37] bg-[#d4af37]/10 px-2.5 py-1 rounded-full text-xs font-semibold">
            <Crown size={14} />
            <span>{profile?.vip_level || 'GUEST'}</span>
          </div>
        </div>

        {!profile ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="text-center mb-6">
              <Sparkles className="w-8 h-8 text-[#d4af37] mx-auto mb-2" />
              <h2 className="text-base font-semibold text-neutral-100">開通專屬 VIP 黑卡</h2>
              <p className="text-xs text-neutral-400 mt-1">完善資料即可享有尊榮預約與專屬貴賓禮遇</p>
            </div>

            <div>
              <label className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1.5">
                <User size={14} /> 真實姓名
              </label>
              <input
                type="text"
                required
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="請輸入姓名"
                className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1.5">
                <Phone size={14} /> 手機號碼
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1.5">
                <Calendar size={14} /> 生日（享有專屬生日禮）
              </label>
              <input
                type="date"
                required
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 bg-gradient-to-r from-[#d4af37] to-[#aa8024] hover:brightness-110 text-black font-semibold py-3 rounded-lg text-sm tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {submitting ? '開卡處理中...' : '開通 VIP 會員卡'}
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-center">
            <div>
              {editingNickname ? (
                <form onSubmit={handleNicknameSubmit} className="flex items-center justify-center gap-2">
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={20}
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    className="flex-1 max-w-[180px] bg-[#1b1c24] border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                  />
                  <button
                    type="submit"
                    disabled={nicknameSubmitting}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa8024] text-black font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {nicknameSubmitting ? '儲存中...' : '儲存'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingNickname(false)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 cursor-pointer"
                  >
                    取消
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm font-medium text-neutral-100">{profile.display_name}</span>
                  {!profile.nickname_locked && (
                    <button
                      type="button"
                      onClick={() => {
                        setNicknameInput(profile.display_name);
                        setEditingNickname(true);
                      }}
                      className="flex items-center gap-1 text-[11px] text-[#d4af37] cursor-pointer"
                    >
                      <Pencil size={11} /> 編輯暱稱
                    </button>
                  )}
                </div>
              )}
              {profile.nickname_locked && (
                <p className="text-[11px] text-neutral-500 mt-1">暱稱僅能修改一次，如需再次變更請洽門市</p>
              )}
            </div>

            <div className="p-6 bg-gradient-to-br from-[#1c1e29] to-[#101117] border border-[#d4af37]/30 rounded-xl shadow-lg relative">
              <div className="bg-white p-3.5 rounded-lg inline-block shadow-inner">
                <QRCodeSVG
                  value={`${window.location.origin}/admin?code=${encodeURIComponent(profile.member_code)}`}
                  size={168}
                  level="H"
                  includeMargin={false}
                />
              </div>
              
              <div className="mt-4">
                <p className="text-xs text-neutral-400 tracking-widest uppercase">Member Code</p>
                <p className="font-mono text-lg font-bold text-[#f5e6c8] tracking-widest mt-0.5">{profile.member_code}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-[#171821] p-3 rounded-lg border border-neutral-800">
                <p className="text-[11px] text-neutral-400">貴賓姓名</p>
                <p className="text-sm font-semibold text-neutral-200 mt-0.5">{profile.real_name}</p>
              </div>
              <div className="bg-[#171821] p-3 rounded-lg border border-neutral-800">
                <p className="text-[11px] text-neutral-400">會員狀態</p>
                <p className="text-sm font-semibold text-[#d4af37] mt-0.5">專屬 VIP 會員</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 pt-2">
              <CheckCircle2 size={13} className="text-[#d4af37]" />
              <span>來店出示 QR Code 即可享有專屬尊榮禮遇</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}