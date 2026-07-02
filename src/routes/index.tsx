import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLandingStats } from "@/lib/adversa.functions";

const landingStatsQuery = queryOptions({
  queryKey: ["landing-stats"],
  queryFn: () => getLandingStats(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adversa — Stress test your AI agents" },
      { name: "description", content: "A stress-testing platform for AI agents." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(landingStatsQuery);
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Nav />
      <Hero />
      <HowItWorks />
      <Principles />
      <ClosingCTA />
      <Footer />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Connect",
      body: "Point Adversa at your agent endpoint. Any framework, any model.",
    },
    {
      n: "02",
      title: "Provoke",
      body: "Run adversarial suites — prompt injection, tool misuse, context drift.",
    },
    {
      n: "03",
      title: "Resolve",
      body: "Inspect traces, reproduce failures, ship hardened agents.",
    },
  ];
  return (
    <section id="how" className="relative py-32 border-t hairline">
      <div className="mx-auto max-w-5xl px-6">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">How it works</div>
          <h2 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.035em] font-semibold text-balance">
            Three steps. <span className="font-serif italic font-normal text-muted-foreground">Zero theatre.</span>
          </h2>
        </div>
        <div className="mt-16 grid gap-px bg-border/40 sm:grid-cols-3 rounded-2xl overflow-hidden hairline border">
          {steps.map((s) => (
            <div key={s.n} className="bg-background p-8">
              <div className="text-[12px] tabular-nums text-accent">{s.n}</div>
              <div className="mt-6 text-[18px] font-medium tracking-tight">{s.title}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Principles() {
  const items = [
    { k: "Deterministic", v: "Seeded runs. Reproducible failures." },
    { k: "Framework-agnostic", v: "OpenAI, Anthropic, custom — all welcome." },
    { k: "Trace-first", v: "Every tool call, every token, captured." },
    { k: "Private by default", v: "Your data never trains anyone's model." },
  ];
  return (
    <section className="relative py-32 border-t hairline">
      <div className="mx-auto max-w-5xl px-6 grid gap-16 md:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Principles</div>
          <h2 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.035em] font-semibold text-balance">
            Built for teams who <span className="font-serif italic font-normal text-muted-foreground">ship.</span>
          </h2>
        </div>
        <dl className="space-y-8">
          {items.map((i) => (
            <div key={i.k} className="border-b hairline pb-6 last:border-0">
              <dt className="text-[15px] font-medium tracking-tight">{i.k}</dt>
              <dd className="mt-1.5 text-[14px] text-muted-foreground">{i.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="relative py-40 border-t hairline overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[500px] aurora opacity-30 animate-drift" />
      </div>
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.04em] font-semibold text-balance">
          Start breaking <span className="font-serif italic font-normal text-muted-foreground">things.</span>
        </h2>
        <div className="mt-10 flex items-center justify-center">
          <Link
            to="/sign-up"
            className="inline-flex h-11 items-center rounded-full bg-foreground text-background px-6 text-[14px] font-medium hover:opacity-90 transition"
          >
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      sub.subscription.unsubscribe();
    };
  }, []);
  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? "backdrop-blur-xl bg-background/70 border-b hairline" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] tracking-tight font-medium">Adversa</span>
        </Link>
        <div className="flex items-center gap-1">
          {signedIn ? (
            <Link
              to="/app"
              className="inline-flex h-8 items-center rounded-full bg-foreground text-background px-3.5 text-[13px] font-medium hover:opacity-90 transition"
            >
              Open console →
            </Link>
          ) : (
            <>
              <Link
                to="/sign-in"
                className="inline-flex h-8 items-center px-3 text-[13px] text-muted-foreground hover:text-foreground transition"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="inline-flex h-8 items-center rounded-full bg-foreground text-background px-3.5 text-[13px] font-medium hover:opacity-90 transition"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Mark({ size = 26 }: { size?: number }) {
  // Aperture mark — six asymmetric blades rotating around a single hot point.
  // The blades read as a probe iris narrowing on a target. Unique to Adversa.
  const blades = [0, 60, 120, 180, 240, 300];
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <defs>
          <linearGradient id="blade-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {/* outer hairline ring */}
        <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.75" />
        {/* aperture blades */}
        <g>
          {blades.map((deg) => (
            <path
              key={deg}
              d="M20 20 L33 14 A14 14 0 0 1 33 20 Z"
              fill="url(#blade-grad)"
              fillOpacity="0.85"
              transform={`rotate(${deg} 20 20)`}
            />
          ))}
        </g>
        {/* inner negative iris */}
        <circle cx="20" cy="20" r="5.5" fill="var(--background)" />
        {/* hot core */}
        <circle cx="20" cy="20" r="2.2" fill="var(--accent)" />
      </svg>
      <span
        className="absolute h-[3px] w-[3px] rounded-full"
        style={{ background: "var(--accent)", boxShadow: "0 0 12px 2px var(--accent)" }}
      />
    </span>
  );
}

function Hero() {
  return (
    <section className="relative pt-44 pb-24 grain">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[800px] aurora opacity-50 animate-drift" />
      </div>

      <div className="mx-auto max-w-5xl px-6 text-center">
        <h1 className="text-balance text-[clamp(2.75rem,8vw,6.25rem)] leading-[0.95] tracking-[-0.045em] font-semibold">
          Break your agents.
          <br />
          <span className="font-serif italic font-normal text-muted-foreground">
            Before reality does.
          </span>
        </h1>

        <p className="mx-auto mt-8 max-w-xl text-pretty text-[16px] leading-relaxed text-muted-foreground">
          A stress-testing platform for AI agents.
        </p>

        <div className="mt-10 flex items-center justify-center gap-2">
          <Link
            to="/sign-in"
            className="group inline-flex h-11 items-center rounded-full px-5 text-[14px] text-foreground/80 hover:text-foreground transition"
          >
            See it in motion
            <span className="ml-2 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>

      <div className="relative mx-auto mt-20 max-w-6xl px-6">
        <div className="relative rounded-3xl glass ring-hairline overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(1_0_0_/_0.04),transparent_30%)]" />
          <DeviceFrame />
        </div>
        <div className="pointer-events-none absolute -inset-x-12 -bottom-12 h-40 bg-[radial-gradient(50%_100%_at_50%_0%,oklch(0.72_0.16_35_/_0.22),transparent_70%)] blur-2xl" />
      </div>
    </section>
  );
}

function DeviceFrame() {
  const { data } = useQuery(landingStatsQuery);
  const total = data?.total ?? 0;
  const categories = data?.categories ?? 0;
  const owasp = data?.owasp_covered ?? 0;
  const frameworks = data?.frameworks ?? [];
  const sample = data?.sample ?? [];

  return (
    <div className="grid grid-cols-12 min-h-[480px]">
      <aside className="col-span-3 border-r hairline p-5 text-[12px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Library · v{total}
        </div>
        <div className="mt-5 space-y-1">
          <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-surface-2 text-foreground">
            <span>Attacks</span>
            <span className="text-accent tabular-nums">{total}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-muted-foreground">
            <span>Categories</span>
            <span className="tabular-nums">{categories}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-muted-foreground">
            <span>OWASP LLM</span>
            <span className="tabular-nums">{owasp}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-muted-foreground">
            <span>Frameworks</span>
            <span className="tabular-nums">{frameworks.length}</span>
          </div>
        </div>
      </aside>

      <main id="console" className="col-span-9 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">Suite</div>
            <div className="mt-1 text-[15px] font-medium">Adversarial · Full Library</div>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="rounded-md glass px-2 py-1 tabular-nums">{total} scenarios</span>
            <span className="rounded-md bg-accent text-accent-foreground px-2.5 py-1 font-medium">Ready</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Attacks" value={String(total)} sub="in library" />
          <Stat label="Categories" value={String(categories)} sub="coverage areas" />
          <Stat label="OWASP LLM" value={String(owasp)} sub="of Top 10" />
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {frameworks.length === 0 ? (
            <span className="rounded-full glass px-2.5 py-1 text-[11px] text-muted-foreground">Loading compliance…</span>
          ) : (
            frameworks.map((f) => (
              <span
                key={f}
                className="rounded-full glass px-2.5 py-1 text-[11px] tracking-wide text-muted-foreground"
              >
                {f}
              </span>
            ))
          )}
        </div>

        <div className="mt-5 rounded-xl hairline border overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 text-[11px] uppercase tracking-widest text-muted-foreground/70 border-b hairline">
            <div className="col-span-1">#</div>
            <div className="col-span-6">Attack</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-2 text-right">Severity</div>
          </div>
          {sample.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 px-4 py-2.5 text-[12.5px] border-b hairline last:border-0">
                  <div className="col-span-12 h-4 rounded bg-foreground/5 animate-pulse" />
                </div>
              ))
            : sample.map((row, i) => (
                <div
                  key={row.name}
                  className="grid grid-cols-12 px-4 py-2.5 text-[12.5px] border-b hairline last:border-0"
                >
                  <div className="col-span-1 text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(4, "0")}
                  </div>
                  <div className="col-span-6 truncate">{row.name}</div>
                  <div className="col-span-3 text-muted-foreground truncate">{row.category}</div>
                  <div className="col-span-2 text-right">
                    <SeverityPill severity={row.severity} />
                  </div>
                </div>
              ))}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl glass p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">{label}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-[22px] font-semibold tracking-tight tabular-nums">{value}</div>
        <div className="text-[12px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    low: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    medium: "bg-accent/15 text-accent border-accent/30",
    high: "bg-destructive/15 text-destructive border-destructive/30",
    critical: "bg-destructive/20 text-destructive border-destructive/40",
  };
  const cls = map[severity] ?? "bg-foreground/10 text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {severity}
    </span>
  );
}

function Waveform() {
  const bars = Array.from({ length: 96 });
  return (
    <div className="absolute inset-0 flex items-end gap-[2px] px-3 pb-3 pt-8">
      {bars.map((_, i) => {
        const h = 12 + Math.abs(Math.sin(i * 0.5)) * 60 + (i % 7) * 4;
        return (
          <div
            key={i}
            className="flex-1 rounded-sm bg-foreground/15"
            style={{ height: `${Math.min(h, 90)}%` }}
          />
        );
      })}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t hairline py-10">
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <Mark size={18} />
          <span className="text-[13px] tracking-tight">Adversa</span>
        </div>
        <span className="text-[12px] text-muted-foreground">© 2026</span>
      </div>
    </footer>
  );
}
