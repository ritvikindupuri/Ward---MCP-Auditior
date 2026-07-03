import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mark } from "./index";
import {
  disconnectGithub,
  generateReport,
  getGithubStatus,
  getPolicy,
  getScan,
  listDueRescans,
  listRepos,
  listScans,
  listWatchedRepos,
  markWatchedScanned,
  saveGithubPat,
  startScan,
  unwatchRepo,
  updatePolicy,
  watchRepo,
} from "@/lib/ward.functions";

type View = "scans" | "policy" | "watchlist";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Console — Ward" },
      { name: "description", content: "Run MCP & AI-agent supply-chain scans across your GitHub repositories." },
    ],
  }),
  component: Console,
});

function Console() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [view, setView] = useState<View>("scans");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate({ to: "/sign-in" }); return; }
      setEmail(data.session.user.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/sign-in" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!ready) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background text-foreground grid grid-cols-[240px_1fr]">
      <Sidebar email={email} view={view} setView={setView} />
      {view === "scans" && <Main />}
      {view === "policy" && <PolicyView />}
      {view === "watchlist" && <WatchlistView />}
    </div>
  );
}

function Sidebar({ email, view, setView }: { email: string | null; view: View; setView: (v: View) => void }) {
  const navigate = useNavigate();
  const items: Array<{ k: View; label: string }> = [
    { k: "scans", label: "Scans" },
    { k: "policy", label: "Policy" },
    { k: "watchlist", label: "Watchlist" },
  ];
  return (
    <aside className="border-r hairline h-screen sticky top-0 p-5 flex flex-col">
      <Link to="/" className="flex items-center gap-2.5 mb-8">
        <Mark size={22} />
        <span className="text-[15px] font-medium tracking-tight">Ward</span>
      </Link>
      <nav className="space-y-1 text-[13px]">
        {items.map((it) => (
          <button
            key={it.k} onClick={() => setView(it.k)}
            className={`w-full text-left px-2.5 py-1.5 rounded-md transition ${view === it.k ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {it.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t hairline text-[12px]">
        <div className="text-muted-foreground truncate mb-2" title={email ?? ""}>{email}</div>
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
          className="text-[12px] text-muted-foreground hover:text-foreground transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function Main() {
  const qc = useQueryClient();
  const ghStatus = useQuery({ queryKey: ["gh-status"], queryFn: () => getGithubStatus() });
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => listScans(), refetchInterval: 3500 });
  const [openScanId, setOpenScanId] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const connected = !!ghStatus.data?.github_login;

  // Auto-rescan runner: every 60s, check for watched repos that are due.
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const due = await listDueRescans();
        for (const w of due) {
          if (cancelled) return;
          const res = await startScan({ data: { repo_full_name: w.repo_full_name } });
          await markWatchedScanned({ data: { id: w.id, scan_id: res.scan_id } });
          qc.invalidateQueries({ queryKey: ["scans"] });
          qc.invalidateQueries({ queryKey: ["watched"] });
        }
      } catch { /* silent */ }
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [connected, qc]);


  return (
    <main className="p-8 max-w-5xl w-full mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[26px] tracking-tight font-semibold">Scans</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {connected ? (
              <>Connected as <span className="text-foreground font-mono">{ghStatus.data?.github_login}</span></>
            ) : (
              "Connect GitHub to begin."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <button
                onClick={() => setShowPicker(true)}
                className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition"
              >
                New scan
              </button>
              <button
                onClick={async () => { await disconnectGithub(); qc.invalidateQueries({ queryKey: ["gh-status"] }); }}
                className="h-9 px-3 rounded-full glass hairline border text-[12px] text-muted-foreground hover:text-foreground transition"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowConnect(true)}
              className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition"
            >
              Connect GitHub
            </button>
          )}
        </div>
      </div>

      {!connected && <ConnectPanel onOpen={() => setShowConnect(true)} />}

      {connected && (
        <>
          <LiveScansPanel
            scans={(scans.data ?? []).filter((s) => s.status === "running" || s.status === "queued")}
            onOpen={setOpenScanId}
          />

          <div className="rounded-2xl hairline border overflow-hidden">
            {(scans.data ?? []).length === 0 ? (
              <div className="p-12 text-center text-[13px] text-muted-foreground">
                No scans yet. Click <span className="text-foreground">New scan</span> to pick a repository.
              </div>
            ) : (
              <ul className="divide-y hairline">
                {scans.data!.map((s) => <ScanRow key={s.id} scan={s} onOpen={() => setOpenScanId(s.id)} />)}
              </ul>
            )}
          </div>
        </>
      )}


      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} onSaved={() => { setShowConnect(false); qc.invalidateQueries({ queryKey: ["gh-status"] }); }} />}
      {showPicker && <RepoPicker onClose={() => setShowPicker(false)} onScanned={() => { setShowPicker(false); qc.invalidateQueries({ queryKey: ["scans"] }); }} />}
      {openScanId && <ScanDetail id={openScanId} onClose={() => setOpenScanId(null)} />}
    </main>
  );
}

function ConnectPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-2xl hairline border p-8">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Step 1</div>
      <h2 className="text-[22px] font-semibold tracking-tight mb-2">Connect your GitHub account</h2>
      <p className="text-[13.5px] text-muted-foreground max-w-lg leading-[1.6]">
        Ward uses a GitHub fine-grained personal access token with read-only repository access.
        Nothing is written back to your account.
      </p>
      <button onClick={onOpen} className="mt-6 h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition">
        Paste token →
      </button>
    </div>
  );
}

function ConnectModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [pat, setPat] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (token: string) => saveGithubPat({ data: { pat: token } }),
    onSuccess: onSaved,
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Modal onClose={onClose} title="Connect GitHub">
      <ol className="text-[13px] text-muted-foreground space-y-1.5 mb-5 list-decimal pl-5">
        <li>Open <a className="text-foreground underline underline-offset-4" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">github.com/settings/tokens</a></li>
        <li>Create a <span className="text-foreground">fine-grained token</span> — All repositories or select ones</li>
        <li>Under Repository permissions, grant <span className="text-foreground font-mono">Contents: Read-only</span> and <span className="text-foreground font-mono">Metadata: Read-only</span></li>
        <li>Paste the token below</li>
      </ol>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">Token</span>
        <input
          type="password" placeholder="github_pat_… or ghp_…" value={pat} onChange={(e) => setPat(e.target.value)}
          className="w-full h-11 rounded-xl glass px-4 text-[13px] font-mono outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {err && <p className="text-[12.5px] text-destructive mt-3">{err}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 px-4 rounded-full glass hairline border text-[13px] text-muted-foreground hover:text-foreground transition">Cancel</button>
        <button
          onClick={() => { setErr(null); save.mutate(pat); }}
          disabled={save.isPending || pat.length < 20}
          className="h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {save.isPending ? "Validating…" : "Connect"}
        </button>
      </div>
    </Modal>
  );
}

function RepoPicker({ onClose, onScanned }: { onClose: () => void; onScanned: () => void }) {
  const repos = useQuery({ queryKey: ["repos"], queryFn: () => listRepos() });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const list = repos.data ?? [];
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter((r) => r.full_name.toLowerCase().includes(s));
  }, [repos.data, q]);

  async function scan(full_name: string) {
    setBusy(full_name); setErr(null);
    try { await startScan({ data: { repo_full_name: full_name } }); onScanned(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); setBusy(null); }
  }

  return (
    <Modal onClose={onClose} title="Pick a repository" wide>
      <input
        placeholder="Filter repositories…" value={q} onChange={(e) => setQ(e.target.value)}
        className="w-full h-10 rounded-lg glass px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring mb-3"
      />
      {repos.isLoading && <p className="text-[13px] text-muted-foreground py-8 text-center">Loading repositories…</p>}
      {repos.error && <p className="text-[13px] text-destructive">{(repos.error as Error).message}</p>}
      <div className="max-h-[420px] overflow-y-auto divide-y hairline">
        {filtered.map((r) => (
          <div key={r.full_name} className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-mono truncate">{r.full_name}</div>
              <div className="text-[11.5px] text-muted-foreground truncate">
                {r.private ? "private · " : "public · "}{r.language ?? "—"} · ★ {r.stars}
              </div>
            </div>
            <button
              disabled={!!busy} onClick={() => scan(r.full_name)}
              className="h-8 px-3 rounded-full bg-foreground text-background text-[12px] font-medium disabled:opacity-40 hover:opacity-90 transition"
            >
              {busy === r.full_name ? "Scanning…" : "Scan"}
            </button>
          </div>
        ))}
      </div>
      {err && <p className="text-[12.5px] text-destructive mt-3">{err}</p>}
    </Modal>
  );
}

function ScanRow({ scan, onOpen }: { scan: NonNullable<Awaited<ReturnType<typeof listScans>>>[number]; onOpen: () => void }) {
  const s = (scan.summary ?? {}) as Record<string, number>;
  const total = (s.critical ?? 0) + (s.high ?? 0) + (s.medium ?? 0) + (s.low ?? 0);
  return (
    <li className="p-4 flex items-center gap-4 hover:bg-surface-2/40 transition cursor-pointer" onClick={onOpen}>
      <StatusDot status={scan.status} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-mono truncate">{scan.repo_full_name}</div>
        <div className="text-[11.5px] text-muted-foreground">
          {scan.status === "running" ? "Running agents…" :
            scan.status === "error" ? scan.error ?? "Errored" :
            `${total} finding${total === 1 ? "" : "s"} · ${new Date(scan.completed_at ?? scan.started_at).toLocaleString()}`}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        {(["critical", "high", "medium", "low"] as const).map((sev) => (
          <SevPill key={sev} sev={sev} n={s[sev] ?? 0} />
        ))}
      </div>
      <span className="text-muted-foreground">›</span>
    </li>
  );
}

function SevPill({ sev, n }: { sev: string; n: number }) {
  const c = sev === "critical" ? "text-red-400 bg-red-500/10"
    : sev === "high" ? "text-orange-400 bg-orange-500/10"
    : sev === "medium" ? "text-yellow-500 bg-yellow-500/10"
    : "text-blue-400 bg-blue-500/10";
  return <span className={`px-1.5 py-0.5 rounded font-mono ${c} ${n === 0 ? "opacity-30" : ""}`}>{n}</span>;
}

function StatusDot({ status }: { status: string }) {
  const c = status === "complete" ? "bg-primary" : status === "running" ? "bg-yellow-400 animate-pulse" : status === "error" ? "bg-red-400" : "bg-muted-foreground";
  return <span className={`h-2 w-2 rounded-full ${c}`} />;
}

type ScanListItem = Awaited<ReturnType<typeof listScans>>[number];

function LiveScansPanel({ scans, onOpen }: { scans: ScanListItem[]; onOpen: (id: string) => void }) {
  if (scans.length === 0) return null;
  return (
    <div className="mb-6 rounded-2xl hairline border overflow-hidden bg-gradient-to-br from-primary/[0.04] to-accent/[0.04]">
      <div className="flex items-center gap-2 px-4 h-10 border-b hairline">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-primary/60 animate-ping" />
          <span className="relative h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-[10.5px] uppercase tracking-[0.2em] text-primary/90 font-medium">Live · {scans.length} running</span>
        <span className="ml-auto text-[10.5px] text-muted-foreground font-mono">agents dispatched in parallel</span>
      </div>
      <ul className="divide-y hairline">
        {scans.map((s) => <LiveScanRow key={s.id} scan={s} onOpen={() => onOpen(s.id)} />)}
      </ul>
    </div>
  );
}

function LiveScanRow({ scan, onOpen }: { scan: ScanListItem; onOpen: () => void }) {
  const progress = (scan.progress ?? {}) as Record<string, string>;
  const agents: Array<{ k: string; label: string; hint: string }> = [
    { k: "mcp",              label: "MCP",       hint: "servers" },
    { k: "tool-poison",      label: "Poison",    hint: "tool defs" },
    { k: "prompt-injection", label: "Prompt-Inj",hint: "prompts" },
    { k: "agent-config",     label: "Config",    hint: "frameworks" },
    { k: "ai-deps",          label: "AI-CVEs",   hint: "OSV.dev" },
  ];
  const done = agents.filter((a) => progress[a.k] === "done").length;
  const pct = Math.round((done / agents.length) * 100);
  return (
    <li className="p-4 hover:bg-surface-2/40 transition cursor-pointer" onClick={onOpen}>
      <div className="flex items-center gap-3 mb-3">
        <StatusDot status={scan.status} />
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-mono truncate">{scan.repo_full_name}</div>
          <div className="text-[11px] text-muted-foreground">
            Started {new Date(scan.started_at).toLocaleTimeString()} · {done} / {agents.length} agents complete
          </div>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">{pct}%</span>
      </div>
      <div className="relative h-1 rounded-full bg-surface-2 overflow-hidden mb-3">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {agents.map((a) => {
          const st = progress[a.k] ?? "queued";
          const dotC = st === "done" ? "bg-primary" : st === "running" ? "bg-yellow-400 animate-pulse" : "bg-muted-foreground/40";
          const border = st === "running" ? "border-yellow-400/40" : st === "done" ? "border-primary/40" : "hairline";
          return (
            <div key={a.k} className={`rounded-lg border ${border} bg-background/40 px-3 py-2`}>
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${dotC}`} />
                <span className="text-[11.5px] font-medium">{a.label}</span>
                <span className="ml-auto text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">{st}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{a.hint}</div>
            </div>
          );
        })}
      </div>
    </li>
  );
}


function ScanDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["scan", id],
    queryFn: () => getScan({ data: { id } }),
    refetchInterval: (query) => (query.state.data?.scan.status === "running" ? 2500 : false),
  });
  const [downloading, setDownloading] = useState(false);
  const [dlErr, setDlErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  async function download() {
    setDownloading(true); setDlErr(null);
    try {
      const res = await generateReport({ data: { id } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDlErr(e instanceof Error ? e.message : "Failed");
    } finally { setDownloading(false); }
  }

  const scan = q.data?.scan;
  const findings = q.data?.findings ?? [];
  const visible = filter === "all" ? findings : findings.filter((f) => f.agent === filter);

  return (
    <Modal onClose={onClose} wide title={scan?.repo_full_name ?? "Scan"}>
      {!scan ? (
        <p className="text-[13px] text-muted-foreground py-8 text-center">Loading…</p>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <StatusDot status={scan.status} />
                <span className="uppercase tracking-[0.14em] text-[10.5px]">{scan.status}</span>
                <span>·</span>
                <a href={scan.repo_url} target="_blank" rel="noreferrer" className="hover:text-foreground underline underline-offset-2">{scan.repo_url}</a>
              </div>
            </div>
            <button
              onClick={download} disabled={downloading || scan.status !== "complete"}
              className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition disabled:opacity-40"
            >
              {downloading ? "Building PDF…" : "Download PDF report"}
            </button>
          </div>

          {scan.status === "running" && (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-6">
              {(["mcp", "tool-poison", "prompt-injection", "agent-config", "ai-deps"] as const).map((k) => {
                const st = (scan.progress as Record<string, string>)?.[k] ?? "queued";
                return (
                  <div key={k} className="rounded-lg hairline border p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{k}</div>
                    <div className="text-[13px] mt-1 flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${st === "done" ? "bg-emerald-400" : st === "running" ? "bg-yellow-400 animate-pulse" : "bg-muted-foreground/40"}`} />
                      {st}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <SummaryCards summary={(scan.summary ?? {}) as Record<string, number>} />

          <div className="flex flex-wrap items-center gap-1 mb-3 text-[12px]">
            {(["all", "mcp", "tool-poison", "prompt-injection", "agent-config", "ai-deps"] as const).map((k) => {
              const n = k === "all" ? findings.length : findings.filter((f) => f.agent === k).length;
              return (
                <button key={k} onClick={() => setFilter(k)}
                  className={`h-7 px-3 rounded-full transition ${filter === k ? "bg-foreground text-background" : "glass hairline border text-muted-foreground hover:text-foreground"}`}>
                  {k} · {n}
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-8 text-center">
              {scan.status === "complete" ? "No findings for this filter." : "Agents still working…"}
            </p>
          ) : (
            <ul className="divide-y hairline">
              {visible.map((f) => <FindingRow key={f.id} f={f} />)}
            </ul>
          )}

          {dlErr && <p className="text-[12px] text-destructive mt-3">{dlErr}</p>}
        </div>
      )}
    </Modal>
  );
}

function SummaryCards({ summary }: { summary: Record<string, number> }) {
  const cards: Array<[string, number, string]> = [
    ["Critical", summary.critical ?? 0, "text-red-400"],
    ["High", summary.high ?? 0, "text-orange-400"],
    ["Medium", summary.medium ?? 0, "text-yellow-500"],
    ["Low", summary.low ?? 0, "text-blue-400"],
  ];
  return (
    <div className="grid grid-cols-4 gap-2 mb-6">
      {cards.map(([l, v, c]) => (
        <div key={l} className="rounded-lg hairline border p-3">
          <div className={`text-[24px] font-semibold ${c}`}>{v}</div>
          <div className="text-[9.5px] tracking-[0.18em] text-muted-foreground mt-0.5">{l.toUpperCase()}</div>
        </div>
      ))}
    </div>
  );
}

function FindingRow({ f }: { f: Awaited<ReturnType<typeof getScan>>["findings"][number] }) {
  const [open, setOpen] = useState(false);
  const c = f.severity === "critical" ? "text-red-400 bg-red-500/10"
    : f.severity === "high" ? "text-orange-400 bg-orange-500/10"
    : f.severity === "medium" ? "text-yellow-500 bg-yellow-500/10"
    : f.severity === "low" ? "text-blue-400 bg-blue-500/10"
    : "text-muted-foreground bg-muted/30";
  const owasp = (f as { owasp_llm?: string | null }).owasp_llm;
  const nist = (f as { nist_ai_rmf?: string | null }).nist_ai_rmf;
  const pv = (f as { policy_violation?: string | null }).policy_violation;
  return (
    <li className="py-3">
      <div className="flex items-start gap-3 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-semibold tracking-wider ${c} mt-0.5`}>{f.severity.toUpperCase()}</span>
        <span className="text-[10.5px] font-mono text-muted-foreground w-16 mt-1">[{f.agent.toUpperCase()}]</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] truncate">{f.title}</div>
          {f.description && <div className="text-[11.5px] text-muted-foreground truncate">{f.description}</div>}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {owasp && <span className="text-[9.5px] px-1.5 py-0.5 rounded font-mono bg-purple-500/10 text-purple-300">OWASP {owasp}</span>}
            {nist && <span className="text-[9.5px] px-1.5 py-0.5 rounded font-mono bg-cyan-500/10 text-cyan-300">NIST {nist}</span>}
            {pv && <span className="text-[9.5px] px-1.5 py-0.5 rounded font-mono bg-red-500/15 text-red-300">POLICY: {pv}</span>}
          </div>
        </div>
        <span className="text-muted-foreground text-[11px]">{open ? "▾" : "›"}</span>
      </div>
      {open && (
        <div className="mt-3 ml-24 space-y-2 text-[12px]">
          {f.judge_reasoning && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-0.5">Judge · {f.judge_verdict ?? "—"}</div>
              <div className="text-[12.5px]">{f.judge_reasoning}</div>
            </div>
          )}
          {f.evidence && Object.keys(f.evidence as object).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-0.5">Evidence</div>
              <pre className="text-[11px] font-mono bg-surface-2 rounded-md p-3 overflow-x-auto">
                {JSON.stringify(f.evidence, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ---------- Policy View ----------

function PolicyView() {
  const qc = useQueryClient();
  const policy = useQuery({ queryKey: ["policy"], queryFn: () => getPolicy() });
  const [allowed, setAllowed] = useState("");
  const [denied, setDenied] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (policy.data) {
      setAllowed(((policy.data.allowed_servers as string[]) ?? []).join("\n"));
      setDenied(((policy.data.denied_servers as string[]) ?? []).join("\n"));
    }
  }, [policy.data]);

  type PolicyPatch = {
    allowed_servers?: string[];
    denied_servers?: string[];
    block_stdio_npx?: boolean;
    block_http_transport?: boolean;
    require_pinned_versions?: boolean;
    block_dangerous_code_exec?: boolean;
    min_package_age_days?: number;
  };
  const save = useMutation({
    mutationFn: (patch: PolicyPatch) => updatePolicy({ data: patch }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["policy"] }); setSaved(true); setTimeout(() => setSaved(false), 1600); },
  });

  const p = policy.data;
  const toggle = (key: string, val: boolean) => save.mutate({ [key]: val });

  return (
    <main className="p-8 max-w-4xl w-full mx-auto">
      <div className="mb-8">
        <h1 className="text-[26px] tracking-tight font-semibold">MCP policy</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Declarative rules Ward enforces on every scan. Findings that trigger a policy rule are flagged as policy violations in reports.</p>
      </div>

      {policy.isLoading ? (
        <p className="text-[13px] text-muted-foreground">Loading policy…</p>
      ) : !p ? null : (
        <div className="space-y-6">
          <div className="rounded-2xl hairline border p-6">
            <h2 className="text-[15px] font-semibold mb-4">Rule toggles</h2>
            <div className="space-y-3">
              <PolicyToggle label="Block stdio MCP servers launched via npx/uvx/bunx" hint="RCE-on-connect vector — every workstation fetches + runs the current upstream release" checked={p.block_stdio_npx} onChange={(v) => toggle("block_stdio_npx", v)} />
              <PolicyToggle label="Require TLS for URL MCP servers" hint="Block plaintext http:// transports" checked={p.block_http_transport} onChange={(v) => toggle("block_http_transport", v)} />
              <PolicyToggle label="Require pinned package versions" hint="Flag ^ / ~ / * ranges on AI/MCP dependencies" checked={p.require_pinned_versions} onChange={(v) => toggle("require_pinned_versions", v)} />
              <PolicyToggle label="Block dangerously_allow_code_execution" hint="Any agent framework config with unsandboxed exec" checked={p.block_dangerous_code_exec} onChange={(v) => toggle("block_dangerous_code_exec", v)} />
            </div>
            <div className="mt-5 pt-5 border-t hairline">
              <label className="block text-[12px] text-muted-foreground mb-1.5">Minimum package age (days) — flag MCP packages younger than this</label>
              <input
                type="number" min={0} max={365} value={p.min_package_age_days}
                onChange={(e) => toggle("min_package_age_days", Number(e.target.value) as never)}
                className="w-32 h-9 rounded-lg glass px-3 text-[13px] font-mono outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl hairline border p-6">
              <h2 className="text-[15px] font-semibold mb-1">Allow-list</h2>
              <p className="text-[11.5px] text-muted-foreground mb-3">One MCP server identifier (package name or URL) per line. If non-empty, servers not on this list are flagged.</p>
              <textarea
                value={allowed} onChange={(e) => setAllowed(e.target.value)}
                onBlur={() => save.mutate({ allowed_servers: allowed.split("\n").map((l) => l.trim()).filter(Boolean) })}
                rows={10}
                placeholder={"@modelcontextprotocol/server-github\n@modelcontextprotocol/server-filesystem"}
                className="w-full rounded-lg glass p-3 text-[12px] font-mono outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="rounded-2xl hairline border p-6">
              <h2 className="text-[15px] font-semibold mb-1">Deny-list</h2>
              <p className="text-[11.5px] text-muted-foreground mb-3">Servers matching these identifiers are flagged as critical on every scan.</p>
              <textarea
                value={denied} onChange={(e) => setDenied(e.target.value)}
                onBlur={() => save.mutate({ denied_servers: denied.split("\n").map((l) => l.trim()).filter(Boolean) })}
                rows={10}
                placeholder={"suspicious-mcp-package\nhttp://internal-only.example"}
                className="w-full rounded-lg glass p-3 text-[12px] font-mono outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {saved && <p className="text-[12px] text-primary">Saved.</p>}
        </div>
      )}
    </main>
  );
}

function PolicyToggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
      <div>
        <div className="text-[13px]">{label}</div>
        <div className="text-[11.5px] text-muted-foreground">{hint}</div>
      </div>
    </label>
  );
}

// ---------- Watchlist View ----------

function WatchlistView() {
  const qc = useQueryClient();
  const watched = useQuery({ queryKey: ["watched"], queryFn: () => listWatchedRepos() });
  const repos = useQuery({ queryKey: ["repos"], queryFn: () => listRepos() });
  const [q, setQ] = useState("");
  const [cadence, setCadence] = useState(24);
  const [busy, setBusy] = useState<string | null>(null);

  const watchedNames = new Set((watched.data ?? []).map((w) => w.repo_full_name));
  const availableRepos = (repos.data ?? []).filter((r) => !watchedNames.has(r.full_name))
    .filter((r) => !q.trim() || r.full_name.toLowerCase().includes(q.toLowerCase()));

  async function addWatch(full_name: string, repo_url: string) {
    setBusy(full_name);
    try {
      await watchRepo({ data: { repo_full_name: full_name, repo_url, cadence_hours: cadence } });
      qc.invalidateQueries({ queryKey: ["watched"] });
    } finally { setBusy(null); }
  }

  return (
    <main className="p-8 max-w-5xl w-full mx-auto">
      <div className="mb-8">
        <h1 className="text-[26px] tracking-tight font-semibold">Watchlist</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Repositories Ward re-scans automatically on a cadence. Scans run in the background whenever the console is open.</p>
      </div>

      <div className="rounded-2xl hairline border overflow-hidden mb-8">
        <div className="px-4 h-11 border-b hairline flex items-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Currently watched · {(watched.data ?? []).length}
        </div>
        {(watched.data ?? []).length === 0 ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">Nothing on watch yet.</div>
        ) : (
          <ul className="divide-y hairline">
            {watched.data!.map((w) => (
              <li key={w.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-mono truncate">{w.repo_full_name}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Every {w.cadence_hours}h · {w.last_scanned_at ? `last scanned ${new Date(w.last_scanned_at).toLocaleString()}` : "not scanned yet"}
                  </div>
                </div>
                <button
                  onClick={async () => { await unwatchRepo({ data: { id: w.id } }); qc.invalidateQueries({ queryKey: ["watched"] }); }}
                  className="h-8 px-3 rounded-full glass hairline border text-[12px] text-muted-foreground hover:text-foreground transition"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl hairline border p-6">
        <h2 className="text-[15px] font-semibold mb-3">Add repository</h2>
        <div className="flex gap-2 mb-3">
          <input
            placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)}
            className="flex-1 h-10 rounded-lg glass px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>Every</span>
            <input
              type="number" min={1} max={720} value={cadence} onChange={(e) => setCadence(Math.max(1, Number(e.target.value)))}
              className="w-16 h-10 rounded-lg glass px-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-ring text-center"
            />
            <span>hours</span>
          </div>
        </div>
        {repos.isLoading && <p className="text-[13px] text-muted-foreground py-6 text-center">Loading repositories…</p>}
        <div className="max-h-[380px] overflow-y-auto divide-y hairline">
          {availableRepos.map((r) => (
            <div key={r.full_name} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-mono truncate">{r.full_name}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {r.private ? "private · " : "public · "}{r.language ?? "—"} · ★ {r.stars}
                </div>
              </div>
              <button
                disabled={busy === r.full_name}
                onClick={() => addWatch(r.full_name, r.html_url)}
                className="h-8 px-3 rounded-full bg-foreground text-background text-[12px] font-medium disabled:opacity-40 hover:opacity-90 transition"
              >
                {busy === r.full_name ? "Adding…" : "Watch"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title?: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[85vh] overflow-y-auto rounded-2xl bg-background hairline border p-6 shadow-2xl`}
      >
        <div className="flex items-center justify-between mb-5">
          {title && <h3 className="text-[16px] font-semibold tracking-tight truncate">{title}</h3>}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[18px] leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
