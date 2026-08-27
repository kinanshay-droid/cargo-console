import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_BADGE, type Tone } from "@/lib/theme";

export function PageHeader({
  title,
  description,
  action,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional icon shown in a colored rounded box beside the title. */
  icon?: LucideIcon;
  /** Tone for the icon box — see src/lib/theme.ts. Only relevant if icon is set. */
  tone?: Tone;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon ? (
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
              TONE_BADGE[tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
