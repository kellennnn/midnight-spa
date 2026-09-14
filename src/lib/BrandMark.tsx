// Lounge Spa 品牌標誌：壁虎 + 弦月 + 星星。這是老闆提供的原始設計稿
// （public/brand-mark.png）去背後裁切出來的圖，不是手繪 SVG——保留這支
// 元件只是為了讓呼叫端維持同一個 <BrandMark className="h-X w-Y" /> 用法，
// 不用一個個改成 <img>。月亮後來調整了兩次，改得更高、更大、離壁虎更遠，
// 畫布因此往上加高不少，圖片比例變成約 548:580（寬:高 ≈ 0.94:1，比原圖
// 明顯更「直」）。套用 className 時寬高盡量抓這個比例，不然圖會被拉伸
// 變形；原本設計給寬扁框（例如 h-8 w-12 這種）用的地方，現在畫面上會
// 比較窄、留白變多，屬預期範圍內，真的太小的話可以把該處的寬高一起加大。
export function BrandMark({ className = 'h-8 w-12' }: { className?: string }) {
  return <img src="/brand-mark.png" alt="Lounge Spa" className={`${className} object-contain`} />;
}
