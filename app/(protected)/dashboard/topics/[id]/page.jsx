import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/custom/page-header';
import { Button } from '@/components/ui/button';
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
import { getTopicById } from '@/services/topic.service';
import { TopicDetailActions } from '../components/topic-detail-actions';
import { PipelineStageBadge } from '@/components/custom/pipeline-stage-badge';
import { MilestoneNote } from '@/components/custom/milestone-note';

export const metadata = { title: 'Topic' };

function fmt(d) {
  if (!d) return '—';
  try {
    return format(d instanceof Date ? d : parseISO(String(d)), 'PP');
  } catch {
    return '—';
  }
}

export default async function TopicDetailPage({ params }) {
  const { id } = await params;
  const topic = await getTopicById(id);
  if (!topic) notFound();
  const articles = topic.articles;
  const articleCount = topic._count?.articles ?? articles.length;

  return (
    <>
      <PageHeader
        title={topic.name}
        description="Topic detail — keywords, articles, and links"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Topics', href: '/dashboard/topics' },
          { label: topic.name, href: `/dashboard/topics/${id}` },
        ]}
        actions={
          <TopicDetailActions
            topic={{
              id: topic.id,
              name: topic.name,
              description: topic.description,
              categoryId: topic.categoryId,
              targetKeyword: topic.targetKeyword,
              status: topic.status,
              articleCount,
            }}
          />
        }
      />
      <Container>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>{topic.description || '—'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Category</span>
                <Button variant="secondary" size="sm" asChild>
                  <Link
                    className="font-medium"
                    href={`/dashboard/categories/${topic.categoryId}`}
                  >
                    {topic.category.name}
                  </Link>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge
                  variant={topic.status === 'active' ? 'active' : 'archived'}
                >
                  {topic.status}
                </StatusBadge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Target keyword</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono text-foreground/90 mb-2">
                {topic.targetKeyword || '—'}
              </p>
              <p className="text-xs text-muted-foreground">Tags — Milestone 3+</p>
            </CardContent>
          </Card>
        </div>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Planned / active articles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Publish</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        className="text-primary font-medium hover:underline"
                        href={`/dashboard/articles/${a.id}`}
                      >
                        {a.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <PipelineStageBadge stage={a.status} />
                    </TableCell>
                    <TableCell>{fmt(a.publishDate)}</TableCell>
                  </TableRow>
                ))}
                {articles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-sm">
                      No articles for this topic yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Kingsgate / business links</CardTitle>
            <CardDescription>SEO opportunities to the main business site (M10)</CardDescription>
          </CardHeader>
          <CardContent>
            <MilestoneNote milestone={10} title="Kingsgate link opportunities">
              Rule-based suggestions in Milestone 10.
            </MilestoneNote>
          </CardContent>
        </Card>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Milestone 7</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Placeholder</p>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}
