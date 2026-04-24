import { PageHeader } from '@/components/custom/page-header';
import { TopicsTable } from './components/topics-table';

export const metadata = {
  title: 'Topics',
  description: 'Subjects within categories',
};

export default function TopicsPage() {
  return (
    <>
      <PageHeader
        title="Topics"
        description="Plan and track subjects that contain articles. CRUD in Milestone 3."
      />
      <TopicsTable />
    </>
  );
}
