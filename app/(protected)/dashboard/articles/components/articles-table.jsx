'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { PipelineStageBadge } from '@/components/custom/pipeline-stage-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PIPELINE_STAGES } from '@/app/(protected)/dashboard/_mock';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function formatDate(v) {
  if (!v) return '—';
  try {
    return format(typeof v === 'string' ? parseISO(v) : v, 'PP');
  } catch {
    return '—';
  }
}

export function ArticlesTable() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [readiness, setReadiness] = useState('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      if (categoryId && categoryId !== 'all') qs.set('categoryId', categoryId);
      if (stage && stage !== 'all') qs.set('status', stage);
      const [artRes, catRes] = await Promise.all([
        fetch(`/api/articles?${qs.toString()}`),
        fetch('/api/categories'),
      ]);
      if (!artRes.ok) {
        const j = await artRes.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to load articles');
      }
      if (!catRes.ok) {
        const j = await catRes.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to load categories');
      }
      const [artJson, catJson] = await Promise.all([
        artRes.json(),
        catRes.json(),
      ]);
      setRows(artJson.data ?? []);
      setCategories(catJson.data ?? []);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [categoryId, stage]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const data = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((a) => {
      if (q && !a.title.toLowerCase().includes(q)) return false;
      if (readiness !== 'all') {
        // Readiness is computed in Milestone 6; filter does not apply yet
        return true;
      }
      return true;
    });
  }, [search, rows, readiness]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        id: 'title',
        header: ({ column }) => (
          <DataGridColumnHeader title="Title" column={column} />
        ),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/dashboard/articles/${row.original.id}`}
          >
            {row.original.title}
          </Link>
        ),
        size: 240,
      },
      {
        accessorKey: 'topicName',
        id: 'topic',
        header: 'Topic',
        size: 140,
      },
      {
        accessorKey: 'categoryName',
        id: 'cat',
        header: 'Category',
        cell: ({ getValue }) => <Badge variant="secondary">{getValue()}</Badge>,
        size: 100,
      },
      {
        accessorKey: 'status',
        id: 'stage',
        header: 'Stage',
        cell: ({ getValue }) => <PipelineStageBadge stage={getValue()} />,
        size: 120,
      },
      {
        id: 'publish',
        header: 'Publish',
        cell: ({ row }) => formatDate(row.original.publishDate),
        size: 100,
      },
      {
        id: 'readyBy',
        header: 'Ready by',
        cell: ({ row }) => formatDate(row.original.readinessDeadline),
        size: 100,
      },
      {
        id: 'readiness',
        header: 'Readiness',
        cell: () => (
          <span className="text-xs text-muted-foreground">M6</span>
        ),
        size: 120,
      },
      {
        id: 'assignee',
        header: 'Assignee',
        cell: () => (
          <span className="text-sm text-muted-foreground">—</span>
        ),
        size: 160,
      },
      {
        id: 'seo',
        header: 'SEO',
        cell: ({ row }) => (
          <span>
            {row.original.seoScore != null ? row.original.seoScore : '—'}
          </span>
        ),
        size: 64,
      },
      {
        id: 'wp',
        header: 'WordPress',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.wordpressPostId != null
              ? `WP #${row.original.wordpressPostId}`
              : '—'}
          </span>
        ),
        size: 120,
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
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => r.id,
  });

  return (
    <Container>
      <MilestoneNote milestone={4}>Full article engine in Milestone 4</MilestoneNote>
      <div className="mt-4 space-y-3">
        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load articles</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
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
          <div>
            <Label className="text-xs">Readiness</Label>
            <Select value={readiness} onValueChange={setReadiness} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="on_track">On track</SelectItem>
                <SelectItem value="at_risk">At risk</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-0.5">Milestone 6</p>
          </div>
        </div>
        <MockTableToolbar
          search={search}
          onSearchChange={setSearch}
          actionLabel="New article (M4)"
          onAction={() => {}}
          placeholder="Search title…"
        />
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !loadError && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No articles yet. Add topics and articles in upcoming milestones.
          </p>
        ) : !loadError && data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No articles match this filter.
          </p>
        ) : !loadError ? (
          <Card>
            <DataGrid
              table={table}
              recordCount={data.length}
              onRowClick={(row) => router.push(`/dashboard/articles/${row.id}`)}
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
