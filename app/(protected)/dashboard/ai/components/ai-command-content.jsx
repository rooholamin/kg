'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ACTION_HISTORY,
  CHAT_MESSAGES,
  DEFAULT_MESSAGES,
  PENDING_CONFIRMATIONS,
  RECENT_CHATS,
  SUGGESTED_PROMPTS,
} from '../mock/chat-threads';
import { AIChatArea } from './ai-chat-area';
import { AISidebar } from './ai-sidebar';

export function AiCommandContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chats, setChats] = useState(RECENT_CHATS);
  const [selectedChat, setSelectedChat] = useState('1');
  const [messages, setMessages] = useState(CHAT_MESSAGES['1']);
  const [message, setMessage] = useState('');

  const handleSend = (text) => {
    const t = text ?? message;
    if (!t.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: t, timestamp: 'just now' },
      {
        id: `b-${Date.now()}`,
        role: 'assistant',
        content:
          'Simulated response — no execution performed. **AI actions activate in Milestone 9.**',
        timestamp: 'just now',
        isSimulated: true,
      },
    ]);
    setMessage('');
  };

  const handleNewChat = () => {
    setMessages([]);
    setSelectedChat(null);
  };

  const handleDeleteChat = (chatId) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    toast.success('Chat deleted');
    if (selectedChat === chatId) {
      setSelectedChat(null);
      setMessages([]);
    }
  };

  const handleChatSelect = (chatId) => {
    setSelectedChat(chatId);
    setMessages(CHAT_MESSAGES[chatId] ?? DEFAULT_MESSAGES);
  };

  // Clicking a pending item opens its linked chat thread
  const handlePendingSelect = (pendingItem) => {
    const { chatId } = pendingItem;
    setSelectedChat(chatId);
    setMessages(CHAT_MESSAGES[chatId] ?? DEFAULT_MESSAGES);
  };

  return (
    <div className="flex items-stretch gap-2.5 overflow-hidden h-[calc(100vh-var(--header-height,70px)-2.5rem)] px-5 pb-5">
      <AISidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((v) => !v)}
        chats={chats}
        selectedChat={selectedChat}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        pendingConfirmations={PENDING_CONFIRMATIONS}
        actionHistory={ACTION_HISTORY}
        onPendingSelect={handlePendingSelect}
      />
      <AIChatArea
        messages={messages}
        message={message}
        onMessageChange={setMessage}
        onSend={handleSend}
        suggestedPrompts={SUGGESTED_PROMPTS}
      />
    </div>
  );
}
