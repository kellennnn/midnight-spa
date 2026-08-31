import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import content from '@/content.json';
import { BrandMark } from '@/lib/BrandMark';
import { Sparkles, Crown, Phone, Calendar, User, CheckCircle2, Pencil, CalendarPlus, X, Clock3 } from 'lucide-react';

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
}

interface Booking {
  id: string;
  preferred_date: string;
  preferred_time: string | null;
  service_item: string;
  therapist_preference: string | null;
  note: string | null;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
  staff_note: string | null;
  created_at: string;
}

// 24 小時營業，時段選單以 30 分鐘為一格（00:00、00:30 ... 23:30）
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

const BOOKING_STATUS_LABEL: Record<Booking['status'], { label: string; className: string }> = {
  pending: { label: '待確認', className: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  confirmed: { label: '已確認', className: 'text-green-400 border-green-500/30 bg-green-500/10' },
  declined: { label: '無法安排', className: 'text-red-400 border-red-500/30 bg-red-500/10' },
  cancelled: { label: '已取消', className: 'text-neutral-500 border-neutral-700 bg-neutral-800/40' },
  completed: { label: '已完成', className: 'text-[#d4af37] border-[#d4af37]/30 bg-[#d4af37]/10' },
};

function MemberComponent() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [lineProfile, setLineProfile] = useState<{ userId: string; displayName: string; pictureUrl?: string } | null>(null);

  const [realName, setRealName] = useState('');
  const [regNickname, setRegNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSubmitting, setNicknameSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<'card' | 'booking'>('card');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    date: '',
    time: '',
    service: content.services?.[0]?.name || '',
    therapist: '',
    note: '',
  });

  useEffect(() => {
    const initLiff = async () => {
      let realProfile: { userId: string; displayName: string; pictureUrl?: string } | null = null;

      try {
        const liffId = import.meta.env.VITE_LIFF_ID;

        if (liffId) {
          await liff.init({ liffId });

          if (!liff.isLoggedIn()) {
            // 不是每次開這個網址都一定會自動帶著 LINE 登入狀態（例如直接貼網址
            // 在瀏覽器打開、或不是從官方帳號選單點進來），這時候要主動導去 LINE
            // 登入頁，確認是「這支手機、這個 LINE 帳號」真正是誰，而不是隨便
            // 都當同一個訪客處理。登入完成後 LINE 會把使用者導回這一頁，
            // 屆時 isLoggedIn() 才會是 true，所以這裡先中斷，不往下跑。
            liff.login({ redirectUri: window.location.href });
            return;
          }

          const userProfile = await liff.getProfile();
          realProfile = {
            userId: userProfile.userId,
            displayName: userProfile.displayName,
            pictureUrl: userProfile.pictureUrl,
          };
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
      // 開卡表單的「暱稱」欄位預設帶入 LINE 名稱，客人可以直接改成自己想顯示的名字
      setRegNickname(activeProfile.displayName);

      // 用安全函式查詢，伺服器端只會回傳這個 line_user_id 對應的單一筆資料，
      // 不會有機會撈到別人的會員資料（詳見 supabase/sql/001_lockdown_members_rls.sql）。
      const { data, error } = await supabase.rpc('get_member_by_line_id', {
        p_line_user_id: activeProfile.userId,
      });

      if (error) {
        console.error('get_member_by_line_id failed:', error);
      } else if (data && data.length > 0) {
        setProfile(data[0]);
        loadBookings(activeProfile.userId);
      }

      setLoading(false);
    };

    initLiff();
  }, []);

  const loadBookings = async (lineUserId: string) => {
    const { data, error } = await supabase.rpc('get_my_bookings', { p_line_user_id: lineUserId });
    if (error) {
      console.error('get_my_bookings failed:', error);
    } else {
      setBookings(data || []);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineProfile) {
      alert('無法取得使用者資訊，請重新整理！');
      return;
    }

    // 未滿 18 歲不開放註冊。資料庫也有同樣的檢查（見
    // supabase/sql/006_require_adult_member.sql），這裡只是讓客人
    // 馬上看到提示，不用等送出才被伺服器擋下來。
    const birthDate = new Date(Number(birthYear), Number(birthMonth) - 1, Number(birthDay));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!hasHadBirthdayThisYear) age -= 1;

    if (age < 18) {
      alert('很抱歉，未滿 18 歲無法開通 VIP 會員卡。');
      return;
    }

    setSubmitting(true);
    try {
      // 會員代碼是隨機抽的，理論上有極低機率跟其他會員撞號（資料庫有加 unique
      // 限制擋掉重複），所以這裡撞到的話就重抽一組再試一次，最多試 5 次。
      let insertError: { code?: string; message: string } | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const randomCode = 'LSP-' + Math.floor(100000 + Math.random() * 900000);

        const newMember = {
          line_user_id: lineProfile.userId,
          member_code: randomCode,
          display_name: regNickname,
          real_name: realName,
          phone: phone,
          birth_month: Number(birthMonth),
          birth_day: Number(birthDay),
          birth_year: Number(birthYear),
          vip_level: 'VIP',
          // 力道偏好、加強/避開部位、香氣偏好、互動風格這些體驗偏好，
          // 客人開卡當下不用填，只能由店員之後在 /admin 後台幫忙補上。
        };

        const { error } = await supabase.from('members').insert([newMember]);

        if (!error) {
          insertError = null;
          break;
        }

        insertError = error;
        if (error.code !== '23505') {
          // 不是「代碼重複」造成的錯誤，重試也沒用，直接停下來
          break;
        }
      }

      // anon 角色現在只有 insert 權限、沒有 select 權限，insert 後沒辦法直接
      // .select() 讀回那一列，所以改成用安全函式 get_member_by_line_id 另外撈一次。
      if (insertError) {
        const friendlyMessage = insertError.message.includes('at least 18 years old')
          ? '很抱歉，未滿 18 歲無法開通 VIP 會員卡。'
          : insertError.message;
        alert('開卡失敗：' + friendlyMessage);
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

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setBookingSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_booking_request', {
        p_line_user_id: profile.line_user_id,
        p_preferred_date: bookingForm.date,
        p_preferred_time: bookingForm.time || null,
        p_service_item: bookingForm.service,
        p_therapist_preference: bookingForm.therapist || null,
        p_note: bookingForm.note || null,
      });

      if (error) {
        alert('預約送出失敗：' + error.message);
        console.error(error);
      } else {
        setBookings((prev) => [...(data || []), ...prev]);
        setShowBookingForm(false);
        setBookingForm({ date: '', time: '', service: content.services?.[0]?.name || '', therapist: '', note: '' });
        alert('預約請求已送出，我們會盡快與您確認時段！');
      }
    } catch (err: any) {
      alert('連線失敗：' + (err.message || '請稍後再試'));
      console.error(err);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (!profile) return;
    if (!window.confirm('確定要取消這筆預約請求嗎？')) return;

    const { data, error } = await supabase.rpc('cancel_my_booking', {
      p_id: id,
      p_line_user_id: profile.line_user_id,
    });

    if (error) {
      alert('取消失敗：' + error.message);
      console.error(error);
    } else if (data && data.length > 0) {
      setBookings((prev) => prev.map((b) => (b.id === id ? data[0] : b)));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1523] flex flex-col items-center justify-center text-[#d4af37]">
        <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="tracking-widest text-sm text-neutral-400">正在連接 LOUNGE VIP 系統...</p>
      </div>
    );
  }

  const birthdayText = profile
    ? profile.birth_month && profile.birth_day
      ? `${profile.birth_year ? profile.birth_year + ' 年 ' : ''}${profile.birth_month} 月 ${profile.birth_day} 日`
      : '未填寫'
    : '';

  return (
    <main className="min-h-screen bg-[#0a1420] text-neutral-200 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md bg-gradient-to-b from-[#152236] to-[#0d1726] border border-[#2b4670] rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            {lineProfile?.pictureUrl ? (
              <img src={lineProfile.pictureUrl} alt="Avatar" className="w-10 h-10 rounded-full border border-[#d4af37]/40 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#213759] border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
                <User size={20} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <BrandMark className="h-4 w-4 text-[#d4af37]" />
                <h1 className="font-serif tracking-widest text-[#f5e6c8] text-lg font-bold">LOUNGE Spa</h1>
              </div>
              <p className="text-xs text-neutral-500 tracking-wider">VIP EXCLUSIVE PASS</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[#d4af37] bg-[#d4af37]/10 px-2.5 py-1 rounded-full text-xs font-semibold">
            <Crown size={14} />
            <span>{profile?.vip_level || 'GUEST'}</span>
          </div>
        </div>

        {profile && (
          <div className="flex items-center gap-1 border-b border-neutral-800 mb-5">
            {(
              [
                ['card', '會員卡'],
                ['booking', '預約'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                  activeTab === key
                    ? 'border-[#d4af37] text-[#f5e6c8]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {!profile ? (
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="text-center mb-2">
              <Sparkles className="w-8 h-8 text-[#d4af37] mx-auto mb-2" />
              <h2 className="text-base font-semibold text-neutral-100">開通專屬 VIP 黑卡</h2>
              <p className="text-xs text-neutral-400 mt-1">完善資料即可享有尊榮預約與專屬貴賓禮遇</p>
            </div>

            <div>
              <label className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1.5">
                <User size={14} /> 真實姓名
                <span className="text-neutral-600">（開通後無法修改，請務必填寫正確）</span>
              </label>
              <input
                type="text"
                required
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="請輸入真實姓名"
                className="w-full bg-[#1c2f4a] border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1.5">
                <Sparkles size={14} /> 暱稱
              </label>
              <input
                type="text"
                required
                value={regNickname}
                onChange={(e) => setRegNickname(e.target.value)}
                placeholder="例如：王小明"
                className="w-full bg-[#1c2f4a] border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1.5">
                <Phone size={14} /> 手機號碼
                <span className="text-neutral-600">（開通後無法修改）</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                className="w-full bg-[#1c2f4a] border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1.5">
                <Calendar size={14} /> 生日
                <span className="text-neutral-600">（開通後無法修改，須年滿 18 歲才能開卡）</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  required
                  min={1900}
                  max={new Date().getFullYear()}
                  placeholder="年"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="w-full bg-[#1c2f4a] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                />
                <input
                  type="number"
                  required
                  min={1}
                  max={12}
                  placeholder="月"
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="w-full bg-[#1c2f4a] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                />
                <input
                  type="number"
                  required
                  min={1}
                  max={31}
                  placeholder="日"
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="w-full bg-[#1c2f4a] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 bg-gradient-to-r from-[#d4af37] to-[#aa8024] hover:brightness-110 text-black font-semibold py-3 rounded-lg text-sm tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {submitting ? '開卡處理中...' : '開通 VIP 會員卡'}
            </button>
          </form>
        ) : activeTab === 'card' ? (
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
                    className="flex-1 max-w-[180px] bg-[#1c2f4a] border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
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

            <div className="p-6 bg-gradient-to-br from-[#1e3252] to-[#111c2f] border border-[#d4af37]/30 rounded-xl shadow-lg relative">
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
              <div className="bg-[#1a2941] p-3 rounded-lg border border-neutral-800">
                <p className="text-[11px] text-neutral-400">真實姓名</p>
                <p className="text-sm font-semibold text-neutral-200 mt-0.5">{profile.real_name}</p>
              </div>
              <div className="bg-[#1a2941] p-3 rounded-lg border border-neutral-800">
                <p className="text-[11px] text-neutral-400">生日</p>
                <p className="text-sm font-semibold text-neutral-200 mt-0.5">{birthdayText}</p>
              </div>
            </div>

            {(profile.pressure_preference ||
              profile.interaction_style ||
              profile.focus_areas.length > 0 ||
              profile.avoid_areas.length > 0 ||
              profile.aroma_preference.length > 0) && (
              <div className="text-left space-y-2 bg-[#1a2941] p-4 rounded-lg border border-neutral-800">
                <p className="text-[11px] text-neutral-400 uppercase tracking-widest">我的體驗偏好</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    profile.pressure_preference,
                    profile.interaction_style,
                    ...profile.focus_areas,
                    ...profile.avoid_areas,
                    ...profile.aroma_preference,
                  ]
                    .filter(Boolean)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-[#d4af37]/30 text-[#d4af37] bg-[#d4af37]/5"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 pt-2">
              <CheckCircle2 size={13} className="text-[#d4af37]" />
              <span>來店出示 QR Code 即可享有專屬尊榮禮遇</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-left bg-[#1a2941] p-4 rounded-lg border border-neutral-800 space-y-3">
              <p className="text-[11px] text-neutral-400 uppercase tracking-widest">預約服務</p>

              {!showBookingForm && (
                <button
                  type="button"
                  onClick={() => setShowBookingForm(true)}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#d4af37] to-[#aa8024] hover:brightness-110 text-black font-semibold py-3 rounded-lg text-sm tracking-wider transition-all duration-200 cursor-pointer"
                >
                  <CalendarPlus size={16} /> 我要預約
                </button>
              )}

              {showBookingForm && (
                <form onSubmit={handleBookingSubmit} className="space-y-2.5 border-b border-neutral-800 pb-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label className="text-[10px] text-neutral-500 mb-1 block">預約日期</label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().slice(0, 10)}
                        value={bookingForm.date}
                        onChange={(e) => setBookingForm((f) => ({ ...f, date: e.target.value }))}
                        className="w-full min-w-0 bg-[#1c2f4a] border border-neutral-700 rounded-lg px-2.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-[10px] text-neutral-500 mb-1 block">預約時段</label>
                      <select
                        value={bookingForm.time}
                        onChange={(e) => setBookingForm((f) => ({ ...f, time: e.target.value }))}
                        className="w-full min-w-0 bg-[#1c2f4a] border border-neutral-700 rounded-lg px-2.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                      >
                        <option value="">選擇時段</option>
                        {TIME_SLOTS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <select
                    value={bookingForm.service}
                    onChange={(e) => setBookingForm((f) => ({ ...f, service: e.target.value }))}
                    className="w-full bg-[#1c2f4a] border border-neutral-700 rounded-lg px-2.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                  >
                    {content.services?.map((s: any) => (
                      <option key={s.name} value={s.name}>
                        {s.name}（{s.min}）
                      </option>
                    ))}
                  </select>
                  <select
                    value={bookingForm.therapist}
                    onChange={(e) => setBookingForm((f) => ({ ...f, therapist: e.target.value }))}
                    className="w-full bg-[#1c2f4a] border border-neutral-700 rounded-lg px-2.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="">不指定人員</option>
                    {content.therapists?.map((t: any) => (
                      <option key={t.no} value={t.name}>
                        {t.name}（{t.no}）
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={bookingForm.note}
                    onChange={(e) => setBookingForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="備註（例如：時段可彈性調整）"
                    rows={2}
                    className="w-full bg-[#1c2f4a] border border-neutral-700 rounded-lg px-2.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-[#d4af37] resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={bookingSubmitting}
                      className="flex-1 text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa8024] text-black font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {bookingSubmitting ? '送出中...' : '送出預約請求'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBookingForm(false)}
                      className="text-xs px-3 py-2 rounded-lg border border-neutral-700 text-neutral-400 cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-500">送出後為「待確認」狀態，我們會盡快與您確認實際時段。</p>
                </form>
              )}

              {bookings.length === 0 ? (
                !showBookingForm && <p className="text-xs text-neutral-500">目前沒有預約紀錄</p>
              ) : (
                <div className="space-y-2">
                  {bookings.map((b) => {
                    const status = BOOKING_STATUS_LABEL[b.status];
                    return (
                      <div key={b.id} className="bg-[#0f1a2b] border border-neutral-800 rounded-lg p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-neutral-200">
                            <Clock3 size={12} className="text-neutral-500" />
                            {b.preferred_date}
                            {b.preferred_time && ` ${b.preferred_time}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-neutral-400 mt-1">{b.service_item}</p>
                        {b.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(b.id)}
                            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 mt-1.5 cursor-pointer"
                          >
                            <X size={10} /> 取消預約
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
