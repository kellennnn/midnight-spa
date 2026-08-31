import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import content from "@/content.json";
import { BrandMark } from "@/lib/BrandMark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: content.seo.title },
      { name: "description", content: content.seo.description },
      { property: "og:title", content: content.seo.ogTitle },
      { property: "og:description", content: content.seo.ogDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Shift = "早班" | "晚班";
type Tier = "standard" | "premium";

type Therapist = {
  no: string;
  name: string;
  photos: string[];
  tags: string[];
  schedule: string;
  shift: Shift;
  onDuty: boolean;
  tier: Tier;
};

const therapists = content.therapists as Therapist[];
const services = content.services;

function Moon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" fill="none" aria-hidden="true">
      <path
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function Sun() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* 淺色／深色模式切換按鈕 */
function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return document.documentElement.classList.contains("light") ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    try {
      localStorage.setItem("midnight-spa-theme", theme);
    } catch {
      // 容錯處理
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label={theme === "dark" ? "切換為淺色模式" : "切換為深色模式"}
      className="group fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-4 py-3 shadow-[0_4px_25px_oklch(0.72_0.14_38/38%)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-primary"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
      <span className="text-xs tracking-[0.16em] text-silver group-hover:text-primary">
        {theme === "dark" ? "淺色模式" : "深色模式"}
      </span>
    </button>
  );
}

function Stardust() {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: (i * 37) % 100,
        top: (i * 61) % 100,
        size: (i % 3) + 1,
        delay: (i % 7) * 0.6,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className="star absolute rounded-full bg-silver"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-12 text-center">
      <p className="mb-3 text-xs uppercase tracking-[0.42em] text-muted-foreground">{eyebrow}</p>
      <h2 className="text-3xl font-light text-gradient-rose sm:text-4xl">{title}</h2>
      <div className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-primary to-transparent" />
    </div>
  );
}

