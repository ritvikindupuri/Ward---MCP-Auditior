import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sable — Supply-chain risk intelligence for GitHub" },
      { name: "description", content: "Multi-agent GitHub scanning. Real CVEs, leaked secrets, supply-chain risk, maintainer OSINT — every finding judged by an LLM, exported as a PDF." },
      { property: "og:title", content: "Sable — Supply-chain risk intelligence for GitHub" },
      { property: "og:description", content: "Multi-agent GitHub security scanning with LLM-judged findings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="4" y="10" width="16" height="12" rx="6" stroke="currentColor" strokeWidth="1.75" opacity="0.55" />
      <path d="M22 10 h4 a6 6 0 0 1 6 6 a6 6 0 0 1 -6 6 h-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" fill="none" />
      <circle cx="22" cy="16" r="1.4" fill="currentColor" />
    </svg>
  );
}

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Nav signedIn={signedIn} />
      <Hero />
      <Pipeline />
      <Agents />
      <Footer />
    </div>
  );
}

function Nav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b hairline">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Mark size={20} />
          <span className="text-[14px] tracking-tight font-medium">Sable</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-[12.5px] text-muted-foreground">
          <a href="#pipeline" className="hover:text-foreground transition">Pipeline</a>
          <a href="#agents" className="hover:text-foreground transition">Agents</a>
        </nav>
        {signedIn ? (
          <Link to="/app" className="text-[12.5px] px-3.5 h-8 flex items-center rounded-full bg-foreground text-background hover:opacity-90 transition">
            Console →
          </Link>
        ) : (
          <Link to="/sign-in" className="text-[12.5px] px-3.5 h-8 flex items-center rounded-full glass hairline border hover:bg-surface-2 transition">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-28 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[640px] aurora opacity-30 animate-drift" />
      </div>
      <div className="mx-auto max-w-5xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass hairline border px-3 py-1 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Multi-agent · LLM-judged
        </div>
        <h1 className="mt-8 text-[68px] md:text-[104px] leading-[0.92] tracking-[-0.05em] font-semibold text-balance">
          Every repo,
          <br />
          <span className="font-serif italic font-normal text-muted-foreground">audited.</span>
        </h1>
        <p className="mt-8 mx-auto max-w-[440px] text-[15.5px] leading-[1.55] text-muted-foreground">
          Four agents. One PDF. Zero hand-waving.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link to="/sign-up" className="h-11 px-5 rounded-full bg-foreground text-background text-[13.5px] font-medium flex items-center hover:opacity-90 transition">
            Start scanning
          </Link>
          <a href="#pipeline" className="h-11 px-5 rounded-full glass hairline border text-[13.5px] font-medium flex items-center hover:bg-surface-2 transition">
            See the pipeline
          </a>
        </div>
        <LiveScanDemo />
      </div>
    </section>
  );
}

