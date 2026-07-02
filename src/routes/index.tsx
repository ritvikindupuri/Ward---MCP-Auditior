import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sable — Supply-chain risk intelligence for GitHub" },
      { name: "description", content: "Sable scans your GitHub repositories with a multi-agent system: dependency CVEs, leaked secrets, supply-chain risk, and maintainer OSINT — every finding judged by an LLM and shipped as a downloadable PDF." },
      { property: "og:title", content: "Sable — Supply-chain risk intelligence for GitHub" },
      { property: "og:description", content: "Multi-agent GitHub security scanning with LLM-judged findings and enterprise-grade PDF reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

/** Sable mark — two interlocking capsules; the front one is severed to signal a broken supply link. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="sableg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* back link */}
      <rect x="4" y="10" width="16" height="12" rx="6" stroke="url(#sableg)" strokeWidth="1.75" />
      {/* front link — severed */}
      <path
        d="M22 10 h4 a6 6 0 0 1 6 6 v0 a6 6 0 0 1 -6 6 h-4"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" fill="none"
      />
      <path d="M22 10 v12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.35" />
      {/* fracture dot */}
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
      <Agents />
      <HowItWorks />
      <Report />
      <Footer />
    </div>
  );
}

function Nav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b hairline">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Mark size={22} />
          <span className="text-[15px] tracking-tight font-medium">Sable</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-[13px] text-muted-foreground">
          <a href="#agents" className="hover:text-foreground transition">Agents</a>
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#report" className="hover:text-foreground transition">Report</a>
        </nav>
        {signedIn ? (
          <Link to="/app" className="text-[13px] px-3.5 h-8 flex items-center rounded-full bg-foreground text-background hover:opacity-90 transition">
            Open console →
          </Link>
        ) : (
          <Link to="/sign-in" className="text-[13px] px-3.5 h-8 flex items-center rounded-full glass hairline border hover:bg-surface-2 transition">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-24 pb-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[720px] aurora opacity-40 animate-drift" />
        <div className="absolute inset-0 grain opacity-[0.35]" />
      </div>
      <div className="mx-auto max-w-5xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass hairline border px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Multi-agent · LLM-judged · Real CVEs
        </div>
        <h1 className="mt-8 text-[64px] md:text-[92px] leading-[0.95] tracking-[-0.045em] font-semibold text-balance">
          The supply chain
          <br />
          <span className="font-serif italic font-normal text-muted-foreground">has a weak link.</span>
        </h1>
        <p className="mt-8 mx-auto max-w-[620px] text-[17px] leading-[1.55] text-muted-foreground text-balance">
          Sable connects to your GitHub, dispatches four specialist agents across every repo,
          and delivers a board-ready PDF of every CVE, leaked secret, typosquat, and untrusted
          maintainer signal — with an LLM judge's reasoning behind every finding.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link to="/sign-up" className="h-12 px-6 rounded-full bg-foreground text-background text-[14px] font-medium flex items-center hover:opacity-90 transition">
            Scan your first repo
          </Link>
          <a href="#agents" className="h-12 px-5 rounded-full glass hairline border text-[14px] font-medium flex items-center hover:bg-surface-2 transition">
            See the agents
          </a>
        </div>

        <ReportPreview />
      </div>
    </section>
  );
}

