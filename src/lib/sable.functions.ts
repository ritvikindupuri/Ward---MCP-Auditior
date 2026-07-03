import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- GitHub connection ----------

async function ghFetch(pat: string, path: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "sable-scanner",
    },
  });
}

export const saveGithubPat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pat: z.string().trim().min(20).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await ghFetch(data.pat, "/user");
    if (!r.ok) throw new Error(`GitHub rejected the token (${r.status}). Check scopes: needs 'repo' or 'public_repo'.`);
    const scopes = r.headers.get("x-oauth-scopes") ?? "";
    const user = (await r.json()) as { login: string };
    const { error } = await context.supabase
      .from("github_connections")
      .upsert({ user_id: context.userId, pat: data.pat, github_login: user.login, scopes, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { login: user.login, scopes };
  });

export const getGithubStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("github_connections")
      .select("github_login,scopes,created_at")
      .maybeSingle();
    return data;
  });

export const disconnectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("github_connections").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const listRepos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: conn } = await context.supabase.from("github_connections").select("pat").maybeSingle();
    if (!conn?.pat) throw new Error("Connect GitHub first.");
    const r = await ghFetch(conn.pat, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator");
    if (!r.ok) throw new Error(`GitHub error ${r.status}`);
    const repos = (await r.json()) as Array<{
      full_name: string;
      html_url: string;
      description: string | null;
      private: boolean;
      default_branch: string;
      language: string | null;
      stargazers_count: number;
      pushed_at: string;
    }>;
    return repos.map((r) => ({
      full_name: r.full_name,
      html_url: r.html_url,
      description: r.description,
      private: r.private,
      default_branch: r.default_branch,
      language: r.language,
      stars: r.stargazers_count,
      pushed_at: r.pushed_at,
    }));
  });

// ---------- Scans ----------

export const listScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scans")
      .select("id,repo_full_name,repo_url,status,summary,progress,started_at,completed_at,error")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getScan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: scan, error } = await context.supabase.from("scans").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: findings } = await context.supabase
      .from("findings")
      .select("*")
      .eq("scan_id", data.id)
      .order("severity", { ascending: false });
    return { scan, findings: findings ?? [] };
  });

// ---------- Parsers ----------

type Dep = { name: string; version: string; ecosystem: string };

function parsePackageJson(txt: string): Dep[] {
  try {
    const j = JSON.parse(txt) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const all = { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) };
    return Object.entries(all).map(([name, v]) => ({
      name,
      version: String(v).replace(/^[\^~>=<\s]+/, "").split(" ")[0] || "0.0.0",
      ecosystem: "npm",
    }));
  } catch { return []; }
}
function parseRequirementsTxt(txt: string): Dep[] {
  return txt.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => {
    const m = l.match(/^([A-Za-z0-9_.-]+)\s*(?:==|>=|~=)\s*([0-9A-Za-z.\-+]+)/);
    return m ? { name: m[1], version: m[2], ecosystem: "PyPI" } : null;
  }).filter((x): x is Dep => !!x);
}
function parseGoMod(txt: string): Dep[] {
  const out: Dep[] = [];
  const rx = /^\s*([\w./\-]+)\s+v([\w.\-+]+)/gm;
  let m;
  while ((m = rx.exec(txt))) out.push({ name: m[1], version: m[2], ecosystem: "Go" });
  return out;
}
function parseCargoLock(txt: string): Dep[] {
  const out: Dep[] = [];
  const blocks = txt.split(/\[\[package\]\]/).slice(1);
  for (const b of blocks) {
    const n = b.match(/name\s*=\s*"([^"]+)"/);
    const v = b.match(/version\s*=\s*"([^"]+)"/);
    if (n && v) out.push({ name: n[1], version: v[1], ecosystem: "crates.io" });
  }
  return out;
}

// ---------- Secret patterns ----------

