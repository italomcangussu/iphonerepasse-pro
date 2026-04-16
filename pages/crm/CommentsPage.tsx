import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Filter, MessageSquareText, RefreshCw, Search, UserRound } from "lucide-react";
import { supabase } from "../../services/supabase";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import { useCRMStore } from "../../components/crm/useCRMStore";
import { useToast } from "../../components/ui/ToastProvider";

type CommentRow = {
  id: string;
  comment_id: string;
  actor_username: string | null;
  content: string | null;
  direction: string;
  status: string;
  media_id: string | null;
  event_created_at: string | null;
  created_at: string;
};

const POLL_INTERVAL_MS = 20_000;
const MOBILE_MEDIA_QUERY = "(max-width: 1023px)";

const formatDate = (value: string | null | undefined): string => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const directionClass = (direction: string) => {
  if (direction === "inbound") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200";
  if (direction === "outbound") return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200";
};

const statusClass = (status: string) => {
  if (["sent", "delivered", "read", "success"].includes(status)) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200";
  }
  if (["failed", "error"].includes(status)) {
    return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200";
  }
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200";
};

const CommentsPage: React.FC = () => {
  const toast = useToast();
  const { selectedStoreId } = useCRMStore();

  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });
  const isMobileViewportRef = useRef(isMobileViewport);

  useEffect(() => {
    isMobileViewportRef.current = isMobileViewport;
  }, [isMobileViewport]);

  const selectedComment = useMemo(
    () => rows.find((row) => row.id === selectedCommentId) || null,
    [rows, selectedCommentId],
  );

  const statusOptions = useMemo(
    () => ["all", ...Array.from(new Set(rows.map((row) => String(row.status || "-").trim()))).sort()],
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (directionFilter !== "all" && row.direction !== directionFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        row.comment_id,
        row.actor_username,
        row.content,
        row.direction,
        row.status,
        row.media_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [rows, search, directionFilter, statusFilter]);

  const loadRows = useCallback(async ({ showLoader = true, silent = false } = {}) => {
    if (!selectedStoreId) {
      setRows([]);
      setSelectedCommentId(null);
      setLoading(false);
      return;
    }

    if (showLoader) setLoading(true);

    try {
      const { data, error } = await supabase
        .from("crm_instagram_comment_events")
        .select("id,comment_id,actor_username,content,direction,status,media_id,event_created_at,created_at")
        .eq("store_id", selectedStoreId)
        .order("event_created_at", { ascending: false, nullsFirst: false })
        .limit(250);

      if (error) throw error;

      const nextRows = (data || []) as CommentRow[];
      setRows(nextRows);
      setSelectedCommentId((current) => {
        if (current && nextRows.some((row) => row.id === current)) return current;
        if (isMobileViewportRef.current) return null;
        return nextRows[0]?.id || null;
      });
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || "Falha ao carregar comentários.");
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [selectedStoreId, toast]);

  const refreshRows = useCallback(async () => {
    setIsRefreshing(true);
    await loadRows({ showLoader: false });
    setIsRefreshing(false);
  }, [loadRows]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onMediaChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onMediaChange);
      return () => mediaQuery.removeEventListener("change", onMediaChange);
    }

    mediaQuery.addListener(onMediaChange);
    return () => mediaQuery.removeListener(onMediaChange);
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!selectedStoreId) return;

    const intervalId = window.setInterval(() => {
      void loadRows({ showLoader: false, silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedStoreId, loadRows]);

  useEffect(() => {
    if (!selectedStoreId) return;

    const handleFocus = () => {
      void loadRows({ showLoader: false, silent: true });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadRows, selectedStoreId]);

  useEffect(() => {
    if (!isMobileViewport && !selectedCommentId && rows.length > 0) {
      setSelectedCommentId(rows[0].id);
    }
  }, [isMobileViewport, rows, selectedCommentId]);

  const listVisible = !isMobileViewport || !selectedCommentId;
  const detailVisible = !isMobileViewport || Boolean(selectedCommentId);

  return (
    <CRMPageFrame
      title="Comentários"
      description="Monitoramento operacional de comentários e respostas públicas do Instagram Oficial."
      actions={(
        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void refreshRows()} disabled={isRefreshing}>
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? "Atualizando" : "Atualizar"}
        </button>
      )}
    >
      <div className="crm-card overflow-hidden">
        <div className="flex h-[74vh] min-h-[560px]">
          <aside
            className={`w-full lg:w-[360px] lg:shrink-0 border-r border-slate-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/80 backdrop-blur ${listVisible ? "flex" : "hidden"} flex-col`}
          >
            <div className="sticky top-0 z-10 border-b border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 px-4 py-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {filteredRows.length} evento(s)
                </p>
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                  Inbox IG
                </span>
              </div>

              <label className="relative block">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  className="crm-input w-full pl-9"
                  placeholder="Buscar por usuário, conteúdo ou status"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 inline-flex items-center gap-1">
                    <Filter size={12} /> Direção
                  </span>
                  <select
                    className="crm-input"
                    value={directionFilter}
                    onChange={(event) => setDirectionFilter(event.target.value as "all" | "inbound" | "outbound")}
                  >
                    <option value="all">Todas</option>
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
                  <select
                    className="crm-input"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{status === "all" ? "Todos" : status}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">Carregando comentários...</div>
              ) : filteredRows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">Sem eventos de comentário para os filtros atuais.</div>
              ) : (
                filteredRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedCommentId(row.id)}
                    className={`w-full border-b border-slate-100/90 dark:border-slate-800 px-4 py-3 text-left transition-colors ${
                      selectedCommentId === row.id ? "bg-brand-50/90 dark:bg-brand-500/12" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          <UserRound size={14} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">@{row.actor_username || "desconhecido"}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.content || "[sem conteúdo]"}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{formatDate(row.event_created_at || row.created_at)}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${directionClass(row.direction)}`}>
                        {row.direction || "-"}
                      </span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(row.status)}`}>
                        {row.status || "-"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className={`flex-1 min-w-0 bg-slate-50/70 dark:bg-slate-950/70 ${detailVisible ? "flex" : "hidden"} flex-col`}>
            {selectedComment ? (
              <>
                <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 px-4 py-3 backdrop-blur">
                  {isMobileViewport ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCommentId(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Voltar para lista"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  ) : null}

                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                    <MessageSquareText size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">@{selectedComment.actor_username || "desconhecido"}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">Comment ID: {selectedComment.comment_id || "-"}</p>
                  </div>

                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${directionClass(selectedComment.direction)}`}>
                    {selectedComment.direction || "-"}
                  </span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(selectedComment.status)}`}>
                    {selectedComment.status || "-"}
                  </span>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Conteúdo</p>
                    <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                      {selectedComment.content || "[sem conteúdo]"}
                    </p>
                  </article>

                  <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Media ID</p>
                      <p className="text-slate-800 dark:text-slate-100 break-all">{selectedComment.media_id || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Data do evento</p>
                      <p className="text-slate-800 dark:text-slate-100">{formatDate(selectedComment.event_created_at || selectedComment.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Criado em</p>
                      <p className="text-slate-800 dark:text-slate-100">{formatDate(selectedComment.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">ID interno</p>
                      <p className="text-slate-800 dark:text-slate-100 break-all">{selectedComment.id}</p>
                    </div>
                  </article>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div className="max-w-sm space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Selecione um evento</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Escolha um comentário na lista para visualizar os detalhes completos do evento.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </CRMPageFrame>
  );
};

export default CommentsPage;
