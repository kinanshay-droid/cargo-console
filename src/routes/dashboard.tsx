import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Users,
  ShieldCheck,
  Building2,
  ScrollText,
  User,
  LayoutGrid,
  TrendingUp,
  Bell,
  ChevronDown,
  ArrowLeftRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n-dictionary";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const NAV_SECTIONS = [
  {
    labelKey: null as TranslationKey | null,
    items: [
      { to: "/dashboard/overview", labelKey: "nav.overview" as TranslationKey, icon: Building2, adminOnly: false },
      { to: "/dashboard/commercial", labelKey: "nav.commercial" as TranslationKey, icon: TrendingUp, adminOnly: false },
      { to: "/dashboard/operations", labelKey: "nav.operations" as TranslationKey, icon: Bell, adminOnly: false },
      { to: "/dashboard/shipments", labelKey: "nav.shipments" as TranslationKey, icon: Truck, adminOnly: false },
      { to: "/dashboard/pickup-distribution", labelKey: "nav.pickupDistribution" as TranslationKey, icon: ArrowLeftRight, adminOnly: false },
      { to: "/dashboard/account", labelKey: "nav.account" as TranslationKey, icon: User, adminOnly: false },
    ],
  },
  {
    labelKey: "nav.adminSection" as TranslationKey | null,
    items: [
      { to: "/dashboard/users", labelKey: "nav.users" as TranslationKey, icon: Users, adminOnly: true },
      { to: "/dashboard/roles", labelKey: "nav.roles" as TranslationKey, icon: ShieldCheck, adminOnly: true },
      { to: "/dashboard/organization", labelKey: "nav.organization" as TranslationKey, icon: Building2, adminOnly: true },
      { to: "/dashboard/audit-log", labelKey: "nav.auditLog" as TranslationKey, icon: ScrollText, adminOnly: true },
    ],
  },
];


function DashboardLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, user } = useCurrentUser();
  const { t } = useI18n();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/login", replace: true });
      } else {
        setSessionChecked(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      navigate({ to: "/dashboard/overview", replace: true });
    }
  }, [pathname, navigate]);

  const email = user?.email ?? null;
  const navSections = NAV_SECTIONS.map((s) => ({
    labelKey: s.labelKey,
    items: s.items.filter((n) => !n.adminOnly || isAdmin),
  })).filter((s) => s.items.length > 0);
  const flatNavItems = navSections.flatMap((s) => s.items);

  async function onLogout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }



  const initials = (user?.fullName || email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const displayName = user?.fullName || (email ? email.split("@")[0] : "User");
  const roleLabel = isAdmin ? t("common.admin") : t("common.member");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-72 shrink-0 flex-col p-3 md:flex print:hidden">
        <div className="flex flex-1 flex-col rounded-2xl bg-sidebar text-sidebar-foreground shadow-xl ring-1 ring-sidebar-border/50">
          {/* Header */}
          <div className="flex items-center justify-center px-3 py-4">
            <img src="/afik-logo-white.png" alt={t("app.name")} className="h-auto w-full rounded-xl" />
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-4 px-3 pt-2">
            {navSections.map((section, idx) => (
              <div key={section.labelKey ?? `sec-${idx}`} className="space-y-1.5">
                {section.labelKey && (
                  <div className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
                    {t(section.labelKey)}
                  </div>
                )}
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-2 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            active
                              ? "bg-white/15 text-sidebar-primary-foreground"
                              : "bg-sidebar-accent/50 text-sidebar-foreground/90",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {t(item.labelKey)}
                      </span>
                      {active && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                          <LayoutGrid className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Profile footer */}
          <div className="p-3">
            <ConfirmDialog
              title={t("logout.title")}
              description={t("logout.description")}
              confirmLabel={t("logout.confirm")}
              onConfirm={onLogout}
              trigger={
                <button className="flex w-full items-center gap-3 rounded-xl bg-sidebar-accent/50 px-3 py-2.5 text-start transition-colors hover:bg-sidebar-accent">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                    {initials || "U"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-sidebar-foreground">
                      {displayName}
                    </span>
                    <span className="block truncate text-xs text-sidebar-foreground/70">
                      {roleLabel}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-sidebar-foreground/70" />
                </button>
              }
            />
          </div>
        </div>
      </aside>


      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden print:hidden">
          <div className="flex items-center gap-2">
            <img src="/afik-logo-white.png" alt={t("app.name")} className="h-9 w-auto rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmDialog
              title={t("logout.title")}
              description={t("logout.description")}
              confirmLabel={t("logout.confirm")}
              onConfirm={onLogout}
              trigger={
                <button className="text-sm underline-offset-4 hover:underline">
                  {t("logout.button")}
                </button>
              }
            />
          </div>
        </div>
        <div className="md:hidden overflow-x-auto border-b bg-card print:hidden">
          <div className="flex gap-1 px-2 py-2">
            {flatNavItems.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>

        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
