import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Cargo Console" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Reset password — Cargo Console" },
      {
        property: "og:description",
        content: "Choose a new password for your account.",
      },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    // Supabase parses the recovery hash and creates a session on this page load.
    // We just need to check whether we now have one.
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasRecoverySession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(true);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pwd !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      await supabase.auth.signOut();
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reset password");
    } finally {
      setLoading(false);
    }
  }

  if (hasRecoverySession === false) return <InvalidLink />;

  if (done) {
    return (
      <AuthLayout
        title="Password updated"
        subtitle="Sign in with your new password."
      >
        <Link
          to="/login"
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose something strong you'll remember.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>New password</Label>
          <Input
            required
            type="password"
            minLength={8}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Confirm new password</Label>
          <Input
            required
            type="password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}

function InvalidLink() {
  return (
    <AuthLayout
      title="This link is invalid or has expired"
      subtitle="Request a fresh reset link and try again."
      footer={
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Link
        to="/forgot-password"
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Request a new link
      </Link>
    </AuthLayout>
  );
}
