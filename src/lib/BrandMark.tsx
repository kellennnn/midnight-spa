// Lounge Spa 品牌標誌：壁虎 + 弦月 + 星星。這是老闆提供的原始設計稿
// （public/brand-mark.png）去背後裁切出來的圖，不是手繪 SVG——保留這支
// 元件只是為了讓呼叫端維持同一個 <BrandMark className="h-X w-Y" /> 用法，
// 不用一個個改成 <img>。月亮後來被調整得更高、更大、離壁虎更遠，畫布
// 因此往上加高，圖片比例變成約 548:508（寬:高 ≈ 1.08:1，比舊版更接近
// 正方形）。套用 className 時寬高盡量抓這個比例，不然圖會被拉伸變形；
// 舊版較寬的框（例如 h-8 w-12 這種）現在會在左右留一點空白，屬預期範圍內。
export function BrandMark({ className = 'h-8 w-12' }: { className?: string }) {
  return <img src="/brand-mark.png" alt="Lounge Spa" className={`${className} object-contain`} />;
}
