import type React from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Mic,
  Search,
  SlidersHorizontal,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import {
  getAvatarTone,
  getConversationAvatarUrl,
  getInitials,
  getLeadDisplay,
  getPreviewText,
  getProviderDotClass,
  getProviderLabel,
  getProviderShortLabel,
  getStatusMeta,
  isAIHandlingConversation,
  isGroupConversation,
  isTransferPendingConversation,
  PROVIDER_OPTIONS,
  resolveMediaKind,
  STATUS_OPTIONS,
  formatConversationDate,
  type ConversationRow,
  type ConversationStatus,
  type CRMChannelRow,
  type FilterView,
  type ProviderFilter,
} from "./conversationUi";

type MessageSearchResult = { conversation_id: string; message_id: string; snippet: string; rank: number };

type ConversationsListPanelProps = {
  activeFiltersCount: number;
  applyFilterView: (view: FilterView) => void;
  channelFilter: string;
  channels: CRMChannelRow[];
  clearConversationFilters: () => void;
  closeMobileFilters: () => void;
  conversationsById: Map<string, ConversationRow>;
  deleteFilterView: (viewId: string) => void | Promise<void>;
  filteredConversations: ConversationRow[];
  filtersCollapsed: boolean;
  filterViews: FilterView[];
  handleSelectConversation: (id: string) => void;
  hasActiveFilters: boolean;
  isMobileFiltersOpen: boolean;
  isMobileViewport: boolean;
  loadingConversations: boolean;
  messageSearchResults: MessageSearchResult[];
  openMessageSearchResult: (conversationId: string) => void | Promise<void>;
  openMobileFilters: () => void;
  openSaveView: () => void;
  providerFilter: ProviderFilter;
  renderSearchSnippet: (snippet: string) => React.ReactNode;
  search: string;
  searchingMessages: boolean;
  searchMode: "leads" | "messages";
  selectedConversationId: string | null;
  setChannelFilter: (value: string) => void;
  setMessageSearchResults: (value: MessageSearchResult[]) => void;
  setProviderFilter: (value: ProviderFilter) => void;
  setSaveViewName: (value: string) => void;
  setSaveViewShared: (value: boolean) => void;
  setSearch: (value: string) => void;
  setSearchMode: (value: "leads" | "messages") => void;
  setShowOnlyUnread: (updater: boolean | ((previous: boolean) => boolean)) => void;
  setStatusFilter: (value: ConversationStatus) => void;
  showOnlyUnread: boolean;
  statusFilter: ConversationStatus;
  toggleFiltersCollapsed: () => void;
  unreadTotal: number;
};

