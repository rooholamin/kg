/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
const rolesData = require('./data/roles');
const usersData = require('./data/users');
const permissionsData = require('./data/permissions');
const magazineContent = require('./data/magazine-content');
const kgContent = require('./data/kg-content');
const kgArticles = require('./data/kg-articles');
const projectProgress = require('./data/project-progress');
const kgSectionsContent = require('./data/kg-sections-content');

const prisma = new PrismaClient();

async function main() {
  console.log('Running database seeding...');

  await prisma.$transaction(
    async (tx) => {
      // Ensure the owner role exists
      const ownerRole = await tx.userRole.upsert({
        where: { slug: 'owner' },
        update: {}, // No updates needed, ensures idempotency
        create: {
          slug: 'owner',
          name: 'Owner',
          description: 'The default system role with full access.',
          isProtected: true,
          isDefault: false, // Optional: set to false if it's not the default role
        },
      });

      // Create the owner user
      const hashedPassword = await bcrypt.hash('12345', 10);
      const demoPassword = await bcrypt.hash('demo123', 10);

      await tx.user.upsert({
        where: { email: 'demo@kt.com' },
        update: {}, // No updates needed, ensures idempotency
        create: {
          email: 'demo@kt.com',
          name: 'Demo',
          password: demoPassword,
          roleId: ownerRole.id,
          avatar: null, // Optional: Add avatar URL if available
          emailVerifiedAt: new Date(), // Optional: Mark email as verified
          status: 'ACTIVE',
        },
      });

      const ownerUser = await tx.user.upsert({
        where: { email: 'owner@kt.com' },
        update: {}, // No updates needed, ensures idempotency
        create: {
          email: 'owner@kt.com',
          name: 'System Owner',
          password: hashedPassword,
          roleId: ownerRole.id,
          avatar: null, // Optional: Add avatar URL if available
          emailVerifiedAt: new Date(), // Optional: Mark email as verified
          status: 'ACTIVE',
        },
      });

      // Seed UserRoles
      await tx.userRole.upsert({
        where: { slug: 'member' },
        update: {}, // No updates needed, ensures idempotency
        create: {
          slug: 'member',
          name: 'Member',
          description: 'Default member role',
          isDefault: true,
          isProtected: true,
          createdAt: new Date(),
        },
      });

      // Seed Roles
      for (const role of rolesData) {
        await tx.userRole.upsert({
          where: { slug: role.slug },
          update: {},
          create: {
            slug: role.slug,
            name: role.name,
            description: role.description,
            isDefault: role.isDefault || false,
            isProtected: role.isProtected || false,
            createdAt: new Date(),
            createdByUserId: ownerUser.id,
          },
        });
      }
      console.log('Roles seeded.');

      // Seed Permissions
      for (const permission of permissionsData) {
        await tx.userPermission.upsert({
          where: { slug: permission.slug },
          update: {},
          create: {
            slug: permission.slug,
            name: permission.name,
            description: permission.description,
            createdAt: new Date(),
            createdByUserId: ownerUser.id,
          },
        });
      }
      console.log('Permissions seeded.');

      // Seed Role Permissions
      const seededRoles = await tx.userRole.findMany();
      const seededPermissions = await tx.userPermission.findMany();

      const userRolePermissionPromises = seededRoles.flatMap((role) => {
        // Generate a random number between 3 and 12 (inclusive)
        const numberOfPermissions =
          Math.floor(Math.random() * (12 - 3 + 1)) + 3;

        // Randomly shuffle the permissions array and select the required number
        const randomizedPermissions = seededPermissions
          .sort(() => Math.random() - 0.5)
          .slice(0, numberOfPermissions);

        // Create promises for each selected permission
        return randomizedPermissions.map((permission) =>
          tx.userRolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id,
              },
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: permission.id,
              assignedAt: new Date(),
            },
          }),
        );
      });

      await Promise.all(userRolePermissionPromises);
      console.log('UserRolePermissions seeded.');

      // Seed Users
      for (const user of usersData) {
        const role = await tx.userRole.findFirst({
          where: { slug: user.roleSlug },
        });
        await tx.user.upsert({
          where: { email: user.email },
          update: {},
          create: {
            email: user.email,
            name: user.name,
            password: hashedPassword,
            avatar: user.avatar ? '/media/avatars/' + user.avatar : null,
            roleId: role.id,
            emailVerifiedAt: new Date(),
            status: 'ACTIVE',
            createdAt: new Date(),
          },
        });
      }
      console.log('Users seeded.');

      // Fetch admin users with roles that are not marked as isDefault
      const users = await tx.user.findMany({
        where: {
          role: {
            isDefault: false, // Exclude default roles
          },
        },
        include: {
          role: true, // Include role details if needed
        },
      });

      // Seed AuditLogs
      const meaningfulVerbs = [
        'created',
        'updated',
        'deleted',
        'requested',
        'reset',
        'terminated',
        'fetched',
        'reviewed',
      ];

      const systemLogPromises = Array.from({ length: 20 }).map(() => {
        const entity = faker.helpers.arrayElement([
          { type: 'user', id: faker.helpers.arrayElement(users).id },
        ]);

        const event = faker.helpers.arrayElement([
          'CREATE',
          'UPDATE',
          'DELETE',
          'FETCH',
        ]);

        // Map meaningful verbs based on the event type
        const verbMap = {
          CREATE: ['created', 'added', 'initialized', 'generated'],
          UPDATE: ['updated', 'modified', 'changed', 'edited'],
          DELETE: ['deleted', 'removed', 'cleared', 'erased'],
          FETCH: ['fetched', 'retrieved', 'requested', 'accessed'],
        };

        const descriptionVerb = faker.helpers.arrayElement(
          verbMap[event] || meaningfulVerbs, // Fallback to the generic meaningfulVerbs
        );

        return tx.systemLog.create({
          data: {
            event,
            userId: faker.helpers.arrayElement(users).id,
            entityId: entity.id,
            entityType: entity.type,
            description: `${entity.type} was ${descriptionVerb}`,
            createdAt: new Date(),
            ipAddress: faker.internet.ipv4(),
          },
        });
      });

      await Promise.all(systemLogPromises);

      // Seed Settings
      await tx.systemSetting.create({
        data: {
          name: 'KGHub',
        },
      });
      console.log('Settings seeded.');

      // ── Sections ────────────────────────────────────────────────────────────
      const SEC_LIVING  = '10000000-0000-4000-8000-000000000001';
      const SEC_BUILD   = '10000000-0000-4000-8000-000000000002';
      const SEC_INVEST  = '10000000-0000-4000-8000-000000000003';
      const SEC_DATA    = '10000000-0000-4000-8000-000000000004';
      const SEC_DESIGN  = '10000000-0000-4000-8000-000000000005';
      const SEC_ECO     = '10000000-0000-4000-8000-000000000006';
      const SEC_DEVELOP = '10000000-0000-4000-8000-000000000007';

      const sections = [
        {
          id: SEC_LIVING,
          name: 'KG Living',
          slug: 'kg-living',
          description: 'Home care, lifestyle, and everyday living guides for homeowners and renters alike.',
          summary: 'Practical advice for maintaining, improving, and enjoying your home.',
          icon: 'Home',
          status: 'active',
          characterName: 'Lyra',
          characterBiography: 'Lyra is a seasoned home lifestyle expert with 15 years of hands-on experience in residential maintenance and interior wellness. She grew up in a family of contractors and translates complex home systems into approachable, actionable guides.',
          characterPersona: 'Warm, practical, and encouraging. Lyra speaks directly to homeowners with empathy and clarity — never condescending, always solution-focused. She believes every home has a story and every maintenance task is an investment in that story.',
          characterImage: '/media/characters/lyra.png',
        },
        {
          id: SEC_BUILD,
          name: 'KG Build',
          slug: 'kg-build',
          description: 'Construction, renovation, and skilled trades content for homeowners and professionals.',
          summary: 'From HVAC to plumbing and electrical — expert guidance on building systems.',
          icon: 'Hammer',
          status: 'active',
          characterName: 'Rex',
          characterBiography: 'Rex is a licensed general contractor with 20+ years of field experience across residential and commercial projects. He has led builds ranging from basement renovations to full new-construction homes and brings a no-nonsense, safety-first approach to every topic.',
          characterPersona: 'Authoritative, precise, and safety-conscious. Rex breaks down complex trade topics into clear, step-by-step guidance. He respects both the DIY homeowner and the seasoned professional, and he never skips the safety warnings.',
          characterImage: '/media/characters/rex.png',
        },
        {
          id: SEC_INVEST,
          name: 'KG Invest',
          slug: 'kg-invest',
          description: 'Real estate investment, personal finance, and wealth-building strategies.',
          summary: 'Smart investment decisions for homeowners, landlords, and first-time investors.',
          icon: 'TrendingUp',
          status: 'active',
          characterName: 'Vera',
          characterBiography: 'Vera is a certified financial planner and real estate investor who began her career at a top-tier investment bank before pivoting to help everyday people build wealth through property. She has personally managed a portfolio of 12 rental properties and coached hundreds of first-time investors.',
          characterPersona: 'Sharp, data-driven, and refreshingly candid. Vera cuts through financial jargon with clear numbers and real scenarios. She is optimistic but grounded — always balancing opportunity with honest risk assessment.',
          characterImage: '/media/characters/vera.png',
        },
        {
          id: SEC_DATA,
          name: 'KG Data',
          slug: 'kg-data',
          description: 'Technology, data, automation, and smart systems for modern living and working.',
          summary: 'Making sense of smart home tech, AI tools, and data-driven decisions.',
          icon: 'Database',
          status: 'active',
          characterName: 'Atlas',
          characterBiography: 'Atlas is a systems architect and tech educator who has spent a decade bridging the gap between enterprise technology and consumer applications. He has built smart home automation systems and written extensively about AI-assisted living.',
          characterPersona: 'Intellectually curious, methodical, and jargon-aware. Atlas assumes intelligence in his readers but never assumes prior technical knowledge. He loves a good analogy and believes the best tech is the kind you stop noticing.',
          characterImage: '/media/characters/atlas.png',
        },
        {
          id: SEC_DESIGN,
          name: 'KG Design',
          slug: 'kg-design',
          description: 'Interior design, architecture, aesthetics, and creative home transformation.',
          summary: 'Inspiring spaces through thoughtful design, style, and creative problem-solving.',
          icon: 'Palette',
          status: 'active',
          characterName: 'Nova',
          characterBiography: 'Nova is an interior architect and design educator with a background in sustainable residential design. She has collaborated with homeowners across North America to transform spaces with both beauty and function in mind.',
          characterPersona: 'Visionary, detail-oriented, and culturally aware. Nova has an eye for what makes a space feel alive and a talent for explaining design principles to non-designers. She celebrates individual taste while offering expert guidance.',
          characterImage: '/media/characters/nova.png',
        },
        {
          id: SEC_ECO,
          name: 'KG Eco',
          slug: 'kg-eco',
          description: 'Sustainability, green living, eco-friendly home upgrades, and environmental responsibility.',
          summary: 'Practical steps toward a lower-footprint, healthier, and more sustainable home life.',
          icon: 'Leaf',
          status: 'active',
          characterName: 'Sage',
          characterBiography: 'Sage is an environmental consultant and sustainable building advocate who has spent a decade helping homeowners reduce their carbon footprint. She holds certifications in LEED and passive house design and writes from direct field experience.',
          characterPersona: 'Grounded, principled, and motivating. Sage never guilt-trips — she meets readers where they are and celebrates every step toward sustainability. She brings scientific rigour without the lecture, and always makes green choices feel achievable.',
          characterImage: '/media/characters/sage.png',
        },
        {
          id: SEC_DEVELOP,
          name: 'KG Develop',
          slug: 'kg-develop',
          description: 'Software development, web technology, and digital tools for creators and professionals.',
          summary: 'Code, tools, and workflows for developers building in the modern web ecosystem.',
          icon: 'Code',
          status: 'active',
          characterName: 'Zane',
          characterBiography: 'Zane is a full-stack software engineer and open-source contributor who has built products used by millions of people. He has worked at both early-stage startups and large engineering organisations and now focuses on developer education and tooling.',
          characterPersona: 'Direct, opinionated, and collaborative. Zane writes for developers who want to ship great software efficiently. He is candid about tradeoffs, excited about emerging tools, and allergic to unnecessary complexity.',
          characterImage: '/media/characters/zane.png',
        },
      ];

      for (const s of sections) {
        await tx.section.upsert({
          where: { id: s.id },
          update: {
            name: s.name,
            slug: s.slug,
            description: s.description,
            summary: s.summary,
            icon: s.icon,
            status: s.status,
            characterName: s.characterName,
            characterBiography: s.characterBiography,
            characterPersona: s.characterPersona,
            characterImage: s.characterImage,
          },
          create: s,
        });
      }
      console.log('Sections (7 KG verticals) seeded.');

      // ── Clear all existing categories (cascades to topics and articles) ──────
      await tx.topic.deleteMany({});
      await tx.category.deleteMany({});
      console.log('Existing categories and topics cleared.');

      // ── Seed categories and topics from Excel ────────────────────────────────
      for (const c of kgSectionsContent.categories) {
        await tx.category.create({
          data: {
            id: c.id,
            name: c.name,
            status: c.status,
            sectionId: c.sectionId,
          },
        });
      }
      for (const t of kgSectionsContent.topics) {
        await tx.topic.create({
          data: {
            id: t.id,
            name: t.name,
            status: t.status,
            categoryId: t.categoryId,
          },
        });
      }
      console.log(
        'KG sections content seeded: ' + kgSectionsContent.categories.length + ' categories, ' + kgSectionsContent.topics.length + ' topics.',
      );

      for (const p of projectProgress.phases) {
        await tx.projectPhase.upsert({
          where: { id: p.id },
          update: {
            slug: p.slug,
            title: p.title,
            description: p.description,
            startDate: p.startDate,
            endDate: p.endDate,
            progressPercent: p.progressPercent,
            sortOrder: p.sortOrder,
          },
          create: p,
        });
      }
      for (const ws of projectProgress.workstreams) {
        await tx.projectWorkstream.upsert({
          where: { id: ws.id },
          update: {
            phaseId: ws.phaseId,
            name: ws.name,
            description: ws.description,
            status: ws.status,
            progressPercent: ws.progressPercent,
            sortOrder: ws.sortOrder,
          },
          create: ws,
        });
      }
      for (const ms of projectProgress.milestones) {
        await tx.projectMilestone.upsert({
          where: { id: ms.id },
          update: {
            workstreamId: ms.workstreamId,
            title: ms.title,
            description: ms.description,
            status: ms.status,
            type: ms.type,
            startDate: ms.startDate,
            endDate: ms.endDate,
            progressPercent: ms.progressPercent,
            sortOrder: ms.sortOrder,
          },
          create: ms,
        });
      }
      for (const bl of projectProgress.blockers) {
        await tx.projectBlocker.upsert({
          where: { id: bl.id },
          update: {
            milestoneId: bl.milestoneId,
            title: bl.title,
            description: bl.description,
            severity: bl.severity,
            status: bl.status,
            createdAt: bl.createdAt,
            resolvedAt: bl.resolvedAt,
          },
          create: bl,
        });
      }
      for (const report of projectProgress.reports) {
        await tx.projectProgressReport.upsert({
          where: { id: report.id },
          update: {
            title: report.title,
            summary: report.summary,
            buildProgress: report.buildProgress,
            automationProgress: report.automationProgress,
            keyFocus: report.keyFocus,
            blockersSummary: report.blockersSummary,
            createdAt: report.createdAt,
          },
          create: report,
        });
      }

      const workstreams = await tx.projectWorkstream.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          milestones: true,
        },
      });

      for (const ws of workstreams) {
        const total = ws.milestones.length || 1;
        const progressPercent = Math.round(
          ws.milestones.reduce((sum, m) => sum + m.progressPercent, 0) / total,
        );

        let status = 'not_started';
        if (ws.milestones.some((m) => m.status === 'blocked')) status = 'blocked';
        else if (
          ws.milestones.length > 0 &&
          ws.milestones.every((m) => m.status === 'completed')
        ) {
          status = 'completed';
        } else if (
          ws.milestones.some(
            (m) => m.status === 'in_progress' || m.status === 'completed',
          )
        ) {
          status = 'in_progress';
        }

        await tx.projectWorkstream.update({
          where: { id: ws.id },
          data: { progressPercent, status },
        });
      }

      const phases = await tx.projectPhase.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          workstreams: true,
        },
      });

      for (const phase of phases) {
        const total = phase.workstreams.length || 1;
        const progressPercent = Math.round(
          phase.workstreams.reduce((sum, ws) => sum + ws.progressPercent, 0) /
            total,
        );
        await tx.projectPhase.update({
          where: { id: phase.id },
          data: { progressPercent },
        });
      }

      console.log(
        'Project progress (phases, workstreams, milestones, blockers, reports) seeded.',
      );

      console.log('Database seeding completed!');
    },
    {
      timeout: 520000,
      maxWait: 520000,
    },
  );
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
