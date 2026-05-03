'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

function countMilestones(phase) {
  return phase.workstreams.reduce((sum, ws) => sum + ws.milestones.length, 0);
}

function countOpenBlockers(phase, blockers) {
  return blockers.filter(
    (b) =>
      b.status === 'open' &&
      b.milestone?.workstream?.phaseId === phase.id,
  ).length;
}

export function PhaseSplitCards({ phases, blockers }) {
  const build = phases.find((phase) => phase.slug === 'build');
  const automation = phases.find((phase) => phase.slug === 'automation');
  if (!build || !automation) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="border-emerald-500/40 h-full">
        <CardHeader className="pt-4 pb-3 px-4 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
            Phase 1
          </div>
          <CardTitle className="flex items-center justify-between gap-2 leading-tight">
            <span>Build phase</span>
            <Badge variant="outline" className="h-6 px-2 text-xs whitespace-nowrap">
              System build
            </Badge>
          </CardTitle>
          <CardDescription>{build.description}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Progress value={build.progressPercent} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Progress</p>
              <p className="font-semibold">{build.progressPercent}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Workstreams</p>
              <p className="font-semibold">{build.workstreams.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Milestones</p>
              <p className="font-semibold">{countMilestones(build)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 border-primary/50 border-dashed h-full">
        <CardHeader className="pt-4 pb-3 px-4 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-primary">
            Phase 2 (Critical)
          </div>
          <CardTitle className="flex items-center justify-between gap-3 leading-tight">
            <span>Automation & calibration phase</span>
            <Badge className="h-6 px-2 text-xs whitespace-nowrap">Value phase</Badge>
          </CardTitle>
          <CardDescription>{automation.description}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            System is built early, but real progress happens during automation.
          </p>
          <Progress value={automation.progressPercent} className="h-2" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Progress</p>
              <p className="font-semibold">{automation.progressPercent}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Workstreams</p>
              <p className="font-semibold">{automation.workstreams.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Open blockers</p>
              <p className="font-semibold">{countOpenBlockers(automation, blockers)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

