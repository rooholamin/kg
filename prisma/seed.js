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
      // Ensure the superadmin role exists
      const ownerRole = await tx.userRole.upsert({
        where: { slug: 'superadmin' },
        update: { name: 'Super Admin' },
        create: {
          slug: 'superadmin',
          name: 'Super Admin',
          description: 'Full access to everything. Reserved for the platform owner.',
          isProtected: true,
          isDefault: false,
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
          characterName: 'Livia Moretti',
          characterBackground: 'Canadian',
          characterRole: 'Lifestyle, smart living, comfort, and wellness writer',
          characterAge: 'Early 30s',
          characterBiography: 'Livia Moretti grew up in a family that cared deeply about food, design, hosting, and home life. Her interest in housing started with the emotional side of spaces. She studied lifestyle media and interior environments, then built her voice around how people actually live inside beautiful homes.\n\nLivia is not overly technical. She cares about comfort, atmosphere, daily routines, wellness, and small choices that make a home feel better.',
          characterTone: 'Warm, polished, human, optimistic, lifestyle focused.',
          characterWritingStyle: 'Livia writes about smart home comfort, wellness spaces, home routines, luxury living trends, family friendly design, and the emotional and happiness value of better living spaces.',
          characterSampleVoice: 'A beautiful home should make daily life feel easier. The best living spaces are not just impressive to look at. They support your routines, your comfort, and the way you want to feel when you walk through the door.',
          characterPersona: 'Warm, polished, and human. Livia speaks to homeowners who care about comfort, atmosphere, and the way a home feels to live in. She is optimistic and lifestyle-focused — never overly technical, always emotionally resonant.',
          characterImage: null,
        },
        {
          id: SEC_BUILD,
          name: 'KG Build',
          slug: 'kg-build',
          description: 'Construction, renovation, and skilled trades content for homeowners and professionals.',
          summary: 'From HVAC to plumbing and electrical — expert guidance on building systems.',
          icon: 'Hammer',
          status: 'active',
          characterName: 'Joseph Bennett',
          characterBackground: 'White Canadian',
          characterRole: 'Construction, materials, building methods, and technological methods writer',
          characterAge: 'Mid 30s',
          characterBiography: 'Joseph Bennett comes from a family of tradespeople and project managers. He spent years around job sites, learning how buildings actually come together beyond the polished final photos. His writing style comes from experience, patience, and a respect for good workmanship.\n\nJoseph is the practical voice of KG Hub. He explains construction in a way that feels real and reliable. He is the person readers trust when they want to understand what is behind the walls.',
          characterTone: 'Direct, practical, grounded, clear, trustworthy.',
          characterWritingStyle: 'Joseph writes about construction systems, materials, build quality, timelines, cost factors, common mistakes, and new building technologies.',
          characterSampleVoice: 'A strong home starts long before construction begins. The planning, material choices, site coordination, and quality checks all matter. When those decisions are made properly, the final result is stronger, safer, and easier to maintain.',
          characterPersona: 'Direct, practical, and grounded. Joseph speaks to readers who want straight answers about how buildings actually come together. He is trustworthy, never overstates, and always respects the craft.',
          characterImage: null,
        },
        {
          id: SEC_INVEST,
          name: 'KG Invest',
          slug: 'kg-invest',
          description: 'Real estate investment, personal finance, and wealth-building strategies.',
          summary: 'Smart investment decisions for homeowners, landlords, and first-time investors.',
          icon: 'TrendingUp',
          status: 'active',
          characterName: 'Stephen Adler',
          characterBackground: 'Jewish Canadian',
          characterRole: 'Real estate investment, ROI, market opportunity, and financial strategy writer',
          characterAge: 'Late 20s',
          characterBiography: 'Stephen Adler grew up in a family where real estate was always part of the conversation. From an early age, he was exposed to property ownership, long term planning, negotiation, and the importance of location. His investment interest came from watching how the right property decisions could shape family wealth, business growth, and generational opportunity.\n\nAfter studying finance and real estate economics, Stephen developed a sharp eye for market movement, emerging neighbourhoods, rental demand, and long term value. He brings a polished, strategic perspective to KG Invest, helping readers understand real estate not just as property, but as a decision shaped by timing, risk, data, and opportunity.',
          characterTone: 'Professional, concise, premium, insightful, results focused.',
          characterWritingStyle: 'Stephen writes market outlooks, investment trend articles, ROI explainers, rental market analysis, property opportunity pieces, and real estate finance content. His writing should feel like a high level briefing from someone who understands both numbers and negotiation.',
          characterSampleVoice: 'The strongest real estate opportunities are rarely found by looking at price alone. They come from understanding demand, timing, location strength, rental movement, and the long term direction of the market.',
          characterPersona: 'Strategic, confident, sharp, ambitious, polished, and analytical. Stephen writes with authority and precision, bringing a high-level investment perspective to every piece.',
          characterImage: null,
        },
        {
          id: SEC_DATA,
          name: 'KG Data',
          slug: 'kg-data',
          description: 'Technology, data, automation, and smart systems for modern living and working.',
          summary: 'Making sense of smart home tech, AI tools, and data-driven decisions.',
          icon: 'Database',
          status: 'active',
          characterName: 'Elara Waller',
          characterBackground: 'German and Korean Canadian',
          characterRole: 'Data, analytics, AI, and property intelligence writer',
          characterAge: 'Early 30s',
          characterBiography: 'Elara Waller grew up between two cultures that valued precision, education, and discipline. Her academic path moved through data science, urban research, and property technology. She became fascinated by how numbers can reveal patterns in housing that people often miss.\n\nElara is the most analytical voice in KG Hub, but she should still feel human. She explains data with confidence, not coldness.',
          characterTone: 'Precise, modern, intelligent, efficient, curious.',
          characterWritingStyle: 'Elara writes about property analytics, AI in real estate, market signals, forecasting, data tools, smart dashboards, and the intelligence layer behind housing decisions.',
          characterSampleVoice: 'Data does not remove judgment from housing decisions. It improves judgment. When the right signals are organized clearly, buyers, builders, investors, and developers can see patterns that are easy to miss on instinct alone.',
          characterPersona: 'Precise, modern, and intelligent. Elara explains data with confidence and clarity, making complex signals accessible without losing depth. She is efficient and curious — analytical but never cold.',
          characterImage: null,
        },
        {
          id: SEC_DESIGN,
          name: 'KG Design',
          slug: 'kg-design',
          description: 'Interior design, architecture, aesthetics, and creative home transformation.',
          summary: 'Inspiring spaces through thoughtful design, style, and creative problem-solving.',
          icon: 'Palette',
          status: 'active',
          characterName: 'Selene Salma',
          characterBackground: 'French and Lebanese',
          characterRole: 'Architecture, interiors, luxury aesthetics, and design innovation writer',
          characterAge: 'Late 20s',
          characterBiography: 'Selene Salma was raised between two strong design cultures. Her eye for interiors came from French elegance and Lebanese attention to detail, pattern, texture, and atmosphere. She studied architecture and editorial design, then built her voice around the emotional and visual power of space.\n\nSelene should feel sophisticated, graceful, and artistic. She is the writer who makes KG Hub feel beautiful.',
          characterTone: 'Elegant, refined, descriptive, artistic, tasteful.',
          characterWritingStyle: 'Selene writes about luxury interiors, architectural trends, materials, space planning, visual identity, design innovation, and timeless aesthetics.',
          characterSampleVoice: 'Great design is not only about what fills a room. It is about proportion, light, texture, and restraint. The most memorable spaces often speak quietly, but with complete confidence.',
          characterPersona: 'Elegant, refined, and artistic. Selene brings a sophisticated eye to every piece, drawing on French elegance and Lebanese attention to detail. She makes design feel both aspirational and accessible.',
          characterImage: null,
        },
        {
          id: SEC_ECO,
          name: 'KG Eco',
          slug: 'kg-eco',
          description: 'Sustainability, green living, eco-friendly home upgrades, and environmental responsibility.',
          summary: 'Practical steps toward a lower-footprint, healthier, and more sustainable home life.',
          icon: 'Leaf',
          status: 'active',
          characterName: 'Eden Chen',
          characterBackground: 'Chinese Canadian',
          characterRole: 'Sustainability, green building, energy efficiency, and clean technology writer',
          characterAge: 'Early 30s',
          characterBiography: 'Eden Chen grew up in Vancouver, surrounded by nature, urban density, and conversations about climate conscious living. Her mother worked in environmental research and her father worked in residential development, which gave her a balanced view of both sustainability and practicality.\n\nEden should feel calm, thoughtful, and deeply credible. She is not preachy. She believes sustainability should be practical, elegant, and built into everyday housing decisions.',
          characterTone: 'Balanced, reassuring, intelligent, calm, purpose driven.',
          characterWritingStyle: 'Eden writes about green building, energy efficiency, sustainable materials, clean technology, low impact housing, ESG ideas, and smarter long term building choices.',
          characterSampleVoice: 'Sustainability works best when it feels practical. Better materials, efficient systems, smarter energy use, and thoughtful planning can improve a home\'s performance without compromising comfort or design.',
          characterPersona: 'Balanced, calm, and deeply credible. Eden is not preachy — she meets readers where they are and makes sustainable choices feel achievable and practical. She brings purpose without pressure.',
          characterImage: null,
        },
        {
          id: SEC_DEVELOP,
          name: 'KG Develop',
          slug: 'kg-develop',
          description: 'Land development, urban growth, project strategy, and large scale housing vision.',
          summary: 'Big picture thinking on urban development, land planning, and housing supply.',
          icon: 'Building2',
          status: 'active',
          characterName: 'Michael Moreno',
          characterBackground: 'Spanish Canadian',
          characterRole: 'Land development, urban growth, project strategy, and large scale housing vision writer',
          characterAge: 'Early 40s',
          characterBiography: 'Michael Moreno grew up watching Toronto expand, intensify, and struggle with housing demand. His interest in development came from seeing how land decisions affect real people, communities, infrastructure, and opportunity. He built his career around urban strategy, growth planning, and development feasibility.\n\nMichael is the big picture voice. He should sound like someone who understands cities, policy, land value, and long term vision.',
          characterTone: 'Executive, grounded, strategic, visionary, authoritative.',
          characterWritingStyle: 'Michael writes about land development, urban planning, housing supply, infrastructure, city growth, project feasibility, and long term development strategy.',
          characterSampleVoice: 'Development is never just about land. It is about timing, access, infrastructure, policy, demand, and the future identity of a community. Strong projects are built from that wider understanding.',
          characterPersona: 'Executive, strategic, and visionary. Michael speaks with authority on urban development, land value, and city growth. He is grounded and credible — someone who understands the full complexity of large-scale housing decisions.',
          characterImage: null,
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
            characterBackground: s.characterBackground,
            characterRole: s.characterRole,
            characterAge: s.characterAge,
            characterBiography: s.characterBiography,
            characterTone: s.characterTone,
            characterWritingStyle: s.characterWritingStyle,
            characterSampleVoice: s.characterSampleVoice,
            characterPersona: s.characterPersona,
            // Do not overwrite characterImage — let users manage it via upload
          },
          create: s,
        });
      }
      console.log('Sections (7 KG verticals) seeded.');

      // ── Upsert categories and topics (preserves existing articles) ───────────
      for (const c of kgSectionsContent.categories) {
        await tx.category.upsert({
          where: { id: c.id },
          update: {
            name: c.name,
            status: c.status,
            sectionId: c.sectionId,
          },
          create: {
            id: c.id,
            name: c.name,
            status: c.status,
            sectionId: c.sectionId,
          },
        });
      }
      for (const t of kgSectionsContent.topics) {
        await tx.topic.upsert({
          where: { id: t.id },
          update: {
            name: t.name,
            status: t.status,
            categoryId: t.categoryId,
          },
          create: {
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
