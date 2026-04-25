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
        description="Create, edit, and manage full article content, media, and pipeline stages."
      />
      <ArticlesTable />
    </>
  );
}
