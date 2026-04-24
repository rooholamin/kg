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
import { MilestoneNote } from '@/components/custom/milestone-note';
import { MOCK_SEO_ARTICLES, DASHBOARD_STATS } from '@/app/(protected)/dashboard/_mock';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'SEO & internal linking' };

export default function SeoPage() {
  return (
    <>
      <PageHeader
        title="SEO & internal linking"
        description="Search optimization and on-site interconnection. Logic in Milestone 10."
      />
      <Container>
        <MilestoneNote milestone={10}>
          Rule-based checks, link suggestions, and Kingsgate opportunities ship in
          Milestone 10.
        </MilestoneNote>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Needing review (mock count)</CardDescription>
              <CardTitle className="text-2xl">
                {MOCK_SEO_ARTICLES.filter((a) => a.needsReview).length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Heuristic TBD in M4+</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg. score (mock)</CardDescription>
              <CardTitle className="text-2xl">{DASHBOARD_STATS.avgSeoScore}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">0–100 scale when live</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Internal link ideas</CardDescription>
              <CardTitle className="text-2xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Milestone 10</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Kingsgate opportunities</CardDescription>
              <CardTitle className="text-2xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Milestone 10</p>
            </CardContent>
          </Card>
        </div>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Articles — keyword &amp; score</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Internal links</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_SEO_ARTICLES.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Button variant="link" className="px-0 h-auto" asChild>
                        <Link href={`/dashboard/articles/${r.id}`}>
                          {r.title}
                        </Link>
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm">{r.keyword}</TableCell>
                    <TableCell>{r.score}</TableCell>
                    <TableCell>{r.internalLinks}</TableCell>
                    <TableCell>
                      {r.needsReview ? (
                        <Badge variant="warning" size="sm" appearance="light">
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Internal link graph (placeholder)</CardTitle>
            <CardDescription>Tree UI shell — no graph data</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Future: connect articles A→B. Component available for hierarchy experiments.
            </p>
            <div className="max-w-md text-sm text-muted-foreground border border-dashed rounded-md p-4">
              TODO(M10): render site section tree; optional graph view
            </div>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}
