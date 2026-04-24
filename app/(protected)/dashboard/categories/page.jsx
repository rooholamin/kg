import { PageHeader } from '@/components/custom/page-header';
import { CategoriesTable } from './components/categories-table';

export const metadata = {
  title: 'Categories',
  description: 'Broad content areas for Automation Magazine.',
};

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Categories"
        description="Group topics and articles. Full CRUD in Milestone 3."
      />
      <CategoriesTable />
    </>
  );
}
