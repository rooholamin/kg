import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/custom/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getArticleById } from '@/services/article.service';
import { getArticleById as getMockArticle } from '@/app/(protected)/dashboard/_mock';
import { ArticleDetailContent } from './components/article-detail-content';

export const metadata = { title: 'Article' };

function buildViewModelFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    topicId: row.topicId,
    categoryId: row.categoryId,
    stage: row.status,
    topicTitle: row.topic.name,
    categoryName: row.category.name,
    publishDate: row.publishDate
      ? format(
          row.publishDate instanceof Date
            ? row.publishDate
            : parseISO(String(row.publishDate)),
          'PP',
        )
      : '—',
    readinessDeadline: row.readinessDeadline
      ? format(
          row.readinessDeadline instanceof Date
            ? row.readinessDeadline
            : parseISO(String(row.readinessDeadline)),
          'PP',
        )
      : '—',
    readiness: 'on_track',
    assignee: null,
    targetKeyword: '—',
    brief: 'No brief yet. Editorial briefs activate in Milestone 4.',
    risk: null,
    seoScore: row.seoScore != null ? String(row.seoScore) : '—',
    wordpressStatus:
      row.wordpressPostId != null
        ? `Synced as WP #${row.wordpressPostId}`
        : 'Not synced',
    social: [],
  };
}

export default async function ArticleDetailPage({ params }) {
  const { id } = await params;
  const row = await getArticleById(id);
  let article;

  if (row) {
    article = buildViewModelFromDb(row);
  } else {
    const mock = getMockArticle(id);
    if (!mock) notFound();
    article = mock;
  }

  return (
    <>
      <PageHeader
        title="Article"
        description={row ? 'Loaded from database' : 'Mock record (legacy id)'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Articles', href: '/dashboard/articles' },
          { label: article.title, href: `/dashboard/articles/${id}` },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/articles">Back to list</Link>
          </Button>
        }
      />
      <ArticleDetailContent article={article} />
    </>
  );
}
