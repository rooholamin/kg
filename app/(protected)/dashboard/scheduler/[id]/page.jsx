import { PageHeader } from '@/components/custom/page-header';
import { BatchDetailContent } from './components/batch-detail-content';

export const metadata = {
  title: 'Batch Detail',
  description: 'Scheduling batch history, slot results, and activity log.',
};

export default async function BatchDetailPage({ params }) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        title="Batch Detail"
        description="Full history, per-slot results, timing, and activity for this schedule batch."
      />
      <BatchDetailContent batchId={id} />
    </>
  );
}
