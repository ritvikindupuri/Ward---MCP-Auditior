import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mark } from "./index";
import {
  createAgent,
  deleteAgent,
  getRun,
  listAgents,
  listRuns,
  startRun,
} from "@/lib/adversa.functions";

type AgentRow = { id: string; name: string; endpoint: string; created_at: string };
type RunRow = {
  id: string;
  agent_id: string;
  status: string;
  total: number;
  pass_count: number;
  fail_count: number;
  error_count: number;
  started_at: string;
  completed_at: string | null;
};
type TraceRow = {
  id: string;
  attack_id: string;
  verdict: string;
  judge_reasoning: string | null;
  response_text: string | null;
  latency_ms: number | null;
  http_status: number | null;
  created_at: string;
  attacks: { name: string; category: string; severity: string; prompt: string; expected_behavior: string } | null;
};

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
  const [connectOpen, setConnectOpen] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

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
          <button
            onClick={() => setConnectOpen(true)}
            className="h-10 rounded-full bg-foreground text-background px-5 text-[13.5px] font-medium hover:opacity-90 transition"
          >
            + Connect agent
          </button>
        </div>

        <div className="mt-10 grid grid-cols-12 gap-6">
          <aside className="col-span-12 md:col-span-4">
            <AgentsPanel onConnect={() => setConnectOpen(true)} />
          </aside>
          <main className="col-span-12 md:col-span-8 space-y-6">
            <RunsPanel onOpenRun={setOpenRunId} />
          </main>
        </div>
      </div>

      {connectOpen && <ConnectAgentModal onClose={() => setConnectOpen(false)} />}
      {openRunId && <RunDetailModal id={openRunId} onClose={() => setOpenRunId(null)} />}
    </div>
  );
}

// ---------- Agents ----------