const ConversationsListPanel: React.FC<ConversationsListPanelProps> = ({
  activeFiltersCount,
  applyFilterView,
  channelFilter,
  channels,
  clearConversationFilters,
  closeMobileFilters,
  conversationsById,
  deleteFilterView,
  filteredConversations,
  filtersCollapsed,
  filterViews,
  handleSelectConversation,
  hasActiveFilters,
  isMobileFiltersOpen,
  isMobileViewport,
  loadingConversations,
  messageSearchResults,
  openMessageSearchResult,
  openMobileFilters,
  openSaveView,
  providerFilter,
  renderSearchSnippet,
  search,
  searchingMessages,
  searchMode,
  selectedConversationId,
  setChannelFilter,
  setMessageSearchResults,
  setProviderFilter,
  setSaveViewName,
  setSaveViewShared,
  setSearch,
  setSearchMode,
  setShowOnlyUnread,
  setStatusFilter,
  showOnlyUnread,
  statusFilter,
  toggleFiltersCollapsed,
  unreadTotal,
}) => (
  <aside className={`crm-conversation-list crm-chat-list-panel flex w-full border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950 md:w-[300px] md:shrink-0 lg:w-[320px] xl:w-[340px] flex-col overflow-hidden`}>
    <div className="shrink-0 space-y-2 border-b border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="crm-conversation-list-summary flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black tracking-tight text-slate-950 dark:text-slate-50">{filteredConversations.length} leads ativos</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {unreadTotal > 0 && (
            <m.span
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="inline-flex min-w-[36px] items-center justify-center rounded-full bg-brand-600 px-2 py-1 text-[10px] font-black text-white shadow-md shadow-brand-600/25"
            >
              {unreadTotal}
            </m.span>
          )}
          {!isMobileViewport && (
            <button type="button" title={filtersCollapsed ? "Mostrar filtros" : "Ocultar filtros"} onClick={toggleFiltersCollapsed} className="inline-flex h-11 w-11 lg:h-9 lg:w-9 items-center justify-center rounded-lg border border-slate-200/60 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {filtersCollapsed ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex w-[112px] shrink-0 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
          <button type="button" onClick={() => { setSearchMode("leads"); setMessageSearchResults([]); }} className={`flex-1 min-h-[44px] lg:min-h-0 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${searchMode === "leads" ? "bg-white shadow-sm text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            Leads
          </button>
          <button type="button" onClick={() => setSearchMode("messages")} className={`flex-1 min-h-[44px] lg:min-h-0 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${searchMode === "messages" ? "bg-white shadow-sm text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            Msg
          </button>
        </div>
        <label className="relative block min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchMode === "messages" ? "Buscar mensagens..." : "Buscar lead..."} className="crm-input crm-input-compact w-full pl-8 min-h-[44px] lg:min-h-9" />
        </label>
      </div>

      {filterViews.length > 0 && !isMobileViewport && (
        <div className="flex flex-wrap gap-2">
          {filterViews.slice(0, 6).map((view) => (
            <div key={view.id} className="group flex items-center gap-1 rounded-full border border-slate-200/60 bg-white pl-3 pr-1 py-1.5 text-[10px] font-black uppercase tracking-tight text-slate-600 shadow-sm transition-all hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <button type="button" onClick={() => applyFilterView(view)} className="flex items-center gap-1.5">
                <BookmarkCheck size={12} className="text-brand-500" />
                {view.name}
                {view.is_shared && <span className="opacity-50">· team</span>}
              </button>
              <button type="button" onClick={() => void deleteFilterView(view.id)} className="ml-1 hidden rounded-full p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500 group-hover:inline-flex" aria-label="Delete view">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isMobileViewport ? (
        <div className="flex max-w-full flex-wrap gap-1.5 pb-1">
          <button
            type="button"
            onClick={clearConversationFilters}
            className={`crm-mobile-filter-chip shrink-0 rounded-full px-3 text-[11px] font-semibold ${!hasActiveFilters ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setShowOnlyUnread((previous) => !previous)}
            className={`crm-mobile-filter-chip shrink-0 rounded-full px-3 text-[11px] font-semibold ${showOnlyUnread ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Não lidas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")}
            className={`crm-mobile-filter-chip shrink-0 rounded-full px-3 text-[11px] font-semibold ${statusFilter === "open" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Abertas
          </button>
          <button
            type="button"
            onClick={() => setProviderFilter(providerFilter === "uazapi" ? "all" : "uazapi")}
            className={`crm-mobile-filter-chip shrink-0 rounded-full px-3 text-[11px] font-semibold ${providerFilter === "uazapi" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => openMobileFilters()}
            className={`crm-mobile-filter-chip shrink-0 rounded-full border px-3 text-[11px] font-semibold ${activeFiltersCount > 0 ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-200" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
            aria-label="Filtros"
          >
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal size={12} />
              Filtros{activeFiltersCount > 0 ? ` · ${activeFiltersCount}` : ""}
            </span>
          </button>
        </div>
      ) : !filtersCollapsed ? (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <select className="crm-input crm-input-compact" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ConversationStatus)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="crm-input crm-input-compact" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderFilter)}>
              {PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="crm-input crm-input-compact col-span-2" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
              <option value="all">Todos os canais</option>
              {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name || channel.id} · {getProviderLabel(channel.provider)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${showOnlyUnread ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`} onClick={() => setShowOnlyUnread((previous) => !previous)}>
              Não lidas
            </button>
            <button type="button" onClick={() => { setSaveViewName(""); setSaveViewShared(false); openSaveView(); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" title="Salvar filtros como view">
              <Bookmark size={11} /> Salvar
            </button>
          </div>
        </>
      ) : null}
    </div>

    <AnimatePresence>
      {isMobileViewport && isMobileFiltersOpen && (
        <>
          <m.button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
            aria-label="Fechar filtros"
            onClick={() => closeMobileFilters()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <m.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-conversation-filters-title"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[82dvh] max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white px-4 pb-4 pt-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950 lg:hidden"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 id="mobile-conversation-filters-title" className="text-sm font-bold text-slate-950 dark:text-slate-50">Filtros avançados</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{activeFiltersCount > 0 ? `${activeFiltersCount} filtro${activeFiltersCount > 1 ? "s" : ""} ativo${activeFiltersCount > 1 ? "s" : ""}` : "Refine a lista sem perder espaço no inbox."}</p>
              </div>
              <button type="button" onClick={() => closeMobileFilters()} className="crm-mobile-close-action inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300" aria-label="Fechar filtros">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Status</span>
                <select className="crm-input w-full" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ConversationStatus)}>
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Provedor</span>
                <select className="crm-input w-full" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderFilter)}>
                  {PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Canal</span>
                <select className="crm-input w-full" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
                  <option value="all">Todos os canais</option>
                  {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name || channel.id} · {getProviderLabel(channel.provider)}</option>)}
                </select>
              </label>

              <button type="button" className={`crm-mobile-sheet-action inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${showOnlyUnread ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`} onClick={() => setShowOnlyUnread((previous) => !previous)}>
                Somente não lidas
              </button>

              {filterViews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Views salvas</p>
                  <div className="flex flex-wrap gap-2">
                    {filterViews.slice(0, 6).map((view) => (
                      <button key={view.id} type="button" onClick={() => { applyFilterView(view); closeMobileFilters(); }} className="crm-mobile-filter-chip inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-3 text-[10px] font-black uppercase tracking-tight text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                        <BookmarkCheck size={12} className="text-brand-500" />
                        {view.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={clearConversationFilters} className="crm-mobile-sheet-action inline-flex flex-1 items-center justify-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  Limpar
                </button>
                <button type="button" onClick={() => closeMobileFilters()} className="crm-mobile-sheet-action inline-flex flex-1 items-center justify-center rounded-full bg-brand-600 px-3 text-xs font-semibold text-white shadow-sm shadow-brand-600/20">
                  Aplicar
                </button>
              </div>

              <button type="button" onClick={() => { setSaveViewName(""); setSaveViewShared(false); openSaveView(); closeMobileFilters(); }} className="crm-mobile-sheet-action inline-flex w-full items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Bookmark size={12} /> Salvar view
              </button>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>

    <div className="crm-chat-list-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1.5">
      {searchMode === "messages" && (
        <div>
          {search.trim().length < 3 ? (
            <p className="p-4 text-xs text-slate-400">Digite pelo menos 3 caracteres para buscar.</p>
          ) : searchingMessages ? (
            <p className="p-4 text-xs text-slate-400">Buscando...</p>
          ) : messageSearchResults.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">Nenhuma mensagem encontrada.</p>
          ) : (
            messageSearchResults.map((result) => {
              const conv = conversationsById.get(result.conversation_id);
              return (
                <button key={result.message_id} type="button" onClick={() => void openMessageSearchResult(result.conversation_id)} className="w-full min-h-[44px] rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-900 dark:active:bg-slate-800">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{conv ? getLeadDisplay(conv) : result.conversation_id}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{renderSearchSnippet(result.snippet)}</p>
                </button>
              );
            })
          )}
        </div>
      )}

      {searchMode === "leads" && loadingConversations ? (
        <div className="p-4 text-sm text-slate-500">Carregando conversas...</div>
      ) : searchMode === "leads" && filteredConversations.length === 0 ? (
        <div className="p-4 text-sm text-slate-500">{search.trim() || showOnlyUnread || statusFilter !== "all" || providerFilter !== "all" || channelFilter !== "all" ? "Nenhuma conversa encontrada para os filtros." : "Nenhuma conversa encontrada."}</div>
      ) : searchMode === "leads" ? (
        filteredConversations.map((conv) => {
          const isActive = conv.id === selectedConversationId;
          const statusMeta = getStatusMeta(conv.status);
          const provider = conv.crm_channels?.provider;
          const previewText = getPreviewText(conv.lastMessage);
          const previewKind = resolveMediaKind(conv.lastMessage?.media_type, conv.lastMessage?.media_url);
          const leadName = getLeadDisplay(conv);
          const isGroup = isGroupConversation(conv);
          const avatarUrl = getConversationAvatarUrl(conv);
          const hasUnread = Number(conv.unread_count || 0) > 0;
          const isTransferPending = isTransferPendingConversation(conv);
          const isAIHandling = isAIHandlingConversation(conv);
          const rowClass = isTransferPending
            ? isActive
              ? "is-active bg-red-100 ring-1 ring-red-300 pl-shadow-float pl-radius-container z-10 animate-pulse dark:bg-red-950/40 dark:ring-red-700"
              : "rounded-xl mb-0.5 bg-red-50 hover:bg-red-100 animate-pulse dark:bg-red-950/25 dark:hover:bg-red-950/35"
            : isActive
              ? "is-active bg-white pl-shadow-float pl-radius-container z-10 dark:bg-slate-900"
              : isAIHandling
                ? "rounded-xl mb-0.5 bg-orange-50/80 hover:bg-orange-100 dark:bg-orange-950/20 dark:hover:bg-orange-950/30"
                : "hover:bg-slate-100/60 rounded-xl mb-0.5 dark:hover:bg-slate-900/40";

          return (
            <m.button
              key={conv.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="button"
              onClick={() => handleSelectConversation(conv.id)}
              className={`crm-chat-row w-full relative overflow-hidden px-3 py-3 text-left transition-all duration-300 ${rowClass}`}
            >
              {isActive && <m.div layoutId="active-pill" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-brand-600 rounded-r-full" />}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-center gap-3">
                  <span className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ring-white dark:ring-slate-950 ${getAvatarTone(conv.lead_id)}`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={leadName} className="h-full w-full rounded-full object-cover" loading="lazy" />
                    ) : isGroup ? (
                      <UsersRound size={18} />
                    ) : (
                      getInitials(leadName)
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[8px] font-black dark:border-slate-950 ${getProviderDotClass(provider)}`}>{getProviderShortLabel(provider)}</span>
                  </span>
                  <div className="min-w-0">
                    <p className={`flex items-center gap-1.5 truncate font-semibold ${hasUnread ? "text-slate-950 dark:text-white" : "text-slate-800 dark:text-slate-100"}`}>
                      {isGroup && <UsersRound size={12} className="shrink-0 text-brand-600 dark:text-brand-300" />}
                      <span className="truncate">{leadName}</span>
                    </p>
                    <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{conv.crm_channels?.name || "Canal"} · {getProviderShortLabel(provider)}</p>
                  </div>
                </div>
                <p className={`shrink-0 text-[11px] ${hasUnread ? "font-bold text-brand-700 dark:text-brand-200" : "text-slate-500 dark:text-slate-400"}`}>{formatConversationDate(conv.last_message_at || conv.lastMessage?.created_at || null)}</p>
              </div>
              <div className="mt-1.5 flex min-w-0 items-center gap-2">
                {conv.lastMessage && (
                  <span
                    aria-label={conv.lastMessage.direction === "inbound" ? "Última mensagem recebida" : "Última mensagem enviada"}
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${conv.lastMessage.direction === "inbound" ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600"}`}
                  />
                )}
                {previewKind && (
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400">
                    {previewKind === "image" ? <ImageIcon size={13} /> : previewKind === "video" ? <Video size={13} /> : previewKind === "audio" ? <Mic size={13} /> : <FileText size={13} />}
                  </span>
                )}
                <p className={`line-clamp-1 text-[12px] leading-5 ${hasUnread ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
                  {conv.lastMessage?.direction === "outbound" ? "Você: " : ""}{previewText}
                </p>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-tight uppercase ${statusMeta.className}`}>{statusMeta.label}</span>
                  {isTransferPending && (
                    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-tight text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
                      Transferência pendente
                    </span>
                  )}
                  {!isTransferPending && isAIHandling && (
                    <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-tight text-orange-700 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-200">
                      IA ativa
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {hasUnread && <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-black text-white shadow-sm shadow-brand-600/30">{conv.unread_count}</span>}
                </div>
              </div>
            </m.button>
          );
        })
      ) : null}
    </div>
  </aside>
);

export default ConversationsListPanel;
