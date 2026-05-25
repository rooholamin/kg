'use client';

import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/custom/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { AlertCircle } from 'lucide-react';

async function fetchAttempts() {
  const res = await apiFetch('/api/ai-attempts');
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load attempts');
  }
  return res.json();
}

function resultPreview(text, max = 220) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export default function AttemptsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ai-attempts'],
    queryFn: fetchAttempts,
  });

  const attempts = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="AI attempts"
        description="Per-generation log for prompts and model outputs."
      />
      <Container>
        <Alert className="mt-4 border-primary/30 bg-primary/5">
          <AlertTitle>AI attempts activate in Milestone 9</AlertTitle>
          <AlertDescription>
            This list uses the live database structure. Entries appear here once generation
            is wired in; you can still POST attempts via the API for testing.
          </AlertDescription>
        </Alert>

        <div className="mt-4 grid grid-cols-1 gap-4">
          {isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Could not load attempts</AlertTitle>
              <AlertDescription>{error?.message || 'Unknown error'}</AlertDescription>
            </Alert>
          ) : null}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : attempts.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No attempts yet</CardTitle>
                <CardDescription>
                  When Milestone 9 ships, every generation will appear here with model, prompt,
                  and full result for audit and compare.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            attempts.map((a) => (
              <Card key={a.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {a.articleId ? `Article ${a.articleId.slice(0, 8)}…` : 'No article'}
                      </CardTitle>
                      <CardDescription>
                        {format(parseISO(String(a.createdAt)), 'PPp')}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{a.model}</Badge>
                      <Badge
                        variant={a.status === 'failed' ? 'destructive' : 'success'}
                        size="sm"
                        appearance="light"
                      >
                        {a.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      Prompt (preview)
                    </p>
                    <p className="font-mono text-xs leading-relaxed bg-muted/50 rounded p-2">
                      {resultPreview(a.prompt, 400)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      Result (preview)
                    </p>
                    <p className="text-foreground/90">{resultPreview(a.result)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {a.articleId ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/articles/${a.articleId}`}>Open article</Link>
                      </Button>
                    ) : null}
                  </div>
                  <Separator />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </Container>
    </>
  );
}
