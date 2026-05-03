'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api';
import { PhaseSplitCards } from './phase-split-cards';
import { PhaseGantt } from './phase-gantt';
import { WorkstreamAccordion } from './workstream-accordion';
import { BlockersPanel } from './blockers-panel';
import { ActivityPanel } from './activity-panel';
import { MilestoneFormDialog } from './milestone-form-dialog';
import { MilestoneArchiveDialog } from './milestone-archive-dialog';
import { WorkstreamFormDialog } from './workstream-form-dialog';

function useIsAdmin() {
  const { data } = useSession();
  return (
    data?.user?.roleName === 'Administrator' || data?.user?.roleName === 'Owner'
  );
}

async function fetchProjectProgress() {
  const response = await apiFetch('/api/project-progress');
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.message || 'Failed to load project progress');
  }
  return response.json();
}

export function ProjectProgressContent({ initialData }) {
  const isAdmin = useIsAdmin();
  const [milestoneDialog, setMilestoneDialog] = useState({
    open: false,
    workstream: null,
    milestone: null,
  });
  const [milestoneDelete, setMilestoneDelete] = useState(null);
  const [workstreamDialogOpen, setWorkstreamDialogOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['project-progress'],
    queryFn: fetchProjectProgress,
    initialData: initialData ? { data: initialData } : undefined,
  });

  const payload = data?.data;
  const phases = payload?.phases || [];
  const blockers = payload?.blockers || [];

  const allMilestones = useMemo(
    () =>
      phases.flatMap((phase) =>
        phase.workstreams.flatMap((ws) =>
          ws.milestones.map((ms) => ({ ...ms, phase })),
        ),
      ),
    [phases],
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) return <p className="text-sm text-destructive">{error.message}</p>;

  return (
    <div className="space-y-6">
      <PhaseSplitCards phases={phases} blockers={blockers} />
      <PhaseGantt phases={phases} />
      <WorkstreamAccordion
        phases={phases}
        isAdmin={isAdmin}
        onAddMilestone={(workstream) =>
          setMilestoneDialog({ open: true, workstream, milestone: null })
        }
        onEditMilestone={(milestone, workstream) =>
          setMilestoneDialog({ open: true, workstream, milestone })
        }
        onDeleteMilestone={(milestone) => setMilestoneDelete(milestone)}
        onAddWorkstream={() => setWorkstreamDialogOpen(true)}
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BlockersPanel blockers={blockers} phases={phases} isAdmin={isAdmin} />
        <ActivityPanel activity={payload?.recentActivity || []} />
      </div>

      <MilestoneFormDialog
        open={milestoneDialog.open}
        onOpenChange={(open) =>
          !open &&
          setMilestoneDialog({ open: false, workstream: null, milestone: null })
        }
        workstream={milestoneDialog.workstream}
        milestone={milestoneDialog.milestone}
      />
      {milestoneDelete && (
        <MilestoneArchiveDialog
          open={Boolean(milestoneDelete)}
          onOpenChange={(open) => !open && setMilestoneDelete(null)}
          milestone={milestoneDelete}
        />
      )}
      <WorkstreamFormDialog
        open={workstreamDialogOpen}
        onOpenChange={setWorkstreamDialogOpen}
        phases={phases}
      />
      {/* Ensures form dialogs have the full milestone list available for linked blocker actions */}
      <span className="hidden">{allMilestones.length}</span>
    </div>
  );
}

