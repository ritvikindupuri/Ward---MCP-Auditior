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

/** Interactive scan diagram — click a node to inspect its example input/output. */
function LiveScanDemo() {
  type NodeDef = {
    id: string;
    label: string;
    kind: "source" | "agent" | "judge" | "artifact";
    x: number; y: number;
    accent?: string;
  };

  const nodes: NodeDef[] = [
    { id: "repo",    label: "Repository",  kind: "source",   x: 10, y: 50 },
    { id: "vulnera", label: "Vulnera",     kind: "agent",    x: 42, y: 14, accent: "#f87171" },
    { id: "sift",    label: "Sift",        kind: "agent",    x: 42, y: 38, accent: "#fb923c" },
    { id: "lineage", label: "Lineage",     kind: "agent",    x: 42, y: 62, accent: "#facc15" },
    { id: "signal",  label: "Signal",      kind: "agent",    x: 42, y: 86, accent: "#a78bfa" },
    { id: "judge",   label: "LLM Judge",   kind: "judge",    x: 72, y: 50 },
    { id: "pdf",     label: "PDF Report",  kind: "artifact", x: 94, y: 50 },
  ];

  const edges: Array<[string, string]> = [
    ["repo", "vulnera"], ["repo", "sift"], ["repo", "lineage"], ["repo", "signal"],
    ["vulnera", "judge"], ["sift", "judge"], ["lineage", "judge"], ["signal", "judge"],
    ["judge", "pdf"],
  ];

  const details: Record<string, {
    subtitle: string;
    summary: string;
    input: { label: string; body: string };
    output: { label: string; body: string };
    tag: string;
  }> = {
    repo: {
      subtitle: "GitHub source of truth",
      summary: "Read-only fine-grained PAT. Default branch only. Never writes.",
      tag: "SOURCE",
      input: { label: "Fetch", body: "GET /repos/acme/payments-svc\nGET /repos/acme/payments-svc/git/trees/main?recursive=1" },
      output: { label: "Materials", body: "package.json  · 342 deps\nrequirements.txt · 41 deps\n1,204 blobs enumerated" },
    },
    vulnera: {
      subtitle: "Dependency CVEs · OSV.dev",
      summary: "Batch-queries OSV.dev for every resolved version, scores CVSS, splits by severity.",
      tag: "AGENT · DEPS",
      input: { label: "OSV query", body: `POST https://api.osv.dev/v1/querybatch\n{ "queries": [\n  { "package": { "name": "cross-spawn", "ecosystem": "npm" },\n    "version": "7.0.3" }, …\n] }` },
      output: { label: "Findings", body: `CVE-2024-21538 · cross-spawn@7.0.3 · CVSS 7.5 · high\nGHSA-mwcw-c2x4-8c55 · lodash@4.17.20 · CVSS 5.3 · medium\n14 advisories across 342 deps` },
    },
    sift: {
      subtitle: "Committed secrets · regex + entropy",
      summary: "Walks default branch, matches high-confidence signatures (AWS, GH, Stripe, private keys).",
      tag: "AGENT · SECRETS",
      input: { label: "Scan set", body: "80 files · .env, .yml, .ts, .py, .toml\nExcludes: node_modules, dist, vendor" },
      output: { label: "Hits", body: `AWS_ACCESS_KEY_ID  in  .env.example  · AKIA5XW…\nSTRIPE_SK_LIVE     in  scripts/seed.ts · sk_live_51H…\n2 leaked · rotate immediately` },
    },
    lineage: {
      subtitle: "Supply-chain risk · LLM-judged",
      summary: "Judge inspects the dependency graph for typosquats, abandoned packages, and solo-maintainer chokepoints.",
      tag: "AGENT · SUPPLY",
      input: { label: "Prompt payload", body: `role: system → "You are a supply-chain analyst…"\nrole: user   → "Dependencies:\\nnpm:node-ipc@11.1.0\\nnpm:reqeusts@2.4.0 …"` },
      output: { label: "Verdicts", body: `solo_maintainer · npm:node-ipc@11.1.0 · high\ntyposquat       · npm:reqeusts@2.4.0    · critical\nabandoned       · npm:request@2.88.2    · medium` },
    },
    signal: {
      subtitle: "Maintainer OSINT · LLM-judged",
      summary: "Correlates repo metadata with owner account age, follower graph, license posture, claimed affiliation.",
      tag: "AGENT · OSINT",
      input: { label: "Correlation set", body: `owner.login = acme-labs · created 2026-06-19 (14d ago)\nowner.public_repos = 3 · followers = 1\nrepo.stars = 812 · license = null` },
      output: { label: "Signals", body: `Owner account created 14 days before push · medium\nNo LICENSE file on widely-forked repo    · low\nAffiliation "@stripe" unverifiable        · medium` },
    },
    judge: {
      subtitle: "LLM Judge · verdict + reasoning",
      summary: "Cross-references every raw signal, ranks by exploitability, attaches short reasoning per finding.",
      tag: "JUDGE",
      input: { label: "Fan-in", body: "14 CVEs + 2 secrets + 3 supply + 3 OSINT\n= 22 raw signals" },
      output: { label: "Ranked", body: `confirmed  · CRITICAL · Stripe live key in scripts/seed.ts\nconfirmed  · HIGH     · CVE-2024-21538 (cross-spawn)\nlikely     · HIGH     · typosquat: reqeusts@2.4.0` },
    },
    pdf: {
      subtitle: "Board-ready audit artifact",
      summary: "Severity-graded index, agent attribution, judge reasoning per finding, CVE table, OSINT notes.",
      tag: "ARTIFACT",
      input: { label: "Compose", body: "cover · exec summary · summary cards\nCVE table · supply rationale · OSINT notes" },
      output: { label: "File", body: "sable-acme-payments-svc-a1c9f2b.pdf\n· 12 pages · 218 KB" },
    },
  };

  const [active, setActive] = useState<string>("vulnera");
  const a = details[active];
  const activeNode = nodes.find((n) => n.id === active)!;

  const posOf = (id: string) => nodes.find((n) => n.id === id)!;
  const kindStyle = (n: NodeDef, isActive: boolean) => {
    const base = "rounded-xl border transition-all duration-200 backdrop-blur-sm";
    if (isActive) return `${base} bg-foreground text-background shadow-[0_8px_30px_-8px_rgba(0,0,0,0.5)] scale-[1.04]`;
    if (n.kind === "source") return `${base} bg-surface-2/60 hairline text-foreground/85 hover:text-foreground`;
    if (n.kind === "artifact") return `${base} bg-primary/10 border-primary/30 text-foreground/90 hover:text-foreground`;
    if (n.kind === "judge") return `${base} bg-accent/10 border-accent/30 text-foreground/90 hover:text-foreground`;
    return `${base} glass hairline text-foreground/80 hover:text-foreground`;
  };

  return (
    <div className="relative mt-16 mx-auto max-w-5xl">
      <div className="rounded-2xl glass hairline border overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 h-9 border-b hairline bg-surface-2/40">
          <span className="h-2 w-2 rounded-full bg-red-400/60" />
          <span className="h-2 w-2 rounded-full bg-yellow-400/60" />
          <span className="h-2 w-2 rounded-full bg-primary/70" />
          <span className="ml-3 text-[10.5px] text-muted-foreground font-mono">sable · pipeline.diagram</span>
          <span className="ml-auto text-[10.5px] text-muted-foreground">click a node</span>
        </div>
        <div className="grid md:grid-cols-[1fr_320px] min-h-[420px]">
          <div className="relative p-6 bg-[radial-gradient(circle_at_1px_1px,oklch(1_0_0_/_0.05)_1px,transparent_0)] [background-size:22px_22px]">
            <div className="relative h-[360px]">
              {/* Bezier connectors */}
              <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <marker id="dot" viewBox="0 0 4 4" refX="2" refY="2" markerWidth="4" markerHeight="4">
                    <circle cx="2" cy="2" r="1.6" fill="currentColor" />
                  </marker>
                </defs>
                {edges.map(([from, to], i) => {
                  const na = posOf(from);
                  const nb = posOf(to);
                  const isActive = active === from || active === to;
                  const mx = (na.x + nb.x) / 2;
                  const path = `M ${na.x} ${na.y} C ${mx} ${na.y}, ${mx} ${nb.y}, ${nb.x} ${nb.y}`;
                  return (
                    <g key={i} className={isActive ? "text-foreground" : "text-muted-foreground/30"}>
                      <path d={path} fill="none" stroke="currentColor" strokeWidth={isActive ? 0.35 : 0.2} strokeLinecap="round" />
                      {isActive && (
                        <path d={path} fill="none" stroke="currentColor" strokeWidth={0.45} strokeLinecap="round" strokeDasharray="0.6 1.2">
                          <animate attributeName="stroke-dashoffset" from="0" to="-6" dur="1.4s" repeatCount="indefinite" />
                        </path>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {nodes.map((n) => {
                const isActive = active === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setActive(n.id)}
                    onMouseEnter={() => setActive(n.id)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 outline-none focus:ring-2 focus:ring-ring rounded-xl"
                    style={{ left: `${n.x}%`, top: `${n.y}%` }}
                    aria-label={n.label}
                  >
                    <div className={`px-3 py-2 min-w-[132px] ${kindStyle(n, isActive)}`}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: n.accent ?? (n.kind === "artifact" ? "var(--color-primary)" : n.kind === "judge" ? "var(--color-accent)" : "currentColor") }}
                        />
                        <span className="text-[11.5px] font-medium tracking-tight whitespace-nowrap">{n.label}</span>
                      </div>
                      <div className={`mt-0.5 text-[9.5px] uppercase tracking-[0.16em] ${isActive ? "opacity-70" : "opacity-40"}`}>
                        {n.kind}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="border-l hairline p-5 bg-surface-2/30 text-left overflow-y-auto max-h-[480px]">
            <div className="text-[9.5px] uppercase tracking-[0.2em] text-primary/80 font-medium">{a.tag}</div>
            <div className="mt-1.5 text-[16px] font-medium tracking-tight">{activeNode.label}</div>
            <div className="text-[11.5px] text-muted-foreground">{a.subtitle}</div>
            <p className="mt-3 text-[12px] leading-[1.55] text-foreground/80">{a.summary}</p>

            <div className="mt-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-1 w-1 rounded-full bg-accent" />
                <span className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">{a.input.label}</span>
              </div>
              <pre className="text-[10.5px] leading-[1.55] font-mono text-foreground/75 bg-background/60 rounded-md hairline border p-2.5 whitespace-pre-wrap break-words">
{a.input.body}
              </pre>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-1 w-1 rounded-full bg-primary" />
                <span className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">{a.output.label}</span>
              </div>
              <pre className="text-[10.5px] leading-[1.55] font-mono text-foreground/85 bg-background/60 rounded-md hairline border p-2.5 whitespace-pre-wrap break-words">
{a.output.body}
              </pre>
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
