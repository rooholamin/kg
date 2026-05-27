import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/custom/page-header';
import { SectionDetailActions } from '../components/section-detail-actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/custom/status-badge';
import { Container } from '@/components/common/container';
import { getSectionById } from '@/services/section.service';
import { getEntityLogs } from '@/services/content-log.service';

export const metadata = {
  title: 'Section',
  description: 'Section detail and related categories',
};

function CharacterField({ label, value, multiline = false }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      {multiline ? (
        <p className="text-foreground/90 leading-relaxed whitespace-pre-line">{value}</p>
      ) : (
        <p className="text-foreground/90">{value}</p>
      )}
    </div>
  );
}

function fmt(d) {
  if (!d) return '—';
  try {
    return format(d instanceof Date ? d : parseISO(String(d)), 'PP');
  } catch {
    return '—';
  }
}

export default async function SectionDetailPage({ params }) {
  const { id } = await params;
  const section = await getSectionById(id);
  if (!section) notFound();

  const logs = await getEntityLogs('section', id);

  return (
    <>
      <PageHeader
        title={section.name}
        description={section.summary ?? section.description ?? ''}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Sections', href: '/dashboard/sections' },
          { label: section.name, href: `/dashboard/sections/${id}` },
        ]}
        actions={
          <SectionDetailActions
            section={{
              id: section.id,
              name: section.name,
              slug: section.slug,
              description: section.description,
              summary: section.summary,
              icon: section.icon,
              status: section.status,
              characterName: section.characterName,
              characterBackground: section.characterBackground,
              characterRole: section.characterRole,
              characterAge: section.characterAge,
              characterBiography: section.characterBiography,
              characterTone: section.characterTone,
              characterWritingStyle: section.characterWritingStyle,
              characterSampleVoice: section.characterSampleVoice,
              characterPersona: section.characterPersona,
              characterImage: section.characterImage,
              categoryCount: section._count.categories,
            }}
          />
        }
      />
      <Container>
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Status and counts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slug</span>
                <span className="font-mono text-xs">{section.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Icon</span>
                <span>{section.icon ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge
                  variant={section.status === 'active' ? 'active' : 'archived'}
                >
                  {section.status}
                </StatusBadge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categories</span>
                <span>{section._count.categories}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{fmt(section.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Description / Summary */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.summary && (
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {section.summary}
                </p>
              )}
              <p className="text-sm text-foreground/80 leading-relaxed">
                {section.description || '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Character Profile */}
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Character Profile</CardTitle>
            <CardDescription>
              The persona representing this section
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 sm:flex-row">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {section.characterImage ? (
                  <Image
                    src={section.characterImage}
                    alt={section.characterName ?? 'Character'}
                    width={96}
                    height={96}
                    className="size-24 rounded-xl object-cover bg-muted"
                    unoptimized
                  />
                ) : (
                  <div className="size-24 rounded-xl bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground">
                    {section.characterName ? section.characterName[0] : '?'}
                  </div>
                )}
              </div>

              {/* Fields */}
              <div className="flex-1 space-y-4 text-sm">
                {/* Name / Background / Role / Age row */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <CharacterField label="Name" value={section.characterName} />
                  <CharacterField label="Background" value={section.characterBackground} />
                  <CharacterField label="Role" value={section.characterRole} />
                  <CharacterField label="Age" value={section.characterAge} />
                </div>

                <CharacterField label="Biography" value={section.characterBiography} multiline />
                <CharacterField label="Tone" value={section.characterTone} />
                <CharacterField label="Writing style" value={section.characterWritingStyle} multiline />

                {section.characterSampleVoice && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Sample voice
                    </p>
                    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-foreground/80 leading-relaxed">
                      &ldquo;{section.characterSampleVoice}&rdquo;
                    </blockquote>
                  </div>
                )}

                <CharacterField label="Persona (AI prompt)" value={section.characterPersona} multiline />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Related Categories */}
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Related Categories</CardTitle>
            <CardDescription>
              Categories belonging to this section
            </CardDescription>
          </CardHeader>
          <CardContent>
            {section.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Topics</TableHead>
                    <TableHead>Articles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          className="text-primary font-medium hover:underline"
                          href={`/dashboard/categories/${c.id}`}
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          variant={
                            c.status === 'active' ? 'active' : 'archived'
                          }
                        >
                          {c.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{c._count.topics}</TableCell>
                      <TableCell>{c._count.articles}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Recent changes to this section</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-start gap-3 text-sm border-b pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">
                      {fmt(log.createdAt)}
                    </span>
                    <span className="text-foreground/90">{log.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Container>
    </>
  );
}
