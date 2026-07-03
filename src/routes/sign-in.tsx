import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mark } from "./index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — Ward" },
      { name: "description", content: "Sign in to Ward." },
    ],
  }),
  component: () => <AuthShell mode="signin" />,
});

export function AuthShell({ mode }: { mode: "signin" | "signup" }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/app`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground grain relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[700px] aurora opacity-40 animate-drift" />
      </div>

      <header className="absolute top-0 inset-x-0 px-6 h-14 flex items-center">
        <Link to="/" className="flex items-center gap-2.5">
          <Mark size={22} />
          <span className="text-[15px] tracking-tight font-medium">Ward</span>
        </Link>
      </header>

      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[34px] leading-[1.05] tracking-[-0.035em] font-semibold text-balance">
            {isSignup ? (
              <>
                Create your <span className="font-serif italic font-normal text-muted-foreground">account.</span>
              </>
            ) : (
              <>
                Welcome <span className="font-serif italic font-normal text-muted-foreground">back.</span>
              </>
            )}
          </h1>
          <p className="mt-3 text-[14px] text-muted-foreground">
            {isSignup ? "Start scanning your repositories in minutes." : "Sign in to your workspace."}
          </p>

          <button
            type="button"
            onClick={onGoogle}
            disabled={loading}
            className="mt-8 w-full h-11 rounded-full glass hairline border text-[14px] font-medium hover:bg-surface-2 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3" onSubmit={onSubmit}>
            {isSignup && (
              <Field label="Name" type="text" placeholder="Ada Lovelace" value={name} onChange={setName} />
            )}
            <Field label="Email" type="email" placeholder="you@company.com" value={email} onChange={setEmail} />
            <Field label="Password" type="password" placeholder="••••••••" value={password} onChange={setPassword} />

            {error && (
              <p className="text-[12.5px] text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full h-11 rounded-full bg-foreground text-background text-[14px] font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "…" : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] text-muted-foreground">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link to="/sign-in" className="text-foreground hover:underline underline-offset-4">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to Ward?{" "}
                <Link to="/sign-up" className="text-foreground hover:underline underline-offset-4">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
        {label}
      </span>
      <input
        type={type}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-xl glass px-4 text-[14px] outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring transition"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
