import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/custom/status-badge';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { getTopicById, getArticlesByTopicId } from '@/app/(protected)/dashboard/_mock';

export const metadata = { title: 'Topic' };

export default async function TopicDetailPage({ params }) {
  const { id } = await params;
  const topic = getTopicById(id);
  if (!topic) notFound();
  const articles = getArticlesByTopicId(id);

  return (
    <>
      <PageHeader
        title={topic.title}
        description="Topic detail — keywords, articles, and links"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Topics', href: '/dashboard/topics' },
          { label: topic.title, href: `/dashboard/topics/${id}` },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/topics">Back</Link>
          </Button>
        }
      />
      <Container>
        <MilestoneNote milestone={3}>Topic edit/persist in Milestone 3</MilestoneNote>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>{topic.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Category</span>
                <Badge variant="secondary">{topic.categoryName}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge variant={topic.status === 'active' ? 'active' : 'draft'}>
                  {topic.status}
                </StatusBadge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Target keywords & tags</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono text-foreground/90 mb-2">
                {topic.targetKeyword}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topic.tags.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
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
                    <TableCell className="capitalize">{a.stage}</TableCell>
                    <TableCell>{a.publishDate}</TableCell>
                  </TableRow>
                ))}
                {articles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-sm">
                      None (mock)
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
