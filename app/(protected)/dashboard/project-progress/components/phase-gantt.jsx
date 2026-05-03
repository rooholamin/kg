'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function toTs(value) {
  return value ? new Date(value).getTime() : 0;
}

export function PhaseGantt({ phases }) {
  const rows = phases
    .filter((phase) => phase.startDate && phase.endDate)
    .map((phase) => {
      const start = toTs(phase.startDate);
      const end = toTs(phase.endDate);
      return {
        name: phase.slug === 'build' ? 'Build' : 'Automation',
        start,
        end,
        duration: Math.max(end - start, 1),
        progressPercent: phase.progressPercent,
      };
    });

  let buildIndex = 0;
  let automationIndex = 0;
  const milestonePoints = phases.flatMap((phase) =>
    phase.workstreams.flatMap((ws) =>
      ws.milestones
        .filter((ms) => ms.startDate || ms.endDate)
        .map((ms) => {
          if (phase.slug === 'build') buildIndex += 1;
          else automationIndex += 1;
          return {
            x: toTs(ms.startDate || ms.endDate),
            y: phase.slug === 'build' ? 'Build' : 'Automation',
            label:
              phase.slug === 'build'
                ? `B${buildIndex}`
                : `A${automationIndex}`,
            title: ms.title,
            status: ms.status,
            type: ms.type,
            progressPercent: ms.progressPercent,
          };
        }),
    ),
  );

  const minStart = rows.length ? Math.min(...rows.map((r) => r.start)) : Date.now();
  const maxEnd = rows.length ? Math.max(...rows.map((r) => r.end)) : Date.now();

  return (
    <Card>
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-[1.15rem] leading-none">Planned phase timeline</CardTitle>
        <CardDescription>
          Planned schedule for build and automation phases. Milestones are labeled
          as B# (build) and A# (automation).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              layout="vertical"
              margin={{ left: 10, right: 20, top: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                domain={[minStart, maxEnd]}
                allowDataOverflow
                tickFormatter={(v) => new Date(v).toLocaleDateString()}
              />
              <YAxis type="category" dataKey="name" width={100} />
              <Tooltip
                content={({ payload, label }) => {
                  const milestoneEntry = payload?.find(
                    (entry) =>
                      entry?.payload?.title &&
                      (entry?.name === 'Milestones' || entry?.dataKey === 'x'),
                  );
                  if (milestoneEntry?.payload) {
                    const ms = milestoneEntry.payload;
                    return (
                      <div className="rounded border border-border bg-background p-2 text-xs">
                        <p className="font-medium">
                          {ms.label}: {ms.title}
                        </p>
                        <p>
                          {new Date(ms.x).toLocaleDateString()} • {ms.type}
                        </p>
                        <p className="text-muted-foreground">
                          {ms.status} • {ms.progressPercent}%
                        </p>
                      </div>
                    );
                  }

                  const row = payload?.[1]?.payload || payload?.[0]?.payload;
                  if (!row) return null;
                  return (
                    <div className="rounded border border-border bg-background p-2 text-xs">
                      <p className="font-medium">{label}</p>
                      <p>
                        {new Date(row.start).toLocaleDateString()} →{' '}
                        {new Date(row.end).toLocaleDateString()}
                      </p>
                      <p className="text-muted-foreground">
                        Progress: {row.progressPercent}%
                      </p>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ fontSize: '11px' }}
              />
              <Bar dataKey="start" stackId="phase" fill="transparent" />
              <Bar
                dataKey="duration"
                name="Phase range"
                stackId="phase"
                fill="var(--color-primary, #3b82f6)"
                radius={4}
              />
              <Scatter
                data={milestonePoints}
                name="Milestones"
                dataKey="x"
                fill="var(--color-warning, #f59e0b)"
                shape="circle"
              >
                <LabelList dataKey="label" position="top" fontSize={10} />
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

