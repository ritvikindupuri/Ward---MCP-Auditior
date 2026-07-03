-- Ward: enterprise policy engine + continuous scanning + compliance mapping

-- 1) Organization MCP policy (allow/deny lists + rule toggles) — one row per user for now
CREATE TABLE public.mcp_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  allowed_servers jsonb NOT NULL DEFAULT '[]'::jsonb,  -- string[] of approved MCP server package/URL identifiers
  denied_servers jsonb NOT NULL DEFAULT '[]'::jsonb,   -- string[] of blocked identifiers
  block_stdio_npx boolean NOT NULL DEFAULT true,       -- block npx/uvx stdio RCE-on-connect
  block_http_transport boolean NOT NULL DEFAULT true,  -- require https for URL servers
  require_pinned_versions boolean NOT NULL DEFAULT true,
  block_dangerous_code_exec boolean NOT NULL DEFAULT true,
  min_package_age_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_policies TO authenticated;
GRANT ALL ON public.mcp_policies TO service_role;

ALTER TABLE public.mcp_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own mcp policy" ON public.mcp_policies
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) Continuously watched repos (auto re-scan)
CREATE TABLE public.watched_repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  repo_full_name text NOT NULL,
  repo_url text NOT NULL,
  cadence_hours integer NOT NULL DEFAULT 24,
  last_scanned_at timestamptz,
  last_scan_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, repo_full_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watched_repos TO authenticated;
GRANT ALL ON public.watched_repos TO service_role;

ALTER TABLE public.watched_repos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own watched repos" ON public.watched_repos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Add compliance + policy metadata to findings (nullable, no data loss)
ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS owasp_llm text,          -- e.g. 'LLM01', 'LLM03'
  ADD COLUMN IF NOT EXISTS nist_ai_rmf text,        -- e.g. 'MAP-2.1', 'MEASURE-2.7'
  ADD COLUMN IF NOT EXISTS policy_violation text;   -- e.g. 'denied_server', 'stdio_npx_blocked'

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER touch_mcp_policies BEFORE UPDATE ON public.mcp_policies
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TRIGGER touch_watched_repos BEFORE UPDATE ON public.watched_repos
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();