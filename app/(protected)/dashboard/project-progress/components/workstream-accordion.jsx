'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function labelForStatus(status) {
  return status.replace('_', ' ');
}

export function WorkstreamAccordion({
  phases,
  isAdmin,
  onAddMilestone,
  onAddWorkstream,
  onEditMilestone,
  onDeleteMilestone,
}) {
  const [expandedWorkstreams, setExpandedWorkstreams] = useState({});

  const toggleWorkstream = (id) => {
    setExpandedWorkstreams((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <Card>
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="flex items-center justify-between gap-3 text-[1.15rem] leading-none">
          <span>Workstreams by phase</span>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs font-medium rounded-md"
              onClick={onAddWorkstream}
            >
              Add workstream
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Accordion type="multiple" defaultValue={['automation']} className="space-y-2">
          {phases.map((phase) => (
            <AccordionItem value={phase.slug} key={phase.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{phase.slug}</span>
                  <Badge variant="outline">{phase.progressPercent}%</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {phase.workstreams.map((ws) => (
                    <div key={ws.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{ws.name}</p>
                          <p className="text-xs text-muted-foreground">{ws.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{labelForStatus(ws.status)}</Badge>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs font-medium rounded-md"
                              onClick={() => onAddMilestone(ws)}
                            >
                              Add milestone
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() => toggleWorkstream(ws.id)}
                          >
                            {expandedWorkstreams[ws.id] ? 'Hide milestones' : 'View milestones'}
                            <ChevronDown
                              className={cn(
                                'ml-1 size-3.5 transition-transform',
                                expandedWorkstreams[ws.id] && 'rotate-180',
                              )}
                            />
                          </Button>
                        </div>
                      </div>
                      <Progress value={ws.progressPercent} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">
                        {ws.milestones.length} milestones • {ws.blockerCount || 0} open blockers
                      </p>
                      {expandedWorkstreams[ws.id] && (
                        <div className="space-y-2 pt-1">
                          {ws.milestones.map((milestone) => (
                            <div
                              key={milestone.id}
                              className="rounded-md border border-dashed p-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {milestone.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {milestone.description || 'No description yet.'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Badge
                                    variant={
                                      milestone.type === 'automation'
                                        ? 'default'
                                        : 'secondary'
                                    }
                                  >
                                    {milestone.type}
                                  </Badge>
                                  <Badge variant="outline">
                                    {labelForStatus(milestone.status)}
                                  </Badge>
                                  <Badge variant="outline">
                                    {milestone.progressPercent}%
                                  </Badge>
                                  {isAdmin && (
                                    <>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => onEditMilestone(milestone, ws)}
                                      >
                                        <Pencil className="size-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => onDeleteMilestone(milestone)}
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

