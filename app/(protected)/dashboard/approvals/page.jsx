'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import {
  CheckCheck,
  XCircle,
  ExternalLink,
  Pencil,
  Loader2,
  AlertCircle,
  FileText,
  CalendarDays,
  BarChart2,
  Tag,
  Eye,
} from 'lucide-react';
import { PageHeader } from '@/components/custom/page-header';
import { Container } from '@/components/common/container';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api';
import { ContentRenderer } from '@/components/custom/content-renderer';
import { ArticleFormDialog } from '@/app/(protected)/dashboard/articles/components/article-form-dialog';

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchApprovalArticles() {
  const res = await apiFetch('/api/articles?status=approval');
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load articles');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(v) {
  if (!v) return null;
  try {
    return format(typeof v === 'string' ? parseISO(v) : v, 'PP');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Article preview modal (Open) — shows content with Approve / Reject in footer
// ---------------------------------------------------------------------------

function ArticlePreviewModal({ article, open, onOpenChange, onApprove, onReject, isDecisionLoading }) {
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectMode, setRejectMode] = useState(false);

  function handleClose() {
    setRejectMode(false);
    setRejectNotes('');
    onOpenChange(false);
  }

  function handleRejectSubmit() {
    onReject(rejectNotes);
    setRejectMode(false);
    setRejectNotes('');
  }

  if (!article) return null;

  const publishDateStr = fmtDate(article.publishDate);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Hero image with title overlay — or plain header if no image */}
        {article.featuredImage ? (
          <div className="relative shrink-0 h-52 sm:h-64 overflow-hidden rounded-t-xl">
            <img
              src={article.featuredImage}
              alt={article.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            {/* text on top */}
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 pt-8">
              <DialogTitle className="text-white text-xl leading-snug drop-shadow pr-8">
                {article.title}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {article.categoryName && (
                  <Badge className="text-xs gap-1 bg-white/20 text-white border-white/30 backdrop-blur-sm">
                    <Tag className="size-3" />
                    {article.categoryName}
                  </Badge>
                )}
                {publishDateStr && (
                  <span className="text-xs text-white/80 flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {publishDateStr}
                  </span>
                )}
                {article.seoScore != null && (
                  <span className="text-xs text-white/80 flex items-center gap-1">
                    <BarChart2 className="size-3" />
                    SEO {article.seoScore}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle className="text-lg leading-snug pr-6">{article.title}</DialogTitle>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {article.categoryName && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Tag className="size-3" />
                  {article.categoryName}
                </Badge>
              )}
              {publishDateStr && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {publishDateStr}
                </span>
              )}
              {article.seoScore != null && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <BarChart2 className="size-3" />
                  SEO {article.seoScore}
                </span>
              )}
            </div>
          </DialogHeader>
        )}

        <Separator />

        {/* Scrollable content body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          {article.summary && (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{article.summary}</p>
          )}
          <ContentRenderer content={article.content} />
        </div>

        <Separator />

        {/* Footer — reject mode toggles to show notes field */}
        <div className="px-6 py-4 shrink-0 space-y-3">
          {rejectMode && (
            <div className="space-y-2">
              <Label htmlFor="preview-reject-notes">Reason / feedback (optional)</Label>
              <Textarea
                id="preview-reject-notes"
                rows={2}
                placeholder="Explain what needs to be revised…"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/articles/${article.id}`} target="_blank">
                <ExternalLink className="me-1.5 size-3.5" />
                Full view
              </Link>
            </Button>
            <div className="flex-1" />
            {rejectMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setRejectMode(false); setRejectNotes(''); }}
                  disabled={isDecisionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRejectSubmit}
                  disabled={isDecisionLoading}
                >
                  {isDecisionLoading && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
                  Confirm reject
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectMode(true)}
                  disabled={isDecisionLoading}
                >
                  <XCircle className="me-1.5 size-3.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={isDecisionLoading}
                >
                  {isDecisionLoading ? (
                    <Loader2 className="me-1.5 size-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="me-1.5 size-3.5" />
                  )}
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Single article approval card
// ---------------------------------------------------------------------------

function ArticleApprovalCard({ article, onOpen, onApprove, onReject, onEdit }) {
  const publishDateStr = fmtDate(article.publishDate);

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        {/* Title + meta */}
        <div>
          <p className="font-semibold text-base leading-snug">{article.title}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {article.categoryName && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Tag className="size-3" />
                {article.categoryName}
              </Badge>
            )}
            {publishDateStr && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="size-3" />
                {publishDateStr}
              </span>
            )}
            {article.seoScore != null && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <BarChart2 className="size-3" />
                SEO {article.seoScore}
              </span>
            )}
          </div>
        </div>

        {/* Summary */}
        {article.summary && (
          <p className="text-sm text-muted-foreground line-clamp-3">{article.summary}</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpen(article)}>
            <Eye className="me-1.5 size-3.5" />
            Open
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(article)}>
            <Pencil className="me-1.5 size-3.5" />
            Edit
          </Button>
          <div className="flex-1" />
          <Button variant="destructive" size="sm" onClick={() => onReject(article)}>
            <XCircle className="me-1.5 size-3.5" />
            Reject
          </Button>
          <Button size="sm" onClick={() => onApprove(article)}>
            <CheckCheck className="me-1.5 size-3.5" />
            Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ApprovalsPage() {
  const queryClient = useQueryClient();

  const [previewArticle, setPreviewArticle] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['articles', 'approval'],
    queryFn: fetchApprovalArticles,
  });

  const articles = data?.data ?? [];

  const decisionMutation = useMutation({
    mutationFn: async ({ id, action, notes }) => {
      const res = await apiFetch(`/api/articles/${id}/approval/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes ?? null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Request failed');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const isApprove = variables.action === 'approve';
      toast.custom(() => (
        <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg text-sm font-medium">
          <RiCheckboxCircleFill className="size-4 text-green-500 shrink-0" />
          {isApprove
            ? 'Article approved and queued for WordPress publishing'
            : 'Article rejected — sent back to writing'}
        </div>
      ), { position: 'top-center' });
      setApproveTarget(null);
      setRejectTarget(null);
      setPreviewArticle(null);
      queryClient.invalidateQueries({ queryKey: ['articles', 'approval'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: (err) => {
      toast.custom(() => (
        <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg text-sm font-medium text-destructive">
          <RiErrorWarningFill className="size-4 shrink-0" />
          {err.message}
        </div>
      ), { position: 'top-center' });
    },
  });

  const isDecisionLoading = decisionMutation.status === 'pending';

  // Card-level quick approve/reject (no preview)
  function handleApproveConfirm() {
    if (!approveTarget) return;
    decisionMutation.mutate({ id: approveTarget.id, action: 'approve' });
  }

  function handleRejectConfirm(notes) {
    if (!rejectTarget) return;
    decisionMutation.mutate({ id: rejectTarget.id, action: 'reject', notes });
  }

  // Preview modal approve/reject
  function handlePreviewApprove() {
    if (!previewArticle) return;
    decisionMutation.mutate({ id: previewArticle.id, action: 'approve' });
  }

  function handlePreviewReject(notes) {
    if (!previewArticle) return;
    decisionMutation.mutate({ id: previewArticle.id, action: 'reject', notes });
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Review articles ready for publishing. Approve to send to WordPress, reject to send back for revision."
      />
      <Container>
        <div className="mt-4">
          {isError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertTitle>Could not load articles</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                {error?.message}
                <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pending
                {articles.length > 0 && (
                  <Badge variant="destructive" appearance="light" size="sm" className="ms-2">
                    {articles.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>

            {/* Pending tab — live data */}
            <TabsContent value="pending" className="mt-4">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </div>
              ) : articles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-lg text-center gap-3">
                  <FileText className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">No articles pending approval</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Articles will appear here once they complete the writing &amp; assets pipeline stages.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {articles.map((article) => (
                    <ArticleApprovalCard
                      key={article.id}
                      article={article}
                      onOpen={setPreviewArticle}
                      onApprove={setApproveTarget}
                      onReject={setRejectTarget}
                      onEdit={setEditTarget}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Approved / Rejected tabs — history not yet tracked */}
            <TabsContent value="approved" className="mt-4">
              <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-lg text-center gap-3">
                <CheckCheck className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Approval history coming soon</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  A full audit log of approved articles will be available in a future update.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="rejected" className="mt-4">
              <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-lg text-center gap-3">
                <XCircle className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Rejection history coming soon</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  A full audit log of rejected articles will be available in a future update.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Container>

      {/* Article preview modal */}
      <ArticlePreviewModal
        article={previewArticle}
        open={Boolean(previewArticle)}
        onOpenChange={(o) => { if (!o) setPreviewArticle(null); }}
        onApprove={handlePreviewApprove}
        onReject={handlePreviewReject}
        isDecisionLoading={isDecisionLoading}
      />

      {/* Quick-approve confirm dialog (from card button) */}
      <Dialog
        open={Boolean(approveTarget)}
        onOpenChange={(o) => { if (!o) setApproveTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve article?</DialogTitle>
            <DialogDescription>
              &ldquo;{approveTarget?.title}&rdquo; will be queued for WordPress publishing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)} disabled={isDecisionLoading}>
              Cancel
            </Button>
            <Button onClick={handleApproveConfirm} disabled={isDecisionLoading}>
              {isDecisionLoading && <Loader2 className="me-1.5 size-4 animate-spin" />}
              Approve &amp; publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-reject dialog (from card button) */}
      <QuickRejectDialog
        article={rejectTarget}
        open={Boolean(rejectTarget)}
        onOpenChange={(o) => { if (!o) setRejectTarget(null); }}
        onConfirm={handleRejectConfirm}
        isLoading={isDecisionLoading}
      />

      {/* Edit article dialog */}
      <ArticleFormDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        article={editTarget}
      />
    </>
  );
}

function QuickRejectDialog({ article, open, onOpenChange, onConfirm, isLoading }) {
  const [notes, setNotes] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setNotes(''); onOpenChange(o); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject article</DialogTitle>
          <DialogDescription>
            &ldquo;{article?.title}&rdquo; will be sent back to the writing stage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="reject-notes">Reason / feedback (optional)</Label>
          <Textarea
            id="reject-notes"
            rows={3}
            placeholder="Explain what needs to be revised…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(notes)}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="me-1.5 size-4 animate-spin" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
