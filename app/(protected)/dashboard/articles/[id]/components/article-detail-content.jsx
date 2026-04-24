'use client';

import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { ReadinessBadge } from '@/components/custom/readiness-badge';
import { PipelineStageBadge } from '@/components/custom/pipeline-stage-badge';
import { PIPELINE_STAGES, MOCK_ACTIVITY } from '@/app/(protected)/dashboard/_mock';
import { cn } from '@/lib/utils';
import { Activity, FileText, GitBranch, LineChart, Share2 } from 'lucide-react';

const tabIcons = {
  overview: FileText,
  brief: FileText,
  pipeline: GitBranch,
  versions: FileText,
  seo: LineChart,
  social: Share2,
  activity: Activity,
};

function PipelineProgress({ stages, currentStage }) {
  const currentIndex = stages.findIndex((s) => s.id === currentStage);

  return (
    <div className="w-full mb-6">
      <div className="flex items-center w-full">
        {stages.map((stage, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div key={stage.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 z-10',
                    'size-7 border-2',
                    isDone && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20',
                    isUpcoming && 'bg-background border-border text-muted-foreground',
                  )}
                >
                  {isDone ? (
                    <svg className="size-3.5" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    stage.order
                  )}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-[10px] leading-tight text-center truncate w-full px-0.5',
                    isCurrent && 'text-primary font-semibold',
                    isDone && 'text-primary/70',
                    isUpcoming && 'text-muted-foreground',
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {index < stages.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-0.5 mb-5 shrink-0',
                    index < currentIndex ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ArticleDetailContent({ article }) {
  const current = article.stage;
  return (
    <Container>
      <PipelineProgress stages={PIPELINE_STAGES} currentStage={current} />
      <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <PipelineStageBadge stage={article.stage} />
              <ReadinessBadge readiness={article.readiness} />
              {article.risk === 'high' && (
                <Badge variant="destructive" appearance="light">
                  Risk: high
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl leading-snug pt-1">{article.title}</CardTitle>
            <CardDescription>
              Topic:{' '}
              <Link
                className="text-primary hover:underline"
                href={`/dashboard/topics/${article.topicId}`}
              >
                {article.topicTitle}
              </Link>
              {' · '}
              <Link
                className="text-primary hover:underline"
                href={`/dashboard/categories/${article.categoryId}`}
              >
                {article.categoryName}
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meta</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Assignee</span>
              <div className="flex items-center gap-1.5">
                <Avatar className="size-6">
                  <AvatarFallback className="text-[10px]">
                    {article.assignee?.initials}
                  </AvatarFallback>
                </Avatar>
                {article.assignee?.name}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Publish</span>
              {article.publishDate}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ready by</span>
              {article.readinessDeadline}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target KW</span>
              <code className="text-xs bg-muted px-1 rounded">
                {article.targetKeyword}
              </code>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="mt-6 w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {[
            ['overview', 'Overview'],
            ['brief', 'Brief'],
            ['pipeline', 'Pipeline'],
            ['versions', 'Versions'],
            ['seo', 'SEO'],
            ['social', 'Social'],
            ['activity', 'Activity'],
          ].map(([id, label]) => (
            <TabsTrigger key={id} value={id} className="text-xs sm:text-sm">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                WordPress: <span className="text-muted-foreground">{article.wordpressStatus}</span>
              </p>
              <p>
                SEO score: <span className="text-muted-foreground">{article.seoScore}</span> (M4 data model)
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brief" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Editorial brief</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">
                {article.brief}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline timeline</CardTitle>
              <CardDescription>
                Bullet timeline — not a separate kanban page. Kanban board is Milestone 5 (tasks).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {PIPELINE_STAGES.map((s) => {
                  const isCurrent = s.id === current;
                  return (
                    <li
                      key={s.id}
                      className={cn(
                        'flex gap-3 text-sm',
                        isCurrent && 'font-medium',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          isCurrent
                            ? 'bg-primary'
                            : 'bg-border',
                        )}
                      />
                      <div>
                        <p className="text-foreground">
                          {s.label}
                          {isCurrent && (
                            <Badge variant="primary" size="sm" className="ms-2">
                              Current
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          TODO(M4): enter/exit timestamps, blockers, owner
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Versions & attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <MilestoneNote milestone={7}>
                Immutable version history in Milestone 7. AI attempts populate after
                Milestone 9.
              </MilestoneNote>
              <p className="text-sm text-muted-foreground mt-2">
                No saved versions in mock.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
              <CardDescription>Structural checks in Milestone 10</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between max-w-sm">
                <span className="text-muted-foreground">Score</span>
                <span>{article.seoScore}</span>
              </div>
              <div className="flex justify-between max-w-sm">
                <span className="text-muted-foreground">Internal links</span>
                <span>0 (M4+)</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {article.social?.map((s) => (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle className="text-base">{s.label}</CardTitle>
                  <CardDescription className="capitalize">{s.status?.replace('_', ' ')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{s.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <MilestoneNote className="mt-4" milestone={10}>
            Automated social generation in Milestone 10.
          </MilestoneNote>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {MOCK_ACTIVITY.filter((a) => a.entity === article.id || a.entity === '—')
                .slice(0, 4)
                .map((a) => (
                  <div key={a.id}>
                    <p className="text-sm font-medium text-foreground">{a.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.user} · {format(parseISO(a.at), 'PPp')}
                    </p>
                    <Separator className="mt-3" />
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Container>
  );
}
