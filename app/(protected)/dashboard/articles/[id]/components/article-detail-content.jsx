'use client';

import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { ReadinessBadge } from '@/components/custom/readiness-badge';
import { PipelineStageBadge } from '@/components/custom/pipeline-stage-badge';
import { PIPELINE_STAGES } from '@/app/(protected)/dashboard/_mock';
import { ContentRenderer } from '@/components/custom/content-renderer';
import { cn, toYoutubeEmbedUrl } from '@/lib/utils';
import { Star } from 'lucide-react';

/**
 * 9 equal columns: circle and label in the same cell so text centers under the dot.
 * Connectors are left/right line halves inside each cell (no second flex row).
 */
function PipelineProgress({ stages, currentStage }) {
  const currentIndex = stages.findIndex((s) => s.id === currentStage);
  return (
    <div className="w-full">
      <div
        className="overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] pb-0.5"
        aria-label="Article pipeline progress"
      >
        <div className="mx-auto w-max min-w-full max-w-6xl px-0.5 sm:w-full sm:px-0">
          <div
            className="grid w-full min-w-[40rem] gap-0"
            style={{
              gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`,
            }}
            role="list"
          >
            {stages.map((stage, index) => {
              const isDone = currentIndex >= 0 && index < currentIndex;
              const isCurrent = currentIndex >= 0 && index === currentIndex;
              const isUpcoming = !isDone && !isCurrent;
              const rightLineDone =
                currentIndex >= 0 && index < stages.length - 1
                  ? index < currentIndex
                  : false;
              const leftLineDone =
                currentIndex >= 0 && index > 0
                  ? (index - 1) < currentIndex
                  : false;
              return (
                <div
                  key={stage.id}
                  className="relative min-w-0"
                  role="listitem"
                >
                  <div className="relative flex h-7 w-full min-w-0 items-center justify-center">
                    {index > 0 && (
                      <div
                        className={cn(
                          'absolute top-1/2 z-0 h-0.5 -translate-y-1/2 rounded-full',
                          'left-0 right-[calc(50%+0.875rem)]',
                          leftLineDone ? 'bg-primary' : 'bg-muted-foreground/20',
                        )}
                        aria-hidden
                      />
                    )}
                    {index < stages.length - 1 && (
                      <div
                        className={cn(
                          'absolute top-1/2 z-0 h-0.5 -translate-y-1/2 rounded-full',
                          'right-0 left-[calc(50%+0.875rem)]',
                          rightLineDone ? 'bg-primary' : 'bg-muted-foreground/20',
                        )}
                        aria-hidden
                      />
                    )}
                    <div
                      className={cn(
                        'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-sm',
                        isDone && 'border-primary bg-primary text-primary-foreground',
                        isCurrent &&
                          'border-primary bg-primary text-primary-foreground ring-4 ring-primary/25',
                        isUpcoming &&
                          'border-muted-foreground/35 bg-background text-muted-foreground',
                      )}
                      title={stage.label}
                    >
                      {isDone ? (
                        <svg
                          className="size-3.5"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M2 7l4 4 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        stage.order
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 min-w-0 px-0.5">
                    <span
                      className={cn(
                        'line-clamp-2 w-full min-h-10 text-balance',
                        'text-center text-[10px] font-medium leading-snug',
                        isCurrent && 'text-primary',
                        isDone && 'text-primary/90',
                        isUpcoming && 'text-muted-foreground',
                      )}
                      title={stage.label}
                    >
                      {stage.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(v) {
  if (!v) return '—';
  try {
    return format(
      typeof v === 'string' ? parseISO(v) : v instanceof Date ? v : parseISO(String(v)),
      'PP',
    );
  } catch {
    return '—';
  }
}

function formatDateTime(v) {
  if (!v) return '—';
  try {
    return format(
      typeof v === 'string' ? parseISO(v) : v instanceof Date ? v : parseISO(String(v)),
      'PPp',
    );
  } catch {
    return '—';
  }
}

function readinessForArticle(article) {
  const now = new Date();
  if (!article.readinessDeadline || !article.publishDate) return 'on_track';
  const pd =
    article.publishDate instanceof Date
      ? article.publishDate
      : parseISO(String(article.publishDate));
  const rd =
    article.readinessDeadline instanceof Date
      ? article.readinessDeadline
      : parseISO(String(article.readinessDeadline));
  if (Number.isNaN(pd.getTime()) || Number.isNaN(rd.getTime())) return 'on_track';
  if (now > pd && article.status !== 'post_publish' && article.status !== 'publishing') {
    return 'overdue';
  }
  if (now > rd && now <= pd) return 'at_risk';
  return 'on_track';
}

/**
 * @param {object} props
 * @param {object} props.article
 * @param {{ id: string; type: string; message: string; createdAt: Date | string }[]} props.activityLogs
 */
export function ArticleDetailContent({ article, activityLogs = [] }) {
  const current = article.status;
  const readiness = readinessForArticle(article);
  const embed = toYoutubeEmbedUrl(article.videoUrl);

  return (
    <Container>
      <div className="mb-5 rounded-xl border border-border/80 bg-muted/20 p-3 shadow-sm ring-1 ring-border/30 sm:p-4">
        <p className="mb-2.5 text-xs font-semibold tracking-wide text-foreground/70">
          Pipeline
        </p>
        <PipelineProgress
          stages={PIPELINE_STAGES}
          currentStage={current}
        />
      </div>

      <div className="relative mb-6 overflow-hidden rounded-xl border bg-muted/20">
        {article.featuredImage ? (
          <div className="relative aspect-[21/9] max-h-[320px] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.featuredImage}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <PipelineStageBadge stage={current} />
                <ReadinessBadge readiness={readiness} />
                {article.isEditorsChoice && (
                  <Badge variant="warning" appearance="light" className="gap-1">
                    <Star className="size-3.5" />
                    Editor’s choice
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground drop-shadow-sm">
                {article.title}
              </h1>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <PipelineStageBadge stage={current} />
              <ReadinessBadge readiness={readiness} />
              {article.isEditorsChoice && (
                <Badge variant="warning" appearance="light" className="gap-1">
                  <Star className="size-3.5" />
                  Editor’s choice
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{article.title}</h1>
          </div>
        )}
        <div className="flex flex-wrap gap-4 border-t bg-card/80 px-5 py-3 text-sm">
          <span>
            <span className="text-muted-foreground">Views</span>{' '}
            <span className="font-medium tabular-nums">{article.views ?? 0}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Likes</span>{' '}
            <span className="font-medium tabular-nums">{article.likes ?? 0}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Comments</span>{' '}
            <span className="font-medium tabular-nums">{article.commentsCount ?? 0}</span>
          </span>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {[
            ['overview', 'Overview'],
            ['content', 'Content'],
            ['pipeline', 'Pipeline'],
            ['social', 'Social'],
            ['seo', 'SEO'],
            ['activity', 'Activity'],
          ].map(([id, label]) => (
            <TabsTrigger key={id} value={id} className="text-xs sm:text-sm">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">
                {article.summary || 'No summary yet.'}
              </p>
            </CardContent>
          </Card>
          {embed ? (
            <Card>
              <CardHeader>
                <CardTitle>Video</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video max-w-3xl overflow-hidden rounded-md border bg-black">
                  <iframe
                    title="Article video"
                    src={embed}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          ) : article.videoUrl ? (
            <Card>
              <CardContent className="pt-6">
                <a
                  href={article.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline"
                >
                  Open video link
                </a>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Meta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Topic</span>
                <p>
                  <Link
                    className="text-primary hover:underline"
                    href={`/dashboard/topics/${article.topicId}`}
                  >
                    {article.topicName}
                  </Link>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Category</span>
                <p>
                  <Link
                    className="text-primary hover:underline"
                    href={`/dashboard/categories/${article.categoryId}`}
                  >
                    {article.categoryName}
                  </Link>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Publish</span>
                <p>{formatDate(article.publishDate)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Ready by</span>
                <p>{formatDate(article.readinessDeadline)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Target keyword</span>
                <p>
                  <code className="text-xs bg-muted px-1 rounded">
                    {article.targetKeyword || '—'}
                  </code>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">WordPress</span>
                <p className="text-muted-foreground">
                  {article.wordpressPostId != null
                    ? `WP #${article.wordpressPostId}`
                    : 'Not synced'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-4 space-y-4">
          <ContentRenderer content={article.content} />
          {article.galleryImages?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Gallery</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {article.galleryImages.map((url) => (
                    <div
                      key={url}
                      className="aspect-square overflow-hidden rounded-md border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>
                The horizontal progress bar at the top of the page shows all stages. Your
                current stage is always visible there.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Per-stage entry and exit times, blockers, and owner assignments are planned
                for Milestone 7 (activity & versions).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {['Instagram', 'X (Twitter)', 'YouTube', 'LinkedIn'].map((label) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription>Planned in Milestone 10</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Post-publish copy and status will be tracked here.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <MilestoneNote className="mt-4" milestone={10}>
            Full social output workflow activates in Milestone 10.
          </MilestoneNote>
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between max-w-sm">
                <span className="text-muted-foreground">Score</span>
                <span>
                  {article.seoScore != null ? article.seoScore : '—'}
                </span>
              </div>
              <div className="flex justify-between max-w-sm">
                <span className="text-muted-foreground">Internal links</span>
                <span>— (M10)</span>
              </div>
            </CardContent>
          </Card>
          <MilestoneNote className="mt-4" milestone={10}>
            Rule-based SEO checks and link suggestions in Milestone 10.
          </MilestoneNote>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Content activity</CardTitle>
              <CardDescription>
                Logged operations for this article (create, update, delete, pipeline events).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activityLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No log entries yet.</p>
              ) : (
                activityLogs.map((a) => (
                  <div key={a.id}>
                    <p className="text-sm font-medium text-foreground">{a.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.type} · {formatDateTime(a.createdAt)}
                    </p>
                    <Separator className="mt-3" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Container>
  );
}
