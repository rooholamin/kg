'use client';

import { useMemo } from 'react';
import { PageHeader } from '@/components/custom/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MOCK_APPROVALS } from '@/app/(protected)/dashboard/_mock';

const riskMap = {
  high: { variant: 'destructive' },
  medium: { variant: 'warning' },
  low: { variant: 'secondary' },
};

function ApprovalCards({ items, showActions }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing in this tab.</p>;
  }
  return (
    <div className="space-y-4">
      {items.map((a) => (
        <Card key={a.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{a.action}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Requested by {a.requestedBy}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={riskMap[a.risk]?.variant || 'secondary'}
                  size="sm"
                  appearance="light"
                >
                  Risk: {a.risk}
                </Badge>
                <span className="text-xs text-muted-foreground">{a.status}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Target:</span> {a.entity}
            </p>
            <div>
              <Label>Notes (shell)</Label>
              <Textarea
                className="mt-1.5"
                rows={2}
                placeholder="Add context for the approver (inactive)"
                disabled
              />
            </div>
            {showActions && (
              <div className="flex gap-2">
                <Button disabled>Approve (M2+)</Button>
                <Button variant="outline" disabled>
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ApprovalsPage() {
  const lists = useMemo(() => {
    return {
      pending: MOCK_APPROVALS.filter((a) => a.status === 'pending'),
      approved: MOCK_APPROVALS.filter((a) => a.status === 'approved'),
      rejected: MOCK_APPROVALS.filter((a) => a.status === 'rejected'),
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="High-impact actions that require a second pair of eyes. Queue logic in a later milestone."
      />
      <Container>
        <MilestoneNote milestone={2}>
          Real approval flow with notifications — after auth & APIs stabilize.
        </MilestoneNote>
        <Tabs defaultValue="pending" className="mt-4">
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            <ApprovalCards items={lists.pending} showActions />
          </TabsContent>
          <TabsContent value="approved" className="mt-4">
            <ApprovalCards items={lists.approved} showActions={false} />
          </TabsContent>
          <TabsContent value="rejected" className="mt-4">
            <ApprovalCards items={lists.rejected} showActions={false} />
          </TabsContent>
        </Tabs>
      </Container>
    </>
  );
}
