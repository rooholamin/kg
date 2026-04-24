'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/custom/page-header';
import { Card, CardTable, CardFooter } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { MOCK_LOGS } from '@/app/(protected)/dashboard/_mock';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function LogsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 7 });

  const data = useMemo(() => {
    return MOCK_LOGS.filter((e) => {
      const q = search.toLowerCase();
      if (q) {
        const s = [
          e.message,
          e.user,
          e.type,
          e.entity,
        ]
          .join(' ')
          .toLowerCase();
        if (!s.includes(q)) return false;
      }
      if (type !== 'all' && e.type !== type) return false;
      return true;
    });
  }, [search, type]);

  const table = useReactTable({
    data,
    getRowId: (r) => r.id,
    columns: [
      {
        accessorKey: 'at',
        header: ({ column }) => <DataGridColumnHeader title="Time" column={column} />,
        cell: ({ getValue }) => format(parseISO(getValue()), 'PPp'),
        size: 180,
      },
      {
        accessorKey: 'type',
        header: ({ column }) => <DataGridColumnHeader title="Type" column={column} />,
        size: 100,
      },
      {
        accessorKey: 'message',
        header: 'Event',
        size: 240,
      },
      {
        accessorKey: 'user',
        header: 'User / source',
        size: 120,
      },
      {
        accessorKey: 'entity',
        header: 'Entity',
        size: 100,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const v = getValue();
          const map = {
            success: 'success',
            error: 'destructive',
            warning: 'warning',
            info: 'secondary',
          };
          return (
            <Badge variant={map[v] || 'secondary'} size="sm" appearance="light">
              {v}
            </Badge>
          );
        },
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
        title="System logs"
        description="Global audit and activity. Real log pipeline in Milestone 7."
      />
      <Container>
        <MilestoneNote milestone={7}>Immutability and full filters in Milestone 7</MilestoneNote>
        <div className="mt-4 space-y-3">
          <div className="w-full sm:w-48">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {['System', 'User', 'Pipeline', 'Integration', 'Approval'].map(
                  (t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <MockTableToolbar
            search={search}
            onSearchChange={setSearch}
            actionLabel={null}
            onAction={() => {}}
            placeholder="Search log text…"
          />
          <Card>
            <DataGrid table={table} recordCount={data.length}>
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
        </div>
      </Container>
    </>
  );
}
