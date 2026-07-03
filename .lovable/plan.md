
# Pivot: Sable → **Ward** — MCP & AI-Agent Supply-Chain Security

The whole app repositions around **the new attack surface nobody scans yet**: MCP servers, agent tool definitions, and AI/LLM manifests inside a repo. Same GitHub-PAT flow, new brains and new UI. No mock data.

## What Ward actually looks for (novel, defensible)

Each agent is a real static analyzer + LLM judge — not another OSV wrapper.

1. **MCP Server Scanner** — parses `mcp.json`, `.mcp/config.json`, `claude_desktop_config.json`, `cursor-mcp.json`, `.vscode/mcp.json`, `smithery.yaml`, `package.json` (`mcpServers`). For each server:
   - resolves the npm/PyPI package, checks age, download count, maintainer, install-scripts (typical crypto-drainer vector)
   - flags `stdio` servers pointing to arbitrary `npx`/`uvx` commands (RCE-on-connect)
   - flags URL servers over `http://`, missing auth, or wildcard scopes
2. **Tool-Poisoning Detector** — scans MCP tool `description` fields and agent tool definitions (LangChain, OpenAI Assistants, AI SDK `tool({...})`, Anthropic tool blocks) for:
   - hidden instructions (`<IMPORTANT>`, `\u200b` zero-widths, base64 blobs, "ignore previous")
   - data-exfiltration patterns (`send this to`, URL-encoded params in descriptions)
   - Uses an LLM judge (Gemini 3 Flash via Lovable AI) to classify intent + write a plain-English rationale
3. **Prompt-Injection in Committed Prompts** — walks `.prompts/`, `prompts/**/*.md`, `system.txt`, YAML `system:` keys, `SYSTEM_PROMPT` env defaults, LangChain `PromptTemplate` literals. Flags: role-override attempts, jailbreak strings, credential-echo patterns.
4. **Agent Framework Config Risk** — LangChain/LangGraph/CrewAI/Autogen/AI-SDK configs: unbounded `max_iterations`, tools without approval gates, shell/exec tools without allow-lists, `dangerously_allow_code_execution`, unrestricted browser tools.
5. **AI Dependency Risk** — SCA narrowed to the AI stack: `openai`, `anthropic`, `@modelcontextprotocol/*`, `langchain`, `mcp`, `smithery`, `fastmcp`, model-loading libs (`transformers`, `torch`, `pickle`-users). Cross-refs OSV + known malicious-package feeds.

Each finding gets an LLM judge verdict: `confirmed | likely | needs-review | false-positive` + reasoning + suggested fix.

## Positioning & naming

- **Name:** **Ward** — "ward off." Short, ownable, matches the security tone.
- **Tagline:** *"The first security scanner for MCP servers and AI agents."*
- **Landing pitch:** every dev is wiring MCP servers and agent tools into prod with zero review. Snyk doesn't scan this. GHAS doesn't scan this. Ward does.

## Scope of changes

### Backend (schema stays, semantics shift)
- Keep `github_connections`, `scans`, `findings` tables as-is (schema fits).
- Update `findings.agent` enum values in code: `mcp` | `tool-poison` | `prompt-injection` | `agent-config` | `ai-deps`.
- No migration needed — `agent` is `text`.

### Server functions (`src/lib/sable.functions.ts` → `src/lib/ward.functions.ts`)
- Replace the four Sable agents with the five Ward agents above.
- Real GitHub tree walk (already there), real file fetches, real OSV batch, real npm-registry metadata calls (age, maintainers, install scripts), real LLM judges via Lovable AI Gateway (`google/gemini-3-flash-preview`).
- PDF report keeps its structure but sections retitle to MCP/Agent findings, plus a new **"Attack Surface Map"** section listing every MCP server + tool discovered per repo.

### Frontend
- Rename product to **Ward** across `__root.tsx`, landing, auth, dashboard.
- New wordmark SVG (shield + severed link motif kept, tightened).
- Landing hero + interactive diagram rewritten around MCP/agent flow: `Repo → Discover MCP servers & tool defs → Static + LLM analysis → Judge → PDF`.
- Agent cards rewritten to the five agents.
- Dashboard scan console: agents list updated; per-finding rows show attack-surface context (which MCP server, which tool name).

### What I will NOT touch
- Auth, `_authenticated` layout, Supabase client wiring, migrations, DB schema.
- The pipeline diagram interactivity you liked — same UX, new labels/data.
- The realtime scan console you liked — same UX, new agent names.

## Files touched
- rename: `src/lib/sable.functions.ts` → `src/lib/ward.functions.ts` (rewritten agents)
- edit: `src/routes/index.tsx` (landing copy + diagram data)
- edit: `src/routes/app.tsx` (agent names, console labels, imports)
- edit: `src/routes/__root.tsx` (title/description/OG → Ward)
- edit: `src/routes/sign-in.tsx`, `src/routes/sign-up.tsx` (branding)

## Out of scope for this pass
- Building Ward's own MCP server, CI GitHub App, PR-blocking checks, SSO/RBAC. Those are the roadmap that makes it enterprise-sellable; this pass is the demo-worthy v1 that proves the wedge.

Approve and I'll ship it.
