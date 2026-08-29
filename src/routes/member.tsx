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

type PillOption = { value: string; hint?: string };

const PRESSURE_OPTIONS: PillOption[] = [
  { value: '輕柔放鬆', hint: '怕痛、純舒壓' },
  { value: '適中舒適', hint: '標準力道' },
  { value: '深層加強', hint: '重度受力、解緊繃' },
];

const FOCUS_AREA_OPTIONS: PillOption[] = [
  { value: '肩頸緊繃' },
  { value: '腰部酸痛' },
  { value: '腿部浮腫' },
  { value: '頭部放鬆' },
];

const AVOID_AREA_OPTIONS: PillOption[] = [
  { value: '舊傷處' },
  { value: '肚子' },
  { value: '腳底' },
  { value: '頸部' },
];

const AROMA_OPTIONS: PillOption[] = [
  { value: '木質調', hint: '雪松、檀香，助眠沉靜' },
  { value: '柑橘草本', hint: '甜橙、薰衣草，舒緩減壓' },
  { value: '清涼舒暢', hint: '薄荷、尤加利，提神通暢' },
  { value: '無香精／敏感肌專用' },
];

const INTERACTION_OPTIONS: PillOption[] = [
  { value: '安靜休息', hint: '只想閉眼睡覺，請勿過度交談' },
  { value: '適度引導', hint: '針對緊繃部位說明即可' },
  { value: '親切互動', hint: '喜歡放鬆聊天' },
];

function toggleInArray(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function SinglePillGroup({
  options,
  value,
  onChange,
}: {
  options: PillOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-left rounded-lg border px-3.5 py-2.5 text-sm transition-colors cursor-pointer ${
            value === opt.value
              ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#f5e6c8]'
              : 'border-neutral-700 bg-[#1b1c24] text-neutral-300 hover:border-neutral-500'
          }`}
        >
          <span className="font-medium">{opt.value}</span>
          {opt.hint && <span className="block text-[11px] text-neutral-500 mt-0.5">{opt.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function MultiPillGroup({
  options,
  value,
  onToggle,
}: {
  options: PillOption[];
  value: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            title={opt.hint}
            className={`rounded-full border px-3.5 py-2 text-xs transition-colors cursor-pointer ${
              selected
                ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#f5e6c8]'
                : 'border-neutral-700 bg-[#1b1c24] text-neutral-300 hover:border-neutral-500'
            }`}
          >
            {opt.value}
          </button>
        );
      })}
    </div>
  );
}

function MemberComponent() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [lineProfile, setLineProfile] = useState<{ userId: string; displayName: string; pictureUrl?: string } | null>(null);

  const [realName, setRealName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [pressurePreference, setPressurePreference] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [avoidAreas, setAvoidAreas] = useState<string[]>([]);
  const [aromaPreference, setAromaPreference] = useState<string[]>([]);
  const [interactionStyle, setInteractionStyle] = useState('');
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
      // 會員代碼是隨機抽的，理論上有極低機率跟其他會員撞號（資料庫有加 unique
      // 限制擋掉重複），所以這裡撞到的話就重抽一組再試一次，最多試 5 次。
      let insertError: { code?: string; message: string } | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const randomCode = 'MID-' + Math.floor(100000 + Math.random() * 900000);

        const newMember = {
          line_user_id: lineProfile.userId,
          member_code: randomCode,
          display_name: lineProfile.displayName,
          real_name: realName,
          phone: phone,
          birth_month: Number(birthMonth),
          birth_day: Number(birthDay),
          birth_year: birthYear ? Number(birthYear) : null,
          vip_level: 'VIP',
          pressure_preference: pressurePreference || null,
          focus_areas: focusAreas,
          avoid_areas: avoidAreas,
          aroma_preference: aromaPreference,
          interaction_style: interactionStyle || null,
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

  const birthdayText = profile
    ? profile.birth_month && profile.birth_day
      ? `${profile.birth_year ? profile.birth_year + ' 年 ' : ''}${profile.birth_month} 月 ${profile.birth_day} 日`
      : '未填寫'
    : '';

  return (
    <main className="min-h-screen bg-[#07080a] text-neutral-200 flex items-center justify-center p-4 py-10">
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
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="text-center mb-2">
              <Sparkles className="w-8 h-8 text-[#d4af37] mx-auto mb-2" />
              <h2 className="text-base font-semibold text-neutral-100">開通專屬 VIP 黑卡</h2>
              <p className="text-xs text-neutral-400 mt-1">完善資料即可享有尊榮預約與專屬貴賓禮遇</p>
            </div>

            <div>
              <label className="text-xs text-neutral-400 flex items-center gap-1.5 mb-1.5">
                <User size={14} /> 稱謂 / 暱稱
              </label>
              <input
                type="text"
                required
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="例如：沈先生、Ken（不需要填本名）"
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
                <Calendar size={14} /> 生日（月／日必填，年份選填，享有專屬生日禮）
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  required
                  min={1}
                  max={12}
                  placeholder="月"
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                />
                <input
                  type="number"
                  required
                  min={1}
                  max={31}
                  placeholder="日"
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                />
                <input
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  placeholder="年（選填）"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="w-full bg-[#1b1c24] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 space-y-5">
              <div>
                <p className="text-xs text-neutral-400 mb-2">力道偏好</p>
                <SinglePillGroup options={PRESSURE_OPTIONS} value={pressurePreference} onChange={setPressurePreference} />
              </div>

              <div>
                <p className="text-xs text-neutral-400 mb-2">希望加強部位（可複選）</p>
                <MultiPillGroup
                  options={FOCUS_AREA_OPTIONS}
                  value={focusAreas}
                  onToggle={(v) => setFocusAreas((prev) => toggleInArray(prev, v))}
                />
              </div>

              <div>
                <p className="text-xs text-neutral-400 mb-2">希望避開部位（可複選）</p>
                <MultiPillGroup
                  options={AVOID_AREA_OPTIONS}
                  value={avoidAreas}
                  onToggle={(v) => setAvoidAreas((prev) => toggleInArray(prev, v))}
                />
              </div>

              <div>
                <p className="text-xs text-neutral-400 mb-2">芳療香氣偏好（可複選）</p>
                <MultiPillGroup
                  options={AROMA_OPTIONS}
                  value={aromaPreference}
                  onToggle={(v) => setAromaPreference((prev) => toggleInArray(prev, v))}
                />
              </div>

              <div>
                <p className="text-xs text-neutral-400 mb-2">店內互動風格</p>
                <SinglePillGroup options={INTERACTION_OPTIONS} value={interactionStyle} onChange={setInteractionStyle} />
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
                <p className="text-[11px] text-neutral-400">貴賓稱謂</p>
                <p className="text-sm font-semibold text-neutral-200 mt-0.5">{profile.real_name}</p>
              </div>
              <div className="bg-[#171821] p-3 rounded-lg border border-neutral-800">
                <p className="text-[11px] text-neutral-400">生日</p>
                <p className="text-sm font-semibold text-neutral-200 mt-0.5">{birthdayText}</p>
              </div>
            </div>

            {(profile.pressure_preference ||
              profile.interaction_style ||
              profile.focus_areas.length > 0 ||
              profile.avoid_areas.length > 0 ||
              profile.aroma_preference.length > 0) && (
              <div className="text-left space-y-2 bg-[#171821] p-4 rounded-lg border border-neutral-800">
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
        )}
      </div>
    </main>
  );
}
