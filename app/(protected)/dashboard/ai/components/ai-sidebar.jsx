'use client';

import {
  ChevronRight,
  Clock,
  Copy,
  FileText,
  History,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const riskDot = {
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-success',
};

function SectionHeader({ label, icon: Icon }) {
  return (
    <div className="flex items-center gap-1.5 px-1">
      {Icon && <Icon className="size-3 text-muted-foreground" />}
      <span className="text-[0.675rem] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function ChatItem({ chat, isSelected, onSelect, onDelete, onCopyLink }) {
  const Icon = chat.icon;

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-md px-2 py-1 transition-colors',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 bg-transparent border-0 cursor-pointer text-left py-0.5"
      >
        <Icon
          className={cn(
            'size-4 shrink-0',
            isSelected ? 'text-primary' : 'text-muted-foreground/60',
          )}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-medium',
            isSelected ? 'text-primary' : 'text-foreground',
          )}
        >
          {chat.title}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity size-6"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onCopyLink && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopyLink(); }}>
              <Copy className="size-4" />
              <span>Copy Link</span>
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="size-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function QuickActions({ isCollapsed }) {
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        {[
          { icon: Star, label: 'Favorites' },
          { icon: Trash2, label: 'Clear History' },
          { icon: Settings, label: 'AI Settings' },
        ].map(({ icon: Icon, label }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button mode="icon" variant="ghost">
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <SectionHeader label="Quick Actions" />
      <div className="space-y-0.5">
        {[
          { icon: Star, label: 'Favorites', badge: { label: '2', variant: 'info' } },
          { icon: Trash2, label: 'Clear History' },
          { icon: History, label: 'Chat History' },
          { icon: FileText, label: 'Templates', badge: { label: '5', variant: 'destructive' } },
          { icon: Settings, label: 'AI Settings' },
        ].map(({ icon: Icon, label, badge }) => (
          <button
            key={label}
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-0"
          >
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            {badge && (
              <Badge
                variant={badge.variant}
                appearance="outline"
                size="sm"
                className="shrink-0"
              >
                {badge.label}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function PendingConfirmations({ items, onSelect }) {
  return (
    <div className="space-y-1.5">
      <SectionHeader label="Pending" icon={ShieldAlert} />
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">No pending actions.</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="group flex w-full items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <span
                className={cn(
                  'size-2 rounded-full shrink-0',
                  riskDot[item.risk] ?? 'bg-muted-foreground',
                )}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {item.label}
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionHistory({ items }) {
  return (
    <div className="space-y-1.5">
      <SectionHeader label="History" icon={History} />
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">No actions logged yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 px-1">
              <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-success/10">
                <Clock className="size-2.5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground leading-snug">
                  {item.action}
                </p>
                <p className="text-[0.65rem] text-muted-foreground mt-0.5">
                  {item.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AISidebar({
  isOpen,
  onToggle,
  chats,
  selectedChat,
  onChatSelect,
  onNewChat,
  onDeleteChat,
  pendingConfirmations = [],
  actionHistory = [],
  onPendingSelect,
}) {
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Chat link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col shrink-0 h-full overflow-hidden transition-[width] duration-300',
          'bg-background border border-input rounded-xl',
          isOpen ? 'w-64' : 'w-[60px]',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex shrink-0 items-center px-3 py-3.5 border-b border-border',
            isOpen ? 'justify-between' : 'justify-center',
          )}
        >
          {isOpen && (
            <span className="text-sm font-semibold text-foreground">AI Command</span>
          )}
          <Button mode="icon" variant="ghost" onClick={onToggle} className="shrink-0">
            {isOpen ? <PanelLeft /> : <PanelRight />}
          </Button>
        </div>

        {/* Scrollable content — plain div, no Radix ScrollArea */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3 space-y-4">
            {/* New Chat */}
            {isOpen ? (
              <button
                type="button"
                onClick={onNewChat}
                className="flex w-full items-center justify-between gap-2 rounded-full px-4 h-10 text-sm font-semibold text-white bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 transition-opacity cursor-pointer border-0 shadow-md"
              >
                <span>New Chat</span>
                <Sparkles className="size-3.5 shrink-0" />
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onNewChat}
                    className="flex size-10 items-center justify-center rounded-full text-white bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 transition-opacity cursor-pointer border-0 shadow-md mx-auto"
                  >
                    <Sparkles className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">New Chat</TooltipContent>
              </Tooltip>
            )}

            {/* Recent chats */}
            {isOpen && (
              <>
                <div className="space-y-1">
                  <SectionHeader label="Recent" />
                  <div className="space-y-0.5 mt-1">
                    {chats.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isSelected={selectedChat === chat.id}
                        onSelect={() => onChatSelect(chat.id)}
                        onDelete={() => onDeleteChat(chat.id)}
                        onCopyLink={handleCopyLink}
                      />
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            <QuickActions isCollapsed={!isOpen} />

            {isOpen && (
              <>
                <Separator />
                <PendingConfirmations items={pendingConfirmations} onSelect={onPendingSelect} />
                <Separator />
                <ActionHistory items={actionHistory} />
              </>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
