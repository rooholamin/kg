'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ReportFormDialog } from './report-form-dialog';

export function ReportsPanel({ latestReport, recentReports, isAdmin }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiFetch(`/api/project-progress/reports/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.message || 'Failed to delete report');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-progress'] }),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="flex items-center justify-between gap-3 text-[1.15rem] leading-none">
          <span>Progress reports</span>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs font-medium rounded-md"
              onClick={() => setOpen(true)}
            >
              New report
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {latestReport ? (
          <div className="rounded-md border p-3 space-y-3">
            <p className="font-medium">{latestReport.title}</p>
            <p className="text-sm text-muted-foreground">{latestReport.summary}</p>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span>Build progress</span>
                  <span>{latestReport.buildProgress}%</span>
                </div>
                <Progress value={latestReport.buildProgress} className="h-1.5" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span>Automation progress</span>
                  <span>{latestReport.automationProgress}%</span>
                </div>
                <Progress value={latestReport.automationProgress} className="h-1.5" />
              </div>
            </div>
            <p className="text-sm">
              <span className="font-medium">Current focus: </span>
              {latestReport.keyFocus || '—'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        )}

        <div className="space-y-2">
          {recentReports.map((report) => (
            <div key={report.id} className="rounded-md border p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(report.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <ReportFormDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

