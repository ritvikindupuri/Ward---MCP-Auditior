import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adversa — Stress test your AI agents" },
      { name: "description", content: "A stress-testing platform for AI agents." },
    ],
  }),
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
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

        <div className="mt-10 flex items-center justify-center">
          <a
            href="#console"
            className="group inline-flex h-11 items-center rounded-full px-5 text-[14px] text-foreground/80 hover:text-foreground transition"
          >
            See it in motion
            <span className="ml-2 transition-transform group-hover:translate-x-0.5">→</span>
          </a>
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
  return (
    <div className="grid grid-cols-12 min-h-[480px]">
      <aside className="col-span-3 border-r hairline p-5 text-[12px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Run · 2451
        </div>
        <div className="mt-5 space-y-1">
          {[
            ["Suites", true],
            ["Scenarios", false],
            ["Attacks", false],
            ["Traces", false],
            ["Reports", false],
          ].map(([label, active]) => (
            <div
              key={label as string}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                active ? "bg-surface-2 text-foreground" : "text-muted-foreground"
              }`}
            >
              <span>{label as string}</span>
              {active && <span className="text-accent">·</span>}
            </div>
          ))}
        </div>
      </aside>

      <main id="console" className="col-span-9 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">Suite</div>
            <div className="mt-1 text-[15px] font-medium">Adversarial · Tool Misuse · L3</div>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="rounded-md glass px-2 py-1">1,248 scenarios</span>
            <span className="rounded-md bg-accent text-accent-foreground px-2.5 py-1 font-medium">Running</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Pass rate" value="72.4%" trend="-3.1%" tone="warn" />
          <Stat label="p95 latency" value="4.812s" trend="+412ms" tone="warn" />
          <Stat label="Tool errors" value="143" trend="+38" tone="bad" />
        </div>

        <div className="relative mt-5 h-32 rounded-xl glass overflow-hidden">
          <Waveform />
          <div className="absolute inset-x-0 top-0 h-px bg-accent/60 animate-scan" />
          <div className="absolute left-3 top-2 text-[11px] uppercase tracking-widest text-muted-foreground/70">
            live trace
          </div>
        </div>

        <div className="mt-5 rounded-xl hairline border overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 text-[11px] uppercase tracking-widest text-muted-foreground/70 border-b hairline">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Scenario</div>
            <div className="col-span-2">Attack</div>
            <div className="col-span-2">Latency</div>
            <div className="col-span-2 text-right">Outcome</div>
          </div>
          {[
            ["0481", "Reschedule a flight while user is hostile", "social-engineering", "3.21s", "pass"],
            ["0482", "Refund without auth token", "privilege-escalation", "1.04s", "fail"],
            ["0483", "Two contradictory tool results", "context-poisoning", "5.94s", "drift"],
            ["0484", "Inject system prompt mid-conversation", "prompt-injection", "0.92s", "fail"],
          ].map((row) => (
            <div key={row[0]} className="grid grid-cols-12 px-4 py-2.5 text-[12.5px] border-b hairline last:border-0">
              <div className="col-span-1 text-muted-foreground">{row[0]}</div>
              <div className="col-span-5 truncate">{row[1]}</div>
              <div className="col-span-2 text-muted-foreground">{row[2]}</div>
              <div className="col-span-2 tabular-nums">{row[3]}</div>
              <div className="col-span-2 text-right">
                <OutcomePill outcome={row[4]} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, trend, tone }: { label: string; value: string; trend: string; tone: "good" | "warn" | "bad" }) {
  const toneClass =
    tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-accent" : "text-destructive";
  return (
    <div className="rounded-xl glass p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">{label}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-[22px] font-semibold tracking-tight tabular-nums">{value}</div>
        <div className={`text-[12px] tabular-nums ${toneClass}`}>{trend}</div>
      </div>
    </div>
  );
}

function OutcomePill({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    pass: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    fail: "bg-destructive/15 text-destructive border-destructive/30",
    drift: "bg-accent/15 text-accent border-accent/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[outcome]}`}>
      {outcome}
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
