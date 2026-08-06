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
        description="Start the engines and watch them process articles — research, write, create assets, queue for approval, optimize on-page SEO, and selectively add Kingsgate backlinks."
      />
      <EngineDashboard />
    </>
  );
}
