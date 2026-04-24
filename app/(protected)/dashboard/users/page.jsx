'use client';

import { useMemo, useState } from 'react';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/custom/page-header';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { MOCK_USERS } from '@/app/(protected)/dashboard/_mock';
import { UserPlus } from 'lucide-react';

const roleVariant = (role) => (role === 'Admin' ? 'primary' : 'secondary');

const statusMap = (s) => {
  if (s === 'ACTIVE') return { label: 'Active', variant: 'success' };
  if (s === 'INACTIVE') return { label: 'Inactive', variant: 'secondary' };
  return { label: s, variant: 'secondary' };
};

export default function DashboardUsersPage() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 6 });
  const data = useMemo(() => MOCK_USERS, []);

  const table = useReactTable({
    data,
    getRowId: (r) => r.id,
    columns: [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataGridColumnHeader title="Name" column={column} />,
        size: 160,
      },
      {
        accessorKey: 'email',
        header: 'Email',
        size: 200,
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ getValue }) => (
          <Badge variant={roleVariant(getValue())} appearance="light">
            {getValue()}
          </Badge>
        ),
        size: 100,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const p = statusMap(getValue());
          return (
            <Badge variant={p.variant} appearance="ghost" size="sm">
              <BadgeDot />
              {p.label}
            </Badge>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'lastActive',
        header: 'Last active',
        cell: ({ getValue }) => format(parseISO(getValue()), 'PPp'),
        size: 160,
      },
    ],
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      <PageHeader
        title="Users &amp; roles"
        description="Team access (shell). The Metronic user module remains at /user-management for full CRUD."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button disabled>
              <UserPlus />
              Invite user (M2+)
            </Button>
            <Button variant="outline" asChild>
              <Link href="/user-management/users">Metronic: Users</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/user-management/roles">Metronic: Roles</Link>
            </Button>
          </div>
        }
      />
      <Container>
        <MilestoneNote milestone={2}>
          This table is mock. Production auth and invites use existing user-management APIs.
        </MilestoneNote>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Admin</p>
            <p className="text-2xl font-semibold">1</p>
            <p className="text-xs text-muted-foreground mt-1">Full access (mock)</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">User</p>
            <p className="text-2xl font-semibold">2</p>
            <p className="text-xs text-muted-foreground mt-1">Scoped (mock)</p>
          </div>
        </div>
        <Card className="mt-4">
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
      </Container>
    </>
  );
}
