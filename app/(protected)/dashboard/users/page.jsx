'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/custom/page-header';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { Container } from '@/components/common/container';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ShieldAlert, UserCog } from 'lucide-react';

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchUsers() {
  const res = await apiFetch('/api/user-management/users?limit=100');
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

async function fetchRoles() {
  const res = await apiFetch('/api/user-management/roles/select');
  if (!res.ok) return [];
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_VARIANT = {
  superadmin: 'destructive',
  admin: 'primary',
  editor: 'success',
};

function roleVariant(slug) {
  return ROLE_VARIANT[slug?.toLowerCase()] ?? 'secondary';
}

function statusMap(s) {
  if (s === 'ACTIVE') return { label: 'Active', variant: 'success' };
  if (s === 'INACTIVE') return { label: 'Inactive', variant: 'secondary' };
  if (s === 'BANNED') return { label: 'Banned', variant: 'destructive' };
  return { label: s ?? '—', variant: 'secondary' };
}

function fmtDate(v) {
  if (!v) return '—';
  try {
    return format(typeof v === 'string' ? parseISO(v) : v, 'PP');
  } catch {
    return '—';
  }
}

// ---------------------------------------------------------------------------
// Change role dialog
// ---------------------------------------------------------------------------

function ChangeRoleDialog({ user, roles, open, onOpenChange, onSuccess }) {
  const [selectedRoleId, setSelectedRoleId] = useState(user?.role?.id ?? '');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/user-management/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: selectedRoleId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to update role');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Role updated for ${user.name || user.email}`);
      queryClient.invalidateQueries({ queryKey: ['dashboard-users'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  function handleOpen(v) {
    if (v) setSelectedRoleId(user?.role?.id ?? '');
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>User</Label>
          <p className="text-sm font-medium">{user?.name || user?.email}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-select">New role</Label>
          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger id="role-select">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || selectedRoleId === user?.role?.id}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardUsersPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.roleSlug === 'superadmin';

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [roleTarget, setRoleTarget] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-users'],
    queryFn: fetchUsers,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles-select'],
    queryFn: fetchRoles,
    enabled: isSuperAdmin,
  });

  const users = data?.data ?? [];

  // Role stats
  const roleStats = users.reduce((acc, u) => {
    const slug = u.role?.name ?? 'Unknown';
    acc[slug] = (acc[slug] ?? 0) + 1;
    return acc;
  }, {});

  const columns = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataGridColumnHeader title="Name" column={column} />,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
      size: 200,
    },
    {
      id: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const roleName = row.original.role?.name ?? '—';
        const roleSlug = roleName.toLowerCase().replace(/\s+/g, '');
        return (
          <Badge variant={roleVariant(roleSlug)} appearance="light">
            {roleName}
          </Badge>
        );
      },
      size: 120,
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
      accessorKey: 'lastSignInAt',
      header: 'Last sign in',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{fmtDate(getValue())}</span>
      ),
      size: 130,
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRoleTarget(row.original)}
              >
                <UserCog className="size-3.5 me-1.5" />
                Change role
              </Button>
            ),
            size: 130,
          },
        ]
      : []),
  ];

  const table = useReactTable({
    data: users,
    getRowId: (r) => r.id,
    columns,
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
        description="Manage team members and their access roles."
      />
      <Container>
        <div className="mt-4">
          {isError && (
            <Alert variant="destructive" className="mb-4">
              <ShieldAlert className="size-4" />
              <AlertDescription>Failed to load users.</AlertDescription>
            </Alert>
          )}

          {/* Role stats */}
          {!isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4 max-w-2xl">
              {Object.entries(roleStats).map(([name, count]) => (
                <div key={name} className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">{name}</p>
                  <p className="text-2xl font-semibold">{count}</p>
                </div>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Card>
              <DataGrid table={table} recordCount={users.length}>
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

      {roleTarget && (
        <ChangeRoleDialog
          user={roleTarget}
          roles={roles}
          open={Boolean(roleTarget)}
          onOpenChange={(v) => { if (!v) setRoleTarget(null); }}
        />
      )}
    </>
  );
}
