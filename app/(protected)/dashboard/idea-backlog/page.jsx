import { PageHeader } from '@/components/custom/page-header';
import { Container } from '@/components/common/container';
import { getIdeas } from '@/services/idea-backlog.service';
import { IdeaBacklogContent } from './components/idea-backlog-content';

export default async function IdeaBacklogPage() {
  const ideas = await getIdeas();

  return (
    <>
      <PageHeader
        title="Idea Backlog"
        description="Capture future ideas that are not in the active development line yet."
      />
      <Container>
        <div className="mt-4">
          <IdeaBacklogContent initialData={ideas} />
        </div>
      </Container>
    </>
  );
}
