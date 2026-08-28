import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { Sparkles, Crown, Phone, Calendar, User, CheckCircle2 } from 'lucide-react';

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
}

function MemberComponent() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [lineProfile, setLineProfile] = useState<{ userId: string; displayName: string; pictureUrl?: string } | null>(null);

  const [realName, setRealName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = import.meta.env.VITE_LIFF_ID;
        
        if (liffId) {
          await liff.init({ liffId });

          if (liff.isLoggedIn()) {
            const userProfile = await liff.getProfile();
            setLineProfile({
              userId: userProfile.userId,
              displayName: userProfile.displayName,
              pictureUrl: userProfile.pictureUrl,
            });

            const { data, error } = await supabase
              .from('members')
              .select('*')
              .eq('line_user_id', userProfile.userId)
              .maybeSingle();

            if (data && !error) {
              setProfile(data);
              setLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('LIFF Init (Local Test Fallback):', err);
      }

      // 電腦本地預覽模式
      setLineProfile((prev) => prev || {
        userId: 'dev_test_user_001',
        displayName: '體驗貴賓 (電腦預覽)',
      });

      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('line_user_id', 'dev_test_user_001')
        .maybeSingle();

      if (data) {
        setProfile(data);
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

      const { data, error } = await supabase
        .from('members')
        .insert([newMember])
        .select()
        .single();

      if (error) {
        alert('開卡失敗：' + error.message);
        console.error(error);
      } else {
        setProfile(data);
      }
    } catch (err: any) {
      alert('連線失敗：' + (err.message || '請檢查網路與資料庫設定'));
      console.error(err);
    } finally {
      setSubmitting(false);
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
            <div className="p-6 bg-gradient-to-br from-[#1c1e29] to-[#101117] border border-[#d4af37]/30 rounded-xl shadow-lg relative">
              <div className="bg-white p-3.5 rounded-lg inline-block shadow-inner">
                <QRCodeSVG
                  value={profile.member_code}
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