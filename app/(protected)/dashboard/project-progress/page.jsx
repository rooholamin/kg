'use client';

import { PageHeader } from '@/components/custom/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { Progress } from '@/components/ui/progress';
import {
  MOCK_BLOCKERS,
  MOCK_PROJECT_MILESTONES,
  MOCK_WORKSTREAMS,
} from '@/app/(protected)/dashboard/_mock';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

const mileData = MOCK_PROJECT_MILESTONES.map((m) => ({
  name: `M${m.index}`,
  progress: m.progress,
  full: m.title,
}));

const gantt = MOCK_WORKSTREAMS.map((w) => ({
  name: w.name,
  p: w.progress,
}));

function phaseStyle(status) {
  if (status === 'done') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
  if (status === 'current') return 'bg-primary/10 text-primary';
  return 'bg-muted text-muted-foreground';
}

export default function ProjectProgressPage() {
  return (
    <>
      <PageHeader
        title="Project progress"
        description="Implementation roadmap vs proposal — admin-edited later; read-only for users."
        actions={
          <Button disabled variant="outline">
            Edit (admin) — M2+
          </Button>
        }
      />
      <Container>
        <MilestoneNote milestone={2}>
          Persisted Gantt and milestones with backend. This view is static mock.
        </MilestoneNote>
        <div className="mt-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Milestones</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {MOCK_PROJECT_MILESTONES.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'rounded-md border border-border p-3 text-sm',
                    phaseStyle(m.status),
                  )}
                >
                  <div className="font-medium">{m.title}</div>
                  <div className="mt-1 text-xs opacity-80 capitalize">
                    {m.status} · {m.progress}%
                  </div>
                  {m.status !== 'upcoming' && (
                    <Progress value={m.progress} className="h-1.5 mt-2" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Workstream progress (mock Gantt / bars)</CardTitle>
              <CardDescription>
                Horizontal view of proposal workstreams. Replace with real dates in
                a later milestone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={gantt}
                    layout="vertical"
                    margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                  >
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ label, payload }) => (
                        <div className="rounded border border-border bg-background px-2 py-1 text-xs shadow-sm">
                          <div className="font-medium">{label}</div>
                          {payload?.[0] && (
                            <div className="text-muted-foreground">
                              {payload[0].value}% done (mock)
                            </div>
                          )}
                        </div>
                      )}
                    />
                    <Bar dataKey="p" name="Progress" fill="var(--color-primary, #3b82f6)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Milestones (summary chart)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mileData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      content={({ payload }) => (
                        <div className="rounded border bg-background p-2 text-xs max-w-xs">
                          {payload?.[0]?.payload?.full}
                          <br />
                          <span className="text-muted-foreground">
                            Progress: {payload?.[0]?.value}%
                          </span>
                        </div>
                      )}
                    />
                    <Bar dataKey="progress" fill="var(--color-primary, #3b82f6)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Blockers &amp; risks</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {MOCK_BLOCKERS.map((b) => (
                  <li key={b.id} className="rounded-md border border-dashed p-3">
                    <p className="font-medium text-foreground">{b.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.impact}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Progress report (summary)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              M1: dashboard shell and navigation complete. M2: backend. Next: categories/topics.
            </CardContent>
          </Card>
        </div>
      </Container>
    </>
  );
}
