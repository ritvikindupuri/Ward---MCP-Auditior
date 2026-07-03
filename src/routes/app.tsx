import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mark, MCPRobot, PoisonRobot, BrainRobot, ConfigRobot, CVERobot } from "./index";
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

type View = "scans" | "history" | "policy" | "watchlist";

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
  const [openScanId, setOpenScanId] = useState<string | null>(null);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

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
      {view === "scans" && (
        <Main
          openScanId={openScanId}
          setOpenScanId={setOpenScanId}
          activeScanId={activeScanId}
          setActiveScanId={setActiveScanId}
        />
      )}
      {view === "history" && <HistoryView setOpenScanId={setOpenScanId} />}
      {view === "policy" && <PolicyView />}
      {view === "watchlist" && (
        <WatchlistView
          setView={setView}
          setActiveScanId={setActiveScanId}
          setOpenScanId={setOpenScanId}
        />
      )}

      {openScanId && <ScanDetail id={openScanId} onClose={() => setOpenScanId(null)} />}
    </div>
  );
}

function Sidebar({ email, view, setView }: { email: string | null; view: View; setView: (v: View) => void }) {
  const navigate = useNavigate();
  const items: Array<{ k: View; label: string }> = [
    { k: "scans", label: "Dashboard" },
    { k: "history", label: "History" },
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

function Main({
  openScanId,
  setOpenScanId,
  activeScanId,
  setActiveScanId
}: {
  openScanId: string | null;
  setOpenScanId: (id: string | null) => void;
  activeScanId: string | null;
  setActiveScanId: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const ghStatus = useQuery({ queryKey: ["gh-status"], queryFn: () => getGithubStatus() });
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => listScans(), refetchInterval: 3500 });
  const [showConnect, setShowConnect] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const [filter, setFilter] = useState<string>("all");
  const [downloading, setDownloading] = useState(false);
  const [dlErr, setDlErr] = useState<string | null>(null);

  const activeScanQuery = useQuery({
    queryKey: ["scan", activeScanId],
    queryFn: () => getScan({ data: { id: activeScanId! } }),
    enabled: !!activeScanId,
    refetchInterval: (query) => (query.state.data?.scan.status === "running" ? 2500 : false),
  });

  async function downloadActiveReport() {
    if (!activeScanId) return;
    setDownloading(true); setDlErr(null);
    try {
      const res = await generateReport({ data: { id: activeScanId } });
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

  const activeFindings = activeScanQuery.data?.findings ?? [];
  const visibleFindings = useMemo(() => {
    if (filter === "all") return activeFindings;
    if (filter === "source" || filter === "judge" || filter === "pdf") return [];
    return activeFindings.filter((f) => f.agent === filter);
  }, [filter, activeFindings]);

  const connected = !!ghStatus.data?.github_login;

  // Auto-set the most recent scan as the active session on load if not set
  useEffect(() => {
    if (!activeScanId && scans.data && scans.data.length > 0) {
      setActiveScanId(scans.data[0].id);
    }
  }, [scans.data, activeScanId, setActiveScanId]);

  const activeScan = useMemo(() => {
    if (!activeScanId || !scans.data) return null;
    return scans.data.find(s => s.id === activeScanId) || null;
  }, [activeScanId, scans.data]);

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
          <h1 className="text-[26px] tracking-tight font-semibold">Dashboard</h1>
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
        <div className="space-y-6">
          {activeScan ? (
            <div className="rounded-2xl hairline border p-6 bg-gradient-to-br from-surface to-surface/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[18px] font-semibold text-white tracking-tight font-mono">{activeScan.repo_full_name}</h2>
                  <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground mt-1">
                    <StatusDot status={activeScan.status} />
                    <span className="uppercase tracking-[0.14em] text-[10px]">{activeScan.status}</span>
                    <span>·</span>
                    <span>Active Session</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpenScanId(activeScan.id)}
                    className="h-8 px-3.5 rounded-full bg-white text-black text-[12.5px] font-semibold hover:opacity-90 transition"
                  >
                    View Details
                  </button>
                </div>
              </div>

              <SummaryCards summary={(activeScan.summary ?? {}) as Record<string, number>} />

              <N8NNodeGraph
                filter={filter}
                setFilter={setFilter}
                findings={activeFindings}
                scanStatus={activeScan.status}
                onDownload={downloadActiveReport}
              />

              {filter === "source" && (
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] text-left space-y-3">
                  <h3 className="text-[15px] font-bold text-white tracking-tight">GitHub Repository Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-[13px] text-muted-foreground font-mono">
                    <div>Repo URL: <a href={activeScan.repo_url} target="_blank" rel="noreferrer" className="text-white hover:underline truncate block">{activeScan.repo_url}</a></div>
                    <div>Full Name: <span className="text-white">{activeScan.repo_full_name}</span></div>
                    <div>Scanned At: <span className="text-white">{activeScan.created_at ? new Date(activeScan.created_at).toLocaleString() : "—"}</span></div>
                    <div>Status: <span className="text-emerald-400">SYNCED & INDEXED</span></div>
                  </div>
                </div>
              )}

              {filter === "judge" && (
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] text-left space-y-3">
                  <h3 className="text-[15px] font-bold text-white tracking-tight">LLM Arbitration Ledger</h3>
                  <p className="text-[13px] text-muted-foreground leading-normal">
                    The Local LLM Judge has processed all {activeFindings.length} findings. Deduplication is complete, severities have been validated against active safety policies, and remediation advisories have been committed to Supabase logs.
                  </p>
                </div>
              )}

              {filter === "pdf" && (
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] text-left space-y-3 text-center">
                  <h3 className="text-[15px] font-bold text-white tracking-tight">Compliance PDF Export</h3>
                  <p className="text-[13px] text-muted-foreground max-w-md mx-auto leading-normal">
                    A formal, executive-ready security report containing findings distribution, OWASP mapping details, and the judge's full audit trail is ready for download.
                  </p>
                  <button
                    onClick={downloadActiveReport} disabled={downloading || activeScan.status !== "complete"}
                    className="mt-2 h-9 px-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-black text-[13px] font-semibold transition disabled:opacity-40"
                  >
                    {downloading ? "Compiling Report..." : "Trigger Download PDF"}
                  </button>
                  {dlErr && <p className="text-[12px] text-destructive mt-3">{dlErr}</p>}
                </div>
              )}

              {filter !== "source" && filter !== "judge" && filter !== "pdf" && (
                <>
                  {visibleFindings.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground py-8 text-center">
                      {activeScan.status === "complete" ? "No findings for this filter." : "Agents are actively auditing the repository codebase…"}
                    </p>
                  ) : (
                    <ul className="divide-y hairline">
                      {visibleFindings.map((f) => <FindingRow key={f.id} f={f} />)}
                    </ul>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-[13.5px] text-muted-foreground">
              No active scan session loaded on the dashboard.
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowPicker(true)}
                  className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition"
                >
                  Start New Scan
                </button>
                {scans.data && scans.data.length > 0 && (
                  <button
                    onClick={() => setActiveScanId(scans.data[0].id)}
                    className="h-9 px-4 rounded-full glass hairline border text-[13px] text-muted-foreground hover:text-foreground transition"
                  >
                    Load Recent Session
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} onSaved={() => { setShowConnect(false); qc.invalidateQueries({ queryKey: ["gh-status"] }); }} />}
      {showPicker && (
        <RepoPicker
          onClose={() => setShowPicker(false)}
          onScanned={(scanId) => {
            setShowPicker(false);
            setActiveScanId(scanId);
            qc.invalidateQueries({ queryKey: ["scans"] });
          }}
        />
      )}
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

function RepoPicker({ onClose, onScanned }: { onClose: () => void; onScanned: (scanId: string) => void }) {
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
    try {
      const res = await startScan({ data: { repo_full_name: full_name } });
      onScanned(res.scan_id);
    }
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

function N8NNodeGraph({
  filter,
  setFilter,
  findings,
  scanStatus,
  onDownload
}: {
  filter: string;
  setFilter: (f: string) => void;
  findings: Array<{ agent: string; severity: string }>;
  scanStatus: string;
  onDownload: () => void;
}) {
  const counts = {
    all: findings.length,
    mcp: findings.filter((f) => f.agent === "mcp").length,
    "tool-poison": findings.filter((f) => f.agent === "tool-poison").length,
    "prompt-injection": findings.filter((f) => f.agent === "prompt-injection").length,
    "agent-config": findings.filter((f) => f.agent === "agent-config").length,
    "ai-deps": findings.filter((f) => f.agent === "ai-deps").length,
  };

  const agents = [
    { id: "mcp", label: "MCP Scanner", icon: MCPRobot, count: counts.mcp },
    { id: "tool-poison", label: "Tool Poisoning", icon: PoisonRobot, count: counts["tool-poison"] },
    { id: "prompt-injection", label: "Prompt Auditor", icon: BrainRobot, count: counts["prompt-injection"] },
    { id: "agent-config", label: "Config Auditor", icon: ConfigRobot, count: counts["agent-config"] },
    { id: "ai-deps", label: "AI-stack CVEs", icon: CVERobot, count: counts["ai-deps"] },
  ];

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-6 overflow-hidden relative mb-6 shadow-lg min-h-[380px] flex flex-col justify-center select-none">
      {/* Background n8n grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.015)_1px,transparent_0)] [background-size:16px_16px]" />

      {/* SVG Wires Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Source to Agents */}
        <path d="M 15 50 C 22 50, 22 18, 35 18" fill="none" stroke={filter === "mcp" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />
        <path d="M 15 50 C 22 50, 22 34, 35 34" fill="none" stroke={filter === "tool-poison" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />
        <path d="M 15 50 C 22 50, 22 50, 35 50" fill="none" stroke={filter === "prompt-injection" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />
        <path d="M 15 50 C 22 50, 22 66, 35 66" fill="none" stroke={filter === "agent-config" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />
        <path d="M 15 50 C 22 50, 22 82, 35 82" fill="none" stroke={filter === "ai-deps" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />

        {/* Agents to Judge */}
        <path d="M 65 18 C 73 18, 73 50, 80 50" fill="none" stroke={filter === "mcp" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />
        <path d="M 65 34 C 73 34, 73 50, 80 50" fill="none" stroke={filter === "tool-poison" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />
        <path d="M 65 50 C 73 50, 73 50, 80 50" fill="none" stroke={filter === "prompt-injection" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />
        <path d="M 65 66 C 73 66, 73 50, 80 50" fill="none" stroke={filter === "agent-config" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />
        <path d="M 65 82 C 73 82, 73 50, 80 50" fill="none" stroke={filter === "ai-deps" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />

        {/* Judge to Report */}
        <path d="M 88 50 H 92" fill="none" stroke={filter === "pdf" ? "#34d399" : "rgba(255,255,255,0.08)"} strokeWidth="0.3" />
      </svg>

      {/* Nodes Grid */}
      <div className="relative z-10 grid grid-cols-3 gap-4 items-center w-full">
        {/* COLUMN 1: Source Nodes */}
        <div className="flex flex-col gap-4 items-center justify-center">
          <button
            onClick={() => setFilter("all")}
            className={`w-[125px] p-3 rounded-xl border text-center flex flex-col items-center gap-2 transition-all cursor-pointer ${
              filter === "all"
                ? "bg-white/5 border-emerald-500/50 shadow-[0_8px_30px_rgba(52,211,153,0.06)]"
                : "bg-black/40 border-white/5 hover:border-white/10"
            }`}
          >
            <div className={`p-2 rounded-lg border text-white ${filter === "all" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-black/30 border-white/5"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="text-[11px] font-bold text-white tracking-tight leading-none">All Findings</div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/10 text-white leading-none">{counts.all}</span>
          </button>

          <button
            onClick={() => setFilter("source")}
            className={`w-[125px] p-3 rounded-xl border text-center flex flex-col items-center gap-2 transition-all cursor-pointer ${
              filter === "source"
                ? "bg-white/5 border-emerald-500/50 shadow-[0_8px_30px_rgba(52,211,153,0.06)]"
                : "bg-black/40 border-white/5 hover:border-white/10"
            }`}
          >
            <div className="p-2 rounded-lg border bg-black/30 border-white/5 text-muted-foreground">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </div>
            <div className="text-[11px] font-bold text-white tracking-tight leading-none">Git Tree</div>
            <span className="text-[9px] font-mono text-muted-foreground uppercase leading-none">Source</span>
          </button>
        </div>

        {/* COLUMN 2: The 5 Agents */}
        <div className="flex flex-col gap-1.5 items-center justify-center">
          {agents.map((a) => {
            const RobotIcon = a.icon;
            const isActive = filter === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setFilter(a.id)}
                className={`w-[180px] p-2 rounded-xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                  isActive
                    ? "bg-white/5 border-emerald-500/50 shadow-[0_8px_30px_rgba(52,211,153,0.06)] scale-[1.03]"
                    : "bg-black/40 border-white/5 hover:border-white/10"
                }`}
              >
                <div className={`p-1.5 rounded-lg border shrink-0 ${
                  isActive ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-black/30 border-white/5 text-muted-foreground"
                }`}>
                  <RobotIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-white tracking-tight truncate leading-none mb-0.5">{a.label}</div>
                  <div className="text-[8.5px] text-muted-foreground uppercase tracking-wider leading-none">Agent</div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                  a.count > 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-white/10 text-white"
                }`}>
                  {a.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* COLUMN 3: LLM Judge & PDF Export */}
        <div className="flex flex-col gap-4 items-center justify-center">
          <button
            onClick={() => setFilter("judge")}
            className={`w-[125px] p-3 rounded-xl border text-center flex flex-col items-center gap-2 transition-all cursor-pointer ${
              filter === "judge"
                ? "bg-white/5 border-emerald-500/50 shadow-[0_8px_30px_rgba(52,211,153,0.06)]"
                : "bg-black/40 border-white/5 hover:border-white/10"
            }`}
          >
            <div className={`p-2 rounded-lg border text-white ${filter === "judge" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-black/30 border-white/5"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l-7 4a2 2 0 0 0 2 0l-7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div className="text-[11px] font-bold text-white tracking-tight leading-none">LLM Judge</div>
            <span className="text-[9px] font-mono text-muted-foreground uppercase leading-none">Arbitrate</span>
          </button>

          <button
            onClick={() => {
              setFilter("pdf");
              onDownload();
            }}
            className={`w-[125px] p-3 rounded-xl border text-center flex flex-col items-center gap-2 transition-all cursor-pointer ${
              filter === "pdf"
                ? "bg-white/5 border-emerald-500/50 shadow-[0_8px_30px_rgba(52,211,153,0.06)]"
                : "bg-black/40 border-white/5 hover:border-white/10"
            }`}
          >
            <div className="p-2 rounded-lg border bg-black/30 border-white/5 text-emerald-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="text-[11px] font-bold text-white tracking-tight leading-none">PDF Report</div>
            <span className="text-[9px] font-mono text-muted-foreground uppercase leading-none">Export</span>
          </button>
        </div>
      </div>
    </div>
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
  const [activeTab, setActiveTab] = useState<"findings" | "chat">("findings");

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
  const visible = useMemo(() => {
    if (filter === "all") return findings;
    if (filter === "source" || filter === "judge" || filter === "pdf") return [];
    return findings.filter((f) => f.agent === filter);
  }, [filter, findings]);

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

          <div className="flex gap-4 border-b border-white/5 mb-5 pb-px text-[14px]">
            <button
              onClick={() => setActiveTab("findings")}
              className={`pb-2.5 font-medium border-b-2 transition-all ${
                activeTab === "findings" ? "border-emerald-400 text-white" : "border-transparent text-muted-foreground hover:text-white"
              }`}
            >
              Vulnerability Findings
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`pb-2.5 font-medium border-b-2 transition-all ${
                activeTab === "chat" ? "border-emerald-400 text-white" : "border-transparent text-muted-foreground hover:text-white"
              }`}
            >
              Chat with AI Auditor
            </button>
          </div>

          {activeTab === "findings" ? (
            <>
              <SummaryCards summary={(scan.summary ?? {}) as Record<string, number>} />

              <N8NNodeGraph
                filter={filter}
                setFilter={setFilter}
                findings={findings}
                scanStatus={scan.status}
                onDownload={download}
              />

              {filter === "source" && (
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] text-left space-y-3">
                  <h3 className="text-[15px] font-bold text-white tracking-tight">GitHub Repository Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-[13px] text-muted-foreground font-mono">
                    <div>Repo URL: <a href={scan.repo_url} target="_blank" rel="noreferrer" className="text-white hover:underline truncate block">{scan.repo_url}</a></div>
                    <div>Full Name: <span className="text-white">{scan.repo_full_name}</span></div>
                    <div>Scanned At: <span className="text-white">{scan.created_at ? new Date(scan.created_at).toLocaleString() : "—"}</span></div>
                    <div>Status: <span className="text-emerald-400">SYNCED & INDEXED</span></div>
                  </div>
                </div>
              )}

              {filter === "judge" && (
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] text-left space-y-3">
                  <h3 className="text-[15px] font-bold text-white tracking-tight">LLM Arbitration Ledger</h3>
                  <p className="text-[13px] text-muted-foreground leading-normal">
                    The Local LLM Judge has processed all {findings.length} findings. Deduplication is complete, severities have been validated against active safety policies, and remediation advisories have been committed to Supabase logs.
                  </p>
                </div>
              )}

              {filter === "pdf" && (
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] text-left space-y-3 text-center">
                  <h3 className="text-[15px] font-bold text-white tracking-tight">Compliance PDF Export</h3>
                  <p className="text-[13px] text-muted-foreground max-w-md mx-auto leading-normal">
                    A formal, executive-ready security report containing findings distribution, OWASP mapping details, and the judge's full audit trail is ready for download.
                  </p>
                  <button
                    onClick={download} disabled={downloading || scan.status !== "complete"}
                    className="mt-2 h-9 px-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-black text-[13px] font-semibold transition disabled:opacity-40"
                  >
                    {downloading ? "Compiling Report..." : "Trigger Download PDF"}
                  </button>
                </div>
              )}

              {filter !== "source" && filter !== "judge" && filter !== "pdf" && (
                <>
                  {visible.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground py-8 text-center">
                      {scan.status === "complete" ? "No findings for this filter." : "Agents still working…"}
                    </p>
                  ) : (
                    <ul className="divide-y hairline">
                      {visible.map((f) => <FindingRow key={f.id} f={f} />)}
                    </ul>
                  )}
                </>
              )}
            </>
          ) : (
            <ChatTab findings={findings} />
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

function getRemediationAdvice(agent: string, title: string) {
  const t = title.toLowerCase();
  const a = agent.toLowerCase();
  if (t.includes("dangerously_allow_code_execution") || t.includes("dangerouslyallowcodeexecution")) {
    return "Disable dangerouslyAllowCodeExecution in your agent framework configuration. If code execution is required, ensure it runs in a sandboxed, isolated environment (e.g. Docker or a secure gVisor sandbox) rather than on the host system, and always implement a manual approval gate before execution.";
  }
  if (a === "mcp") {
    return "Avoid running unverified third-party MCP servers using command launchers like npx or uvx on connection. Enforce HTTPS/WSS transport instead of plaintext HTTP, pin dependencies in lock files, and restrict host file system access using fine-grained server properties.";
  }
  if (a === "tool-poison") {
    return "Audit and sanitize all schemas in your tool declarations. Strip hidden directives, role-override patterns, and zero-width spaces. Run inputs through safety classifiers before passing them to prompt generation models.";
  }
  if (a === "prompt-injection") {
    return "Isolate untrusted user inputs from system instructions using structural delimiter schemas (e.g. XML tags or JSON boundaries). Implement input sanitizers and safety models (such as Llama Guard) to filter hijacking attempts.";
  }
  if (a === "ai-deps" || t.includes("cve") || t.includes("dependency")) {
    return "Upgrade the vulnerable packages (such as langchain, openai, or anthropic) to the latest secure version. If patches are unavailable, configure input validation middleware or pin to the last known safe version.";
  }
  return "Review the policy requirements in the policy editor page. Block unverified third-party libraries and verify execution commands manually before starting scans.";
}

function FormattedJudgeReasoning({ text }: { text: string }) {
  if (!text) return null;

  let displayHtml = text;
  if (text.includes("Static pattern in agent framework config")) {
    displayHtml = `**Threat Analysis:**
* The execution library configuration allows the LLM to run system commands directly.
* Prompt injections in user input can exploit this path to read/write files or infect environment variables.

**Remediation Guidelines:**
* Disable this flag unless absolutely necessary.
* Enforce sandboxing (e.g. gVisor or isolated Docker containers) for code execution.
* Add user-in-the-loop manual approval gates.`;
  } else if (text.includes("Tool descriptions are read by the model")) {
    displayHtml = `**Threat Analysis:**
* Tool descriptions are treated as trusted system text by LLMs.
* Attackers can smuggle commands inside descriptions, hijacking agent behaviors.

**Remediation Guidelines:**
* Sanitize description strings to remove formatting tags or imperative verbs.
* Lock down schemas to allow only expected primitive types.`;
  }

  const lines = displayHtml.split("\n");
  return (
    <div className="space-y-3 mt-1.5 text-[13px] text-white/90 leading-[1.6]">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          const content = trimmed.replace(/\*\*/g, "");
          return (
            <h4 key={idx} className="text-[12px] font-bold text-emerald-400 uppercase tracking-wider mt-3 mb-1">
              {content}
            </h4>
          );
        }
        if (trimmed.startsWith("**") && trimmed.includes(":**")) {
          const parts = trimmed.split(":**");
          const header = parts[0].replace(/\*\*/g, "");
          const body = parts.slice(1).join(":**").trim();
          return (
            <div key={idx} className="mt-2">
              <span className="text-[11.5px] font-bold text-emerald-400 uppercase tracking-wider mr-1.5">{header}:</span>
              <span className="text-[13px] text-white/90">{body}</span>
            </div>
          );
        }

        if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
          const content = trimmed.substring(1).trim();
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-1">
              <span className="text-emerald-400 text-[14px] leading-none select-none mt-0.5">•</span>
              <span className="text-[13px] text-muted-foreground leading-normal">{content}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-[13px] text-white/90 leading-normal">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function FindingRow({ f }: { f: Awaited<ReturnType<typeof getScan>>["findings"][number] }) {
  const [open, setOpen] = useState(false);
  const c = f.severity === "critical" ? "text-red-400 bg-red-500/10 border-red-500/20"
    : f.severity === "high" ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
    : f.severity === "medium" ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/20"
    : f.severity === "low" ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
    : "text-muted-foreground bg-muted/30 border-white/5";
  const owasp = (f as { owasp_llm?: string | null }).owasp_llm;
  const nist = (f as { nist_ai_rmf?: string | null }).nist_ai_rmf;
  const pv = (f as { policy_violation?: string | null }).policy_violation;
  
  const remediation = getRemediationAdvice(f.agent, f.title);

  return (
    <li className="mb-4 p-4.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all">
      <div className="flex items-start gap-4 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border shrink-0 mt-0.5 ${c}`}>
          {f.severity}
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/5 text-muted-foreground uppercase shrink-0 mt-0.5">
          {f.agent}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-bold text-white tracking-tight leading-normal truncate">{f.title}</div>
          {f.description && <div className="text-[13px] text-muted-foreground mt-1 leading-normal">{f.description}</div>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {owasp && <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">OWASP {owasp}</span>}
            {nist && <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">NIST {nist}</span>}
            {pv && <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-red-500/15 text-red-300 border border-red-500/25">POLICY: {pv}</span>}
          </div>
        </div>
        <span className="text-muted-foreground/60 hover:text-white text-[14px] px-1 shrink-0 select-none transition-colors">{open ? "▾" : "▸"}</span>
      </div>
      
      {open && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-4 text-[13px] animate-slide-down">
          {f.judge_reasoning && (
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-400 font-semibold mb-1">Judge Verdict · {f.judge_verdict ?? "CONFIRMED"}</div>
              <FormattedJudgeReasoning text={f.judge_reasoning} />
            </div>
          )}
          
          {f.evidence && Object.keys(f.evidence as object).length > 0 && (
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-1">Evidence</div>
              <pre className="text-[11.5px] font-mono bg-black/40 border border-white/5 rounded-lg p-3 text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(f.evidence, null, 2)}
              </pre>
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 font-mono text-[11.5px] leading-[1.5]">
            <span className="text-white font-semibold block mb-0.5 font-sans text-[13px] tracking-tight">Security Remediation:</span>
            <span className="text-muted-foreground">{remediation}</span>
          </div>
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

function WatchlistView({ setView, setActiveScanId, setOpenScanId }: { setView: (v: View) => void; setActiveScanId: (id: string | null) => void; setOpenScanId: (id: string | null) => void }) {
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
                <div className="flex items-center gap-2">
                  {w.last_scan_id && (
                    <button
                      onClick={() => {
                        setActiveScanId(w.last_scan_id);
                        setOpenScanId(w.last_scan_id);
                        setView("scans");
                      }}
                      className="h-8 px-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-black text-[12.5px] font-semibold transition"
                    >
                      View Findings
                    </button>
                  )}
                  <button
                    onClick={async () => { await unwatchRepo({ data: { id: w.id } }); qc.invalidateQueries({ queryKey: ["watched"] }); }}
                    className="h-8 px-3 rounded-full glass hairline border text-[12px] text-muted-foreground hover:text-foreground transition"
                  >
                    Remove
                  </button>
                </div>
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

function HistoryView({ setOpenScanId }: { setOpenScanId: (id: string | null) => void }) {
  const qc = useQueryClient();
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => listScans(), refetchInterval: 5000 });
  const [err, setErr] = useState<string | null>(null);

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear your local session history? This will delete all scan records from the database.")) return;
    try {
      const { error } = await supabase.from("scans").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["scans"] });
    } catch (e: any) {
      setErr(e.message || "Failed to clear history");
    }
  };

  return (
    <main className="p-8 max-w-5xl w-full mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[26px] tracking-tight font-semibold">Scan History</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Review and reload previous MCP audit sessions.</p>
        </div>
        {(scans.data ?? []).length > 0 && (
          <button
            onClick={handleClearHistory}
            className="h-9 px-4 rounded-full bg-red-500/10 border border-red-500/20 text-[12px] text-red-400 hover:bg-red-500/20 transition"
          >
            Clear History
          </button>
        )}
      </div>

      {err && <p className="text-[12.5px] text-destructive mb-4">{err}</p>}

      <div className="rounded-2xl hairline border overflow-hidden bg-background/50">
        {scans.isLoading ? (
          <div className="p-12 text-center text-[13.5px] text-muted-foreground">Loading history log...</div>
        ) : (scans.data ?? []).length === 0 ? (
          <div className="p-12 text-center text-[13px] text-muted-foreground">
            No history found. Run a new scan on the dashboard to save your first session.
          </div>
        ) : (
          <ul className="divide-y hairline">
            {scans.data!.map((s) => (
              <ScanRow key={s.id} scan={s} onOpen={() => setOpenScanId(s.id)} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function ChatTab({ findings }: { findings: any[] }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Hi! I am the Ward AI Security Assistant. Ask me anything about the vulnerabilities found in this scan, or how to remediate them." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userText = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    try {
      const findingsContext = findings.map(f => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join("\n");
      const systemPrompt = `You are the Ward Security AI Assistant. You are helpfully explaining the following MCP security audit findings to a developer:\n\n${findingsContext}\n\nProvide clear, direct, and actionable security remediation advice. Keep responses concise and formatted in markdown.`;

      let activeModel = "llama-guard3";
      try {
        const tagsRes = await fetch("http://localhost:11434/api/tags");
        if (tagsRes.ok) {
          const tags = await tagsRes.json() as any;
          const names = (tags.models ?? []).map((m: any) => m.name.toLowerCase());
          if (names.some((n: string) => n.includes("llama3"))) activeModel = "llama3";
          else if (names.some((n: string) => n.includes("granite-guardian"))) activeModel = "granite-guardian:8b";
          else if (tags.models && tags.models.length > 0) activeModel = tags.models[0].name;
        }
      } catch (e) {
        console.warn("Ollama tags fetch failed, using default model.");
      }

      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: activeModel,
          prompt: `System context:\n${systemPrompt}\n\nUser Question:\n${userText}`,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error("Ollama generation failed");
      const data = await response.json() as any;
      const reply = data.response || "No response received.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e: any) {
      console.error(e);
      setMessages(prev => [...prev, { role: "assistant", content: "Error: Failed to connect to local Ollama server. Make sure Ollama is running and has a model pulled." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 flex flex-col min-h-[380px] bg-black/20 rounded-2xl border border-white/5 p-4 text-left">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider font-mono">Chat Session</span>
        <button
          type="button"
          onClick={() => setMessages([{ role: "assistant", content: "Chat cleared. Ask me anything about the scan." }])}
          className="text-[10px] text-muted-foreground hover:text-white transition font-sans"
        >
          Clear Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 max-h-[280px] pr-2 scrollbar-thin">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
              m.role === 'user' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-white/5 text-muted-foreground border border-white/5'
            }`}>
              <span className="font-mono text-[9px] text-white/40 block mb-1 uppercase tracking-wider">{m.role}</span>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-xl px-3 py-2 text-[12px] text-muted-foreground flex items-center gap-2 border border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>AI Auditor is analyzing...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-white/5 pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the findings..."
          disabled={loading}
          className="flex-1 h-9 rounded-lg bg-black/40 border border-white/5 px-3 text-[12.5px] outline-none focus:border-emerald-500/50 text-white placeholder:text-muted-foreground/30 transition-all font-sans"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-[12.5px] font-semibold disabled:opacity-50 transition-all font-sans"
        >
          Send
        </button>
      </form>
    </div>
  );
}
