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
  diffRuns,
  getAttackStats,
  getRun,
  listAgents,
  listRuns,
  startRun,
} from "@/lib/adversa.functions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  attacks: { name: string; category: string; severity: string; prompt: string; expected_behavior: string; owasp_id: string | null; compliance_tags: string[] | null } | null;
};
type CatStat = { category: string; total: number; pass: number; fail: number; err: number };

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
  const [diffPair, setDiffPair] = useState<{ base: string; head: string } | null>(null);

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
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <div className="min-h-screen bg-background text-foreground grain">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b hairline">
          <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center justify-between">
            <Tip label="Back to marketing site">
              <Link to="/" className="flex items-center gap-2.5">
                <Mark size={22} />
                <span className="text-[15px] tracking-tight font-medium">Adversa</span>
                <span className="ml-3 text-[12px] text-muted-foreground">/ Console</span>
              </Link>
            </Tip>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-muted-foreground hidden sm:block">{user.email}</span>
              <Tip label="Signed-in user">
                <div className="h-7 w-7 rounded-full bg-surface-2 hairline border flex items-center justify-center text-[12px] font-medium cursor-default">
                  {initial}
                </div>
              </Tip>
              <Tip label="End your session">
                <button
                  onClick={signOut}
                  className="h-8 rounded-full hairline border px-3 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
                >
                  Sign out
                </button>
              </Tip>
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
            <Tip label="Register an AI agent endpoint to test">
              <button
                onClick={() => setConnectOpen(true)}
                className="h-10 rounded-full bg-foreground text-background px-5 text-[13.5px] font-medium hover:opacity-90 transition"
              >
                + Connect agent
              </button>
            </Tip>
          </div>

          <div className="mt-10 grid grid-cols-12 gap-6">
            <aside className="col-span-12 md:col-span-4">
              <AgentsPanel onConnect={() => setConnectOpen(true)} />
            </aside>
            <main className="col-span-12 md:col-span-8 space-y-6">
              <RunsPanel onOpenRun={setOpenRunId} onCompare={(base, head) => setDiffPair({ base, head })} />
            </main>
          </div>
        </div>

        {connectOpen && <ConnectAgentModal onClose={() => setConnectOpen(false)} />}
        {openRunId && <RunDetailModal id={openRunId} onClose={() => setOpenRunId(null)} />}
        {diffPair && <RunDiffModal base={diffPair.base} head={diffPair.head} onClose={() => setDiffPair(null)} />}
      </div>
    </TooltipProvider>
  );
}

