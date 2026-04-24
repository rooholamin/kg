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
import { format, parseISO } from 'date-fns';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/custom/status-badge';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { MOCK_CATEGORIES } from '@/app/(protected)/dashboard/_mock';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { ChevronRight } from 'lucide-react';

export function CategoriesTable() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });

  const data = useMemo(() => {
    const q = search.toLowerCase();
    return MOCK_CATEGORIES.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [search]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        id: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader title="Name" column={column} />
        ),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/dashboard/categories/${row.original.id}`}
          >
            {row.original.name}
          </Link>
        ),
        size: 200,
      },
      {
        accessorKey: 'description',
        id: 'description',
        header: ({ column }) => (
          <DataGridColumnHeader title="Description" column={column} />
        ),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground line-clamp-2 max-w-md">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        id: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        cell: ({ getValue }) => (
          <StatusBadge
            variant={getValue() === 'active' ? 'active' : 'archived'}
          >
            {getValue()}
          </StatusBadge>
        ),
        size: 100,
      },
      {
        accessorKey: 'topicCount',
        id: 'topicCount',
        header: ({ column }) => (
          <DataGridColumnHeader title="Topics" column={column} />
        ),
        size: 80,
      },
      {
        accessorKey: 'articleCount',
        id: 'articleCount',
        header: ({ column }) => (
          <DataGridColumnHeader title="Articles" column={column} />
        ),
        size: 80,
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
        id: 'go',
        header: '',
        cell: () => <ChevronRight className="size-4 text-muted-foreground" />,
        size: 40,
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
      <MilestoneNote milestone={3}>Real CRUD for categories in Milestone 3.</MilestoneNote>
      <div className="mt-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Create category</SheetTitle>
              <SheetDescription>Form is non-persistent. TODO(M3)</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-3">
              <div>
                <Label>Name</Label>
                <Input placeholder="e.g. Finance" disabled />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={3} disabled placeholder="Short summary…" />
              </div>
              <Button disabled className="w-full">
                Save (inactive)
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <MockTableToolbar
          search={search}
          onSearchChange={setSearch}
          actionLabel="Create (opens sheet)"
          onAction={() => setOpen(true)}
          placeholder="Filter categories"
        />
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No categories match. TODO(M2): empty state with seed action
          </p>
        ) : (
          <Card>
            <DataGrid
              table={table}
              recordCount={data.length}
              onRowClick={(row) =>
                router.push(`/dashboard/categories/${row.id}`)
              }
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
        )}
      </div>
    </Container>
  );
}