/** Interactive scan visualization — hover a node to inspect its live output. */
function LiveScanDemo() {
  const nodes = [
    { id: "repo", label: "Repository", sub: "acme/payments-svc", x: 8, y: 50 },
    { id: "vulnera", label: "Vulnera", sub: "OSV.dev · deps", x: 38, y: 18, agent: true, color: "#ef4444" },
    { id: "sift", label: "Sift", sub: "secrets scan", x: 38, y: 40, agent: true, color: "#f97316" },
    { id: "lineage", label: "Lineage", sub: "supply-chain", x: 38, y: 62, agent: true, color: "#eab308" },
    { id: "signal", label: "Signal", sub: "maintainer OSINT", x: 38, y: 84, agent: true, color: "#38bdf8" },
    { id: "judge", label: "LLM Judge", sub: "reasoning · verdict", x: 68, y: 50 },
    { id: "pdf", label: "PDF Report", sub: "board-ready", x: 92, y: 50 },
  ] as const;

  const edges = [
    ["repo", "vulnera"], ["repo", "sift"], ["repo", "lineage"], ["repo", "signal"],
    ["vulnera", "judge"], ["sift", "judge"], ["lineage", "judge"], ["signal", "judge"],
    ["judge", "pdf"],
  ] as const;

  const [active, setActive] = useState<string>("vulnera");
  const activeNode = nodes.find((n) => n.id === active)!;

  const details: Record<string, { title: string; items: string[] }> = {
    repo: { title: "Source", items: ["Read-only PAT", "Default branch only", "No code egress"] },
    vulnera: { title: "Vulnera output", items: ["CVE-2024-21538 · cross-spawn@7.0.3", "GHSA-mwcw-c2x4-8c55 · lodash@4.17.20", "342 deps · 14 advisories"] },
    sift: { title: "Sift output", items: ["AWS_ACCESS_KEY_ID in .env.example", "Stripe live key in seed.ts", "12 files scanned"] },
    lineage: { title: "Lineage output", items: ["Solo maintainer: node-ipc@11.1.0", "Typosquat candidate: reqeusts", "1 abandoned package"] },
    signal: { title: "Signal output", items: ["Owner account age: 14d", "Push burst mismatch", "Affiliation unverified"] },
    judge: { title: "Judge verdict", items: ["Cross-referenced 4 agents", "Ranked by exploitability", "Attached reasoning per finding"] },
    pdf: { title: "Artifact", items: ["Severity-graded index", "Agent attribution per finding", "sable-acme-payments-a1c9f2b.pdf"] },
  };

  return (
    <div className="relative mt-16 mx-auto max-w-5xl">
      <div className="rounded-2xl glass hairline border overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 h-9 border-b hairline bg-surface-2/40">
          <span className="h-2 w-2 rounded-full bg-red-400/60" />
          <span className="h-2 w-2 rounded-full bg-yellow-400/60" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
          <span className="ml-3 text-[10.5px] text-muted-foreground font-mono">sable · pipeline · live</span>
          <span className="ml-auto text-[10.5px] text-muted-foreground">hover a node</span>
        </div>
        <div className="grid md:grid-cols-[1fr_260px] min-h-[360px]">
          <div className="relative p-6">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)]">
              {edges.map(([a, b], i) => {
                const na = nodes.find((n) => n.id === a)!;
                const nb = nodes.find((n) => n.id === b)!;
                const isActive = active === a || active === b;
                return (
                  <line
                    key={i}
                    x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                    stroke={isActive ? "currentColor" : "currentColor"}
                    strokeOpacity={isActive ? 0.5 : 0.12}
                    strokeWidth={isActive ? 0.35 : 0.2}
                    strokeDasharray={isActive ? "0.6 0.6" : undefined}
                  >
                    {isActive && (
                      <animate attributeName="stroke-dashoffset" from="0" to="-4" dur="0.9s" repeatCount="indefinite" />
                    )}
                  </line>
                );
              })}
            </svg>
            <div className="relative h-[320px]">
              {nodes.map((n) => {
                const isActive = active === n.id;
                return (
                  <button
                    key={n.id}
                    onMouseEnter={() => setActive(n.id)}
                    onFocus={() => setActive(n.id)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group outline-none"
                    style={{ left: `${n.x}%`, top: `${n.y}%` }}
                  >
                    <div
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border hairline transition-all ${
                        isActive
                          ? "bg-foreground text-background scale-105 shadow-lg"
                          : "glass text-foreground/80 hover:text-foreground"
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "agent" in n && n.agent ? n.color : "currentColor" }}
                      />
                      <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">{n.label}</span>
                    </div>
                    <div className={`mt-1 text-[9.5px] text-center whitespace-nowrap font-mono transition-opacity ${isActive ? "opacity-70" : "opacity-30"}`}>
                      {n.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <aside className="border-l hairline p-5 bg-surface-2/20 text-left">
            <div className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/70">Inspecting</div>
            <div className="mt-1.5 text-[15px] font-medium tracking-tight">{activeNode.label}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{activeNode.sub}</div>
            <div className="mt-5 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{details[active].title}</div>
              {details[active].items.map((it, i) => (
                <div key={i} className="flex items-start gap-2 text-[11.5px] text-foreground/85">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-foreground/40 shrink-0" />
                  <span className="font-mono leading-[1.5]">{it}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Pipeline() {
  return (
    <section id="pipeline" className="relative py-28 border-t hairline">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Pipeline</div>
        <h2 className="text-[40px] md:text-[52px] leading-[1] tracking-[-0.035em] font-semibold text-balance max-w-2xl">
          Connect. Dispatch.
          <br />
          <span className="font-serif italic font-normal text-muted-foreground">Ship the PDF.</span>
        </h2>
        <PipelineDiagram />
      </div>
    </section>
  );
}

/** Interactive stepper — click a step, see it activate. */
function PipelineDiagram() {
  const steps = [
    { n: "01", t: "Connect", d: "Read-only GitHub PAT." },
    { n: "02", t: "Dispatch", d: "Four agents run in parallel." },
    { n: "03", t: "Judge", d: "LLM verdict on every raw signal." },
    { n: "04", t: "Ship", d: "Downloadable PDF." },
  ];
  const [step, setStep] = useState(0);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    timer.current = window.setInterval(() => setStep((s) => (s + 1) % steps.length), 2600);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, []);
  return (
    <div className="mt-14">
      <div className="relative h-px bg-border">
        <div
          className="absolute top-0 left-0 h-px bg-foreground transition-all duration-700"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
        {steps.map((s, i) => {
          const active = i === step;
          return (
            <button
              key={s.n}
              onMouseEnter={() => { if (timer.current) window.clearInterval(timer.current); setStep(i); }}
              onClick={() => setStep(i)}
              className="text-left group"
            >
              <div className={`text-[10.5px] font-mono transition ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {s.n}
              </div>
              <div className={`mt-2 text-[16px] font-medium tracking-tight transition ${active ? "text-foreground" : "text-muted-foreground/70"}`}>
                {s.t}
              </div>
              <div className="mt-1 text-[12.5px] leading-[1.5] text-muted-foreground">{s.d}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Agents() {
  const agents = [
    { n: "01", name: "Vulnera", role: "Dependency CVEs" },
    { n: "02", name: "Sift", role: "Committed secrets" },
    { n: "03", name: "Lineage", role: "Supply-chain risk" },
    { n: "04", name: "Signal", role: "Maintainer OSINT" },
  ];
  return (
    <section id="agents" className="relative py-28 border-t hairline">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Agents</div>
        <div className="grid md:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden hairline border">
          {agents.map((a) => (
            <div key={a.n} className="bg-background p-7 flex items-baseline gap-4">
              <span className="text-[10.5px] font-mono text-muted-foreground">{a.n}</span>
              <div>
                <div className="text-[17px] font-medium tracking-tight">{a.name}</div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5 uppercase tracking-[0.14em]">{a.role}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link to="/sign-up" className="h-11 px-5 rounded-full bg-foreground text-background text-[13.5px] font-medium inline-flex items-center hover:opacity-90 transition">
            Scan your first repo →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t hairline py-8">
      <div className="mx-auto max-w-6xl px-6 flex flex-wrap items-center justify-between gap-4 text-[11.5px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Mark size={14} />
          <span>Sable · {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#pipeline" className="hover:text-foreground transition">Pipeline</a>
          <a href="#agents" className="hover:text-foreground transition">Agents</a>
          <Link to="/sign-in" className="hover:text-foreground transition">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
