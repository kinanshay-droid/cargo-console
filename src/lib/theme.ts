// Shared, canonical color mappings derived from the "Navy Trust" design tokens
// defined in src/styles.css (--primary, --accent, --success, --warning, --destructive, --muted).
// Every page/component that needs a status badge, a status dot, or a hero-card
// gradient should pull from these maps instead of inventing raw Tailwind color
// classes (sky-*, emerald-*, rose-*, violet-*, etc.) or hardcoded hex values.
// This keeps the whole app visually consistent and keeps dark mode working,
// since raw hex/utility colors don't respond to the .dark theme overrides.

export type Tone = "primary" | "accent" | "success" | "warning" | "destructive" | "muted";

/** Pill / badge classes — text + soft background + border, light & dark safe. */
export const TONE_BADGE: Record<Tone, string> = {
  primary: "border-primary/20 bg-primary/10 text-primary",
  accent: "border-accent/25 bg-accent/10 text-accent",
  success: "border-success/25 bg-success/15 text-success",
  warning: "border-warning/30 bg-warning/15 text-warning",
  destructive: "border-destructive/20 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
};

/** Small status dots (lists, legends). */
export const TONE_DOT: Record<Tone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
};

/** Hero-card / KPI-card gradients — each tone shades into a lighter version of itself
 * rather than jumping to an unrelated hue, so every gradient still reads as "on brand". */
export const TONE_GRADIENT: Record<Tone, string> = {
  primary: "from-primary to-primary/70",
  accent: "from-accent to-accent/70",
  success: "from-success to-success/70",
  warning: "from-warning to-warning/70",
  destructive: "from-destructive to-destructive/70",
  muted: "from-muted-foreground to-muted-foreground/60",
};

/** Badges rendered on top of a solid --primary (navy) background — e.g. a hero
 * header. Uses white-tinted variants of the same semantic hues so status is
 * still distinguishable, without falling back to arbitrary rainbow colors. */
export const TONE_BADGE_ON_PRIMARY: Record<Tone, string> = {
  primary: "border-white/20 bg-white/10 text-white/80",
  accent: "border-accent/40 bg-accent/25 text-white",
  success: "border-success/40 bg-success/25 text-white",
  warning: "border-warning/40 bg-warning/25 text-white",
  destructive: "border-destructive/40 bg-destructive/25 text-white",
  muted: "border-white/20 bg-white/10 text-white/70",
};

/** Outline / ghost buttons that want a tinted hover state. */
export const TONE_OUTLINE_BUTTON: Record<Tone, string> = {
  primary: "border-primary/30 text-primary hover:bg-primary/10",
  accent: "border-accent/40 text-accent hover:bg-accent/10",
  success: "border-success/40 text-success hover:bg-success/10",
  warning: "border-warning/40 text-warning hover:bg-warning/10",
  destructive: "border-destructive/30 text-destructive hover:bg-destructive/10",
  muted: "border-border text-muted-foreground hover:bg-muted",
};

/** Solid, filled pill/chip — active filter toggles and similar controls
 * that need a fully colored "selected" state rather than a soft badge. */
export const TONE_SOLID: Record<Tone, string> = {
  primary: "border-primary bg-primary text-primary-foreground",
  accent: "border-accent bg-accent text-accent-foreground",
  success: "border-success bg-success text-success-foreground",
  warning: "border-warning bg-warning text-warning-foreground",
  destructive: "border-destructive bg-destructive text-destructive-foreground",
  muted: "border-muted-foreground bg-muted-foreground text-background",
};