function ReportPreview() {
  return (
    <div className="relative mt-20 mx-auto max-w-4xl">
      <div className="rounded-2xl glass hairline border overflow-hidden shadow-2xl">
        <div className="flex items-center gap-1.5 px-4 h-9 border-b hairline bg-surface-2/40">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-[11px] text-muted-foreground font-mono">sable-acme-payments-a1c9f2b.pdf</span>
        </div>
        <div className="grid grid-cols-[220px_1fr] min-h-[420px]">
          <aside className="border-r hairline p-5 text-[12px] space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-2">Scan</div>
              <div className="font-mono text-[11px] break-all">acme/payments-svc</div>
              <div className="text-muted-foreground text-[11px] mt-1">main · 342 deps</div>
            </div>
            <div className="pt-4 border-t hairline space-y-1.5">
              {[
                ["Dependency CVEs", "OSV.dev"],
                ["Committed secrets", "regex + entropy"],
                ["Supply-chain risk", "LLM judge"],
                ["Maintainer OSINT", "LLM judge"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-foreground text-[12px]">{k}</div>
                  <div className="text-muted-foreground text-[10.5px]">{v}</div>
                </div>
              ))}
            </div>
          </aside>
          <div className="p-6">
            <div className="grid grid-cols-4 gap-2 mb-6">
              {[
                ["CRITICAL", "3", "text-red-400"],
                ["HIGH", "11", "text-orange-400"],
                ["MEDIUM", "24", "text-yellow-500"],
                ["LOW", "38", "text-blue-400"],
              ].map(([l, v, c]) => (
                <div key={l} className="rounded-lg hairline border p-3">
                  <div className={`text-[22px] font-semibold ${c}`}>{v}</div>
                  <div className="text-[9px] tracking-[0.18em] text-muted-foreground mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { s: "critical", a: "SECRETS", t: "AWS Access Key ID in .env.example", c: "text-red-400 bg-red-500/10" },
                { s: "critical", a: "DEPS", t: "CVE-2024-21538 in cross-spawn@7.0.3", c: "text-red-400 bg-red-500/10" },
                { s: "high", a: "SUPPLY", t: "solo_maintainer: npm:node-ipc@11.1.0", c: "text-orange-400 bg-orange-500/10" },
                { s: "medium", a: "OSINT", t: "Owner account created 14 days before push", c: "text-yellow-500 bg-yellow-500/10" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b hairline last:border-0">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold tracking-wider ${f.c}`}>{f.s.toUpperCase()}</span>
                  <span className="text-[10px] font-mono text-muted-foreground w-16">[{f.a}]</span>
                  <span className="text-[12.5px] flex-1 truncate">{f.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 text-center">
        Preview of the exported PDF layout. Numbers vary per repository.
      </p>
    </div>
  );
}

function Agents() {
  const agents = [
    { n: "01", name: "Vulnera", role: "Dependency CVEs", body: "Parses package.json, requirements.txt, go.mod, Cargo.lock — then batch-queries OSV.dev for every known advisory that applies to the resolved version." },
    { n: "02", name: "Sift", role: "Committed secrets", body: "Walks the default branch and matches against high-confidence signatures — AWS keys, GitHub tokens, Stripe live keys, private key blocks, and more." },
    { n: "03", name: "Lineage", role: "Supply-chain risk", body: "LLM judge inspects the dependency graph for typosquats, abandoned packages, single-maintainer choke points, and packages with a history of malicious install scripts." },
    { n: "04", name: "Signal", role: "Maintainer OSINT", body: "Correlates repo metadata with owner account age, follower graph, license posture, and claimed affiliations — flags mismatches that precede supply-chain attacks." },
  ];
  return (
    <section id="agents" className="relative py-32 border-t hairline">
      <div className="mx-auto max-w-5xl px-6">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4">The agents</div>
          <h2 className="text-[44px] md:text-[56px] leading-[1] tracking-[-0.035em] font-semibold text-balance">
            Four specialists.
            <br />
            <span className="font-serif italic font-normal text-muted-foreground">One verdict.</span>
          </h2>
        </div>
        <div className="mt-16 grid md:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden hairline border">
          {agents.map((a) => (
            <div key={a.n} className="bg-background p-8">
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-[11px] font-mono text-muted-foreground">{a.n}</span>
                <span className="text-[20px] font-semibold tracking-tight">{a.name}</span>
                <span className="text-[11px] text-muted-foreground ml-auto uppercase tracking-[0.14em]">{a.role}</span>
              </div>
              <p className="text-[14px] leading-[1.6] text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Connect", body: "Paste a GitHub fine-grained PAT with read-only repo scope. Nothing else." },
    { n: "02", title: "Dispatch", body: "Pick a repo. Sable runs all four agents in parallel against your default branch." },
    { n: "03", title: "Judge", body: "An LLM judge reviews every raw signal and attaches its reasoning to every finding." },
    { n: "04", title: "Ship", body: "Download a professionally-formatted PDF. Hand it to your CISO, auditor, or board." },
  ];
  return (
    <section id="how" className="relative py-32 border-t hairline">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4">How it works</div>
        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="text-[11px] font-mono text-muted-foreground mb-3">{s.n}</div>
              <div className="text-[18px] font-medium tracking-tight mb-2">{s.title}</div>
              <p className="text-[13.5px] leading-[1.55] text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Report() {
  return (
    <section id="report" className="relative py-32 border-t hairline">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4">The artifact</div>
        <h2 className="text-[44px] md:text-[56px] leading-[1] tracking-[-0.035em] font-semibold text-balance max-w-3xl mx-auto">
          A report you'd
          <br />
          <span className="font-serif italic font-normal text-muted-foreground">actually send.</span>
        </h2>
        <p className="mt-6 mx-auto max-w-xl text-[15px] text-muted-foreground leading-[1.6]">
          Severity-graded, agent-attributed, judge-annotated. Every scan produces a
          downloadable PDF built for the people who don't live in your terminal.
        </p>
        <div className="mt-12">
          <Link to="/sign-up" className="h-12 px-6 rounded-full bg-foreground text-background text-[14px] font-medium inline-flex items-center hover:opacity-90 transition">
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t hairline py-10">
      <div className="mx-auto max-w-6xl px-6 flex flex-wrap items-center justify-between gap-4 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Mark size={16} />
          <span>Sable · {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#agents" className="hover:text-foreground transition">Agents</a>
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <Link to="/sign-in" className="hover:text-foreground transition">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