function Tip({ label, children, side = "bottom" }: { label: string; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="bg-surface-2 text-foreground hairline border text-[11.5px]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ---------- Agents ----------

function AgentsPanel({ onConnect }: { onConnect: () => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listAgents);
  const del = useServerFn(deleteAgent);
  const run = useServerFn(startRun);
  const stats = useServerFn(getAttackStats);
  const { data: agents = [], isLoading } = useQuery<AgentRow[]>({
    queryKey: ["agents"],
    queryFn: () => list() as Promise<AgentRow[]>,
  });
  const { data: attackStats } = useQuery<{ total: number; categories: number; owasp_covered: number; frameworks: string[] }>({
    queryKey: ["attack-stats"],
    queryFn: () => stats() as Promise<{ total: number; categories: number; owasp_covered: number; frameworks: string[] }>,
    staleTime: 60_000,
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
  const runMut = useMutation({
    mutationFn: (agent_id: string) => run({ data: { agent_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });

  const attackCount = attackStats?.total ?? null;

  return (
    <section className="rounded-2xl hairline border p-5">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-medium">Agents</div>
        <Tip label="Agents registered in this workspace">
          <span className="text-[12px] text-muted-foreground cursor-default">{agents.length}</span>
        </Tip>
      </div>
      <div className="mt-4 space-y-2">
        {isLoading && <div className="text-[13px] text-muted-foreground">Loading…</div>}
        {!isLoading && agents.length === 0 && (
          <div className="rounded-xl border hairline border-dashed p-6 text-center">
            <div className="text-[13.5px] font-medium">No agents yet</div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Point Adversa at an endpoint to begin.</p>
            <Tip label="Guided setup — OpenAI, OpenRouter, Groq or custom">
              <button
                onClick={onConnect}
                className="mt-4 h-9 rounded-full bg-foreground text-background px-4 text-[12.5px] font-medium hover:opacity-90 transition"
              >
                Connect agent
              </button>
            </Tip>
          </div>
        )}
        {agents.map((a) => (
          <div key={a.id} className="rounded-xl hairline border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Tip label={`Created ${new Date(a.created_at).toLocaleString()}`} side="top">
                  <div className="text-[13.5px] font-medium truncate cursor-default">{a.name}</div>
                </Tip>
                <Tip label={a.endpoint} side="top">
                  <div className="text-[11.5px] text-muted-foreground truncate cursor-default">{a.endpoint}</div>
                </Tip>
              </div>
              <Tip label="Remove this agent">
                <button
                  onClick={() => removeMut.mutate(a.id)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  aria-label="Delete agent"
                >
                  ✕
                </button>
              </Tip>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Tip label={attackCount ? `Run all ${attackCount} adversarial probes against this agent` : "Run the full adversarial suite"}>
                <button
                  disabled={runMut.isPending && runMut.variables === a.id}
                  onClick={() => runMut.mutate(a.id)}
                  className="h-8 rounded-full bg-foreground text-background px-3.5 text-[12px] font-medium hover:opacity-90 transition disabled:opacity-60"
                >
                  {runMut.isPending && runMut.variables === a.id ? "Running…" : "Run stress test"}
                </button>
              </Tip>
              <Tip label="Size of the adversarial library">
                <span className="text-[11px] text-muted-foreground cursor-default">
                  {attackCount == null ? "…" : `${attackCount} attacks`}
                </span>
              </Tip>
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

function RunsPanel({
  onOpenRun,
  onCompare,
}: {
  onOpenRun: (id: string) => void;
  onCompare: (base: string, head: string) => void;
}) {
  const list = useServerFn(listRuns);
  const stats = useServerFn(getAttackStats);
  const { data: runs = [], isLoading } = useQuery<RunRow[]>({
    queryKey: ["runs"],
    queryFn: () => list() as Promise<RunRow[]>,
    refetchInterval: 4000,
  });
  const { data: attackStats } = useQuery<{ total: number; categories: number; owasp_covered: number; frameworks: string[] }>({
    queryKey: ["attack-stats"],
    queryFn: () => stats() as Promise<{ total: number; categories: number; owasp_covered: number; frameworks: string[] }>,
    staleTime: 60_000,
  });

  const [baseId, setBaseId] = useState<string | null>(null);
  const [headId, setHeadId] = useState<string | null>(null);

  const aggregate = useMemo(() => {
    const done = runs.filter((r) => r.status === "complete");
    const totalPass = done.reduce((a, r) => a + (r.pass_count ?? 0), 0);
    const totalRun = done.reduce((a, r) => a + (r.total ?? 0), 0);
    const rate = totalRun ? Math.round((totalPass / totalRun) * 100) : null;
    return { runs: runs.length, done: done.length, rate };
  }, [runs]);

  const canCompare = baseId && headId && baseId !== headId;
  const attackCount = attackStats?.total ?? null;

  return (
    <>
      <section className="rounded-2xl hairline border overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b hairline">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">Overview</div>
            <div className="mt-1 text-[15px] font-medium">Adversarial suite</div>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <Tip label={`${aggregate.done} complete of ${aggregate.runs} total`}>
              <span className="rounded-md glass px-2 py-1 cursor-default">{aggregate.runs} runs</span>
            </Tip>
            <Tip label="Aggregate pass rate across all completed runs">
              <span className="rounded-md hairline border px-2.5 py-1 text-muted-foreground cursor-default">
                {aggregate.rate == null ? "—" : `${aggregate.rate}% pass`}
              </span>
            </Tip>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5">
          <Stat
            label="Total runs"
            value={aggregate.runs.toString()}
            tip="Runs executed in this workspace"
          />
          <Stat
            label="Pass rate"
            value={aggregate.rate == null ? "—" : `${aggregate.rate}%`}
            tip="Share of adversarial probes the agent handled safely"
          />
          <Stat
            label="Attacks per run"
            value={attackCount == null ? "…" : attackCount.toString()}
            tip={
              attackStats
                ? `${attackStats.total} probes across ${attackStats.categories} categories, ${attackStats.owasp_covered} OWASP LLM entries`
                : "Loading adversarial library…"
            }
          />
        </div>

        {attackStats && attackStats.frameworks.length > 0 && (
          <div className="px-5 pb-4 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10.5px] uppercase tracking-widest text-muted-foreground/70 mr-1">
              Compliance coverage
            </span>
            {attackStats.frameworks.map((f) => (
              <Tip key={f} label={`Probes mapped to ${f} controls`}>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full hairline border text-muted-foreground cursor-default">
                  {f}
                </span>
              </Tip>
            ))}
          </div>
        )}

        <div className="px-5 pb-2 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <div className="truncate">
            Regression gate:{" "}
            <span className="text-foreground/80">{baseId ? "baseline set" : "pick a baseline"}</span>
            {" · "}
            <span className="text-foreground/80">{headId ? "compare set" : "pick a compare run"}</span>
          </div>
          <div className="flex items-center gap-2">
            {(baseId || headId) && (
              <Tip label="Clear the current baseline/compare selection">
                <button
                  onClick={() => {
                    setBaseId(null);
                    setHeadId(null);
                  }}
                  className="h-7 px-2.5 rounded-full hairline border hover:bg-surface-2 transition"
                >
                  Clear
                </button>
              </Tip>
            )}
            <Tip
              label={
                canCompare
                  ? "Open regression diff between selected runs"
                  : "Pick a baseline and a compare run first"
              }
            >
              <button
                disabled={!canCompare}
                onClick={() => canCompare && onCompare(baseId!, headId!)}
                className="h-7 px-3 rounded-full bg-accent text-accent-foreground text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                View diff →
              </button>
            </Tip>
          </div>
        </div>

        <div className="p-5 pt-3">
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
              {runs.map((r) => {
                const isBase = baseId === r.id;
                const isHead = headId === r.id;
                const completed = r.status === "complete";
                return (
                  <div
                    key={r.id}
                    className="w-full px-4 py-3 hover:bg-surface-2 transition flex items-center gap-3"
                  >
                    <Tip label="Open full report with traces + judge reasoning" side="top">
                      <button onClick={() => onOpenRun(r.id)} className="flex-1 min-w-0 text-left">
                        <div className="text-[13px] font-medium truncate">
                          Run · {new Date(r.started_at).toLocaleString()}
                        </div>
                        <div className="text-[11.5px] text-muted-foreground">
                          {r.status === "running"
                            ? "In progress…"
                            : `${r.pass_count}/${r.total} passed · ${r.fail_count} fail · ${r.error_count} error`}
                        </div>
                      </button>
                    </Tip>
                    <StatusPill status={r.status} />
                    {completed && (
                      <div className="flex items-center gap-1">
                        <Tip label="Use as regression baseline (v1)">
                          <button
                            onClick={() => setBaseId(isBase ? null : r.id)}
                            className={`h-7 px-2 rounded-md text-[10.5px] uppercase tracking-widest transition hairline border ${
                              isBase
                                ? "bg-accent/15 text-accent border-accent/40"
                                : "text-muted-foreground hover:bg-surface-2"
                            }`}
                          >
                            base
                          </button>
                        </Tip>
                        <Tip label="Compare against baseline (v2)">
                          <button
                            onClick={() => setHeadId(isHead ? null : r.id)}
                            className={`h-7 px-2 rounded-md text-[10.5px] uppercase tracking-widest transition hairline border ${
                              isHead
                                ? "bg-accent/15 text-accent border-accent/40"
                                : "text-muted-foreground hover:bg-surface-2"
                            }`}
                          >
                            vs
                          </button>
                        </Tip>
                      </div>
                    )}
                    <Tip label="Open run">
                      <button
                        onClick={() => onOpenRun(r.id)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Open run"
                      >
                        ›
                      </button>
                    </Tip>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, tip }: { label: string; value: string; tip?: string }) {
  const inner = (
    <div className="rounded-xl glass p-4 cursor-default">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">{label}</div>
      <div className="mt-2 text-[22px] font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
  return tip ? <Tip label={tip}>{inner}</Tip> : inner;
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

// ---------- Guided Connect Wizard ----------

type Preset = {
  id: string;
  label: string;
  blurb: string;
  endpoint: string;
  authPrefix: string;
  keyUrl: string;
  keySteps: string[];
  suggestedName: string;
};

const PRESETS: Preset[] = [
  {
    id: "openai",
    label: "OpenAI",
    blurb: "GPT-4o, GPT-4.1, o-series — the default LLM everyone starts with.",
    endpoint: "https://api.openai.com/v1/chat/completions",
    authPrefix: "Bearer ",
    keyUrl: "https://platform.openai.com/api-keys",
    keySteps: [
      "Open platform.openai.com/api-keys and sign in.",
      "Click Create new secret key, name it 'adversa', copy the sk-… value.",
      "Paste it below — we prepend 'Bearer ' for you.",
    ],
    suggestedName: "openai-gpt4",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    blurb: "One key, 200+ models (Claude, Llama, Gemini, Mistral…).",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authPrefix: "Bearer ",
    keyUrl: "https://openrouter.ai/keys",
    keySteps: [
      "Open openrouter.ai/keys and sign in.",
      "Click Create Key, copy the sk-or-… value.",
      "Paste it below — we prepend 'Bearer ' for you.",
    ],
    suggestedName: "openrouter-agent",
  },
  {
    id: "groq",
    label: "Groq",
    blurb: "Fast Llama / Mixtral inference. Free tier available.",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    authPrefix: "Bearer ",
    keyUrl: "https://console.groq.com/keys",
    keySteps: [
      "Open console.groq.com/keys and sign in.",
      "Click Create API Key, copy the gsk_… value.",
      "Paste it below — we prepend 'Bearer ' for you.",
    ],
    suggestedName: "groq-llama",
  },
  {
    id: "custom",
    label: "Custom / self-hosted",
    blurb: "Your own agent behind any URL that speaks OpenAI-style chat.",
    endpoint: "",
    authPrefix: "",
    keyUrl: "",
    keySteps: [
      "Deploy an endpoint that accepts POST { messages: [{ role, content }] }.",
      "Return { choices: [{ message: { content } }] } — the OpenAI shape.",
      "Add any auth header your service requires (or leave blank).",
    ],
    suggestedName: "my-agent",
  },
];

type Step = "path" | "provider" | "credentials" | "test" | "done";

function ConnectAgentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createAgent);

  const [step, setStep] = useState<Step>("path");
  const [preset, setPreset] = useState<Preset | null>(null);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [rawKey, setRawKey] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      create({ data: { name, endpoint, auth_header: authHeader || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      onClose();
    },
  });

  function choosePath(guided: boolean) {
    setStep(guided ? "provider" : "credentials");
  }

  function choosePreset(p: Preset) {
    setPreset(p);
    setEndpoint(p.endpoint);
    setName(p.suggestedName);
    setAuthHeader("");
    setRawKey("");
    setStep("credentials");
  }

  async function testConnection() {
    setTestStatus("testing");
    setTestMsg("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authHeader) headers["Authorization"] = authHeader;
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: preset?.id === "groq" ? "llama-3.1-8b-instant" : "gpt-4o-mini",
          messages: [{ role: "user", content: "Reply with the single word: ok" }],
        }),
      });
      if (!res.ok) {
        setTestStatus("fail");
        setTestMsg(`HTTP ${res.status} — ${await res.text().then((t) => t.slice(0, 160))}`);
        return;
      }
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content === "string") {
        setTestStatus("ok");
        setTestMsg(`Reply: "${content.slice(0, 80)}"`);
      } else {
        setTestStatus("fail");
        setTestMsg("Response shape is not OpenAI-compatible (no choices[0].message.content).");
      }
    } catch (e) {
      setTestStatus("fail");
      setTestMsg((e as Error).message);
    }
  }

  const canSave = name.trim() && endpoint.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl hairline border bg-surface-1 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b hairline flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">
              {step === "path" && "Setup"}
              {step === "provider" && "Step 1 of 3 · Provider"}
              {step === "credentials" && (preset ? "Step 2 of 3 · Credentials" : "Connect")}
              {step === "test" && "Step 3 of 3 · Verify"}
            </div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight">
              {step === "path" && "Connect an agent"}
              {step === "provider" && "Which model powers your agent?"}
              {step === "credentials" && (preset ? `Get your ${preset.label} key` : "Enter endpoint")}
              {step === "test" && "Test the connection"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-full hairline border text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {step === "path" && (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">
                An "agent" here is any HTTP endpoint that talks to an LLM. Adversa POSTs adversarial
                prompts to it and grades the replies.
              </p>
              <button
                onClick={() => choosePath(true)}
                className="w-full text-left rounded-xl hairline border p-4 hover:bg-surface-2 transition"
              >
                <div className="text-[14px] font-medium">Walk me through it</div>
                <div className="mt-1 text-[12.5px] text-muted-foreground">
                  Pick a provider, we'll show you exactly where to grab the API key.
                </div>
              </button>
              <button
                onClick={() => choosePath(false)}
                className="w-full text-left rounded-xl hairline border p-4 hover:bg-surface-2 transition"
              >
                <div className="text-[14px] font-medium">I already have an endpoint</div>
                <div className="mt-1 text-[12.5px] text-muted-foreground">
                  Skip ahead and paste your URL + auth header.
                </div>
              </button>
            </div>
          )}

          {step === "provider" && (
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => choosePreset(p)}
                  className="w-full text-left rounded-xl hairline border p-4 hover:bg-surface-2 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[14px] font-medium">{p.label}</div>
                    <span className="text-muted-foreground text-[13px]">›</span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-muted-foreground">{p.blurb}</div>
                </button>
              ))}
              <p className="pt-2 text-[11.5px] text-muted-foreground">
                Don't have an agent at all? Pick <span className="text-foreground">OpenAI</span> — the free tier
                is enough to try Adversa, and it takes 30 seconds to sign up.
              </p>
            </div>
          )}

          {step === "credentials" && (
            <div className="space-y-4">
              {preset && preset.keySteps.length > 0 && (
                <div className="rounded-xl hairline border p-4 bg-surface-2/40">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">
                    How to get your key
                  </div>
                  <ol className="mt-2 space-y-1.5 text-[12.5px] text-foreground/90 list-decimal list-inside">
                    {preset.keySteps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  {preset.keyUrl && (
                    <a
                      href={preset.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-accent hover:underline"
                    >
                      Open {new URL(preset.keyUrl).hostname} ↗
                    </a>
                  )}
                </div>
              )}

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

              {preset && preset.authPrefix ? (
                <Field label={`API key (we add "${preset.authPrefix.trim()}" for you)`}>
                  <input
                    value={rawKey}
                    onChange={(e) => {
                      setRawKey(e.target.value);
                      setAuthHeader(e.target.value ? `${preset.authPrefix}${e.target.value}` : "");
                    }}
                    placeholder="sk-…"
                    className="w-full h-10 rounded-lg hairline border bg-background px-3 text-[13.5px] outline-none focus:border-foreground/30 font-mono"
                  />
                </Field>
              ) : (
                <Field label="Auth header (optional)">
                  <input
                    value={authHeader}
                    onChange={(e) => setAuthHeader(e.target.value)}
                    placeholder="Bearer sk-…"
                    className="w-full h-10 rounded-lg hairline border bg-background px-3 text-[13.5px] outline-none focus:border-foreground/30 font-mono"
                  />
                </Field>
              )}

              <p className="text-[11.5px] text-muted-foreground">
                Your key is stored encrypted and only used to call your endpoint. It never leaves your workspace.
              </p>
            </div>
          )}

          {step === "test" && (
            <div className="space-y-4">
              <p className="text-[13px] text-muted-foreground">
                We'll send a single "reply with ok" probe to make sure your endpoint answers before running the full suite.
              </p>
              <div className="rounded-xl hairline border p-4 space-y-2 text-[12.5px]">
                <div className="flex gap-2"><span className="text-muted-foreground w-20">Endpoint</span><span className="font-mono truncate">{endpoint}</span></div>
                <div className="flex gap-2"><span className="text-muted-foreground w-20">Auth</span><span className="font-mono truncate">{authHeader ? authHeader.slice(0, 20) + "…" : "(none)"}</span></div>
              </div>
              <button
                onClick={testConnection}
                disabled={testStatus === "testing"}
                className="h-10 rounded-full hairline border px-4 text-[13px] hover:bg-surface-2 transition disabled:opacity-60"
              >
                {testStatus === "testing" ? "Testing…" : "Run test probe"}
              </button>
              {testStatus === "ok" && (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3 text-[12.5px] text-emerald-300">
                  ✓ Connection works. {testMsg}
                </div>
              )}
              {testStatus === "fail" && (
                <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-[12.5px] text-red-300">
                  ✕ {testMsg}
                  <div className="mt-1 text-muted-foreground">You can still save and debug later.</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t hairline flex items-center justify-between gap-2">
          <button
            onClick={() => {
              if (step === "provider") setStep("path");
              else if (step === "credentials") setStep(preset ? "provider" : "path");
              else if (step === "test") setStep("credentials");
              else onClose();
            }}
            className="h-9 rounded-full hairline border px-4 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
          >
            {step === "path" ? "Cancel" : "Back"}
          </button>

          <div className="flex items-center gap-2">
            {mut.isError && (
              <span className="text-[12px] text-red-400 mr-2">
                {(mut.error as Error)?.message ?? "Failed to save"}
              </span>
            )}
            {step === "credentials" && (
              <button
                onClick={() => setStep("test")}
                disabled={!canSave}
                className="h-9 rounded-full hairline border px-4 text-[12.5px] hover:bg-surface-2 transition disabled:opacity-40"
              >
                Test →
              </button>
            )}
            {(step === "credentials" || step === "test") && (
              <button
                onClick={() => mut.mutate()}
                disabled={!canSave || mut.isPending}
                className="h-9 rounded-full bg-foreground text-background px-5 text-[13px] font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                {mut.isPending ? "Saving…" : "Save agent"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[12px] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}


function RunDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const get = useServerFn(getRun);
  type RunDetail = { run: RunRow; traces: TraceRow[] };
  const { data, isLoading } = useQuery<RunDetail>({
    queryKey: ["run", id],
    queryFn: () => get({ data: { id } }) as Promise<RunDetail>,
    refetchInterval: (q) => (q.state.data?.run?.status === "complete" ? false : 3000),
  });

  const traces = data?.traces ?? [];
  const catStats: CatStat[] = (() => {
    const m = new Map<string, CatStat>();
    for (const t of traces) {
      const c = t.attacks?.category ?? "Uncategorized";
      const s = m.get(c) ?? { category: c, total: 0, pass: 0, fail: 0, err: 0 };
      s.total++;
      if (t.verdict === "pass") s.pass++;
      else if (t.verdict === "fail") s.fail++;
      else s.err++;
      m.set(c, s);
    }
    return Array.from(m.values()).sort((a, b) => b.fail - a.fail);
  })();

  const failures = traces.filter((t) => t.verdict === "fail");

  const exportReport = () => {
    if (!data) return;
    const report = {
      generated_at: new Date().toISOString(),
      run: data.run,
      summary: {
        pass_rate: data.run.total ? data.run.pass_count / data.run.total : 0,
        categories: catStats,
      },
      failures: failures.map((t) => ({
        attack: t.attacks?.name,
        category: t.attacks?.category,
        owasp_id: t.attacks?.owasp_id,
        severity: t.attacks?.severity,
        compliance_tags: t.attacks?.compliance_tags ?? [],
        judge_reasoning: t.judge_reasoning,
        response: t.response_text,
      })),
      traces,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adversa-report-${data.run.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-2xl hairline border bg-surface-1 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b hairline flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Red-team report</div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-tight">
              {data?.run ? new Date(data.run.started_at).toLocaleString() : "Loading…"}
            </h2>
            {data?.run && (
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                {data.run.pass_count}/{data.run.total} passed · {data.run.fail_count} failed · {data.run.error_count} error
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data?.run?.status === "complete" && (
              <Tip label="Download compliance-ready report (JSON) for auditors">
                <button
                  onClick={exportReport}
                  className="h-8 px-3 rounded-full hairline border text-[12px] text-foreground hover:bg-surface-2 transition"
                >
                  Export JSON
                </button>
              </Tip>
            )}
            <Tip label="Close report">
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full hairline border text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
                aria-label="Close"
              >
                ×
              </button>
            </Tip>
          </div>
        </div>

        {catStats.length > 0 && (
          <div className="px-5 pt-4 pb-2 border-b hairline">
            <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground/70 mb-2">
              Category breakdown
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {catStats.map((c) => {
                const rate = c.total ? c.pass / c.total : 0;
                const bar = Math.round(rate * 100);
                const tone = rate >= 0.9 ? "bg-emerald-400" : rate >= 0.6 ? "bg-amber-400" : "bg-red-400";
                return (
                  <Tip
                    key={c.category}
                    label={`${c.pass} pass · ${c.fail} fail · ${c.err} error out of ${c.total}`}
                  >
                    <div className="rounded-lg hairline border p-2.5 cursor-default">
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="truncate font-medium">{c.category}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {c.pass}/{c.total}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-surface-2 overflow-hidden">
                        <div className={`h-full ${tone}`} style={{ width: `${bar}%` }} />
                      </div>
                    </div>
                  </Tip>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-5 space-y-2">
          {isLoading && <div className="text-[13px] text-muted-foreground">Loading traces…</div>}
          {traces.map((t: TraceRow) => {
            const atk = t.attacks;
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
                      {atk?.owasp_id ? `${atk.owasp_id} · ` : ""}
                      {atk?.category} · {atk?.severity} · {t.latency_ms}ms
                    </div>
                  </div>
                  <span className="text-muted-foreground text-[11px] group-open:hidden">expand</span>
                </summary>
                <div className="mt-3 space-y-3 text-[12.5px]">
                  {atk?.compliance_tags && atk.compliance_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {atk.compliance_tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10.5px] px-2 py-0.5 rounded-full hairline border text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
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

function RunDiffModal({ base, head, onClose }: { base: string; head: string; onClose: () => void }) {
  const diff = useServerFn(diffRuns);
  type DiffRow = {
    attack_id: string;
    name: string;
    category: string;
    severity: string;
    owasp_id: string | null;
    base_verdict: string;
    head_verdict: string;
    change: "regressed" | "fixed" | "still_failing" | "still_passing" | "unchanged";
    head_reasoning: string | null;
  };
  type DiffData = {
    base: RunRow;
    head: RunRow;
    rows: DiffRow[];
    summary: { regressed: number; fixed: number; still_failing: number; still_passing: number };
  };
  const { data, isLoading, error } = useQuery<DiffData>({
    queryKey: ["diff", base, head],
    queryFn: () => diff({ data: { base_id: base, head_id: head } }) as Promise<DiffData>,
  });

  const order: Record<DiffRow["change"], number> = {
    regressed: 0,
    still_failing: 1,
    fixed: 2,
    still_passing: 3,
    unchanged: 4,
  };
  const rows = [...(data?.rows ?? [])].sort((a, b) => order[a.change] - order[b.change]);

  const changeTone: Record<DiffRow["change"], string> = {
    regressed: "text-red-400 bg-red-400/10 border-red-400/30",
    fixed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    still_failing: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    still_passing: "text-muted-foreground bg-muted-foreground/5 border-border",
    unchanged: "text-muted-foreground bg-muted-foreground/5 border-border",
  };

  const gateBlocked = (data?.summary.regressed ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-2xl hairline border bg-surface-1 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b hairline flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Regression diff</div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-tight">
              Baseline vs candidate
            </h2>
            {data && (
              <div className="mt-1 text-[12px] text-muted-foreground">
                base {new Date(data.base.started_at).toLocaleString()} → head{" "}
                {new Date(data.head.started_at).toLocaleString()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span
                className={`text-[10.5px] uppercase tracking-widest rounded-full px-2.5 py-1 hairline border ${
                  gateBlocked
                    ? "text-red-400 bg-red-400/10 border-red-400/30"
                    : "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
                }`}
              >
                {gateBlocked ? "gate: block" : "gate: pass"}
              </span>
            )}
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full hairline border text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
            >
              ×
            </button>
          </div>
        </div>

        {data && (
          <div className="px-5 py-4 border-b hairline grid grid-cols-2 md:grid-cols-4 gap-2">
            <DiffStat label="Regressed" value={data.summary.regressed} tone="text-red-400" />
            <DiffStat label="Fixed" value={data.summary.fixed} tone="text-emerald-400" />
            <DiffStat label="Still failing" value={data.summary.still_failing} tone="text-amber-400" />
            <DiffStat label="Still passing" value={data.summary.still_passing} tone="text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 overflow-auto p-5 space-y-2">
          {isLoading && <div className="text-[13px] text-muted-foreground">Loading diff…</div>}
          {error && (
            <div className="text-[13px] text-red-400">Failed to load diff: {(error as Error).message}</div>
          )}
          {rows.map((r) => (
            <div key={r.attack_id} className={`rounded-xl border p-3 ${changeTone[r.change]}`}>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-widest rounded-full px-2 py-1 bg-background/40">
                  {r.change.replace("_", " ")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate text-foreground">{r.name}</div>
                  <div className="text-[11px] opacity-80 truncate">
                    {r.owasp_id ? `${r.owasp_id} · ` : ""}
                    {r.category} · {r.severity}
                  </div>
                </div>
                <div className="text-[11px] tabular-nums text-foreground/80 whitespace-nowrap">
                  {r.base_verdict} → <span className="font-semibold">{r.head_verdict}</span>
                </div>
              </div>
              {r.change === "regressed" && r.head_reasoning && (
                <div className="mt-2 text-[12px] text-foreground/80 border-t border-white/5 pt-2">
                  {r.head_reasoning}
                </div>
              )}
            </div>
          ))}
          {!isLoading && rows.length === 0 && (
            <div className="text-[13px] text-muted-foreground">No overlapping attacks to compare.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl glass p-3">
      <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground/70">{label}</div>
      <div className={`mt-1 text-[22px] font-semibold tracking-tight tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
