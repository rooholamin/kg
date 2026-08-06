import Link from 'next/link';
import { PageHeader } from '@/components/custom/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import {
  getSeoDashboardStats,
  getSeoArticlesPage,
  getRecentSeoRuns,
  getRecentLinkingBatchRuns,
} from '@/services/seo.service';

export const metadata = { title: 'SEO & internal linking' };

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SeoStatusBadge({ optimized }) {
  return optimized ? (
    <Badge variant="success" size="sm" appearance="light">
      Optimized
    </Badge>
  ) : (
    <Badge variant="secondary" size="sm" appearance="light">
      Pending
    </Badge>
  );
}

function RunStatusBadge({ status }) {
  if (status === 'completed') {
    return <Badge variant="success" size="sm" appearance="light">Completed</Badge>;
  }
  if (status === 'failed') {
    return <Badge variant="destructive" size="sm" appearance="light">Failed</Badge>;
  }
  return <Badge variant="warning" size="sm" appearance="light">Running</Badge>;
}

export default async function SeoPage() {
  const [stats, articlesPage, recentSeoRuns, recentLinkingRuns] = await Promise.all([
    getSeoDashboardStats(),
    getSeoArticlesPage({ page: 1, pageSize: 25 }),
    getRecentSeoRuns(15),
    getRecentLinkingBatchRuns(15),
  ]);

  return (
    <>
      <PageHeader
        title="SEO & internal linking"
        description="On-page SEO optimization and selective Kingsgate backlinking, run by the 'seo' and 'kingsgate-linking' Editor in Chief engines."
      />
      <Container>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>SEO optimized</CardDescription>
              <CardTitle className="text-2xl">{stats.seoOptimizedCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Articles the SEO engine has processed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Awaiting SEO pass</CardDescription>
              <CardTitle className="text-2xl">{stats.seoPendingCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {stats.seoFailedCount > 0 ? `${stats.seoFailedCount} run(s) failed` : 'Published, not yet optimized'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Kingsgate opportunities</CardDescription>
              <CardTitle className="text-2xl">{stats.linkedCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Articles linked to a Kingsgate post</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Link rate</CardDescription>
              <CardTitle className="text-2xl">
                {stats.linkRatePercent != null ? `${stats.linkRatePercent}%` : '—'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {stats.batchesWithLink} of {stats.batchesRun} batch(es) produced a link — by design, most shouldn&apos;t
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Articles — SEO &amp; linking status</CardTitle>
            <CardDescription>Most recently updated first · {articlesPage.total} published article(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Target keyword</TableHead>
                  <TableHead>SEO</TableHead>
                  <TableHead>SEO optimized at</TableHead>
                  <TableHead>Kingsgate link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articlesPage.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      No published articles yet.
                    </TableCell>
                  </TableRow>
                )}
                {articlesPage.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Button variant="link" className="px-0 h-auto" asChild>
                        <Link href={`/dashboard/articles/${r.id}`}>{r.title}</Link>
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm">{r.topic?.targetKeyword || '—'}</TableCell>
                    <TableCell>
                      <SeoStatusBadge optimized={r.seoOptimized} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(r.seoOptimizedAt)}
                    </TableCell>
                    <TableCell>
                      {r.kingsgateLinkUrl ? (
                        <a
                          href={r.kingsgateLinkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Linked ↗
                        </a>
                      ) : r.linkReviewed ? (
                        <span className="text-xs text-muted-foreground">Reviewed, not selected</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">Not reviewed yet</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent SEO runs</CardTitle>
              <CardDescription>On-page optimization, one article at a time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentSeoRuns.length === 0 && (
                <p className="text-sm text-muted-foreground">No SEO runs yet — start the SEO engine on the Editor in Chief page.</p>
              )}
              {recentSeoRuns.map((run) => (
                <div key={run.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Button variant="link" className="px-0 h-auto text-sm font-medium" asChild>
                      <Link href={`/dashboard/articles/${run.articleId}`}>{run.article?.title ?? run.articleId}</Link>
                    </Button>
                    <RunStatusBadge status={run.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formatDateTime(run.createdAt)}</p>
                  {run.status === 'failed' && run.errorMessage && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5">{run.errorMessage}</p>
                  )}
                  {run.changesSummary && (
                    <p className="text-xs text-foreground/80 mt-1.5 line-clamp-3">{run.changesSummary}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent linking batches</CardTitle>
              <CardDescription>Batch of 10 reviewed together — at most one link per batch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentLinkingRuns.length === 0 && (
                <p className="text-sm text-muted-foreground">No linking batches yet — start the Kingsgate Linking engine on the Editor in Chief page.</p>
              )}
              {recentLinkingRuns.map((run) => (
                <div key={run.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      {run.selectedArticleTitle ? (
                        <>
                          Linked:{' '}
                          <Link
                            href={`/dashboard/articles/${run.selectedArticleId}`}
                            className="text-primary hover:underline"
                          >
                            {run.selectedArticleTitle}
                          </Link>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No article linked this batch</span>
                      )}
                    </p>
                    <RunStatusBadge status={run.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(run.createdAt)} · {run.articleIds.length} article(s) reviewed
                    {run.matchedFeature ? ` · matched "${run.matchedFeature}"` : ''}
                  </p>
                  {run.status === 'failed' && run.errorMessage && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5">{run.errorMessage}</p>
                  )}
                  {run.reasoning && (
                    <p className="text-xs text-foreground/80 mt-1.5 line-clamp-3">{run.reasoning}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Container>
    </>
  );
}
