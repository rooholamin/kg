'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { Container } from '@/components/common/container';
import { PipelineStageBadge } from '@/components/custom/pipeline-stage-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronRight, Pencil, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PIPELINE_STAGES } from '@/app/(protected)/dashboard/_mock';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ReadinessBadge } from '@/components/custom/readiness-badge';
import { ArticleFormDialog } from './article-form-dialog';
import { ArticleArchiveDialog } from './article-archive-dialog';

function formatDate(v) {
  if (!v) return '—';
  try {
    return format(typeof v === 'string' ? parseISO(v) : v, 'PP');
  } catch {
    return '—';
  }
}

function readinessFromRow(row) {
  const now = new Date();
  if (!row.readinessDeadline || !row.publishDate) return 'on_track';
  const pd = parseISO(String(row.publishDate));
  const rd = parseISO(String(row.readinessDeadline));
  if (Number.isNaN(pd.getTime()) || Number.isNaN(rd.getTime())) return 'on_track';
  if (now > pd && row.status !== 'post_publish' && row.status !== 'publishing') {
    return 'overdue';
  }
  if (now > rd && now <= pd) return 'at_risk';
  return 'on_track';
}

async function fetchArticles({ categoryId, status }) {
  const qs = new URLSearchParams();
  if (categoryId && categoryId !== 'all') qs.set('categoryId', categoryId);
  if (status && status !== 'all') qs.set('status', status);
  const response = await apiFetch(`/api/articles?${qs.toString()}`);
  if (!response.ok) {
    const j = await response.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load articles');
  }
  return response.json();
}

export function ArticlesTable() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [readiness, setReadiness] = useState('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });

  const { data: catJson } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const r = await apiFetch('/api/categories');
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
  });
  const categories = catJson?.data ?? [];

  const {
    data: artJson,
    isLoading: loading,
    isError: loadError,
    error: errObj,
  } = useQuery({
    queryKey: ['articles', { categoryId, stage }],
    queryFn: () => fetchArticles({ categoryId, status: stage }),
  });
  const rows = artJson?.data ?? [];
  const loadErrorMsg = errObj?.message;

  const data = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((a) => {
      if (q && !a.title.toLowerCase().includes(q)) return false;
      if (readiness !== 'all') {
        const r = readinessFromRow(a);
        if (r !== readiness) return false;
      }
      return true;
    });
  }, [search, rows, readiness]);

  const columns = useMemo(
    () => [
      {
        id: 'thumb',
        header: '',
        cell: ({ row }) => {
          const src = row.original.featuredImage;
          return src ? (
            <div className="size-8 overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="size-8 rounded-md border border-dashed bg-muted/30" />
          );
        },
        size: 44,
      },
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
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.title}
          </Link>
        ),
        size: 200,
      },
      {
        accessorKey: 'topicName',
        id: 'topic',
        header: 'Topic',
        size: 120,
      },
      {
        accessorKey: 'categoryName',
        id: 'cat',
        header: 'Category',
        cell: ({ getValue }) => {
          const v = getValue();
          return v ? (
            <Badge
              variant="secondary"
              size="fluid"
              className="w-full max-w-full justify-center text-balance"
            >
              {v}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        size: 140,
      },
      {
        accessorKey: 'status',
        id: 'stage',
        header: 'Stage',
        cell: ({ getValue }) => <PipelineStageBadge stage={getValue()} />,
        size: 120,
      },
      {
        id: 'ec',
        header: '',
        cell: ({ row }) =>
          row.original.isEditorsChoice ? (
            <span title="Editor’s choice">
              <Star className="size-4 fill-amber-400 text-amber-500" />
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        size: 36,
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
        cell: ({ row }) => (
          <ReadinessBadge
            className="w-full text-center"
            readiness={readinessFromRow(row.original)}
          />
        ),
        size: 120,
      },
      {
        id: 'stats',
        header: 'Stats',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {row.original.views ?? 0} / {row.original.likes ?? 0} / {row.original.commentsCount ?? 0}
          </span>
        ),
        size: 120,
      },
      {
        id: 'seo',
        header: 'SEO',
        cell: ({ row }) => (
          <span>
            {row.original.seoScore != null ? row.original.seoScore : '—'}
          </span>
        ),
        size: 56,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div
            className="flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                setEditing(row.original);
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
              onClick={() => {
                setDeleting({ id: row.original.id, title: row.original.title });
                setArchiveOpen(true);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
        size: 80,
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
      <div className="mt-4 space-y-3">
        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load articles</AlertTitle>
            <AlertDescription>{loadErrorMsg}</AlertDescription>
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
            <Select value={readiness} onValueChange={setReadiness}>
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
            <p className="text-[10px] text-muted-foreground mt-0.5">Rule enforced in M6+</p>
          </div>
        </div>
        <MockTableToolbar
          search={search}
          onSearchChange={setSearch}
          actionLabel="New article"
          onAction={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          placeholder="Search title…"
        />
        <ArticleFormDialog
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) {
              setEditing(null);
            }
          }}
          article={editing}
        />
        <ArticleArchiveDialog
          open={archiveOpen}
          onOpenChange={(o) => {
            setArchiveOpen(o);
            if (!o) setDeleting(null);
          }}
          article={deleting}
        />
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !loadError && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No articles yet. Create one to get started.
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
