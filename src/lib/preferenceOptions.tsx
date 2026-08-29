// 開卡表單跟 /admin 後台共用的體驗偏好選項清單與標籤選擇元件，
// 兩邊維持同一份定義，不用各自維護一份、以後容易兜不起來。

export type PillOption = { value: string; hint?: string };

export const PRESSURE_OPTIONS: PillOption[] = [
  { value: '輕柔放鬆', hint: '怕痛、純舒壓' },
  { value: '適中舒適', hint: '標準力道' },
  { value: '深層加強', hint: '重度受力、解緊繃' },
];

export const FOCUS_AREA_OPTIONS: PillOption[] = [
  { value: '肩頸緊繃' },
  { value: '腰部酸痛' },
  { value: '腿部浮腫' },
  { value: '頭部放鬆' },
];

export const AVOID_AREA_OPTIONS: PillOption[] = [
  { value: '舊傷處' },
  { value: '肚子' },
  { value: '腳底' },
  { value: '頸部' },
];

export const AROMA_OPTIONS: PillOption[] = [
  { value: '木質調', hint: '雪松、檀香，助眠沉靜' },
  { value: '柑橘草本', hint: '甜橙、薰衣草，舒緩減壓' },
  { value: '清涼舒暢', hint: '薄荷、尤加利，提神通暢' },
  { value: '無香精／敏感肌專用' },
];

export const INTERACTION_OPTIONS: PillOption[] = [
  { value: '安靜休息', hint: '只想閉眼睡覺，請勿過度交談' },
  { value: '適度引導', hint: '針對緊繃部位說明即可' },
  { value: '親切互動', hint: '喜歡放鬆聊天' },
];

export function toggleInArray(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function SinglePillGroup({
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

export function MultiPillGroup({
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
