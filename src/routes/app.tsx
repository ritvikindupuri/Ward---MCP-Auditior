import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Mark } from "./index";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Console — Adversa" },
      { name: "description", content: "Your Adversa workspace." },
    ],
  }),
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<"Suites" | "Scenarios" | "Attacks" | "Traces" | "Reports">("Suites");
  const [connectOpen, setConnectOpen] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [agentName, setAgentName] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [connectStatus, setConnectStatus] = useState<null | "saving" | "saved">(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setReady(true);
      if (!u) navigate({ to: "/sign-in" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate({ to: "/sign-in" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center text-[13px] text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return null;

  const name = (user.user_metadata?.name as string | undefined) ?? user.email?.split("@")[0] ?? "you";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground grain">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b hairline">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Mark size={22} />
            <span className="text-[15px] tracking-tight font-medium">Adversa</span>
            <span className="ml-3 text-[12px] text-muted-foreground">/ Console</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-muted-foreground hidden sm:block">{user.email}</span>
            <div className="h-7 w-7 rounded-full bg-surface-2 hairline border flex items-center justify-center text-[12px] font-medium">
              {initial}
            </div>
            <button
              onClick={signOut}
              className="h-8 rounded-full hairline border px-3 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Workspace</div>
            <h1 className="mt-2 text-[34px] leading-[1.05] tracking-[-0.035em] font-semibold">
              Welcome, <span className="font-serif italic font-normal text-muted-foreground">{name}.</span>
            </h1>
          </div>
          <button className="h-10 rounded-full bg-foreground text-background px-5 text-[13.5px] font-medium hover:opacity-90 transition">
            + New run
          </button>
        </div>

        <div className="mt-10 grid grid-cols-12 gap-6">
          <aside className="col-span-12 md:col-span-3">
            <div className="rounded-2xl hairline border p-3 text-[13px]">
              <div className="px-2 pt-1 pb-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70">
                Navigation
              </div>
              {(["Suites", "Scenarios", "Attacks", "Traces", "Reports"] as const).map((label) => (
                <button
                  key={label}
                  onClick={() => setActive(label)}
                  className={`w-full text-left flex items-center justify-between rounded-lg px-2.5 py-2 transition ${
                    active === label ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{label}</span>
                  {active === label && <span className="text-accent">·</span>}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl hairline border p-4">
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70">Plan</div>
              <div className="mt-2 text-[14px] font-medium">Private Beta</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">Unlimited runs during beta.</div>
            </div>
          </aside>

          <main className="col-span-12 md:col-span-9 space-y-6">
            <section className="rounded-2xl hairline border overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b hairline">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">Suite</div>
                  <div className="mt-1 text-[15px] font-medium">Adversarial · Tool Misuse · L3</div>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="rounded-md glass px-2 py-1">0 scenarios</span>
                  <span className="rounded-md hairline border px-2.5 py-1 text-muted-foreground">Idle</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5">
                <EmptyStat label="Pass rate" />
                <EmptyStat label="p95 latency" />
                <EmptyStat label="Tool errors" />
              </div>

              <div className="p-5 pt-0">
                <div className="rounded-xl border hairline border-dashed p-10 text-center">
                  <div className="text-[14px] font-medium">No runs yet</div>
                  <p className="mt-1.5 text-[13px] text-muted-foreground max-w-sm mx-auto">
                    Connect your first agent endpoint to start stress-testing. Every trace, tool call, and failure will land here.
                  </p>
                  <button
                    onClick={() => { setConnectStatus(null); setConnectOpen(true); }}
                    className="mt-5 h-10 rounded-full bg-foreground text-background px-5 text-[13.5px] font-medium hover:opacity-90 transition"
                  >
                    Connect an agent
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl hairline border p-5">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-medium">Recent activity</div>
                <span className="text-[12px] text-muted-foreground">Live</span>
              </div>
              <div className="mt-4 text-[13px] text-muted-foreground text-center py-10">
                Nothing here yet.
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function EmptyStat({ label }: { label: string }) {
  return (
    <div className="rounded-xl glass p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">{label}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-[22px] font-semibold tracking-tight tabular-nums text-muted-foreground/50">—</div>
        <div className="text-[12px] tabular-nums text-muted-foreground/50">·</div>
      </div>
    </div>
  );
}
