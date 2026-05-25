import { PageHeader } from '@/components/custom/page-header';
import { SectionsTable } from './components/sections-table';

export const metadata = {
  title: 'Sections',
  description: 'KG Hub content verticals — each with a character and persona.',
};

export default function SectionsPage() {
  return (
    <>
      <PageHeader
        title="Sections"
        description="Top-level KG Hub verticals. Each section has its own character, persona, and set of categories."
      />
      <SectionsTable />
    </>
  );
}
