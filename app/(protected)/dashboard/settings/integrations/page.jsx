import { PageHeader } from '@/components/custom/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { MOCK_INTEGRATIONS } from '@/app/(protected)/dashboard/_mock';
import { Plug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export const metadata = { title: 'Integrations' };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        description="External systems and channels. None are connected in Milestone 1."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings">Back to settings</Link>
          </Button>
        }
      />
      <Container>
        <MilestoneNote milestone={8}>
          WordPress first, then AI (9), then n8n and social (10) — see product roadmap.
        </MilestoneNote>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MOCK_INTEGRATIONS.map((i) => (
            <Card key={i.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                      <Plug className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{i.name}</CardTitle>
                      <CardDescription>{i.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" appearance="light">
                    Not connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Milestone {i.milestone} — {i.name} wiring
                </p>
                <Button variant="outline" size="sm" disabled>
                  Configure
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </>
  );
}
