'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Container } from '@/components/common/container';
import { PipelineStageBadge } from '@/components/custom/pipeline-stage-badge';
import { ReadinessBadge } from '@/components/custom/readiness-badge';
import { PIPELINE_STAGES } from '@/app/(protected)/dashboard/_mock';
import { apiFetch } from '@/lib/api';
import { ArticleFormDialog } from './article-form-dialog';
import { ArticleArchiveDialog } from './article-archive-dialog';
import { ArticlesBulkBar } from './articles-bulk-bar';

const PAGE_SIZES = [25, 50, 100];

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

async function fetchJson(url) {
  const response = await apiFetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Request failed');
  }
  return response.json();
}

/** Header cell that toggles server-side sorting. */
function SortHead({ id, label, sort, dir, onSort, className }) {
  const active = sort === id;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => onSort(id)}
      >
        {label}
        {active &&
          (dir === 'asc' ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          ))}
      </button>
    </TableHead>
  );
}

export function ArticlesTable() {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [readiness, setReadiness] = useState('all');
  const [sort, setSort] = useState('publish');
  const [dir, setDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState(() => new Map());

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: sectionsJson } = useQuery({
    queryKey: ['sections'],
    queryFn: () => fetchJson('/api/sections'),
  });
  const sections = sectionsJson?.data ?? [];

  const { data: categoriesJson } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchJson('/api/categories'),
  });
  const allCategories = categoriesJson?.data ?? [];
  const categories = useMemo(
    () =>
      sectionId === 'all'
        ? allCategories
        : allCategories.filter((c) => c.sectionId === sectionId),
    [allCategories, sectionId],
  );

  const filters = { stage, sectionId, categoryId, readiness, search };

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['articles', filters, sort, dir, page, pageSize],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
        dir,
      });
      if (stage !== 'all') qs.set('status', stage);
      if (sectionId !== 'all') qs.set('sectionId', sectionId);
      if (categoryId !== 'all') qs.set('categoryId', categoryId);
      if (readiness !== 'all') qs.set('readiness', readiness);
      if (search) qs.set('search', search);
      return fetchJson(`/api/articles?${qs.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  // Any change to the result set puts you back on the first page.
  const resetPage = () => setPage(1);

  const handleSection = (value) => {
    setSectionId(value);
    resetPage();
    if (value === 'all') return;
    const stillValid = allCategories.some(
      (c) => c.id === categoryId && c.sectionId === value,
    );
    if (!stillValid) setCategoryId('all');
  };

  const handleSort = (id) => {
    if (sort === id) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(id);
      setDir(id === 'title' ? 'asc' : 'desc');
    }
    resetPage();
  };

  const toggleRow = (row, checked) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(row.id, row);
      else next.delete(row.id);
      return next;
    });
  };

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAllOnPage = (checked) => {
    setSelected((prev) => {
      const next = new Map(prev);
      rows.forEach((r) => (checked ? next.set(r.id, r) : next.delete(r.id)));
      return next;
    });
  };

  const selectedRows = useMemo(() => [...selected.values()], [selected]);
  const clearSelection = () => setSelected(new Map());

  const pageButtons = useMemo(() => {
    const span = 5;
    const start = Math.max(Math.min(page - 2, pageCount - span + 1), 1);
    const end = Math.min(start + span - 1, pageCount);
    const out = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }, [page, pageCount]);

  return (
    <Container>
      <div className="mt-4 space-y-3">
        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load articles</AlertTitle>
            <AlertDescription>{error?.message}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs">Stage</Label>
            <Select
              value={stage}
              onValueChange={(v) => {
                setStage(v);
                resetPage();
              }}
            >
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
            <Label className="text-xs">Section</Label>
            <Select value={sectionId} onValueChange={handleSection}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                resetPage();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
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
            <Select
              value={readiness}
              onValueChange={(v) => {
                setReadiness(v);
                resetPage();
              }}
            >
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
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-8"
              placeholder="Search title…"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                resetPage();
              }}
            />
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="me-1.5 size-4" />
            New article
          </Button>
        </div>

        <ArticlesBulkBar
          selectedRows={selectedRows}
          onClearSelection={clearSelection}
        />

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    size="sm"
                    checked={allOnPageSelected}
                    onCheckedChange={(v) => toggleAllOnPage(v === true)}
                    aria-label="Select all on page"
                  />
                </TableHead>
                <SortHead
                  id="title"
                  label="Title"
                  sort={sort}
                  dir={dir}
                  onSort={handleSort}
                />
                <TableHead>Topic</TableHead>
                <TableHead>Category</TableHead>
                <SortHead
                  id="stage"
                  label="Stage"
                  sort={sort}
                  dir={dir}
                  onSort={handleSort}
                />
                <TableHead className="w-9" />
                <SortHead
                  id="publish"
                  label="Publish"
                  sort={sort}
                  dir={dir}
                  onSort={handleSort}
                />
                <SortHead
                  id="readyBy"
                  label="Ready by"
                  sort={sort}
                  dir={dir}
                  onSort={handleSort}
                />
                <TableHead>Readiness</TableHead>
                <TableHead className="text-nowrap">V / L / C</TableHead>
                <SortHead
                  id="seo"
                  label="SEO"
                  sort={sort}
                  dir={dir}
                  onSort={handleSort}
                />
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                    Loading articles…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                    No articles match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    data-state={selected.has(row.id) ? 'selected' : undefined}
                    onClick={() => router.push(`/dashboard/articles/${row.id}`)}
                  >
                    <TableCell
                      className="py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        size="sm"
                        checked={selected.has(row.id)}
                        onCheckedChange={(v) => toggleRow(row, v === true)}
                        aria-label="Select row"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Link
                        href={`/dashboard/articles/${row.id}`}
                        className="block max-w-[22rem] truncate font-medium text-primary hover:underline"
                        title={row.title}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.title}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="block max-w-[10rem] truncate text-muted-foreground">
                        {row.topicName || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      {row.categoryName ? (
                        <Badge variant="secondary" className="max-w-[11rem] truncate">
                          {row.categoryName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <PipelineStageBadge stage={row.status} />
                    </TableCell>
                    <TableCell className="py-2">
                      {row.isEditorsChoice ? (
                        <Star
                          className="size-4 fill-amber-400 text-amber-500"
                          title="Editor’s choice"
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="py-2 text-nowrap">
                      {formatDate(row.publishDate)}
                    </TableCell>
                    <TableCell className="py-2 text-nowrap">
                      {formatDate(row.readinessDeadline)}
                    </TableCell>
                    <TableCell className="py-2">
                      <ReadinessBadge readiness={readinessFromRow(row)} />
                    </TableCell>
                    <TableCell className="py-2 text-nowrap text-xs text-muted-foreground">
                      {row.views ?? 0} / {row.likes ?? 0} / {row.commentsCount ?? 0}
                    </TableCell>
                    <TableCell className="py-2">
                      {row.seoScore ?? '—'}
                    </TableCell>
                    <TableCell
                      className="py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Edit article"
                          onClick={() => {
                            setEditing(row);
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
                          aria-label="Archive article"
                          onClick={() => {
                            setDeleting({ id: row.id, title: row.title });
                            setArchiveOpen(true);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  resetPage();
                }}
              >
                <SelectTrigger className="w-fit" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-nowrap">
                {firstRow} – {lastRow} of {total}
                {isFetching ? ' · updating…' : ''}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {pageButtons.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={p === page ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-7 text-sm"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(p + 1, pageCount))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </Card>

        <ArticleFormDialog
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setEditing(null);
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
      </div>
    </Container>
  );
}
