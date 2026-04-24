'use client';

import { useEffect, useRef } from 'react';
import { Bot, Mic, Paperclip, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AIActionCard, AIChatMessage } from './ai-chat-message';

function WelcomeScreen({ onSuggestSelect }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center overflow-auto">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-5 shrink-0">
        <Bot className="size-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        AI Command Center
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-8">
        Your natural-language control surface for the Automation Magazine
        pipeline. Ask anything about articles, topics, readiness, or SEO.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {[
          'What articles are at risk this month?',
          'Summarize pipeline health for this week',
          'List topics with zero published articles',
          'Which articles need SEO review?',
        ].map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSuggestSelect(prompt)}
            className="text-left rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AIChatArea({
  messages,
  message,
  onMessageChange,
  onSend,
  suggestedPrompts,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-background border border-input rounded-xl overflow-hidden">
      {/* Messages / welcome area — grows and scrolls */}
      {hasMessages ? (
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5">
            {messages.map((m) =>
              m.role === 'action' ? (
                <AIActionCard
                  key={m.id}
                  label={m.label}
                  detail={m.detail}
                  risk={m.risk}
                  timestamp={m.timestamp}
                />
              ) : (
                <AIChatMessage
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  timestamp={m.timestamp}
                  isSimulated={m.isSimulated}
                />
              ),
            )}
            <div ref={bottomRef} className="h-4" />
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 min-h-0">
          <WelcomeScreen onSuggestSelect={(prompt) => onSend(prompt)} />
        </div>
      )}

      {/* Input — fixed at bottom */}
      <div className="shrink-0 border-t border-border p-4">
        <div className="space-y-3">
          {/* Suggested prompts */}
          {hasMessages && suggestedPrompts.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="size-3.5 text-muted-foreground shrink-0" />
              {suggestedPrompts.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSend(s)}
                  className="text-xs rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input box */}
          <div className="flex flex-col gap-2 bg-muted/30 rounded-2xl border border-border shadow-sm p-4">
            <Input
              type="text"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Ask the AI Command Center anything…"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground h-auto px-0 text-sm py-1"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <Paperclip className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <Mic className="size-4" />
                </Button>
              </div>
              <Button
                variant={message.trim() ? 'default' : 'secondary'}
                size="icon"
                className={cn(
                  'size-9 rounded-xl transition-all',
                  !message.trim() && 'opacity-50',
                )}
                onClick={() => onSend()}
                disabled={!message.trim()}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Responses are static until Milestone 9. No actions are executed.
          </p>
        </div>
      </div>
    </div>
  );
}
