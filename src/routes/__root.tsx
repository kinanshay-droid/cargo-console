import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";


import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";

function NotFoundComponent() {
  return (
    <div className="auth-shell">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="auth-shell">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AFIK Logistics Platform — Shipment & Org Management" },
      {
        name: "description",
        content:
          "A logistics operations console for managing shipments, users, roles, and organization settings.",
      },
      { name: "author", content: "AFIK Logistics Platform" },
      { property: "og:title", content: "AFIK Logistics Platform" },
      {
        property: "og:description",
        content: "Manage shipments, users, and organization settings in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
        <SupabaseAuthListener />
        <OverlayPointerEventsGuard />
      </I18nProvider>
    </QueryClientProvider>
  );
}

// Known Radix UI issue: when one overlay primitive (e.g. a Popover, like the
// "פעולה מהירה" quick-actions menu) closes at almost the same moment another
// (a Dialog it opened) does too — every save-and-close action-dialog flow in
// this app does exactly that — each primitive manages
// document.body.style.pointerEvents (and aria-hidden on background siblings)
// independently and can leave it stuck after the last one closes, even
// though nothing is open anymore. That silently blocks every click on the
// page, including the very button that's supposed to reopen the menu, until
// a full reload.
//
// A MutationObserver alone isn't reliable here: it only fires on the
// mutation event itself, and if that fires while the *other* primitive's
// close/cleanup effect hasn't run yet, clearing it there can race with that
// cleanup re-locking it right after. So this also polls on an interval —
// cheap, and guarantees the stuck state gets caught and corrected on the
// very next tick no matter how the two primitives' timings interleave.
function OverlayPointerEventsGuard() {
  useEffect(() => {
    const clearIfStuck = () => {
      const hasOpenOverlay = !!document.querySelector('[data-state="open"]');
      if (hasOpenOverlay) return;
      if (document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
      if (document.documentElement.style.pointerEvents === "none") {
        document.documentElement.style.pointerEvents = "";
      }
    };
    const observer = new MutationObserver(clearIfStuck);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    const interval = setInterval(clearIfStuck, 400);
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);
  return null;
}

// One global listener: refetch on identity transitions and redirect on sign-out.
function SupabaseAuthListener() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    // Lazy import so the auth-listener does not run during SSR.
    let unsub: (() => void) | undefined;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (
          event !== "SIGNED_IN" &&
          event !== "SIGNED_OUT" &&
          event !== "USER_UPDATED"
        )
          return;
        router.invalidate();
        if (event === "SIGNED_OUT") {
          qc.clear();
          const publicPaths = ["/login", "/signup", "/forgot-password", "/reset-password"];
          if (!publicPaths.includes(pathname)) {
            router.navigate({ to: "/login", replace: true });
          }
        } else {
          qc.invalidateQueries();
        }
      });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => {
      unsub?.();
    };
  }, [qc, router, pathname]);
  return null;
}


