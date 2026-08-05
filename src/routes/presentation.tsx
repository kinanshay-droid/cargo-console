import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, X, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Public, in-app rendering of the AFIK client presentation — same content
// and palette as AFIK_Client_Presentation.pptx (src/styles.css theme
// tokens), shown as a web slideshow instead of a downloaded file so it
// opens instantly from the login page on any device.

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "מצגת המערכת — AFIK Logistics Platform" },
      { name: "description", content: "AFIK Logistics Platform — מצגת פתרון ללקוח." },
    ],
  }),
  component: PresentationPage,
});

// ---------- shared building blocks ----------

function Kicker({ children }: { children: ReactNode; dark?: boolean }) {
  return <div className="text-sm font-bold text-accent">{children}</div>;
}

function Title({ children, dark, size = "text-3xl md:text-4xl" }: { children: ReactNode; dark?: boolean; size?: string }) {
  return (
    <h2 className={cn(size, "mt-2 font-bold tracking-tight", dark ? "text-white" : "text-foreground")}>
      {children}
    </h2>
  );
}

function Badge({ children, tone = "navy" }: { children: ReactNode; tone?: "navy" | "accent" | "success" | "warning" | "destructive" }) {
  const toneClass: Record<string, string> = {
    navy: "bg-primary text-primary-foreground",
    accent: "bg-accent text-white",
    success: "bg-success text-white",
    warning: "bg-warning text-white",
    destructive: "bg-destructive text-white",
  };
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold", toneClass[tone])}>
      {children}
    </span>
  );
}

function Row({ n, title, desc, tone = "accent" }: { n: ReactNode; title: string; desc: string; tone?: "navy" | "accent" | "success" | "warning" | "destructive" }) {
  return (
    <div className="flex items-start gap-3">
      <Badge tone={tone}>{n}</Badge>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-foreground">{title}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", className)}>{children}</div>
  );
}

function Footer({ n, dark }: { n: number; dark?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-3 flex items-center justify-between px-6 text-[11px] md:px-10",
        dark ? "text-white/50" : "text-muted-foreground",
      )}
    >
      <span>AFIK Logistics Platform</span>
      <span>{n}</span>
    </div>
  );
}

// ---------- slide data (mirrors the pptx content) ----------

const PAINS: { title: string; desc: string; tone: "destructive" | "warning" | "accent" | "navy" | "success"; glyph: string }[] = [
  { title: "כלים מבוזרים ולא מחוברים", desc: "אקסל, מיילים, וואטסאפ ומערכות נפרדות לכל שלב בתהליך", tone: "destructive", glyph: "!" },
  { title: "חוסר נראות בזמן אמת", desc: "קשה לדעת בוודאות איפה כל משלוח נמצא ברגע נתון", tone: "warning", glyph: "?" },
  { title: "הצעות מחיר איטיות וידניות", desc: "תלויות בזיכרון ובניסיון האישי של איש המכירות", tone: "accent", glyph: "~" },
  { title: "מטענים רגישי טמפרטורה", desc: "דורשים בקרה קפדנית — טעות קטנה עולה ביוקר", tone: "navy", glyph: "°" },
  { title: "תיאום איסוף והפצה עמוס", desc: "בטלפונים, בהודעות ובניירת שקל לאבד", tone: "success", glyph: "↻" },
];

const PILLARS = [
  { title: "מסחר", desc: "לידים, הצעות מחיר ולקוחות" },
  { title: "תפעול", desc: "מעקב מלא אחרי כל משלוח" },
  { title: "שרשרת קור", desc: "אריזה ובקרת טמפרטורה" },
  { title: "ניהול", desc: "משתמשים, הרשאות וביקורת" },
];

const KPIS = [
  { val: "128", lab: "משלוחים פעילים" },
  { val: "34", lab: "הצעות פתוחות" },
  { val: "6", lab: "תיקים דחופים" },
  { val: "342", lab: "לקוחות פעילים" },
];

const QUOTE_ROWS: { name: string; code: string; tone: "success" | "accent" }[] = [
  { name: "גל גבוה", code: "Q-2607-9592", tone: "success" },
  { name: "רוני לוי", code: "Q-2607-9588", tone: "accent" },
  { name: "עדן כהן", code: "Q-2607-9571", tone: "success" },
];

