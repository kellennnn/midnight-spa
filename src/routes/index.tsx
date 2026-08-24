import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import content from "@/content.json";

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

const LINE_URL = content.site.lineUrl;

type Shift = "早班" | "晚班";

type Therapist = {
  no: string;
  name: string;
  photos: string[];
  tags: string[];
  schedule: string;
  shift: Shift;
  onDuty: boolean;
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

function LineButton({
  children,
  large = false,
}: {
  children: React.ReactNode;
  large?: boolean;
}) {
  return (
    <a
      href={LINE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        large
          ? "glow-cta inline-flex items-center justify-center rounded-full bg-primary px-10 py-4 text-base font-medium tracking-[0.18em] text-primary-foreground shadow-sm"
          : "glow-cta inline-flex w-full items-center justify-center rounded-full border border-primary/50 bg-transparent px-5 py-2.5 text-sm tracking-[0.16em] text-primary"
      }
    >
      {children}
    </a>
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

/* 置頂跑馬燈元件 */
/* 生動升級版跑馬燈元件 */
/* 款式一：勃艮第酒紅跑馬燈 */
function AnnouncementMarquee() {
  const announcements = [
    { tag: "即時班表", text: "今日班表即時更新中，請透過 LINE 私訊卡位", icon: "🌙" },
    { tag: "五星好評", text: "Google 五星好評享下次療程現折 $200", icon: "⭐" },
    { tag: "夜間限定", text: "深夜時段（23:00 後）預約享專屬迎賓精油芳療", icon: "✨" },
    { tag: "新客禮遇", text: "新客初次體驗，官方 LINE 領取 $300 折價券", icon: "🎁" },
  ];

  return (
    <div className="marquee-bar fixed inset-x-0 top-0 z-40 flex h-14 w-full items-center overflow-hidden border-b-2 border-[#e07a86]/40 bg-[#220c12] shadow-[0_6px_30px_rgba(224,122,134,0.25)] backdrop-blur-lg">
      <div className="marquee-fade-left pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#220c12] to-transparent" />
      <div className="marquee-fade-right pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-[#220c12] to-transparent" />

      <div className="marquee-text flex w-max animate-marquee items-center gap-16 whitespace-nowrap text-sm tracking-[0.16em] text-[#fceade]">
        {[...announcements, ...announcements].map((item, idx) => (
          <div
            key={idx}
            className="marquee-item group flex shrink-0 items-center gap-3 transition-all duration-300 hover:text-[#fca5a5]"
          >
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="marquee-dot-ping absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f87171] opacity-75" />
              <span className="marquee-dot relative inline-flex h-2 w-2 rounded-full bg-[#f87171]" />
            </span>

            <span className="marquee-tag rounded-full border border-[#e07a86]/50 bg-[#e07a86]/25 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#fca5a5]">
              {item.tag}
            </span>

            <span className="font-semibold">
              <span className="mr-1.5 inline-block text-base">{item.icon}</span>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 頂部快速選單：釘在跑馬燈下方，可橫向捲動跳到各區塊 */
function QuickNav() {
  return (
    <nav className="fixed inset-x-0 top-14 z-30 h-11 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="no-scrollbar mx-auto flex h-full max-w-6xl items-center gap-1 overflow-x-auto px-4 sm:justify-center sm:gap-2">
        {content.nav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary hover:text-silver"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/* 右下角浮動按鈕 */
function FloatingLineWidget() {
  return (
    <a
      href={LINE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="LINE 即時預約"
      className="group fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-4 py-3 shadow-[0_4px_25px_oklch(0.72_0.14_38/38%)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-primary"
    >
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
      </span>
      <span className="text-xs tracking-[0.16em] text-silver group-hover:text-primary">LINE 預約</span>
    </a>
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

        <div className="mt-8">
          <LineButton large>LINE 私訊預約</LineButton>
        </div>
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

function Index() {
  const [filter, setFilter] = useState<"全部" | "今日上班中" | Shift>("全部");
  const [points, setPoints] = useState(3);
  const [openPerson, setOpenPerson] = useState<Therapist | null>(null);

  const list = therapists.filter((t) =>
    filter === "全部" ? true : filter === "今日上班中" ? t.onDuty : t.shift === filter,
  );

  return (
    <main className="min-h-screen bg-background">
      {/* 置頂即時跑馬燈 + 快速選單 */}
      <AnnouncementMarquee />
      <QuickNav />
      <div className="h-[100px]" aria-hidden="true" />

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
          <div className="mb-8 inline-flex items-center gap-3 rounded-full hairline px-5 py-2 backdrop-blur-sm">
            <Moon />
            <span className="text-xs tracking-[0.34em] text-silver">{content.hero.badge}</span>
          </div>
          <h1 className="text-4xl font-light leading-[1.35] text-silver sm:text-6xl">
            {content.hero.titleBefore}
            <span className="text-gradient-rose">{content.hero.titleHighlight}</span>
            {content.hero.titleAfter}
            <br />
            {content.hero.titleLine2}
          </h1>
          <p className="mt-8 text-sm tracking-[0.24em] text-muted-foreground sm:text-base">
            {content.hero.subtitle}
          </p>
          <div className="mt-12">
            <LineButton large>LINE 立即預約</LineButton>
          </div>
        </div>
      </section>

      {/* Booking Steps */}
      <section id="booking" className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <SectionTitle eyebrow="How To Book" title="預約流程" />
          <div className="grid gap-8 sm:grid-cols-3">
            {content.booking.steps.map((step, i) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full hairline text-lg text-gradient-rose">
                  {i + 1}
                </div>
                <h3 className="text-base font-light text-silver">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-6 rounded-lg hairline bg-card/70 p-8 backdrop-blur-sm sm:flex-row sm:justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(content.site.lineUrl)}`}
              alt="掃描加入 LINE 預約"
              width={140}
              height={140}
              loading="lazy"
              className="h-[140px] w-[140px] rounded-md bg-white p-2"
            />
            <div className="text-center sm:text-left">
              <p className="text-sm tracking-[0.16em] text-silver">掃描 QR Code 加入 LINE</p>
              <p className="mt-1 text-xs text-muted-foreground">或直接點擊下方按鈕私訊預約</p>
              <div className="mt-4">
                <LineButton large>LINE 立即預約</LineButton>
              </div>
            </div>
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

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((t) => (
              <article
                key={t.no}
                onClick={() => setOpenPerson(t)}
                className="group cursor-pointer overflow-hidden rounded-lg hairline bg-card/70 backdrop-blur-sm transition-transform duration-500 hover:-translate-y-1"
              >
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
                <div className="p-5">
                  <h3 className="text-xl font-light text-silver">
                    {t.no} · {t.name}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full hairline px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-xs tracking-[0.16em] text-muted-foreground">
                    當日班表 {t.schedule}（{t.shift}）
                  </p>
                  <div className="mt-5" onClick={(e) => e.stopPropagation()}>
                    <LineButton>LINE 私訊預約</LineButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {list.length === 0 && (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              此條件目前無可預約人員，歡迎透過 LINE 詢問臨時班表。
            </p>
          )}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <SectionTitle eyebrow="Services & Price" title="服務項目與價目" />
          <div className="flex flex-wrap justify-center gap-6">
            {services.map((s) => (
              <div
                key={s.name}
                className="w-full max-w-sm rounded-lg hairline bg-card/70 p-10 text-center backdrop-blur-sm"
              >
                <h3 className="text-2xl font-light text-silver">{s.name}</h3>
                <p className="mt-2 text-xs tracking-wide text-muted-foreground">{s.desc}</p>
                <p className="mt-8 text-5xl font-medium text-gradient-rose">{s.price}</p>
                <p className="mt-3 text-xs tracking-[0.24em] text-muted-foreground">{s.min}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            以上價格已含服務費，實際課程內容以現場說明為準。
          </p>
        </div>
      </section>

      {/* Loyalty */}
      <section className="ripple-field relative overflow-hidden border-t border-border px-6 py-24">
        <div className="relative mx-auto max-w-4xl">
          <SectionTitle eyebrow="Membership" title="LINE 集點與會員禮遇" />
          <div className="rounded-lg hairline bg-card/70 p-8 backdrop-blur-sm sm:p-12">
            <p className="text-center text-xs tracking-[0.28em] text-muted-foreground">
              目前集點 {points} / 10
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  key={i}
                  aria-label={`第 ${i + 1} 點`}
                  onClick={() => setPoints(i + 1 === points ? i : i + 1)}
                  className={`h-8 w-8 rounded-full transition-all duration-300 ${
                    i < points
                      ? "bg-primary shadow-[0_0_18px_oklch(0.72_0.14_38/48%)]"
                      : "hairline bg-transparent"
                  }`}
                />
              ))}
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {content.membership.cards.map((c) => (
                <div key={c.title} className="rounded-lg hairline p-5">
                  <h3 className="text-base font-light text-silver">{c.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <LineButton large>LINE 立即預約</LineButton>
            </div>
          </div>
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
              title="Midnight SPA 地圖位置"
              src={`https://www.google.com/maps?q=${encodeURIComponent(content.footer.address)}&output=embed`}
              width="100%"
              height="360"
              style={{ border: 0, display: "block" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="mt-6 grid gap-2 text-center text-xs leading-relaxed text-muted-foreground sm:grid-cols-2 sm:text-left">
            <p>{content.footer.transit}</p>
            <p>{content.footer.parking}</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t border-border px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <Moon />
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
            <p>{content.footer.phone}</p>
            <p>{content.footer.transit}</p>
            <p>{content.footer.parking}</p>
          </div>
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <h3 className="mb-3 text-sm font-light tracking-[0.2em] text-silver">聯絡預約</h3>
            <p>{content.footer.lineId}</p>
            <p>{content.footer.telegramId}</p>
            <div className="pt-4">
              <LineButton>LINE 立即預約</LineButton>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-6xl border-t border-border pt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
          <p>{content.footer.disclaimer1}</p>
          <p className="mt-1">{content.footer.disclaimer2}</p>
          <p className="mt-4">© {new Date().getFullYear()} {content.site.name}. All rights reserved.</p>
        </div>
      </footer>

      {/* 右下角常駐浮動按鈕 + 左下角深淺色切換 */}
      <FloatingLineWidget />
      <ThemeToggle />

      {/* 人員相簿 Modal */}
      {openPerson && (
        <TherapistModal therapist={openPerson} onClose={() => setOpenPerson(null)} />
      )}
    </main>
  );
}