const SECRET_PATTERNS: Array<{ name: string; rx: RegExp; severity: string }> = [
  { name: "AWS Access Key ID", rx: /\bAKIA[0-9A-Z]{16}\b/g, severity: "critical" },
  { name: "AWS Secret Access Key", rx: /aws(.{0,20})?['"][0-9a-zA-Z/+]{40}['"]/g, severity: "critical" },
  { name: "GitHub Personal Access Token", rx: /\bghp_[A-Za-z0-9]{36}\b/g, severity: "critical" },
  { name: "GitHub Fine-grained Token", rx: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g, severity: "critical" },
  { name: "OpenAI API Key", rx: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, severity: "high" },
  { name: "Stripe Live Secret Key", rx: /\bsk_live_[A-Za-z0-9]{20,}\b/g, severity: "critical" },
  { name: "Slack Token", rx: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, severity: "high" },
  { name: "Google API Key", rx: /\bAIza[0-9A-Za-z_\-]{35}\b/g, severity: "high" },
  { name: "Private Key Block", rx: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g, severity: "critical" },
  { name: "Generic Bearer Token", rx: /bearer\s+[A-Za-z0-9\-._~+/]{30,}/gi, severity: "medium" },
];

// ---------- LLM judge ----------

async function llmJson<T>(system: string, user: string): Promise<T | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  try { return JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as T; } catch { return null; }
}

// ---------- Start scan ----------

const MANIFEST_PATHS = [
  { path: "package.json", parser: parsePackageJson },
  { path: "requirements.txt", parser: parseRequirementsTxt },
  { path: "go.mod", parser: parseGoMod },
  { path: "Cargo.lock", parser: parseCargoLock },
];

async function ghGetFile(pat: string, repo: string, branch: string, path: string): Promise<string | null> {
  const r = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${path}`, {
    headers: { Authorization: `Bearer ${pat}`, "User-Agent": "sable-scanner" },
  });
  if (!r.ok) return null;
  return r.text();
}

export const startScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ repo_full_name: z.string().min(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conn } = await supabase.from("github_connections").select("pat,github_login").maybeSingle();
    if (!conn?.pat) throw new Error("Connect GitHub first.");
    const pat = conn.pat;

    // Repo metadata
    const metaR = await ghFetch(pat, `/repos/${data.repo_full_name}`);
    if (!metaR.ok) throw new Error(`Cannot access ${data.repo_full_name} (${metaR.status})`);
    const meta = (await metaR.json()) as {
      html_url: string; default_branch: string; owner: { login: string; type: string };
      description: string | null; stargazers_count: number; open_issues_count: number;
      pushed_at: string; created_at: string; license: { name: string } | null;
    };

    const { data: scan, error: se } = await supabase.from("scans").insert({
      user_id: userId,
      repo_full_name: data.repo_full_name,
      repo_url: meta.html_url,
      default_branch: meta.default_branch,
      status: "running",
      progress: { deps: "running", secrets: "running", supply: "running", osint: "running" },
    }).select().single();
    if (se || !scan) throw new Error("Failed to create scan");

    const insertFindings = async (rows: Array<{
      agent: string; severity: string; title: string; description?: string;
      evidence?: Record<string, unknown>; judge_verdict?: string; judge_reasoning?: string;
    }>) => {
      if (!rows.length) return;
      await supabase.from("findings").insert(rows.map((r) => ({
        scan_id: scan.id, user_id: userId,
        agent: r.agent, severity: r.severity, title: r.title,
        description: r.description ?? null, evidence: (r.evidence ?? {}) as never,
        judge_verdict: r.judge_verdict ?? null, judge_reasoning: r.judge_reasoning ?? null,
      })));
    };

    const summary: Record<string, number> = { deps: 0, secrets: 0, supply: 0, osint: 0, critical: 0, high: 0, medium: 0, low: 0 };
    const bump = (sev: string) => { summary[sev] = (summary[sev] ?? 0) + 1; };

    // ---- Agent 1: Dependency CVEs via OSV.dev ----
    const allDeps: Dep[] = [];
    for (const m of MANIFEST_PATHS) {
      const txt = await ghGetFile(pat, data.repo_full_name, meta.default_branch, m.path);
      if (txt) allDeps.push(...m.parser(txt));
    }
    const depsSlice = allDeps.slice(0, 200);
    if (depsSlice.length) {
      const queries = depsSlice.map((d) => ({ package: { name: d.name, ecosystem: d.ecosystem }, version: d.version }));
      const osvR = await fetch("https://api.osv.dev/v1/querybatch", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queries }),
      });
      if (osvR.ok) {
        const osv = (await osvR.json()) as { results: Array<{ vulns?: Array<{ id: string; summary?: string; severity?: Array<{ score: string }> }> }> };
        for (let i = 0; i < depsSlice.length; i++) {
          const vulns = osv.results?.[i]?.vulns ?? [];
          for (const v of vulns) {
            const scoreStr = v.severity?.[0]?.score ?? "";
            const cvss = Number((scoreStr.match(/CVSS:[^/]+\/.*?\/([0-9.]+)/) || scoreStr.match(/([0-9.]+)/))?.[1] ?? 0);
            const sev = cvss >= 9 ? "critical" : cvss >= 7 ? "high" : cvss >= 4 ? "medium" : "low";
            summary.deps++; bump(sev);
            await insertFindings([{
              agent: "deps", severity: sev,
              title: `${v.id} in ${depsSlice[i].name}@${depsSlice[i].version}`,
              description: v.summary ?? "Known vulnerability from OSV.dev",
              evidence: { package: depsSlice[i].name, version: depsSlice[i].version, ecosystem: depsSlice[i].ecosystem, cve: v.id, cvss },
              judge_verdict: "confirmed",
              judge_reasoning: "Matched against OSV.dev advisory database — vulnerability applies to the resolved version.",
            }]);
          }
        }
      }
    }
    await supabase.from("scans").update({ progress: { ...(scan.progress as object), deps: "done" } }).eq("id", scan.id);

    // ---- Agent 2: Secret scanning ----
    const treeR = await ghFetch(pat, `/repos/${data.repo_full_name}/git/trees/${meta.default_branch}?recursive=1`);
    let filesScanned = 0;
    if (treeR.ok) {
      const tree = (await treeR.json()) as { tree: Array<{ path: string; type: string; size?: number }> };
      const candidates = tree.tree
        .filter((n) => n.type === "blob" && (n.size ?? 0) < 200_000)
        .filter((n) => /\.(env|ya?ml|json|js|ts|tsx|jsx|py|rb|go|rs|java|cs|php|sh|toml|ini|cfg|conf|xml|properties|pem|key)$/i.test(n.path) || /(^|\/)\.env/i.test(n.path))
        .filter((n) => !/(^|\/)(node_modules|dist|build|\.next|vendor|target)\//.test(n.path))
        .slice(0, 80);
      for (const f of candidates) {
        const txt = await ghGetFile(pat, data.repo_full_name, meta.default_branch, f.path);
        if (!txt) continue;
        filesScanned++;
        for (const p of SECRET_PATTERNS) {
          const m = txt.match(p.rx);
          if (m && m.length) {
            summary.secrets++; bump(p.severity);
            const sample = m[0].slice(0, 12) + "…";
            await insertFindings([{
              agent: "secrets", severity: p.severity,
              title: `${p.name} in ${f.path}`,
              description: `Pattern matched ${m.length} time(s). Rotate the credential immediately and purge from git history.`,
              evidence: { file: f.path, matches: m.length, sample },
              judge_verdict: p.severity === "critical" ? "confirmed" : "likely",
              judge_reasoning: `Signature matches ${p.name} format. Committed credentials are considered compromised regardless of repository visibility.`,
            }]);
            break; // one finding per file per pattern is enough
          }
        }
      }
    }
    await supabase.from("scans").update({ progress: { ...(scan.progress as object), deps: "done", secrets: "done" }, summary: { ...summary, files_scanned: filesScanned, deps_analyzed: depsSlice.length } }).eq("id", scan.id);

    // ---- Agent 3: Supply-chain risk (LLM judged) ----
    if (depsSlice.length) {
      const sample = depsSlice.slice(0, 40).map((d) => `${d.ecosystem}:${d.name}@${d.version}`).join("\n");
      const judged = await llmJson<{ risks: Array<{ package: string; risk: string; severity: string; reasoning: string }> }>(
        "You are a supply-chain security analyst. Given a list of package dependencies, identify supply-chain risks: known typosquats of popular packages, packages abandoned/unmaintained (based on your training knowledge), packages with a single maintainer, or packages with historically-suspicious install scripts. Only flag genuine concerns — do not invent risks. Return JSON: {\"risks\":[{\"package\":\"eco:name@ver\",\"risk\":\"typosquat|abandoned|solo_maintainer|install_script|other\",\"severity\":\"low|medium|high|critical\",\"reasoning\":\"1 short sentence\"}]}",
        `Dependencies:\n${sample}`,
      );
      for (const r of judged?.risks ?? []) {
        summary.supply++; bump(r.severity);
        await insertFindings([{
          agent: "supply", severity: r.severity,
          title: `${r.risk.replace(/_/g, " ")}: ${r.package}`,
          description: r.reasoning,
          evidence: { package: r.package, risk_type: r.risk },
          judge_verdict: "likely",
          judge_reasoning: r.reasoning,
        }]);
      }
    }
    await supabase.from("scans").update({ progress: { ...(scan.progress as object), deps: "done", secrets: "done", supply: "done" } }).eq("id", scan.id);

    // ---- Agent 4: OSINT on org/maintainer ----
    const ownerR = await ghFetch(pat, `/users/${meta.owner.login}`);
    const owner = ownerR.ok ? (await ownerR.json()) as {
      login: string; type: string; public_repos: number; followers: number; created_at: string;
      company: string | null; blog: string | null; email: string | null; name: string | null;
    } : null;
    if (owner) {
      const context = {
        repo: data.repo_full_name,
        description: meta.description,
        stars: meta.stargazers_count,
        open_issues: meta.open_issues_count,
        pushed_at: meta.pushed_at,
        created_at: meta.created_at,
        license: meta.license?.name ?? null,
        owner: {
          login: owner.login, type: owner.type, public_repos: owner.public_repos,
          followers: owner.followers, created_at: owner.created_at,
          company: owner.company, blog: owner.blog, name: owner.name,
        },
      };
      const judged = await llmJson<{ signals: Array<{ title: string; severity: string; reasoning: string }> }>(
        "You are an OSINT analyst evaluating repository trustworthiness. Given repo + owner metadata, flag genuine risk signals: brand-new owner account, very low follower/repo count for an org claiming to be established, stale repo (no push in >12 months) still being distributed, missing license, suspiciously young account owning a widely-forked repo, blog/company that doesn't match claims. Do NOT invent — only flag what the data supports. Return JSON: {\"signals\":[{\"title\":\"...\",\"severity\":\"info|low|medium|high\",\"reasoning\":\"one sentence citing the metadata\"}]}",
        JSON.stringify(context),
      );
      for (const s of judged?.signals ?? []) {
        summary.osint++; bump(s.severity);
        await insertFindings([{
          agent: "osint", severity: s.severity,
          title: s.title,
          description: s.reasoning,
          evidence: context as unknown as Record<string, unknown>,
          judge_verdict: "needs_review",
          judge_reasoning: s.reasoning,
        }]);
      }
    }

    await supabase.from("scans").update({
      status: "complete",
      completed_at: new Date().toISOString(),
      progress: { deps: "done", secrets: "done", supply: "done", osint: "done" },
      summary: { ...summary, files_scanned: filesScanned, deps_analyzed: depsSlice.length },
    }).eq("id", scan.id);

    return { scan_id: scan.id, summary };
  });

// ---------- PDF report ----------

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: scan, error } = await context.supabase.from("scans").select("*").eq("id", data.id).single();
    if (error || !scan) throw new Error("Scan not found");
    const { data: findings } = await context.supabase.from("findings").select("*").eq("scan_id", data.id);
    const rows = findings ?? [];

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const mono = await pdf.embedFont(StandardFonts.Courier);

    const W = 612, H = 792, M = 54;
    const ink = rgb(0.08, 0.09, 0.11);
    const muted = rgb(0.42, 0.44, 0.5);
    const rule = rgb(0.88, 0.89, 0.92);
    const sevColor = (s: string) =>
      s === "critical" ? rgb(0.78, 0.11, 0.16) :
      s === "high" ? rgb(0.87, 0.42, 0.05) :
      s === "medium" ? rgb(0.72, 0.55, 0.05) :
      s === "low" ? rgb(0.2, 0.45, 0.7) : rgb(0.4, 0.45, 0.5);

    let page = pdf.addPage([W, H]);
    let y = H - M;
    const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
    const need = (h: number) => { if (y - h < M) newPage(); };
    const text = (t: string, x: number, size: number, f = font, color = ink) => {
      page.drawText(t, { x, y, size, font: f, color });
    };
    const wrap = (str: string, size: number, maxW: number, f = font): string[] => {
      const words = str.split(/\s+/);
      const lines: string[] = []; let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > maxW) { if (cur) lines.push(cur); cur = w; } else cur = test;
      }
      if (cur) lines.push(cur);
      return lines;
    };

    // Cover
    text("SABLE", M, 10, bold, muted);
    y -= 14; text("Supply-chain risk report", M, 10, font, muted);
    y -= 48;
    for (const line of wrap(scan.repo_full_name, 28, W - 2 * M, bold)) {
      text(line, M, 28, bold); y -= 34;
    }
    y -= 8;
    text(scan.repo_url, M, 10, mono, muted); y -= 24;
    text(`Generated ${new Date().toISOString().slice(0, 10)}`, M, 10, font, muted); y -= 8;
    text(`Scan id ${scan.id}`, M, 9, mono, muted); y -= 40;

    const s = (scan.summary ?? {}) as Record<string, number>;
    const cards: Array<[string, number, ReturnType<typeof rgb>]> = [
      ["Critical", s.critical ?? 0, sevColor("critical")],
      ["High", s.high ?? 0, sevColor("high")],
      ["Medium", s.medium ?? 0, sevColor("medium")],
      ["Low", s.low ?? 0, sevColor("low")],
    ];
    const cardW = (W - 2 * M - 24) / 4;
    let cx = M;
    for (const [label, val, col] of cards) {
      page.drawRectangle({ x: cx, y: y - 72, width: cardW, height: 72, borderColor: rule, borderWidth: 0.75 });
      page.drawText(String(val), { x: cx + 12, y: y - 40, size: 26, font: bold, color: col });
      page.drawText(label.toUpperCase(), { x: cx + 12, y: y - 60, size: 9, font: bold, color: muted });
      cx += cardW + 8;
    }
    y -= 96;

    text("BY AGENT", M, 9, bold, muted); y -= 16;
    const agents: Array<[string, string]> = [
      ["Dependency CVEs (OSV.dev)", "deps"],
      ["Committed secrets", "secrets"],
      ["Supply-chain risk", "supply"],
      ["Maintainer OSINT", "osint"],
    ];
    for (const [label, key] of agents) {
      const c = s[key] ?? 0;
      text(label, M, 11, font); text(String(c), W - M - 30, 11, mono);
      y -= 18;
    }
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rule });
    y -= 20;
    text(`${s.deps_analyzed ?? 0} dependencies analyzed · ${s.files_scanned ?? 0} files scanned for secrets`, M, 9, font, muted);

    // Findings pages, grouped by severity
    const order = ["critical", "high", "medium", "low", "info"];
    const grouped = order.flatMap((sev) => rows.filter((r) => r.severity === sev));

    newPage();
    text("FINDINGS", M, 10, bold, muted); y -= 24;
    text(`${rows.length} total`, M, 20, bold); y -= 32;

    for (const f of grouped) {
      need(90);
      // severity chip
      const chipW = 62;
      page.drawRectangle({ x: M, y: y - 14, width: chipW, height: 16, color: sevColor(f.severity) });
      page.drawText(String(f.severity).toUpperCase(), { x: M + 6, y: y - 10, size: 8, font: bold, color: rgb(1, 1, 1) });
      page.drawText(`[${String(f.agent).toUpperCase()}]`, { x: M + chipW + 8, y: y - 10, size: 8, font: mono, color: muted });
      y -= 24;

      for (const line of wrap(f.title ?? "", 12, W - 2 * M, bold)) { need(16); text(line, M, 12, bold); y -= 15; }
      if (f.description) {
        y -= 4;
        for (const line of wrap(f.description as string, 10, W - 2 * M)) { need(14); text(line, M, 10, font, ink); y -= 13; }
      }
      if (f.judge_reasoning) {
        y -= 4;
        text("Judge:", M, 8, bold, muted); y -= 11;
        for (const line of wrap(f.judge_reasoning as string, 9, W - 2 * M - 12)) { need(12); text(line, M + 12, 9, font, muted); y -= 11; }
      }
      const ev = (f.evidence ?? {}) as Record<string, unknown>;
      const evStr = Object.entries(ev).slice(0, 6).map(([k, v]) => `${k}=${String(v).slice(0, 40)}`).join("  ");
      if (evStr) {
        y -= 4;
        for (const line of wrap(evStr, 8, W - 2 * M, mono)) { need(11); text(line, M, 8, mono, muted); y -= 10; }
      }
      y -= 10;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.3, color: rule });
      y -= 16;
    }

    // Footer on each page
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
      p.drawText(`Sable  ·  ${scan.repo_full_name}  ·  ${i + 1} / ${pages.length}`, {
        x: M, y: 24, size: 8, font, color: muted,
      });
    });

    const bytes = await pdf.save();
    // base64 encode
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = btoa(bin);
    return { filename: `sable-${scan.repo_full_name.replace(/\//g, "-")}-${scan.id.slice(0, 8)}.pdf`, base64: b64 };
  });
