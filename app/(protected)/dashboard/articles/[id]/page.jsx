import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/custom/page-header';
import {
  getArticleById,
  getArticleContentLogs,
} from '@/services/article.service';
import { ArticleDetailContent } from './components/article-detail-content';
import { ArticleDetailActions } from '../components/article-detail-actions';

export const metadata = { title: 'Article' };

function toArticleView(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    topicId: row.topicId,
    categoryId: row.categoryId,
    status: row.status,
    topicName: row.topic.name,
    categoryName: row.category.name,
    targetKeyword: row.topic.targetKeyword,
    publishDate: row.publishDate,
    readinessDeadline: row.readinessDeadline,
    seoScore: row.seoScore,
    wordpressPostId: row.wordpressPostId,
    featuredImage: row.featuredImage,
    galleryImages: row.galleryImages,
    videoUrl: row.videoUrl,
    isEditorsChoice: row.isEditorsChoice,
    views: row.views,
    likes: row.likes,
    commentsCount: row.commentsCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export default async function ArticleDetailPage({ params }) {
  const { id } = await params;
  const row = await getArticleById(id);
  if (!row) notFound();

  const article = toArticleView(row);
  const activityLogs = await getArticleContentLogs(id);

  return (
    <>
      <PageHeader
        title="Article"
        description="Readiness, content, and pipeline in one place."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Articles', href: '/dashboard/articles' },
          { label: article.title, href: `/dashboard/articles/${id}` },
        ]}
        actions={<ArticleDetailActions article={article} />}
      />
      <ArticleDetailContent
        article={article}
        activityLogs={activityLogs.map((l) => ({
          id: l.id,
          type: l.type,
          message: l.message,
          createdAt: l.createdAt,
        }))}
      />
    </>
  );
}
