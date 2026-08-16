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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
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

/* 淺色／深色模式切換按鈕。狀態直接讀寫 <html class="light">，
   並存進 localStorage，重新整理後會記住上次選擇。 */
function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.classList.contains("light") ? "light" : "dark",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    try {
      localStorage.setItem("midnight-spa-theme", theme);
    } catch {
      // localStorage may be unavailable (e.g. private mode) — theme still
      // works for this session, it just won't persist across reloads.
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label={theme === "dark" ? "切換為淺色模式" : "切換為深色模式"}
      className="hairline flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-silver transition-colors hover:text-primary"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
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
          ? "glow-cta inline-flex items-center justify-center rounded-full bg-primary px-10 py-4 text-base font-medium tracking-[0.18em] text-primary-foreground"
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

/* 跑馬燈元件 */
function AnnouncementMarquee() {
  const announcements = content.announcements;

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-10 w-full items-center overflow-hidden border-y border-border/60 bg-card/90 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-card to-transparent" />
      <div className="flex w-max animate-marquee items-center gap-12 whitespace-nowrap text-xs tracking-[0.22em] text-silver/80">
        {[...announcements, ...announcements].map((text, idx) => (
          <div key={idx} className="flex shrink-0 items-center gap-3">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{text}</span>
          </div>
        ))}
      </div>
      <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2">
        <ThemeToggle />
      </div>
    </div>
  );
}

/* 右下角浮動按鈕元件 */
function FloatingLineWidget() {
  return (
    <a
      href={LINE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="LINE 即時預約"
      className="group fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-primary/40 bg-card/90 px-4 py-3 shadow-[0_4px_25px_oklch(0.78_0.07_40/35%)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-primary"
    >
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
      </span>
      <span className="text-xs tracking-[0.16em] text-silver group-hover:text-primary">LINE 預約</span>
    </a>
  );
}

/* 人員細圖檢視視窗：顯示該人員的照片相簿 */
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-md"
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

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {therapist.photos.map((photo, i) => (
            <button
              key={photo}
              onClick={() => setZoomIndex(i)}
              aria-label={`放大檢視第 ${i + 1} 張照片`}
              className="group relative aspect-[3/4] overflow-hidden rounded-md hairline"
            >
              <img
                src={photo}
                alt={`${therapist.name} 照片 ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </button>
          ))}
        </div>

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

/* 單張照片放大檢視，可用左右箭頭切換同一人的其他照片 */
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

      <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-[0.2em] text-muted-foreground">
        {index + 1} / {photos.length}
      </span>
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
      {/* 最新即時活動跑馬燈：fixed 釘在最上方，隨捲動永遠可見 */}
      <AnnouncementMarquee />
      <div className="h-10" aria-hidden="true" />

      {/* Hero */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden px-6">
        <img
          src="/photos/hero-ripple.jpg"
          alt="午夜水波紋"
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
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

      {/* Team */}
      <section className="ripple-field relative overflow-hidden px-6 py-24">
        <div className="relative mx-auto max-w-6xl">
          <SectionTitle eyebrow="Today's Team" title="今日服務人員陣容" />

          <div className="mb-12 flex flex-wrap justify-center gap-3">
            {(["全部", "今日上班中", "早班", "晚班"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-6 py-2 text-xs tracking-[0.22em] transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
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
                className="group cursor-pointer overflow-hidden rounded-lg hairline bg-card/60 backdrop-blur-sm transition-transform duration-500 hover:-translate-y-1"
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
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                    <span className="rounded-full hairline bg-card/80 px-4 py-2 text-[11px] tracking-[0.18em] text-silver">
                      查看 {t.photos.length} 張照片
                    </span>
                  </div>
                  <span
                    className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] tracking-[0.18em] ${
                      t.onDuty
                        ? "bg-primary/90 text-primary-foreground"
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
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <SectionTitle eyebrow="Services & Price" title="服務項目與價目" />
          <ul className="divide-y divide-border">
            {services.map((s) => (
              <li
                key={s.name}
                className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <div>
                  <h3 className="text-xl font-light text-silver">{s.name}</h3>
                  <p className="mt-1 text-xs tracking-wide text-muted-foreground">{s.desc}</p>
                </div>
                <div className="flex items-baseline gap-4 sm:text-right">
                  <span className="text-xs tracking-[0.2em] text-muted-foreground">{s.min}</span>
                  <span className="text-lg text-gradient-rose">{s.price}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            以上價格已含服務費，實際課程內容以現場說明為準。
          </p>
        </div>
      </section>

      {/* Loyalty */}
      <section className="ripple-field relative overflow-hidden border-t border-border px-6 py-24">
        <div className="relative mx-auto max-w-4xl">
          <SectionTitle eyebrow="Membership" title="LINE 集點與會員禮遇" />
          <div className="rounded-lg hairline bg-card/60 p-8 backdrop-blur-sm sm:p-12">
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
                      ? "bg-primary shadow-[0_0_18px_oklch(0.78_0.07_40/45%)]"
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

      {/* Footer */}
      <footer className="border-t border-border px-6 py-20">
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

      {/* 右下角常駐浮動按鈕 */}
      <FloatingLineWidget />

      {/* 人員細圖檢視視窗 */}
      {openPerson && (
        <TherapistModal therapist={openPerson} onClose={() => setOpenPerson(null)} />
      )}
    </main>
  );
}