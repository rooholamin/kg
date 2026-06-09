'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Pencil, Trash2, AlertCircle, ChevronRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/custom/status-badge';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TopicFormDialog } from './topic-form-dialog';
import { TopicArchiveDialog } from './topic-archive-dialog';
import { cn } from '@/lib/utils';

async function fetchTopics() {
  const res = await apiFetch('/api/topics');
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load topics');
  }
  return res.json();
}

async function fetchCategories() {
  const res = await apiFetch('/api/categories');
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load categories');
  }
  return res.json();
}

export function TopicsTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });
  const [formOpen, setFormOpen] = useState(false);
  const [formTopic, setFormTopic] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveTopic, setArchiveTopic] = useState(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/topics/wordpress/sync-all', { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Sync failed');
      }
      return res.json();
    },
    onSuccess: (result) => {
      const { synced, skipped, errors } = result.data ?? {};
      const parts = [];
      if (synced) parts.push(`${synced} synced`);
      if (skipped) parts.push(`${skipped} skipped (parent not synced or no credentials)`);
      if (errors?.length) parts.push(`${errors.length} failed`);
      toast.success(`WordPress sync complete${parts.length ? ': ' + parts.join(', ') : ''}`);
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const unsyncedCount = (data?.data ?? []).filter((t) => !t.wpCategoryId && t.status === 'active').length;

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const rows = data?.data ?? [];
  const categories = catData?.data ?? [];

  const dataFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((t) => {
      const matchQ =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.targetKeyword ?? '').toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q);
      const matchC = catFilter === 'all' || t.categoryId === catFilter;
      return matchQ && matchC;
    });
  }, [search, catFilter, rows]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        id: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader title="Topic" column={column} />
        ),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/dashboard/topics/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.name}
          </Link>
        ),
        size: 200,
      },
      {
        accessorKey: 'categoryName',
        id: 'categoryName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Category" column={column} />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.categoryName}</Badge>
        ),
        size: 120,
      },
      {
        accessorKey: 'targetKeyword',
        id: 'targetKeyword',
        header: ({ column }) => (
          <DataGridColumnHeader title="Target keyword" column={column} />
        ),
        size: 160,
      },
      {
        id: 'tags',
        header: 'Tags',
        cell: () => (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      },
      {
        id: 'priority',
        header: ({ column }) => (
          <DataGridColumnHeader title="Priority" column={column} />
        ),
        cell: () => <span className="text-sm text-muted-foreground">—</span>,
        size: 100,
      },
      {
        accessorKey: 'status',
        id: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        cell: ({ getValue }) => {
          const v = getValue();
          return (
            <StatusBadge
              variant={v === 'active' ? 'active' : 'archived'}
              className={cn(v === 'archived' && 'opacity-80')}
            >
              {v}
            </StatusBadge>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'articleCount',
        id: 'articleCount',
        header: 'Articles',
        size: 80,
      },
      {
        accessorKey: 'wpCategoryId',
        id: 'wpCategoryId',
        header: ({ column }) => (
          <DataGridColumnHeader title="WP Sync" column={column} />
        ),
        cell: ({ getValue }) => {
          const v = getValue();
          return v ? (
            <Badge variant="secondary" appearance="light" className="gap-1 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="size-3" />
              #{v}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
        size: 100,
      },
      {
        id: 'readiness',
        header: 'Readiness',
        cell: () => (
          <span className="text-xs text-muted-foreground">Milestone 6</span>
        ),
        size: 160,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Edit"
                onClick={() => {
                  setFormTopic(r);
                  setFormOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                aria-label="Archive or delete"
                onClick={() => {
                  setArchiveTopic(r);
                  setArchiveOpen(true);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        },
        size: 100,
      },
      {
        id: 'go',
        header: '',
        cell: () => <ChevronRight className="size-4 text-muted-foreground" />,
        size: 32,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: dataFiltered,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => r.id,
  });

  const loadError = isError ? error?.message : null;
  const showSkeleton = isLoading;
  const showTable = !loadError && !isLoading;

  return (
    <Container>
      <div className="mt-4 space-y-3">
        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load topics</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {loadError}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <TopicFormDialog
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setFormTopic(null);
          }}
          topic={formTopic}
        />
        <TopicArchiveDialog
          open={archiveOpen}
          onOpenChange={(o) => {
            setArchiveOpen(o);
            if (!o) setArchiveTopic(null);
          }}
          topic={archiveTopic}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full sm:w-48">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <MockTableToolbar
          search={search}
          onSearchChange={setSearch}
          actionLabel="New topic"
          onAction={() => {
            setFormTopic(null);
            setFormOpen(true);
          }}
          placeholder="Filter topics"
          secondaryAction={
            unsyncedCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.status === 'pending'}
              >
                <RefreshCw className={`me-1.5 size-4 ${syncMutation.status === 'pending' ? 'animate-spin' : ''}`} />
                Sync to WordPress
                <Badge variant="secondary" appearance="light" className="ms-1.5">
                  {unsyncedCount}
                </Badge>
              </Button>
            ) : null
          }
        />
        {isFetching && !isLoading && (
          <p className="text-xs text-muted-foreground">Refreshing…</p>
        )}

        {showSkeleton ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !loadError && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No topics yet.{' '}
            <button
              type="button"
              className="text-primary underline font-medium"
              onClick={() => {
                setFormTopic(null);
                setFormOpen(true);
              }}
            >
              Create your first topic
            </button>
            .
          </p>
        ) : !loadError && dataFiltered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No topics match this filter.
          </p>
        ) : showTable ? (
          <Card>
            <DataGrid
              table={table}
              recordCount={dataFiltered.length}
              onRowClick={(row) => router.push(`/dashboard/topics/${row.id}`)}
            >
              <CardTable>
                <ScrollArea>
                  <DataGridTable table={table} />
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardTable>
              <CardFooter>
                <DataGridPagination className="py-0" />
              </CardFooter>
            </DataGrid>
          </Card>
        ) : null}
      </div>
    </Container>
  );
}
