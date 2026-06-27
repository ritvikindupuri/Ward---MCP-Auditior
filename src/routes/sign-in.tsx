import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mark } from "./index";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — Adversa" },
      { name: "description", content: "Sign in to Adversa." },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  return <AuthShell mode="signin" />;
}

export function AuthShell({ mode }: { mode: "signin" | "signup" }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground grain relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[700px] aurora opacity-40 animate-drift" />
      </div>

      <header className="absolute top-0 inset-x-0 px-6 h-14 flex items-center">
        <Link to="/" className="flex items-center gap-2.5">
          <Mark size={22} />
          <span className="text-[15px] tracking-tight font-medium">Adversa</span>
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
            {isSignup ? "Start stress-testing in minutes." : "Sign in to your workspace."}
          </p>

          <form
            className="mt-10 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {isSignup && <Field label="Name" type="text" placeholder="Ada Lovelace" />}
            <Field label="Email" type="email" placeholder="you@company.com" />
            <Field label="Password" type="password" placeholder="••••••••" />

            <button
              type="submit"
              className="mt-2 w-full h-11 rounded-full bg-foreground text-background text-[14px] font-medium hover:opacity-90 transition"
            >
              {isSignup ? "Create account" : "Sign in"}
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
                New to Adversa?{" "}
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

function Field({ label, type, placeholder }: { label: string; type: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
        {label}
      </span>
      <input
        type={type}
        required
        placeholder={placeholder}
        className="w-full h-11 rounded-xl glass px-4 text-[14px] outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring transition"
      />
    </label>
  );
}
