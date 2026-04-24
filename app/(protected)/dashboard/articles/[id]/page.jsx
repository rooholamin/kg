import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/custom/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getArticleById } from '@/app/(protected)/dashboard/_mock';
import { ArticleDetailContent } from './components/article-detail-content';

export const metadata = { title: 'Article' };

export default async function ArticleDetailPage({ params }) {
  const { id } = await params;
  const article = getArticleById(id);
  if (!article) notFound();

  return (
    <>
      <PageHeader
        title="Article"
        description="Full record — static in Milestone 1"
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
