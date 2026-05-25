'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { ChevronRight, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/custom/status-badge';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { SectionFormDialog } from './section-form-dialog';
import { SectionArchiveDialog } from './section-archive-dialog';

async function fetchSections() {
  const res = await apiFetch('/api/sections');
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load sections');
  }
  return res.json();
}

export function SectionsTable() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });
  const [formOpen, setFormOpen] = useState(false);
  const [formSection, setFormSection] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveSection, setArchiveSection] = useState(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['sections'],
    queryFn: fetchSections,
  });

  const rows = data?.data ?? [];

  const dataFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q) ||
        (s.characterName ?? '').toLowerCase().includes(q),
    );
  }, [search, rows]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        id: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader title="Name" column={column} />
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <Link
              className="font-medium text-primary hover:underline"
              href={`/dashboard/sections/${row.original.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.name}
            </Link>
            {row.original.slug && (
              <span className="text-xs text-muted-foreground font-mono">
                {row.original.slug}
              </span>
            )}
          </div>
        ),
        size: 200,
      },
      {
        accessorKey: 'characterName',
        id: 'characterName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Character" column={column} />
        ),
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center gap-2">
              {s.characterImage ? (
                <img
                  src={s.characterImage}
                  alt={s.characterName ?? ''}
                  className="size-7 rounded-full object-cover bg-muted"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {s.characterName ? s.characterName[0] : '?'}
                </div>
              )}
              <span>{s.characterName ?? '—'}</span>
            </div>
          );
        },
        size: 160,
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
        accessorKey: 'categoryCount',
        id: 'categoryCount',
        header: ({ column }) => (
          <DataGridColumnHeader title="Categories" column={column} />
        ),
        size: 100,
      },
      {
        accessorKey: 'createdAt',
        id: 'createdAt',
        header: ({ column }) => (
          <DataGridColumnHeader title="Created" column={column} />
        ),
        cell: ({ getValue }) => format(parseISO(getValue()), 'PP'),
        size: 120,
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
                  setFormSection(r);
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
                  setArchiveSection(r);
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
        size: 40,
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
      <div className="mt-4">
        {loadError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load sections</AlertTitle>
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

        <SectionFormDialog
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setFormSection(null);
          }}
          section={formSection}
        />
        <SectionArchiveDialog
          open={archiveOpen}
          onOpenChange={(o) => {
            setArchiveOpen(o);
            if (!o) setArchiveSection(null);
          }}
          section={archiveSection}
        />

        <MockTableToolbar
          search={search}
          onSearchChange={setSearch}
          actionLabel="Create section"
          onAction={() => {
            setFormSection(null);
            setFormOpen(true);
          }}
          placeholder="Filter sections"
        />
        {isFetching && !isLoading && (
          <p className="text-xs text-muted-foreground mb-2">Refreshing…</p>
        )}

        {showSkeleton ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !loadError && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No sections yet.{' '}
            <button
              type="button"
              className="text-primary underline font-medium"
              onClick={() => {
                setFormSection(null);
                setFormOpen(true);
              }}
            >
              Create your first section
            </button>
            .
          </p>
        ) : !loadError && dataFiltered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No sections match this filter.
          </p>
        ) : showTable ? (
          <Card>
            <DataGrid
              table={table}
              recordCount={dataFiltered.length}
              onRowClick={(row) => router.push(`/dashboard/sections/${row.id}`)}
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
