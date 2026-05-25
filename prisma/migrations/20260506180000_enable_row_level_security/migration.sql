-- Enable Row-Level Security on all Prisma-managed tables in `public`.
--
-- Context: Supabase exposes tables via PostgREST using the `anon` / `authenticated`
-- roles. Without RLS, those APIs allow broad access. This app uses Prisma from the
-- server only; the DB owner connection Supabase uses for migrations/pooling bypasses
-- RLS, so existing server-side queries keep working while the Data API is denied by
-- default (no permissive policies for anon/authenticated).

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemSetting" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Topic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArticleVersion" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "AIAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Approval" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ProjectPhase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectWorkstream" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMilestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectBlocker" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectProgressReport" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "IdeaBacklog" ENABLE ROW LEVEL SECURITY;
