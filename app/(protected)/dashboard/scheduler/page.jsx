import { PageHeader } from '@/components/custom/page-header';
import { SchedulerContent } from './components/scheduler-content';

export const metadata = {
  title: 'Scheduler',
  description: 'Batch-schedule articles, distribute topics fairly, and trigger n8n generation.',
};

export default function SchedulerPage() {
  return (
    <>
      <PageHeader
        title="Scheduler"
        description="Create batches of scheduled article slots, distribute topics across sections, and trigger n8n for article planning."
      />
      <SchedulerContent />
    </>
  );
}
