import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DICTIONARY, type Locale, type TranslationKey } from "@/lib/i18n-dictionary";

const STORAGE_KEY = "app_locale";
const DEFAULT_LOCALE: Locale = "he";

type I18nContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "he" || saved === "en" ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * App-wide language toggle. Wraps the app (see __root.tsx) so any component
 * can call useI18n() to read the current locale/direction or translate a key.
 *
 * Note: the server always renders the Hebrew/RTL shell (see RootShell in
 * __root.tsx) — this provider corrects `document.documentElement` to the
 * user's saved choice right after hydration, so an English-preferring user
 * sees a brief RTL flash on first load. That's an accepted trade-off for
 * this stage; avoiding it entirely would need locale in a cookie read
 * during SSR.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  function setLocale(l: Locale) {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore storage errors (private mode, quota, ...) */
    }
  }

  function toggleLocale() {
    setLocale(locale === "he" ? "en" : "he");
  }

  function t(key: TranslationKey): string {
    const entry = DICTIONARY[key];
    if (!entry) return key;
    return entry[locale];
  }

  return (
    <I18nContext.Provider
      value={{ locale, dir: locale === "he" ? "rtl" : "ltr", setLocale, toggleLocale, t }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

/**
 * Flips the whole app between Hebrew and English.
 * - variant="pill" — small compact button, for tight header/toolbar spots.
 * - variant="row" — full-width menu-row style, for a sidebar/menu list.
 */
export function LanguageToggle({
  className,
  variant = "pill",
}: {
  className?: string;
  variant?: "pill" | "row";
}) {
  const { locale, toggleLocale, t } = useI18n();
  const nextLabel = t("lang.toggleTo");

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggleLocale}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          className,
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent/50 text-sidebar-foreground/90">
          <Globe className="h-4 w-4" />
        </span>
        {nextLabel}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      className={className}
      aria-label={nextLabel}
    >
      <Globe className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{locale === "he" ? "EN" : "עב"}</span>
    </Button>
  );
}