const COMMERCIAL_BULLETS = [
  { title: "ניהול לידים ולקוחות", desc: "כל שיחה, הצעה והזמנה מתועדת תחת כרטיס לקוח אחד" },
  { title: "Pipeline מסחרי חי", desc: "מעקב אחרי הצעות פתוחות, אחוזי המרה וביצועי נציגים" },
  { title: "דשבורד אנליטי ללקוחות", desc: "תובנות על נפח, רווחיות ותדירות הזמנות לפי לקוח" },
];

const FUNNEL = [
  { val: "58", lab: "לידים פתוחים", tone: "accent" as const },
  { val: "34", lab: "הצעות בהמתנה", tone: "warning" as const },
  { val: "342", lab: "לקוחות פעילים", tone: "success" as const },
];

const QUOTE_BULLETS = [
  { title: "אשף הצעת מחיר מודרך", desc: "יעדים, Incoterms, מאפייני מטען ואריזה — צעד אחר צעד" },
  { title: "מנוע המלצת אריזה אוטומטי", desc: "ממליץ על סוג האריזה לפי טמפ׳ נדרשת ומשקל המוצר" },
  { title: "ייצוא הצעה מוכנה ללקוח", desc: "מסמך PDF ממותג, מוכן לשליחה תוך דקות" },
];

const SHIPMENT_TAGS = [
  { label: "Dry Shipper", bg: "#3b8fc4", fg: "#ffffff" },
  { label: "General", bg: "#5a5a5f", fg: "#ffffff" },
  { label: "קנאביס", bg: "#3fa172", fg: "#ffffff" },
  { label: "15° - 25°", bg: "#a8d84a", fg: "#2b3305" },
  { label: "DG", bg: "#e0607a", fg: "#ffffff" },
  { label: "2° - 8°", bg: "#3ddc84", fg: "#04331b" },
  { label: "Batteries", bg: "#b48ee0", fg: "#2b1a3a" },
  { label: "-20°", bg: "#7c94a8", fg: "#ffffff" },
  { label: "DG + Dry-Ice", bg: "#f28b82", fg: "#3a0f0c" },
  { label: "Dry-Ice", bg: "#7ec8e3", fg: "#0c2733" },
];

const STAGES = ["חדש", "מוכן להזמנה", "יצא לדרך", "במעבר", "מוכן למסירה", "נמסר"];

const OPS_BULLETS = [
  { title: "מסך תפעול ממורכז", desc: "כל התיקים הפתוחים, מסוננים לפי נציג ורמת דחיפות" },
  { title: "תיוג ועדכון סטטוס בזמן אמת", desc: "כל שינוי בתיק מתועד ומעדכן את כל בעלי העניין" },
  { title: "BL, הפניה ופרטי מכס", desc: "כל המסמכים והמספרים הרלוונטיים — בכרטיס אחד" },
];

const COLD_BULLETS = [
  { title: "קטלוג אריזות ייעודי", desc: "CoolGuard ו-BioTherm, עם מידות, נפח ומשקל תפוסה" },
  { title: "חישוב משקל אוטומטי", desc: "משקל המארז + משקל המוצר בפועל — יחד, בזמן אמת" },
  { title: "צ׳קליסט דיגיטלי מלא", desc: "9 סעיפי בקרה, נשמר ישירות בתיק — לכל מארז בנפרד" },
];

const CHECKLIST_ROWS: { label: string; status: "ok" | "not_ok" | "unset"; ref?: string }[] = [
  { label: "סוג המארז נכון", status: "ok", ref: "CoolGuard Advance 96L" },
  { label: "טווח טמפרטורה מאושר", status: "ok", ref: "Chilled (+2°C עד +8°C)" },
  { label: "Data Logger הופעל", status: "ok" },
  { label: "סרט הדבקה תקין", status: "not_ok" },
  { label: "צילום תוויות", status: "unset" },
];

