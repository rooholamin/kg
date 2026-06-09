-- Replace KGHub demo roles with three editorial roles.
-- Uses ON CONFLICT to be idempotent — safe to run multiple times.

INSERT INTO "UserRole" (id, slug, name, description, "isProtected", "isDefault")
VALUES
  (gen_random_uuid(), 'superadmin', 'Super Admin', 'Full access to everything. Reserved for the platform owner.', true,  false),
  (gen_random_uuid(), 'admin',      'Admin',       'Can manage settings, sections, categories, topics, pipeline engines, and schedule articles.', true, false),
  (gen_random_uuid(), 'editor',     'Editor',      'Can view, edit, and approve or reject articles.', false, true)
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      "isProtected" = EXCLUDED."isProtected",
      "isDefault"   = EXCLUDED."isDefault";

-- Clear isDefault from any old roles so only editor is default
UPDATE "UserRole" SET "isDefault" = false
WHERE slug NOT IN ('superadmin', 'admin', 'editor') AND "isDefault" = true;
