-- Video pipeline switched from custom-tool Higgsfield Developer API calls to
-- Higgsfield's hosted MCP server (mcp.higgsfield.ai) — this is what actually
-- unlocks Seedance 2.0 / Kling 3.0 / native audio generation. Adds the
-- Character Admin Agent (creates Reference Elements) and the vault reference
-- that authenticates every MCP session.
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "characterAdminAgentId" TEXT;
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "characterAdminEnvironmentId" TEXT;
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "higgsfieldVaultId" TEXT;