const PICKUP_BULLETS = [
  { title: "קישור אוטומטי לפי תאריך", desc: "מילוי תאריך איסוף בתיק — והמשלוח מופיע מיד בלוח איסוף/הפצה" },
  { title: "דשבורד ייעודי לצוות השטח", desc: '"משימות היום" — רשימה ממוקדת לכל בלדר, בזמן אמת' },
  { title: "מיון וסינון חכם", desc: "לפי מועד ביצוע, סוג משלוח וטווח תאריכים" },
];

const KINDS: { label: string; tone: "success" | "warning" }[] = [
  { label: "ייצוא", tone: "success" },
  { label: "ייבוא", tone: "warning" },
  { label: "משלוחי דרופ", tone: "success" },
  { label: "פנים ארצי", tone: "warning" },
];

const ADMIN_ITEMS = [
  { title: "ניהול משתמשים והרשאות", desc: "תפקידי מנהל וחבר צוות, לפי ארגון" },
  { title: "יומן ביקורת מלא", desc: "מי שינה מה, ומתי — לכל פעולה רגישה" },
  { title: "הרשאות ברמת שורה (RLS)", desc: "כל ארגון רואה אך ורק את הנתונים שלו, ברמת בסיס הנתונים" },
  { title: "תשתית ענן גלובלית", desc: "זמינות וביצועים גבוהים, בכל מקום" },
];

const VALUE_ITEMS = [
  { title: "פחות טעויות תפעול", desc: "תהליכים מובנים במערכת אחת, במקום זיכרון וניירות פזורים", hi: true },
  { title: "תגובה מהירה יותר ללקוח", desc: "הצעת מחיר מוכנה תוך דקות, לא שעות", hi: false },
  { title: "שקיפות מלאה לכל בעל תפקיד", desc: "מכירות, תפעול ובלדרים רואים את אותה תמונת אמת", hi: false },
  { title: "גדילה בלי לאבד שליטה", desc: "מערכת אחת שגדלה יחד עם היקף הפעילות שלכם", hi: false },
];

const NEXT_STEPS = [
  { title: "הדגמה חיה של המערכת", desc: "סיור מודרך במסכים המרכזיים, מותאם לתהליכי העבודה שלכם" },
  { title: "סביבת דמו לניסיון עצמאי", desc: "גישה לכניסת דמו — התנסות חופשית בלי התחייבות" },
  { title: "התאמה אישית", desc: "חיבור נתוני הארגון שלכם והגדרת תהליכים ייעודיים" },
];

// ---------- the 12 slides ----------

