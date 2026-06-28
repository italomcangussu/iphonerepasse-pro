import type React from "react";
import { memo } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  Eye,
  EyeOff,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  getLeadDisplay,
  getProviderLabel,
  PROVIDER_OPTIONS,
  STATUS_OPTIONS,
  type ConversationRow,
  type ConversationStatus,
  type CRMChannelRow,
  type FilterView,
  type ProviderFilter,
} from "./conversationUi";
import ConversationListItem from "./ConversationListItem";
import {
  ConversationListSkeleton,
  ConversationWorkspaceState,
} from "./ConversationWorkspaceState";

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
  loadError: string | null;
  loadingConversations: boolean;
  messageSearchResults: MessageSearchResult[];
  openMessageSearchResult: (conversationId: string) => void | Promise<void>;
  openMobileFilters: () => void;
  openSaveView: () => void;
  providerFilter: ProviderFilter;
  renderSearchSnippet: (snippet: string) => React.ReactNode;
  retryLoadConversations: () => void;
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
  startConversation: () => void;
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
  loadError,
  loadingConversations,
  messageSearchResults,
  openMessageSearchResult,
  openMobileFilters,
  openSaveView,
  providerFilter,
  renderSearchSnippet,
  retryLoadConversations,
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
  startConversation,
  statusFilter,
  toggleFiltersCollapsed,
  unreadTotal,
}) => (
  <aside aria-label="Conversas" className="crm-conversation-list crm-chat-list-panel flex w-full min-w-0 flex-col overflow-hidden border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
    <div className="shrink-0 space-y-2 border-b border-slate-200/80 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
      <div className="crm-conversation-list-summary flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-ios-headline font-semibold text-slate-950 dark:text-slate-50">Caixa de entrada</h2>
          <p className="text-ios-caption text-slate-600 dark:text-slate-300">{filteredConversations.length} em atendimento</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {unreadTotal > 0 && (
            <m.span
              initial={false}
              className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-ios-caption font-bold text-white"
              aria-label={`${unreadTotal} mensagens não lidas`}
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
        <div role="group" aria-label="Tipo de busca" className="flex min-h-11 w-[148px] shrink-0 gap-1 rounded-ios border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
          <button type="button" aria-pressed={searchMode === "leads"} onClick={() => { setSearchMode("leads"); setMessageSearchResults([]); }} className={`flex-1 rounded-md px-2 text-ios-caption font-semibold transition-colors ${searchMode === "leads" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"}`}>
            Contatos
          </button>
          <button type="button" aria-pressed={searchMode === "messages"} onClick={() => setSearchMode("messages")} className={`flex-1 rounded-md px-2 text-ios-caption font-semibold transition-colors ${searchMode === "messages" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"}`}>
            Mensagens
          </button>
        </div>
        <label className="relative block min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input aria-label={searchMode === "messages" ? "Buscar mensagens" : "Buscar contatos"} type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchMode === "messages" ? "Buscar mensagens" : "Buscar contatos"} className="crm-input crm-input-compact min-h-11 w-full pl-8" />
        </label>
      </div>

      {filterViews.length > 0 && !isMobileViewport && (
        <div className="flex flex-wrap gap-2">
          {filterViews.slice(0, 6).map((view) => (
            <div key={view.id} className="group flex min-h-11 items-center gap-1 rounded-full border border-slate-200/60 bg-white pl-3 pr-1 text-ios-caption font-semibold text-slate-600 transition-colors hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <button type="button" onClick={() => applyFilterView(view)} className="flex min-h-11 items-center gap-1.5">
                <BookmarkCheck size={12} className="text-brand-500" />
                {view.name}
                {view.is_shared && <span className="opacity-70">· equipe</span>}
              </button>
              <button type="button" onClick={() => void deleteFilterView(view.id)} className="ml-1 hidden h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 group-hover:inline-flex" aria-label={`Excluir visualização ${view.name}`}>
                <X size={14} />
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
            aria-pressed={!hasActiveFilters}
            className={`crm-mobile-filter-chip shrink-0 rounded-full px-3 text-[11px] font-semibold ${!hasActiveFilters ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setShowOnlyUnread((previous) => !previous)}
            aria-pressed={showOnlyUnread}
            className={`crm-mobile-filter-chip shrink-0 rounded-full px-3 text-[11px] font-semibold ${showOnlyUnread ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Não lidas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")}
            aria-pressed={statusFilter === "open"}
            className={`crm-mobile-filter-chip shrink-0 rounded-full px-3 text-[11px] font-semibold ${statusFilter === "open" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Abertas
          </button>
          <button
            type="button"
            onClick={() => setProviderFilter(providerFilter === "uazapi" ? "all" : "uazapi")}
            aria-pressed={providerFilter === "uazapi"}
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
            <button type="button" aria-pressed={showOnlyUnread} className={`inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full px-3 text-ios-caption font-semibold transition-colors ${showOnlyUnread ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`} onClick={() => setShowOnlyUnread((previous) => !previous)}>
              Não lidas
            </button>
            <button type="button" onClick={() => { setSaveViewName(""); setSaveViewShared(false); openSaveView(); }} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-ios-caption font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" title="Salvar filtros como visualização">
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

              <button type="button" aria-pressed={showOnlyUnread} className={`crm-mobile-sheet-action inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${showOnlyUnread ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`} onClick={() => setShowOnlyUnread((previous) => !previous)}>
                Somente não lidas
              </button>

              {filterViews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Visualizações salvas</p>
                  <div className="flex flex-wrap gap-2">
                    {filterViews.slice(0, 6).map((view) => (
                      <button key={view.id} type="button" onClick={() => { applyFilterView(view); closeMobileFilters(); }} className="crm-mobile-filter-chip inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-3 text-ios-caption font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
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
                <Bookmark size={12} /> Salvar visualização
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

      {searchMode === "leads" && loadError ? (
        <ConversationWorkspaceState
          compact
          tone="error"
          title="Não foi possível carregar as conversas"
          description="Verifique sua conexão e tente novamente."
          action={{ label: "Tentar novamente", onClick: retryLoadConversations }}
        />
      ) : searchMode === "leads" && loadingConversations ? (
        <ConversationListSkeleton />
      ) : searchMode === "leads" && filteredConversations.length === 0 ? (
        <ConversationWorkspaceState
          compact
          tone="empty"
          title={hasActiveFilters || search.trim() ? "Nenhuma conversa corresponde à busca" : "Sua caixa de entrada está vazia"}
          description={hasActiveFilters || search.trim()
            ? "Limpe a busca ou remova filtros para ver mais conversas."
            : channels.length > 0
              ? "Inicie uma conversa ou aguarde a próxima mensagem de um cliente."
              : "Conecte um canal para começar a atender clientes."}
          action={hasActiveFilters || search.trim()
            ? { label: "Limpar filtros", onClick: clearConversationFilters }
            : channels.length > 0
              ? { label: "Iniciar conversa", onClick: startConversation }
              : undefined}
        />
      ) : searchMode === "leads" ? (
        filteredConversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            selected={conversation.id === selectedConversationId}
            onSelect={handleSelectConversation}
          />
        ))
      ) : null}
    </div>
  </aside>
);

export default memo(ConversationsListPanel);
