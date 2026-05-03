'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function prettyEntity(type) {
  if (!type) return 'activity';
  return type.replace('project_', '').replaceAll('_', ' ');
}

function parseMessage(message) {
  if (!message) return { title: 'Activity updated', changes: [] };

  // New format: "Title :: field: from -> to | field: from -> to"
  if (message.includes('::')) {
    const [title, raw] = message.split('::');
    const changes = (raw || '')
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
    return { title: title.trim(), changes };
  }

  // Backward compatibility with older "(a; b; c)" style entries
  const match = message.match(/^(.*)\((.*)\)\s*$/);
  if (match) {
    const title = (match[1] || '').trim();
    const changes = (match[2] || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);
    return { title: title || message, changes };
  }

  return { title: message, changes: [] };
}

export function ActivityPanel({ activity }) {
  return (
    <Card>
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-[1.15rem] leading-none">
          Project activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-2">
        {activity?.length ? (
          activity.map((item) => {
            const parsed = parseMessage(item.message);
            return (
              <div key={item.id} className="rounded-md border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">
                      {parsed.title}
                    </p>
                    {parsed.changes.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {parsed.changes.map((change) => (
                          <li
                            key={change}
                            className="text-xs text-muted-foreground rounded bg-muted/40 px-2 py-1"
                          >
                            {change}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {prettyEntity(item.entityType)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">No project activity yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