const SLIDES: (() => ReactNode)[] = [
  // 1. Title
  () => (
    <div className="relative flex h-full flex-col items-center justify-center bg-primary text-center">
      <div className="text-lg font-bold text-accent">AFIK</div>
      <div className="mt-2 text-3xl font-bold text-white md:text-5xl">AFIK Logistics Platform</div>
      <div className="mt-4 text-base italic text-[#cadcfc] md:text-xl">האינטליגנציה מאחורי כל משלוח</div>
      <div className="absolute bottom-8 text-xs text-white/60 md:text-sm">מצגת פתרון ללקוח · אוגוסט 2026</div>
    </div>
  ),
  // 2. Challenge
  () => (
    <div className="relative flex h-full flex-col bg-background p-6 md:p-10">
      <Kicker>האתגר</Kicker>
      <Title>ניהול משלוחים בינלאומיים הוא מורכב מדי</Title>
      <div className="mt-4 flex-1 space-y-3 overflow-hidden md:mt-6 md:space-y-4">
        {PAINS.map((p) => (
          <div key={p.title} className="flex items-start gap-3 border-b border-border pb-3 last:border-0">
            <Badge tone={p.tone}>{p.glyph}</Badge>
            <div>
              <div className="text-sm font-bold text-foreground md:text-base">{p.title}</div>
              <div className="text-xs text-muted-foreground md:text-sm">{p.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <Footer n={2} />
    </div>
  ),
  // 3. Solution
  () => (
    <div className="relative flex h-full flex-col justify-center bg-primary p-6 md:p-10">
      <Kicker>הפתרון</Kicker>
      <div className="mt-2 text-xl font-bold leading-snug text-white md:text-3xl">
        AFIK Logistics Platform היא פלטפורמה אחת שמנהלת את כל מחזור החיים של המשלוח — מהליד הראשון ועד המסירה
        בפועל, במקום אחד.
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2 md:mt-10 md:grid-cols-4 md:gap-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-xl bg-[#1f3c6c] p-3 md:p-4">
            <div className="text-sm font-bold text-white md:text-base">{p.title}</div>
            <div className="mt-1 text-[11px] text-[#cadcfc] md:text-xs">{p.desc}</div>
          </div>
        ))}
      </div>
      <Footer n={3} dark />
    </div>
  ),
  // 4. Overview / dashboard mock
  () => (
    <div className="relative flex h-full flex-col bg-background p-6 md:p-10">
      <Kicker>מבט על המערכת</Kicker>
      <Title>תמונת מצב מלאה, בזמן אמת</Title>
      <div className="mt-3 flex-1 overflow-hidden rounded-2xl border bg-card p-3 shadow-sm md:mt-4 md:p-4">
        <div className="flex items-center justify-center gap-2 border-b pb-2">
          <span className="h-2 w-2 rounded-full bg-destructive/70" />
          <span className="h-2 w-2 rounded-full bg-warning/70" />
          <span className="h-2 w-2 rounded-full bg-success/70" />
          <span className="mr-2 text-[11px] font-semibold text-muted-foreground">AFIK · דשבורד תפעולי</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {KPIS.map((k) => (
            <div key={k.lab} className="rounded-lg bg-muted p-2 text-center md:p-3">
              <div className="text-lg font-bold text-primary md:text-2xl">{k.val}</div>
              <div className="text-[9px] text-muted-foreground md:text-[11px]">{k.lab}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 md:mt-3">
          <div className="flex h-14 items-end gap-1 rounded-lg bg-muted p-2 md:h-20">
            {[40, 65, 50, 80, 55, 90, 70, 60, 85, 45, 75, 95, 65, 55].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-accent/70" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="hidden w-32 rounded-lg bg-muted p-2 text-[10px] text-muted-foreground sm:block">
            מסלול פעיל
            <div className="mt-3 flex items-center justify-between text-[9px]">
              <span>TLV</span>
              <span>JFK</span>
            </div>
          </div>
        </div>
        <div className="mt-2 space-y-1 md:mt-3">
          {QUOTE_ROWS.map((r) => (
            <div key={r.code} className="flex items-center justify-between rounded-md bg-muted px-2 py-1 text-[10px] md:text-xs">
              <span className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", r.tone === "success" ? "bg-success" : "bg-accent")} />
                {r.name}
              </span>
              <span className="font-mono text-muted-foreground">{r.code}</span>
            </div>
          ))}
        </div>
      </div>
      <Footer n={4} />
    </div>
  ),
  // 5. Commercial
  () => (
    <div className="relative flex h-full flex-col bg-background p-6 md:p-10">
      <Kicker>מודול מסחרי</Kicker>
      <Title>מליד ללקוח משלם — במעקב מלא</Title>
      <div className="mt-4 grid flex-1 grid-cols-1 gap-6 overflow-hidden md:mt-6 md:grid-cols-2">
        <div className="space-y-4 md:space-y-6">
          {COMMERCIAL_BULLETS.map((b, i) => (
            <Row key={b.title} n={i + 1} title={b.title} desc={b.desc} />
          ))}
        </div>
        <div className="flex flex-col justify-center gap-2 md:gap-3">
          {FUNNEL.map((f) => (
            <Card key={f.lab} className="flex items-center gap-3">
              <span className="h-9 w-9 shrink-0 rounded-full" style={{ backgroundColor: `var(--${f.tone})` }} />
              <div>
                <div className="text-xl font-bold text-primary md:text-2xl">{f.val}</div>
                <div className="text-xs text-muted-foreground">{f.lab}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <Footer n={5} />
    </div>
  ),
  // 6. Quotes
  () => (
    <div className="relative flex h-full flex-col bg-background p-6 md:p-10">
      <Kicker>הצעות מחיר</Kicker>
      <Title>אשף חכם שמכיר את סוג המטען</Title>
      <div className="mt-4 grid flex-1 grid-cols-1 gap-6 overflow-hidden md:mt-6 md:grid-cols-2">
        <div className="space-y-4 md:space-y-6">
          {QUOTE_BULLETS.map((b, i) => (
            <Row key={b.title} n={i + 1} title={b.title} desc={b.desc} />
          ))}
        </div>
        <Card className="flex flex-col">
          <div className="text-sm font-bold">סוג משלוח</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 md:gap-2">
            {SHIPMENT_TAGS.map((t) => (
              <span
                key={t.label}
                className="rounded-full px-2 py-1.5 text-center text-[10px] font-bold md:text-xs"
                style={{ backgroundColor: t.bg, color: t.fg }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </Card>
      </div>
      <Footer n={6} />
    </div>
  ),
  // 7. Operations / pipeline
  () => (
    <div className="relative flex h-full flex-col bg-background p-6 md:p-10">
      <Kicker>תפעול</Kicker>
      <Title>כל תיק, בכל רגע — באיזה שלב הוא נמצא</Title>
      <div className="mt-4 flex items-center justify-center gap-1 overflow-x-auto md:mt-8 md:gap-2" dir="rtl">
        {STAGES.map((st, i) => (
          <div key={st} className="flex items-center gap-1 md:gap-2">
            <div
              className={cn(
                "whitespace-nowrap rounded-xl px-2.5 py-2 text-[10px] font-bold text-white md:px-4 md:py-3 md:text-sm",
                i === 0 ? "bg-accent" : i === STAGES.length - 1 ? "bg-success" : "bg-primary",
              )}
            >
              {st}
            </div>
            {i < STAGES.length - 1 && <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground md:h-4 md:w-4" />}
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-[11px] text-muted-foreground md:mt-3 md:text-xs">
        6 מתוך 22 שלבי תפעול מוגדרים מראש
      </div>
      <div className="mt-4 grid flex-1 grid-cols-1 gap-2 overflow-hidden sm:grid-cols-3 md:mt-6 md:gap-3">
        {OPS_BULLETS.map((b) => (
          <Card key={b.title}>
            <div className="text-xs font-bold md:text-sm">{b.title}</div>
            <div className="mt-1 text-[10px] text-muted-foreground md:text-xs">{b.desc}</div>
          </Card>
        ))}
      </div>
      <Footer n={7} />
    </div>
  ),
  // 8. Cold chain / checklist
  () => (
    <div className="relative flex h-full flex-col bg-background p-6 md:p-10">
      <Kicker>שרשרת קור</Kicker>
      <Title>בקרת טמפרטורה — מהאריזה ועד הצ׳קליסט</Title>
      <div className="mt-4 grid flex-1 grid-cols-1 gap-6 overflow-hidden md:mt-6 md:grid-cols-2">
        <div className="space-y-4 md:space-y-6">
          {COLD_BULLETS.map((b, i) => (
            <Row key={b.title} n={i + 1} title={b.title} desc={b.desc} tone="navy" />
          ))}
        </div>
        <Card className="flex flex-col overflow-hidden">
          <div className="text-xs font-bold md:text-sm">צ׳קליסט הכנת מארז מבוקר טמפרטורה</div>
          <div className="mt-2 h-1 rounded-full bg-border">
            <div className="h-1 w-3/5 rounded-full bg-accent" />
          </div>
          <div className="mt-2 space-y-1.5 overflow-hidden md:space-y-2">
            {CHECKLIST_ROWS.map((r) => (
              <div key={r.label} className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1.5">
                {r.status === "ok" && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                {r.status === "not_ok" && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
                    <X className="h-3 w-3" />
                  </span>
                )}
                {r.status === "unset" && <span className="h-5 w-5 shrink-0 rounded-full bg-border" />}
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold">{r.label}</div>
                  {r.ref && <div className="truncate text-[9px] text-accent">מהתיק: {r.ref}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Footer n={8} />
    </div>
  ),
  // 9. Pickup / distribution
  () => (
    <div className="relative flex h-full flex-col bg-background p-6 md:p-10">
      <Kicker>איסוף והפצה</Kicker>
      <Title>מהתיק ישירות לדשבורד הבלדרים</Title>
      <div className="mt-4 flex-1 space-y-3 md:mt-6 md:space-y-4">
        {PICKUP_BULLETS.map((b, i) => (
          <Row key={b.title} n={i + 1} title={b.title} desc={b.desc} />
        ))}
      </div>
      <Card className="mt-4 grid grid-cols-4 gap-2">
        {KINDS.map((k) => (
          <div key={k.label} className="flex flex-col items-center gap-1.5 px-1 py-1">
            <span className={cn("h-5 w-5 rounded-full", k.tone === "success" ? "bg-success" : "bg-warning")} />
            <span className="text-[10px] font-bold md:text-xs">{k.label}</span>
          </div>
        ))}
      </Card>
      <Footer n={9} />
    </div>
  ),
  // 10. Admin & security
  () => (
    <div className="relative flex h-full flex-col bg-background p-6 md:p-10">
      <Kicker>ניהול ואבטחה</Kicker>
      <Title>שליטה מלאה, בלי להתפשר על ביטחון המידע</Title>
      <div className="mt-4 grid flex-1 grid-cols-1 gap-3 overflow-hidden sm:grid-cols-2 md:mt-6 md:gap-4">
        {ADMIN_ITEMS.map((it) => (
          <Card key={it.title} className="flex flex-col justify-center">
            <div className="text-sm font-bold md:text-base">{it.title}</div>
            <div className="mt-1 text-xs text-muted-foreground md:text-sm">{it.desc}</div>
          </Card>
        ))}
      </div>
      <Footer n={10} />
    </div>
  ),
  // 11. Value
  () => (
    <div className="relative flex h-full flex-col bg-background p-6 md:p-10">
      <Kicker>הערך העסקי</Kicker>
      <Title>למה זה משנה בשטח</Title>
      <div className="mt-4 grid flex-1 grid-cols-1 gap-3 overflow-hidden sm:grid-cols-2 md:mt-6 md:gap-4">
        {VALUE_ITEMS.map((it) => (
          <Card
            key={it.title}
            className={cn("flex flex-col justify-center", it.hi && "border-0 bg-primary")}
          >
            <div className={cn("text-sm font-bold md:text-base", it.hi ? "text-white" : "text-foreground")}>
              {it.title}
            </div>
            <div className={cn("mt-1 text-xs md:text-sm", it.hi ? "text-[#cadcfc]" : "text-muted-foreground")}>
              {it.desc}
            </div>
          </Card>
        ))}
      </div>
      <Footer n={11} />
    </div>
  ),
  // 12. Next steps
  () => (
    <div className="relative flex h-full flex-col justify-center bg-primary p-6 md:p-10">
      <Kicker dark>הצעדים הבאים</Kicker>
      <div className="mt-2 text-2xl font-bold text-white md:text-4xl">בואו נתחיל</div>
      <div className="mt-6 space-y-4 md:mt-8 md:space-y-6">
        {NEXT_STEPS.map((s, i) => (
          <div key={s.title} className="flex items-start gap-3">
            <Badge tone="accent">{i + 1}</Badge>
            <div>
              <div className="text-sm font-bold text-white md:text-base">{s.title}</div>
              <div className="mt-0.5 text-xs text-[#cadcfc] md:text-sm">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-6 text-center text-[11px] text-white/60 md:bottom-8 md:text-xs">
        afiklog.com · kinanshay@gmail.com
      </div>
    </div>
  ),
];

function PresentationPage() {
  const [idx, setIdx] = useState(0);
  const total = SLIDES.length;

  function next() {
    setIdx((i) => Math.min(i + 1, total - 1));
  }
  function prev() {
    setIdx((i) => Math.max(i - 1, 0));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-6">
      <div className="mb-4 flex w-full max-w-5xl items-center justify-between">
        <Link to="/login" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" />
          חזרה לכניסה
        </Link>
        <span className="text-sm font-medium text-muted-foreground">
          {idx + 1} / {total}
        </span>
      </div>

      <div className="relative aspect-[16/9] w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
        {SLIDES[idx]()}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={next}
          disabled={idx === total - 1}
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted disabled:opacity-30"
          aria-label="הבא"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === idx ? "w-5 bg-accent" : "w-2 bg-border hover:bg-muted-foreground/40",
              )}
              aria-label={`שקף ${i + 1}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={prev}
          disabled={idx === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted disabled:opacity-30"
          aria-label="הקודם"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
