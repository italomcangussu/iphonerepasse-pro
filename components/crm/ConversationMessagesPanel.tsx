import type React from "react";
import { ArrowDown } from "lucide-react";
import MessageBubble, { type MessageBubbleMessage } from "./MessageBubble";
import type { ReactionSummary } from "../../lib/crm/groupReactions";
import { resolveMetaCampaignPreviewData } from "../../lib/crm/messageUtils";

type ThreadGroup = {
  label: string;
  messages: MessageBubbleMessage[];
};

type ConversationMessagesPanelProps = {
  clearNewMessageCount: () => void;
  deleteMessageForEveryone: (message: MessageBubbleMessage) => void | Promise<void>;
  handleScrollContainer: () => void;
  isMobileViewport?: boolean;
  loadingMessages: boolean;
  loadingOlder: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  newMessageCount: number;
  onOpenMedia: (url: string, type: "image" | "video" | "audio" | "document", fileName: string) => void;
  openEditMessage: (message: MessageBubbleMessage) => void;
  openForwardMessage: (message: MessageBubbleMessage) => void;
  reactToMessage: (message: MessageBubbleMessage, emoji: string) => void | Promise<void>;
  reactionsMap: Map<string, ReactionSummary>;
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
  loadingMessages,
  loadingOlder,
  messagesEndRef,
  newMessageCount,
  onOpenMedia,
  openEditMessage,
  openForwardMessage,
  reactToMessage,
  reactionsMap,
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

      {loadingMessages ? (
        <div className="rounded-xl bg-white/80 p-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900/80">Carregando mensagens...</div>
      ) : visibleMessages.length === 0 ? (
        <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">Nenhuma mensagem encontrada.</div>
      ) : (
        <div className="mt-auto min-w-0 max-w-full space-y-4 overflow-x-clip">
          {threadGroups.map((group) => (
            <div key={group.label} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-linear-to-r from-transparent via-slate-300 to-slate-300 dark:via-slate-700 dark:to-slate-700" />
                <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">{group.label}</span>
                <span className="h-px flex-1 bg-linear-to-l from-transparent via-slate-300 to-slate-300 dark:via-slate-700 dark:to-slate-700" />
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
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>

    {newMessageCount > 0 && (
      <button
        type="button"
        onClick={() => { clearNewMessageCount(); scrollToBottom(); }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-emerald-500 transition-colors"
      >
        <ArrowDown size={13} />
        {newMessageCount} nova{newMessageCount > 1 ? "s" : ""} {newMessageCount > 1 ? "mensagens" : "mensagem"}
      </button>
    )}
  </div>
);

export default ConversationMessagesPanel;
