import { PageHeader } from '@/components/custom/page-header';
import { DashboardHomeContent } from './components/dashboard-home-content';

export const metadata = {
  title: 'Automation Magazine — Main Dashboard',
  description: 'Operational overview of content, pipeline, and automation.',
};

export default function MainDashboardPage() {
  return (
    <>
      <PageHeader
        title="Automation Magazine Dashboard"
        description="AI-assisted content operations — live executive overview."
      />
      <DashboardHomeContent />
    </>
  );
}
