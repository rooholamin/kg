'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/custom/page-header';
import { Card, CardTable, CardFooter } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { Container } from '@/components/common/container';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { AlertCircle } from 'lucide-react';

const LOG_TYPES = ['all', 'category', 'topic', 'article', 'project', 'system', 'content'];
const ENTITY_TYPES = [
  'all',
  'category',
  'topic',
  'article',
  'project',
  'project_phase',
  'project_workstream',
  'project_milestone',
  'project_blocker',
  'project_report',
];

function actionBadgeVariant(action) {
  switch (action) {
    case 'create':
      return 'success';
    case 'delete':
      return 'destructive';
    case 'archive':
      return 'warning';
    case 'status_change':
      return 'primary';
    case 'update':
    default:
      return 'secondary';
  }
}

function formatEntityCell(row) {
  const t = row.entityType || '—';
  const id = row.entityId;
  if (!id) return t;
  const short = id.length > 10 ? `${id.slice(0, 8)}…` : id;
  return `${t} · ${short}`;
}

async function fetchLogs(type, entityType) {
  const params = new URLSearchParams();
  if (type && type !== 'all') params.set('type', type);
  if (entityType && entityType !== 'all') params.set('entityType', entityType);
  params.set('limit', '300');
  const res = await apiFetch(`/api/logs?${params.toString()}`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load logs');
  }
  return res.json();
}

export default function LogsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [entityType, setEntityType] = useState('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['content-logs', type, entityType],
    queryFn: () => fetchLogs(type, entityType),
  });

  const rawRows = data?.data ?? [];

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rawRows;
    return rawRows.filter((row) => {
      const hay = [
        row.message,
        row.type,
        row.action,
        row.entityType,
        row.entityId,
        row.userLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rawRows, search]);

  const table = useReactTable({
    data: filteredRows,
    getRowId: (r) => r.id,
    columns: [
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataGridColumnHeader title="Time" column={column} />,
        cell: ({ getValue }) => {
          const v = getValue();
          try {
            return format(
              typeof v === 'string' ? parseISO(v) : v instanceof Date ? v : parseISO(String(v)),
              'PPp',
            );
          } catch {
            return '—';
          }
        },
        size: 190,
      },
      {
        accessorKey: 'action',
        header: ({ column }) => <DataGridColumnHeader title="Action" column={column} />,
        cell: ({ getValue }) => {
          const v = getValue() || '—';
          return (
            <Badge variant={actionBadgeVariant(v)} size="sm" appearance="light">
              {v}
            </Badge>
          );
        },
        size: 120,
      },
      {
        id: 'entity',
        header: 'Entity',
        accessorFn: (row) => formatEntityCell(row),
        size: 200,
      },
      {
        accessorKey: 'message',
        header: 'Message',
        size: 280,
      },
      {
        accessorKey: 'userLabel',
        header: 'User',
        cell: ({ getValue }) => getValue() || '—',
        size: 140,
      },
      {
        accessorKey: 'type',
        header: ({ column }) => <DataGridColumnHeader title="Type" column={column} />,
        size: 100,
      },
    ],
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      <PageHeader
        title="Activity & logs"
        description="Global audit trail for content, articles, and project progress."
      />
      <Container>
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="w-full sm:w-44">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === 'all' ? 'All types' : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-52">
              <Label className="text-xs">Entity</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === 'all' ? 'All entities' : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <MockTableToolbar
            search={search}
            onSearchChange={setSearch}
            actionLabel={null}
            onAction={() => {}}
            placeholder="Search messages, entity, user…"
          />
          {isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Could not load logs</AlertTitle>
              <AlertDescription>{error?.message || 'Unknown error'}</AlertDescription>
            </Alert>
          ) : null}
          {isLoading ? (
            <div className="space-y-2 rounded-lg border p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : (
            <Card>
              <DataGrid table={table} recordCount={filteredRows.length}>
                <CardTable>
                  <ScrollArea>
                    {filteredRows.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        {rawRows.length === 0
                          ? 'No activity yet. Create or edit content to see entries here.'
                          : 'No rows match your search or filters.'}
                      </div>
                    ) : (
                      <>
                        <DataGridTable table={table} />
                        <ScrollBar orientation="horizontal" />
                      </>
                    )}
                  </ScrollArea>
                </CardTable>
                {filteredRows.length > 0 ? (
                  <CardFooter>
                    <DataGridPagination className="py-0" />
                  </CardFooter>
                ) : null}
              </DataGrid>
            </Card>
          )}
        </div>
      </Container>
    </>
  );
}
