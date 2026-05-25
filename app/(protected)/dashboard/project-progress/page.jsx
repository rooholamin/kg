import { PageHeader } from '@/components/custom/page-header';
import { Container } from '@/components/common/container';
import Link from 'next/link';
import { getProjectProgressTree } from '@/services/project-progress.service';
import { Button } from '@/components/ui/button';
import { ProjectProgressContent } from './components/project-progress-content';

export default async function ProjectProgressPage() {
  const data = await getProjectProgressTree();

  return (
    <>
      <PageHeader
        title="Project progress"
        description="Build phase delivery + automation and calibration progress tracking."
        actions={(
          <Button variant="outline" asChild>
            <Link href="/dashboard/idea-backlog">Idea Backlog →</Link>
          </Button>
        )}
      />
      <Container>
        <div className="mt-4">
          <ProjectProgressContent initialData={data} />
        </div>
      </Container>
    </>
  );
}
