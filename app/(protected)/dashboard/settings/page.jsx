import Link from 'next/link';
import { PageHeader } from '@/components/custom/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { Separator } from '@/components/ui/separator';

export const metadata = { title: 'Settings' };

export default function DashboardSettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace rules and preferences. Persistence in Milestone 2+."
      />
      <Container>
        <MilestoneNote milestone={2}>Save to DB / system settings when backend lands</MilestoneNote>
        <div className="mt-4 grid gap-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Content rules</CardTitle>
              <CardDescription>Editorial policy placeholders</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Default brief template, minimum word count, required fields — TBD.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>7-day readiness rule</CardTitle>
              <CardDescription>Displayed in calendar when enforced (M6)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Every article must reach <strong>Ready</strong> at least{' '}
                <strong>7 days</strong> before scheduled publish. Enforcement is off in
                Milestone 1.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notifications (shell)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Approval required</Label>
                  <p className="text-xs text-muted-foreground">Email when queued</p>
                </div>
                <Switch disabled defaultChecked={false} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>At-risk article digest</Label>
                  <p className="text-xs text-muted-foreground">Weekly</p>
                </div>
                <Switch disabled defaultChecked={false} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Theme follows KGHub (next-themes)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use the existing header theme toggle. No extra controls here in M1.
              </p>
            </CardContent>
          </Card>
          <Button asChild>
            <Link href="/dashboard/settings/integrations">Integrations</Link>
          </Button>
        </div>
      </Container>
    </>
  );
}
