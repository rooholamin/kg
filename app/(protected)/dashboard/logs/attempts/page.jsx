import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { PageHeader } from '@/components/custom/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { MOCK_AI_ATTEMPTS } from '@/app/(protected)/dashboard/_mock';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export const metadata = { title: 'AI attempts' };

export default function AttemptsPage() {
  return (
    <>
      <PageHeader
        title="AI attempts"
        description="Per-generation log for prompts and model outputs. Populates with real data after Milestone 9."
      />
      <Container>
        <MilestoneNote milestone={9}>
          Every attempt will be stored with model, prompt, and result for diff/compare.
        </MilestoneNote>
        <div className="mt-4 grid grid-cols-1 gap-4">
          {MOCK_AI_ATTEMPTS.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{a.articleTitle}</CardTitle>
                    <CardDescription>
                      {format(parseISO(a.createdAt), 'PPp')}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{a.model}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Prompt (preview)</p>
                  <p className="font-mono text-xs leading-relaxed bg-muted/50 rounded p-2">
                    {a.promptPreview}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Result (simulated)</p>
                  <p className="text-foreground/90">{a.resultPreview}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/articles/${a.articleId}`}>
                      Open article
                    </Link>
                  </Button>
                  <Button size="sm" disabled variant="secondary">
                    Compare versions (M7+)
                  </Button>
                </div>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Comparison and rejection reasons: Milestone 7/9
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </>
  );
}