/* 置頂公告列：低調單行輪播，一次只顯示一則，淡入淡出切換 */
function AnnouncementMarquee() {
  const announcements = [
    "✦ 採會員專屬預約制 ｜ 首次使用請先完成會員註冊",
    "✦ 24H 全年無休 ｜ 獨立私密包廂，全時段開放線上預約",
    "✦ 全館嚴格執行一客一清消毒 ｜ 享受純淨無干擾的解壓時光",
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  return (
    <div className="fixed inset-x-0 top-0 z-40 h-12 w-full border-b-2 border-primary/50 bg-card/90 shadow-[0_2px_20px_oklch(0.76_0.12_83/15%)] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-center px-6">
        <p
          key={index}
          className="announcement-fade truncate text-center text-sm font-medium tracking-[0.18em] text-primary sm:text-base"
        >
          {announcements[index]}
        </p>
      </div>
    </div>
  );
}

/* 頂部導覽列：釘在公告列下方，左側品牌標誌，右側導覽連結 */
function QuickNav() {
  const accentColors = ["text-primary", "text-[#e5b292]", "text-silver"];
  return (
    <nav className="fixed inset-x-0 top-12 z-30 h-20 border-b border-white/5 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6">
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <BrandMark className="h-8 w-12 text-primary" />
          <span className="font-serif text-base tracking-[0.22em] text-silver sm:text-lg">
            Lounge <span className="text-primary">Spa</span>
          </span>
        </a>
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto sm:gap-3">
          {content.nav
            .filter((item) => item.href !== "/member" && item.href !== "#booking")
            .map((item, i) => (
              <a
                key={item.href}
                href={item.href}
                className={`group relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium tracking-[0.18em] transition-colors sm:text-base ${accentColors[i % accentColors.length]} opacity-80 hover:opacity-100`}
              >
                {item.label}
                <span className="absolute inset-x-3 -bottom-0.5 h-px scale-x-0 bg-current transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
        </div>
      </div>
    </nav>
  );
}

/* 人員相簿 Modal */
function TherapistModal({
  therapist,
  onClose,
}: {
  therapist: Therapist;
  onClose: () => void;
}) {
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoomIndex !== null) setZoomIndex(null);
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [zoomIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="hairline relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="關閉"
          className="hairline absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-silver"
        >
          ✕
        </button>

        <h3 className="text-2xl font-light text-silver">
          {therapist.no} · {therapist.name}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {therapist.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full hairline px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs tracking-[0.16em] text-muted-foreground">
          當日班表 {therapist.schedule}（{therapist.shift}）
        </p>

        <button
          onClick={() => setZoomIndex(0)}
          aria-label="放大檢視照片"
          className="group relative mx-auto mt-6 block aspect-[3/4] w-full max-w-xs overflow-hidden rounded-md hairline"
        >
          <img
            src={therapist.photos[0]}
            alt={therapist.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 backdrop-blur-0 transition-all duration-300 group-hover:bg-background/50 group-hover:opacity-100 group-hover:backdrop-blur-sm">
            <span className="rounded-full hairline bg-card/90 px-4 py-2 text-[11px] tracking-[0.18em] text-silver">
              點擊放大
            </span>
          </div>
        </button>

      </div>

      {zoomIndex !== null && (
        <PhotoLightbox
          photos={therapist.photos}
          name={therapist.name}
          index={zoomIndex}
          onClose={() => setZoomIndex(null)}
          onIndexChange={setZoomIndex}
        />
      )}
    </div>
  );
}

/* 照片放大檢視燈箱 */
function PhotoLightbox({
  photos,
  name,
  index,
  onClose,
  onIndexChange,
}: {
  photos: string[];
  name: string;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIndexChange((index - 1 + photos.length) % photos.length);
  };
  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIndexChange((index + 1) % photos.length);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="關閉放大檢視"
        className="hairline absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-silver transition-colors hover:text-primary"
      >
        ✕
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="上一張"
            className="hairline absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-silver transition-colors hover:text-primary sm:left-6"
          >
            ‹
          </button>
          <button
            onClick={goNext}
            aria-label="下一張"
            className="hairline absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-silver transition-colors hover:text-primary sm:right-6"
          >
            ›
          </button>
        </>
      )}

      <img
        src={photos[index]}
        alt={`${name} 放大照片 ${index + 1}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-md object-contain"
      />

      {photos.length > 1 && (
        <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-[0.2em] text-silver/80">
          {index + 1} / {photos.length}
        </span>
      )}
    </div>
  );
}

/* 進站年齡確認頁：擋在最上層，確認過一次後用 localStorage 記住 */
function AgeGate() {
  const [verified, setVerified] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("midnight-spa-age-verified") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = verified ? previousOverflow : "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [verified]);

  if (verified) return null;

  const handleConfirm = () => {
    try {
      localStorage.setItem("midnight-spa-age-verified", "true");
    } catch {
      // localStorage 不可用時，本次瀏覽仍可繼續，只是下次會再問一次
    }
    setVerified(true);
  };

  const handleDecline = () => {
    window.location.href = "https://www.google.com";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
      <div className="hairline w-full max-w-sm rounded-lg bg-card/95 p-8 text-center backdrop-blur-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <BrandMark className="h-5 w-8 text-silver" />
          <span className="text-xs tracking-[0.34em] text-silver">{content.site.name}</span>
        </div>
        <h2 className="text-xl font-light text-silver">年齡確認</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          本網站內容僅適合年滿 18 歲之成年人瀏覽。
          <br />
          請問您是否已年滿 18 歲？
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            className="glow-cta rounded-full bg-primary px-6 py-3 text-sm font-medium tracking-[0.16em] text-primary-foreground"
          >
            是，我已年滿 18 歲
          </button>
          <button
            onClick={handleDecline}
            className="hairline rounded-full px-6 py-3 text-sm tracking-[0.16em] text-muted-foreground transition-colors hover:text-silver"
          >
            否，離開網站
          </button>
        </div>
      </div>
    </div>
  );
}

/* 人員卡片：一般 / 進階兩組共用同一張卡片，premium 為 true 時套用香檳金
   邊框、光暈與內框，跟進階價目卡是同一套「黑金珠寶盒」視覺語言。 */
function TherapistCard({
  t,
  onOpen,
  premium = false,
}: {
  t: Therapist;
  onOpen: (t: Therapist) => void;
  premium?: boolean;
}) {
  return (
    <article
      onClick={() => onOpen(t)}
      className={
        premium
          ? "group relative cursor-pointer overflow-hidden rounded-lg border border-[#E5B292]/70 bg-gradient-to-b from-[#1c1e2b] to-[#0f1017] shadow-[0_0_25px_rgba(229,178,146,0.18)] transition-transform duration-500 hover:-translate-y-1"
          : "group cursor-pointer overflow-hidden rounded-lg hairline bg-card/70 backdrop-blur-sm transition-transform duration-500 hover:-translate-y-1"
      }
    >
      {premium && (
        <div className="pointer-events-none absolute inset-1.5 z-10 rounded-md border border-[#E5B292]/20" />
      )}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={t.photos[0]}
          alt={`${t.no} ${t.name}`}
          width={768}
          height={1024}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
          <span className="rounded-full hairline bg-card/90 px-4 py-2 text-[11px] tracking-[0.18em] text-silver">
            查看詳細資料
          </span>
        </div>
        <span
          className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] tracking-[0.18em] ${
            t.onDuty
              ? "bg-primary/90 text-primary-foreground font-medium"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {t.onDuty ? "上班中" : "休假"}
        </span>
      </div>
      <div className="relative z-10 p-5">
        <h3 className={`text-xl font-light ${premium ? "text-[#FCEADE]" : "text-silver"}`}>
          {t.no} · {t.name}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {t.tags.map((tag) => (
            <span
              key={tag}
              className={
                premium
                  ? "rounded-full border border-[#E5B292]/40 px-2.5 py-1 text-[11px] text-[#E5B292]"
                  : "rounded-full hairline px-2.5 py-1 text-[11px] text-muted-foreground"
              }
            >
              {tag}
            </span>
          ))}
        </div>
        <p
          className={`mt-4 text-xs tracking-[0.16em] ${premium ? "text-gray-300" : "text-muted-foreground"}`}
        >
          當日班表 {t.schedule}（{t.shift}）
        </p>
      </div>
    </article>
  );
}

function Index() {
  const [filter, setFilter] = useState<"全部" | "今日上班中" | Shift>("全部");
  const [openPerson, setOpenPerson] = useState<Therapist | null>(null);

  const list = therapists.filter((t) =>
    filter === "全部" ? true : filter === "今日上班中" ? t.onDuty : t.shift === filter,
  );
  const standardList = list.filter((t) => t.tier === "standard");
  const premiumList = list.filter((t) => t.tier === "premium");

  return (
    <main className="min-h-screen bg-background">
      {/* 進站年齡確認 */}
      <AgeGate />

      {/* 置頂即時跑馬燈 + 快速選單 */}
      <AnnouncementMarquee />
      <QuickNav />
      <div className="h-[128px]" aria-hidden="true" />

      {/* Hero */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden px-6">
        <img
          src="/photos/hero-ripple.jpg"
          alt="午夜水波紋"
          width={1920}
          height={1088}
          className="hero-photo absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="hero-overlay absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
        <Stardust />
        <div className="relative z-10 mx-auto max-w-3xl py-24 text-center">
          <div className="mb-10 flex flex-col items-center gap-4">
            <BrandMark className="hero-emblem-glow h-14 w-24 text-primary sm:h-20 sm:w-32" />
            <span className="hero-emblem-glow font-serif text-xl tracking-[0.4em] text-primary sm:text-2xl">
              {content.hero.badge}
            </span>
          </div>
          <h1 className="font-serif text-4xl font-light leading-[1.4] text-silver sm:text-6xl">
            {content.hero.titleBefore}
            <span className="text-gradient-rose">{content.hero.titleHighlight}</span>
            {content.hero.titleAfter}
            <br />
            {content.hero.titleLine2}
          </h1>
          <p className="mt-8 text-sm tracking-[0.32em] text-muted-foreground sm:text-base">
            {content.hero.subtitle}
          </p>
        </div>

        {/* 向下滾動提示 */}
        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-scroll-hint">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <span className="text-[10px] tracking-[0.3em]">SCROLL</span>
            <svg width="14" height="22" viewBox="0 0 14 22" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="12" height="20" rx="6" stroke="currentColor" strokeOpacity="0.5" />
              <circle className="scroll-hint-dot" cx="7" cy="6" r="1.5" fill="currentColor" />
            </svg>
          </div>
        </div>
      </section>

      {/* Team */}
      <section id="team" className="ripple-field relative overflow-hidden border-t border-border px-6 py-24">
        <div className="relative mx-auto max-w-6xl">
          <SectionTitle eyebrow="Today's Team" title="今日服務人員陣容" />

          <div className="mb-12 flex flex-wrap justify-center gap-3">
            {(["全部", "今日上班中", "早班", "晚班"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-6 py-2 text-xs tracking-[0.22em] transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hairline text-muted-foreground hover:text-silver"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* 一般按摩師 */}
          <div>
            <h3 className="mb-6 text-center text-lg font-bold uppercase tracking-[0.24em] text-silver sm:text-xl">
              一般按摩師 · 經典舒壓
            </h3>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {standardList.map((t) => (
                <TherapistCard key={t.no} t={t} onOpen={setOpenPerson} />
              ))}
            </div>
            {standardList.length === 0 && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                此條件目前無可預約人員，歡迎透過 LINE 詢問臨時班表。
              </p>
            )}
          </div>

          {/* 進階芳療師 */}
          <div className="mt-16">
            <h3 className="mb-6 text-center text-lg font-bold uppercase tracking-[0.24em] text-[#E5B292] sm:text-xl">
              進階芳療師 · 深層調理
            </h3>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {premiumList.map((t) => (
                <TherapistCard key={t.no} t={t} onOpen={setOpenPerson} premium />
              ))}
            </div>
            {premiumList.length === 0 && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                此條件目前無可預約人員，歡迎透過 LINE 詢問臨時班表。
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-xl">
          <SectionTitle eyebrow="Services" title="服務項目" />
          <div className="space-y-8">
            {services.map((s) => (
              <div
                key={s.name}
                className={
                  s.featured
                    ? "relative rounded-2xl border border-[#E5B292]/70 bg-gradient-to-b from-[#1c1e2b] to-[#0f1017] p-8 shadow-[0_0_25px_rgba(229,178,146,0.18)]"
                    : "rounded-2xl hairline bg-card/70 p-8 backdrop-blur-sm"
                }
              >
                {s.featured && (
                  <>
                    <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-[#E5B292]/20" />
                    <span className="absolute -top-3 right-6 rounded-full border border-[#E5B292] bg-[#12131d] px-3 py-1 text-[10px] font-bold tracking-wider text-[#FCEADE] shadow-md">
                      {s.badge}
                    </span>
                  </>
                )}
                {!s.featured && (
                  <span className="inline-block rounded-full hairline px-3 py-1 text-[11px] tracking-[0.14em] text-muted-foreground">
                    {s.badge}
                  </span>
                )}

                <h3
                  className={`relative z-10 mt-3 text-xl font-light ${s.featured ? "text-[#FCEADE]" : "text-silver"}`}
                >
                  {s.name}
                </h3>
                <p
                  className={`relative z-10 mt-1 text-xs tracking-wide ${s.featured ? "text-[#E5B292]" : "text-muted-foreground"}`}
                >
                  {s.min}
                </p>
                <div className="relative z-10 mt-4">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] tracking-[0.2em] ${
                      s.featured ? "border-[#FCEADE]/50 text-[#FCEADE]" : "border-primary/40 text-primary"
                    }`}
                  >
                    專屬客製
                  </span>
                  <p
                    className={`mt-3 text-sm leading-relaxed ${s.featured ? "text-[#FCEADE]/90" : "text-silver"}`}
                  >
                    {s.tagline}
                  </p>
                </div>

                <ul
                  className={`relative z-10 mt-6 space-y-2 border-t pt-5 text-xs leading-relaxed ${
                    s.featured ? "border-white/10 text-gray-200" : "border-border text-muted-foreground"
                  }`}
                >
                  {s.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className={s.featured ? "text-[#E5B292]" : "text-primary"}>✦</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
            ※ Lounge Spa 採全預約專屬制。每項療程均依貴賓當日身心狀態與精油配方進行客製化配置，
            完整療程細節將於到店時由專業芳療師為您細心諮詢與說明。
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <SectionTitle eyebrow="FAQ" title="常見問題" />
          <div className="space-y-3">
            {content.faq.map((item) => (
              <details
                key={item.q}
                className="group rounded-lg hairline bg-card/70 p-5 backdrop-blur-sm [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-silver">
                  {item.q}
                  <span className="ml-4 shrink-0 text-lg text-primary transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Map */}
      <section id="map" className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <SectionTitle eyebrow="Location" title="交通位置" />
          <div className="overflow-hidden rounded-lg hairline">
            <iframe
              title="Lounge Spa 地圖位置"
              src={`https://www.google.com/maps?q=${encodeURIComponent(content.footer.address)}&output=embed`}
              width="100%"
              height="360"
              style={{ border: 0, display: "block" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            <p>{content.footer.parking}</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t border-border px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <BrandMark className="h-5 w-8 text-silver" />
              <span className="text-xs tracking-[0.34em] text-silver">{content.site.name}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {content.footer.taglineLines.map((line, i) => (
                <span key={line}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </p>
          </div>
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <h3 className="mb-3 text-sm font-light tracking-[0.2em] text-silver">交通指引</h3>
            <p>{content.footer.address}</p>
            <p>{content.footer.parking}</p>
          </div>
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <h3 className="mb-3 text-sm font-light tracking-[0.2em] text-silver">聯絡預約</h3>
            <p>{content.footer.lineId}</p>
            <p>{content.footer.telegramId}</p>
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-6xl border-t border-border pt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
          <p>{content.footer.disclaimer1}</p>
          <p className="mt-1">{content.footer.disclaimer2}</p>
          <p className="mt-4">© {new Date().getFullYear()} {content.site.name}. All rights reserved.</p>
        </div>
      </footer>

      {/* 左下角深淺色切換 */}
      <ThemeToggle />

      {/* 人員相簿 Modal */}
      {openPerson && (
        <TherapistModal therapist={openPerson} onClose={() => setOpenPerson(null)} />
      )}
    </main>
  );
}