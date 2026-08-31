// Lounge Spa 品牌標誌：壁虎 + 弦月 + 星星。這是老闆提供的原始設計稿
// （public/brand-mark.png）去背後裁切出來的圖，不是手繪 SVG——保留這支
// 元件只是為了讓呼叫端維持同一個 <BrandMark className="h-X w-Y" /> 用法，
// 不用一個個改成 <img>。原圖比例約 548:374（寬:高 ≈ 1.465:1），套用
// className 時寬高盡量抓這個比例，不然圖會被拉伸變形。
export function BrandMark({ className = 'h-8 w-12' }: { className?: string }) {
  return <img src="/brand-mark.png" alt="Lounge Spa" className={`${className} object-contain`} />;
}
