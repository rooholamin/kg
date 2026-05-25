import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/custom/page-header';
import prisma from '@/lib/prisma';
import {
  getArticleById,
  getArticleContentLogs,
  getArticleVersions,
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
  const [activityLogs, versionRows] = await Promise.all([
    getArticleContentLogs(id),
    getArticleVersions(id),
  ]);

  const versionUserIds = [
    ...new Set(versionRows.map((v) => v.createdBy).filter(Boolean)),
  ];
  const activityUserIds = [
    ...new Set(activityLogs.map((l) => l.createdBy).filter(Boolean)),
  ];
  const allUserIds = [...new Set([...versionUserIds, ...activityUserIds])];
  let userLabelMap = {};
  if (allUserIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, name: true, email: true },
    });
    userLabelMap = Object.fromEntries(
      users.map((u) => [u.id, u.name?.trim() || u.email || u.id]),
    );
  }

  const versions = versionRows.map((v) => ({
    id: v.id,
    title: v.title,
    summary: v.summary,
    content: v.content,
    versionLabel: v.versionLabel,
    createdAt: v.createdAt,
    createdBy: v.createdBy,
    createdByLabel: v.createdBy ? userLabelMap[v.createdBy] ?? null : null,
  }));

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
        versions={versions}
        activityLogs={activityLogs.map((l) => ({
          id: l.id,
          type: l.type,
          action: l.action,
          message: l.message,
          createdAt: l.createdAt,
          createdBy: l.createdBy,
          userLabel: l.createdBy ? userLabelMap[l.createdBy] ?? null : null,
        }))}
      />
    </>
  );
}
