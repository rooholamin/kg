'use client';

import {
  Bot,
  CheckCircle,
  Copy,
  MoreHorizontal,
  RotateCcw,
  Share2,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarIndicator,
  AvatarStatus,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function parseInline(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-muted-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function renderContent(content) {
  const lines = content.split('\n');
  const elements = [];
  let currentList = null;

  const flushList = () => {
    if (!currentList) return;
    if (currentList.type === 'ul') {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-3 space-y-1.5">
          {currentList.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 pl-1">
              <span className="mt-2 size-1 rounded-full bg-current shrink-0 opacity-70" />
              <span className="flex-1">{parseInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
    } else {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-3 space-y-1.5">
          {currentList.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 pl-1">
              <span className="font-medium text-muted-foreground text-sm shrink-0">
                {i + 1}.
              </span>
              <span className="flex-1">{parseInline(item)}</span>
            </li>
          ))}
        </ol>,
      );
    }
    currentList = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      if (elements.length > 0) {
        elements.push(<div key={`space-${index}`} className="h-3" />);
      }
      return;
    }

    if (trimmed.match(/^[•\-*]\s/)) {
      const text = trimmed.replace(/^[•\-*]\s*/, '');
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(text);
      return;
    }

    const numberMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberMatch) {
      const text = numberMatch[2];
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(text);
      return;
    }

    if (
      (trimmed.startsWith('**') && trimmed.endsWith('**')) ||
      trimmed.startsWith('###')
    ) {
      flushList();
      const headerText = trimmed
        .replace(/^###\s*/, '')
        .replace(/^\*\*|\*\*$/g, '');
      elements.push(
        <h3
          key={index}
          className="font-bold text-[15px] mt-5 mb-2.5 first:mt-0 text-muted-foreground"
        >
          {headerText}
        </h3>,
      );
      return;
    }

    flushList();
    elements.push(
      <p key={index} className="my-1 leading-relaxed">
        {parseInline(line)}
      </p>,
    );
  });

  flushList();
  return elements;
}

const riskVariant = { high: 'destructive', medium: 'warning', low: 'success' };

export function AIActionCard({ label, detail, risk, timestamp, onApprove, onReject }) {
  return (
    <div className="flex items-start gap-3 py-4">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-warning/10">
          <ShieldAlert className="size-4 text-warning" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2 max-w-[90%]">
        <div className="rounded-2xl rounded-bl-sm border border-warning/30 bg-warning/5 px-5 py-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={riskVariant[risk] ?? 'secondary'} appearance="light" size="sm">
              {risk} risk
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Action required
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{detail}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                toast.success('Action approved — will execute in Milestone 9.');
                onApprove?.();
              }}
            >
              <CheckCircle className="size-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => {
                toast.info('Action rejected.');
                onReject?.();
              }}
            >
              <XCircle className="size-3.5" />
              Reject
            </Button>
          </div>
          <p className="text-[0.65rem] text-muted-foreground">
            No actions execute until Milestone 9 — buttons are wired for UI preview only.
          </p>
        </div>
        {timestamp && (
          <span className="text-xs text-muted-foreground px-1">{timestamp}</span>
        )}
      </div>
    </div>
  );
}

export function AIChatMessage({ role, content, timestamp, isSimulated }) {
  const isUser = role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Message copied to clipboard');
    } catch {
      toast.error('Failed to copy message');
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 py-4',
        isUser && 'flex-row-reverse',
      )}
    >
      {isUser ? (
        <Avatar className="size-9 shrink-0">
          <AvatarImage src="/media/avatars/300-2.png" alt="You" />
          <AvatarFallback>U</AvatarFallback>
          <AvatarIndicator className="-end-1.5 -top-1.5">
            <AvatarStatus variant="online" className="size-2.5" />
          </AvatarIndicator>
        </Avatar>
      ) : (
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-primary/10">
            <Bot className="size-4 text-primary" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col gap-1 flex-1', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-5 py-3.5 text-sm shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground max-w-[85%] rounded-br-sm'
              : 'bg-muted/50 text-foreground max-w-[90%] rounded-bl-sm',
          )}
        >
          {isSimulated && !isUser && (
            <p className="text-xs text-muted-foreground mb-2 opacity-70">
              Simulated response
            </p>
          )}
          <div className="text-sm">{renderContent(content)}</div>

          {!isUser && (
            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={handleCopy}
                title="Copy"
              >
                <Copy className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => toast.success('Feedback submitted')}
                title="Thumbs up"
              >
                <ThumbsUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => toast.success('Feedback submitted')}
                title="Thumbs down"
              >
                <ThumbsDown className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => toast.info('Share')}
                title="Share"
              >
                <Share2 className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => toast.info('Regenerating...')}
                title="Regenerate"
              >
                <RotateCcw className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                title="More"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
        {timestamp && (
          <span className="text-xs text-muted-foreground px-1">{timestamp}</span>
        )}
      </div>
    </div>
  );
}