function AgentsPanel({ onConnect }: { onConnect: () => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listAgents);
  const del = useServerFn(deleteAgent);
  const run = useServerFn(startRun);
  const { data: agents = [], isLoading } = useQuery<AgentRow[]>({
    queryKey: ["agents"],
    queryFn: () => list() as Promise<AgentRow[]>,
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
  const runMut = useMutation({
    mutationFn: (agent_id: string) => run({ data: { agent_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });

  return (
    <section className="rounded-2xl hairline border p-5">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-medium">Agents</div>
        <span className="text-[12px] text-muted-foreground">{agents.length}</span>
      </div>
      <div className="mt-4 space-y-2">
        {isLoading && <div className="text-[13px] text-muted-foreground">Loading…</div>}
        {!isLoading && agents.length === 0 && (
          <div className="rounded-xl border hairline border-dashed p-6 text-center">
            <div className="text-[13.5px] font-medium">No agents yet</div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Point Adversa at an endpoint to begin.</p>
            <button
              onClick={onConnect}
              className="mt-4 h-9 rounded-full bg-foreground text-background px-4 text-[12.5px] font-medium hover:opacity-90 transition"
            >
              Connect agent
            </button>
          </div>
        )}
        {agents.map((a) => (
          <div key={a.id} className="rounded-xl hairline border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate">{a.name}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">{a.endpoint}</div>
              </div>
              <button
                onClick={() => removeMut.mutate(a.id)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
                title="Delete"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                disabled={runMut.isPending && runMut.variables === a.id}
                onClick={() => runMut.mutate(a.id)}
                className="h-8 rounded-full bg-foreground text-background px-3.5 text-[12px] font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {runMut.isPending && runMut.variables === a.id ? "Running…" : "Run stress test"}
              </button>
              <span className="text-[11px] text-muted-foreground">12 attacks</span>
            </div>
          </div>
        ))}
      </div>
      {runMut.isError && (
        <div className="mt-3 text-[12px] text-red-500">
          {(runMut.error as Error)?.message ?? "Run failed"}
        </div>
      )}
    </section>
  );
}

// ---------- Runs ----------

function RunsPanel({ onOpenRun }: { onOpenRun: (id: string) => void }) {
  const list = useServerFn(listRuns);
  const { data: runs = [], isLoading } = useQuery<RunRow[]>({
    queryKey: ["runs"],
    queryFn: () => list() as Promise<RunRow[]>,
    refetchInterval: 4000,
  });

  const stats = useMemo(() => {
    const done = runs.filter((r) => r.status === "complete");
    const totalPass = done.reduce((a, r) => a + (r.pass_count ?? 0), 0);
    const totalRun = done.reduce((a, r) => a + (r.total ?? 0), 0);
    const rate = totalRun ? Math.round((totalPass / totalRun) * 100) : null;
    return { runs: runs.length, rate };
  }, [runs]);

  return (
    <>
      <section className="rounded-2xl hairline border overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b hairline">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">Overview</div>
            <div className="mt-1 text-[15px] font-medium">Adversarial suite · v0.1</div>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="rounded-md glass px-2 py-1">{stats.runs} runs</span>
            <span className="rounded-md hairline border px-2.5 py-1 text-muted-foreground">
              {stats.rate == null ? "—" : `${stats.rate}% pass`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5">
          <Stat label="Total runs" value={stats.runs.toString()} />
          <Stat label="Pass rate" value={stats.rate == null ? "—" : `${stats.rate}%`} />
          <Stat label="Attacks per run" value="12" />
        </div>

        <div className="p-5 pt-0">
          {isLoading && <div className="text-[13px] text-muted-foreground">Loading…</div>}
          {!isLoading && runs.length === 0 && (
            <div className="rounded-xl border hairline border-dashed p-10 text-center">
              <div className="text-[14px] font-medium">No runs yet</div>
              <p className="mt-1.5 text-[13px] text-muted-foreground max-w-sm mx-auto">
                Connect an agent, then hit "Run stress test" to probe it with the adversarial library.
              </p>
            </div>
          )}
          {runs.length > 0 && (
            <div className="rounded-xl hairline border divide-y divide-border/50 overflow-hidden">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onOpenRun(r.id)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-2 transition flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">
                      Run · {new Date(r.started_at).toLocaleString()}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {r.status === "running" ? "In progress…" : `${r.pass_count}/${r.total} passed · ${r.fail_count} fail · ${r.error_count} error`}
                    </div>
                  </div>
                  <StatusPill status={r.status} />
                  <span className="text-muted-foreground">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl glass p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">{label}</div>
      <div className="mt-2 text-[22px] font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "complete"
      ? "text-emerald-400 bg-emerald-400/10"
      : status === "running"
      ? "text-accent bg-accent/10"
      : "text-muted-foreground bg-muted-foreground/10";
  return (
    <span className={`text-[10.5px] uppercase tracking-widest rounded-full px-2 py-1 ${color}`}>{status}</span>
  );
}

// ---------- Modals ----------

function ConnectAgentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createAgent);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [auth, setAuth] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          endpoint,
          auth_header: auth || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl hairline border bg-surface-1 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Setup</div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight">Connect an agent</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hairline border text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          Adversa POSTs each attack prompt to your endpoint as{" "}
          <code className="text-foreground/80">{`{ messages: [{ role: 'user', content: '<prompt>' }] }`}</code>{" "}
          and reads the reply from <code className="text-foreground/80">choices.0.message.content</code>{" "}
          (OpenAI-compatible).
        </p>

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <Field label="Agent name">
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="support-copilot"
              className="w-full h-10 rounded-lg hairline border bg-background px-3 text-[13.5px] outline-none focus:border-foreground/30"
            />
          </Field>
          <Field label="Endpoint URL">
            <input
              required
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.your-agent.com/v1/chat/completions"
              className="w-full h-10 rounded-lg hairline border bg-background px-3 text-[13.5px] outline-none focus:border-foreground/30"
            />
          </Field>
          <Field label="Auth header (optional)">
            <input
              value={auth}
              onChange={(e) => setAuth(e.target.value)}
              placeholder="Bearer sk-…"
              className="w-full h-10 rounded-lg hairline border bg-background px-3 text-[13.5px] outline-none focus:border-foreground/30"
            />
          </Field>

          {mut.isError && (
            <div className="text-[12px] text-red-500">
              {(mut.error as Error)?.message ?? "Failed to save"}
            </div>
          )}

          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={mut.isPending}
              className="h-10 rounded-full bg-foreground text-background px-5 text-[13.5px] font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {mut.isPending ? "Saving…" : "Save agent"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full hairline border px-4 text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[12px] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function RunDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const get = useServerFn(getRun);
  const { data, isLoading } = useQuery({
    queryKey: ["run", id],
    queryFn: () => get({ data: { id } }),
    refetchInterval: (q) => (q.state.data?.run?.status === "complete" ? false : 3000),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl hairline border bg-surface-1 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b hairline flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Run</div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-tight">
              {data?.run ? new Date(data.run.started_at).toLocaleString() : "Loading…"}
            </h2>
            {data?.run && (
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                {data.run.pass_count}/{data.run.total} passed · {data.run.fail_count} failed · {data.run.error_count} error
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hairline border text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-2">
          {isLoading && <div className="text-[13px] text-muted-foreground">Loading traces…</div>}
          {data?.traces?.map((t) => {
            const atk = (t as unknown as { attacks: { name: string; category: string; severity: string; prompt: string; expected_behavior: string } }).attacks;
            const color =
              t.verdict === "pass"
                ? "text-emerald-400 bg-emerald-400/10"
                : t.verdict === "fail"
                ? "text-red-400 bg-red-400/10"
                : "text-muted-foreground bg-muted-foreground/10";
            return (
              <details key={t.id} className="rounded-xl hairline border p-3 group">
                <summary className="flex items-center gap-3 cursor-pointer list-none">
                  <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-1 ${color}`}>
                    {t.verdict}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{atk?.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {atk?.category} · {atk?.severity} · {t.latency_ms}ms
                    </div>
                  </div>
                  <span className="text-muted-foreground text-[11px] group-open:hidden">expand</span>
                </summary>
                <div className="mt-3 space-y-3 text-[12.5px]">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground/70">Attack prompt</div>
                    <pre className="mt-1 whitespace-pre-wrap text-foreground/90">{atk?.prompt}</pre>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground/70">Expected behavior</div>
                    <p className="mt-1 text-muted-foreground">{atk?.expected_behavior}</p>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground/70">Agent response</div>
                    <pre className="mt-1 whitespace-pre-wrap text-foreground/90 max-h-64 overflow-auto rounded-lg bg-background hairline border p-2">
                      {t.response_text ?? "(no response)"}
                    </pre>
                  </div>
                  {t.judge_reasoning && (
                    <div>
                      <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground/70">Judge</div>
                      <p className="mt-1 text-muted-foreground">{t.judge_reasoning}</p>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}
