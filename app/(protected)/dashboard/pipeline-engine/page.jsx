import { PageHeader } from '@/components/custom/page-header';
import { EngineDashboard } from './components/engine-dashboard';

export const metadata = {
  title: 'Editor in Chief',
  description: 'Pipeline engine that automatically processes articles through research, writing, and asset generation.',
};

export default function PipelineEnginePage() {
  return (
    <>
      <PageHeader
        title="Editor in Chief"
        description="Start the engine and watch it process articles one by one — research, write, create assets, and queue for approval."
      />
      <EngineDashboard />
    </>
  );
}
