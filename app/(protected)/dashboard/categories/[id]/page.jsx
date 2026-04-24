import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/custom/page-header';
import { CategoryDetailActions } from '../components/category-detail-actions';
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
import { getCategoryById } from '@/services/category.service';
import { getArticles } from '@/services/article.service';
import { PipelineStageBadge } from '@/components/custom/pipeline-stage-badge';

export const metadata = {
  title: 'Category',
  description: 'Category detail and related content',
};

function fmt(d) {
  if (!d) return '—';
  try {
    return format(d instanceof Date ? d : parseISO(String(d)), 'PP');
  } catch {
    return '—';
  }
}

export default async function CategoryDetailPage({ params }) {
  const { id } = await params;
  const category = await getCategoryById(id);
  if (!category) notFound();

  const articles = await getArticles({ categoryId: id });
  const topics = category.topics;

  return (
    <>
      <PageHeader
        title={category.name}
        description={category.description ?? ''}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Categories', href: '/dashboard/categories' },
          { label: category.name, href: `/dashboard/categories/${id}` },
        ]}
        actions={
          <CategoryDetailActions
            category={{
              id: category.id,
              name: category.name,
              description: category.description,
              status: category.status,
              topicCount: category._count.topics,
              articleCount: category._count.articles,
            }}
          />
        }
      />
      <Container>
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Status and counts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge
                  variant={category.status === 'active' ? 'active' : 'archived'}
                >
                  {category.status}
                </StatusBadge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Topics</span>
                <span>{category._count.topics}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Articles</span>
                <span>{category._count.articles}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{fmt(category.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {category.description || '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Related topics</CardTitle>
              <CardDescription>Within this category</CardDescription>
            </CardHeader>
            <CardContent>
              {topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">No topics yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topics.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link
                            className="text-primary font-medium hover:underline"
                            href={`/dashboard/topics/${t.id}`}
                          >
                            {t.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={
                              t.status === 'active' ? 'active' : 'archived'
                            }
                          >
                            {t.status}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Related articles (preview)</CardTitle>
            </CardHeader>
            <CardContent>
              {articles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No articles</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Stage</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Per-entity feed — wire in Milestone 7</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No events yet (placeholder)</p>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}
