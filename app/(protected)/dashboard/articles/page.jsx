import { PageHeader } from '@/components/custom/page-header';
import { ArticlesTable } from './components/articles-table';

export const metadata = {
  title: 'Articles',
  description: 'Content pieces and pipeline',
};

export default function ArticlesPage() {
  return (
    <>
      <PageHeader
        title="Articles"
        description="List, filter, and open article records. Real persistence in Milestone 4."
      />
      <ArticlesTable />
    </>
  );
}
