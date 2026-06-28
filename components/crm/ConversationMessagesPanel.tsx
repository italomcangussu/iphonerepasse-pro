import type React from "react";
import { memo } from "react";
import { ArrowDown } from "lucide-react";
import MessageBubble, { type MessageBubbleMessage } from "./MessageBubble";
import type { ReactionSummary } from "../../lib/crm/groupReactions";
import { resolveMetaCampaignPreviewData } from "../../lib/crm/messageUtils";
import {
  ConversationWorkspaceState,
  MessageThreadSkeleton,
} from "./ConversationWorkspaceState";

type ThreadGroup = {
  label: string;
  messages: MessageBubbleMessage[];
};

type ConversationMessagesPanelProps = {
  clearNewMessageCount: () => void;
  deleteMessageForEveryone: (message: MessageBubbleMessage) => void | Promise<void>;
  handleScrollContainer: () => void;
  isMobileViewport?: boolean;
  loadError: string | null;
  loadingMessages: boolean;
  loadingOlder: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  newMessageCount: number;
  onOpenMedia: (url: string, type: "image" | "video" | "audio" | "document", fileName: string) => void;
  openEditMessage: (message: MessageBubbleMessage) => void;
  openForwardMessage: (message: MessageBubbleMessage) => void;
  reactToMessage: (message: MessageBubbleMessage, emoji: string) => void | Promise<void>;
  reactionsMap: Map<string, ReactionSummary>;
  retryLoadMessages: () => void;
  retryMessage?: (message: MessageBubbleMessage) => void | Promise<void>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollToBottom: () => void;
  scrollToMessage: (providerMessageId: string) => void;
  selectedConversationId: string | null;
  setReplyingTo: (message: MessageBubbleMessage) => void;
  threadGroups: ThreadGroup[];
  topSentinelRef: React.RefObject<HTMLDivElement | null>;
  visibleMessages: MessageBubbleMessage[];
};

const ConversationMessagesPanel: React.FC<ConversationMessagesPanelProps> = ({
  clearNewMessageCount,
  deleteMessageForEveryone,
  handleScrollContainer,
  isMobileViewport = false,
  loadError,
  loadingMessages,
  loadingOlder,
  messagesEndRef,
  newMessageCount,
  onOpenMedia,
  openEditMessage,
  openForwardMessage,
  reactToMessage,
  reactionsMap,
  retryLoadMessages,
  retryMessage,
  scrollContainerRef,
  scrollToBottom,
  scrollToMessage,
  selectedConversationId,
  setReplyingTo,
  threadGroups,
  topSentinelRef,
  visibleMessages,
}) => (
  <div className="crm-conversation-messages-wrapper relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div
      ref={scrollContainerRef}
      onScroll={handleScrollContainer}
      className="crm-conversation-messages flex flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
      style={isMobileViewport && selectedConversationId ? { paddingBottom: "var(--crm-mobile-composer-obstruction-height)" } : undefined}
    >
      <div ref={topSentinelRef} className="h-1" />

      {loadingOlder && (
        <div className="py-3 text-center text-xs text-slate-400">Carregando mensagens anteriores...</div>
      )}

      {loadError ? (
        <ConversationWorkspaceState
          tone="error"
          title="Não foi possível carregar as mensagens"
          description="Verifique sua conexão e tente novamente."
          action={{ label: "Tentar novamente", onClick: retryLoadMessages }}
        />
      ) : loadingMessages ? (
        <MessageThreadSkeleton />
      ) : visibleMessages.length === 0 ? (
        <ConversationWorkspaceState
          tone="neutral"
          title="Ainda não há mensagens nesta conversa"
          description="Envie a primeira mensagem quando estiver pronto."
        />
      ) : (
        <div className="@container mt-auto min-w-0 max-w-full space-y-4 overflow-x-clip">
          {threadGroups.map((group) => (
            <section key={group.label} aria-label={group.label} className="space-y-3">
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="rounded-full bg-slate-100 px-3 py-1 text-ios-caption font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{group.label}</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="flex min-w-0 max-w-full flex-col gap-1.5 overflow-x-clip">
                {group.messages.map((msg) => {
                  const reaction = reactionsMap.get(msg.provider_message_id || "");
                  const metaCampaign = resolveMetaCampaignPreviewData({ webhookPayload: msg.webhook_payload as Record<string, unknown> | null });
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      reactionSummary={reaction}
                      metaCampaign={metaCampaign}
                      onReply={setReplyingTo}
                      onReact={(message, emoji) => void reactToMessage(message, emoji)}
                      onForward={openForwardMessage}
                      onEdit={openEditMessage}
                      onDelete={(message) => void deleteMessageForEveryone(message)}
                      onOpenMedia={onOpenMedia}
                      onScrollToReply={scrollToMessage}
                      onRetry={retryMessage}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>

    {newMessageCount > 0 && (
      <div role="status" aria-live="polite" className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <button
          type="button"
          onClick={() => { clearNewMessageCount(); scrollToBottom(); }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-600 px-4 text-ios-caption font-semibold text-white shadow-ios26-sm transition-colors duration-150 hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <ArrowDown size={14} />
          {newMessageCount} nova{newMessageCount > 1 ? "s mensagens" : " mensagem"}
        </button>
      </div>
    )}
  </div>
);

export default memo(ConversationMessagesPanel);
