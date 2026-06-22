import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Bot,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Images,
  Info,
  Link2,
  LogOut,
  Mic,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  User,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";
import PushOptIn from "../../components/pwa/PushOptIn";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../components/ui/ToastProvider";
import { useConsents } from "../../hooks/useConsents";
import { ROLE_LABELS } from "../../lib/permissions";
import { supabase } from "../../services/supabase";
import { DPO_CONTACT_EMAIL, PRIVACY_POLICY_VERSION } from "../../constants";

const CRMChannels = lazy(() => import("../CRMChannels"));

const MAIN_APP_URL = "https://app.iphonerepasse.com.br";
const LEGAL_LINKS = {
  privacy: `${MAIN_APP_URL}/#/legal/privacidade`,
  terms: `${MAIN_APP_URL}/#/legal/termos`,
  data: `${MAIN_APP_URL}/#/legal/dados`,
};

// Settings submenus. Following Apple's Human Interface Guidelines for app
// settings, in-app preferences are grouped by intent (account, appearance,
// notifications, privacy & security, app configuration, about) so people can
// find a control where they expect it. Persistent grants are surfaced read-only;
// file/photo pickers are described as one-time selections, not permissions.
type SettingsSection =
  | "account"
  | "appearance"
  | "notifications"
  | "privacy"
  | "permissions"
  | "channels"
  | "attribution"
  | "ai"
  | "about";

type SectionMeta = {
  id: SettingsSection;
  title: string;
  description: string;
  icon: LucideIcon;
};

type SectionGroup = {
  label: string;
  items: SectionMeta[];
};

const SECTION_GROUPS: SectionGroup[] = [
  {
    label: "Preferências",
    items: [
      { id: "account", title: "Conta", description: "Sessão, perfil e acesso", icon: User },
      { id: "appearance", title: "Aparência", description: "Tema claro, escuro ou automático", icon: Sun },
      { id: "notifications", title: "Notificações", description: "Alertas de mensagens, leads e vendas", icon: Bell },
    ],
  },
  {
    label: "Privacidade e segurança",
    items: [
      { id: "privacy", title: "Privacidade e dados", description: "Exportar dados, consentimentos e exclusão", icon: ShieldCheck },
      { id: "permissions", title: "Permissões", description: "Microfone, mídia e notificações", icon: Smartphone },
    ],
  },
  {
    label: "Configuração do CRM",
    items: [
      { id: "channels", title: "Canais de atendimento", description: "WhatsApp, Instagram e webhooks", icon: Waypoints },
      { id: "attribution", title: "Atribuição (UTM)", description: "Mapeamento de campanhas e origem", icon: Link2 },
      { id: "ai", title: "Agente de IA", description: "Assistente automático de atendimento", icon: Bot },
    ],
  },
  {
    label: "Informações",
    items: [
      { id: "about", title: "Sobre o CRM Plus", description: "Versão, suporte e documentos legais", icon: Info },
    ],
  },
];

const SECTION_LOOKUP: Record<SettingsSection, SectionMeta> = SECTION_GROUPS.reduce(
  (acc, group) => {
    group.items.forEach((item) => {
      acc[item.id] = item;
    });
    return acc;
  },
  {} as Record<SettingsSection, SectionMeta>,
);

type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: "Permitido",
  denied: "Bloqueado",
  prompt: "Não decidido",
  unsupported: "Via sistema",
};

const PERMISSION_BADGE: Record<PermissionState, string> = {
  granted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  denied: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  prompt: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  unsupported: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const isIOSDevice = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

const isStandaloneDisplayMode = () => {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
};

// ── Reusable presentation pieces ─────────────────────────────────────────────

const SectionShell: React.FC<{ meta: SectionMeta; onBack: () => void; children: React.ReactNode }> = ({
  meta,
  onBack,
  children,
}) => {
  const Icon = meta.icon;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="crm-icon-btn"
          aria-label="Voltar para Configurações"
          title="Voltar"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={18} className="shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-50">{meta.title}</h2>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{meta.description}</p>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};

const InfoRow: React.FC<{ icon: LucideIcon; title: string; subtitle?: string; trailing?: React.ReactNode }> = ({
  icon: Icon,
  title,
  subtitle,
  trailing,
}) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3">
    <div className="flex items-center gap-3 min-w-0">
      <Icon size={18} className="shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
    </div>
    {trailing}
  </div>
);

const Divider: React.FC = () => <div className="border-t border-slate-100 dark:border-slate-800" />;

const LegalLink: React.FC<{ href: string; label: string; icon: LucideIcon }> = ({ href, label, icon: Icon }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
  >
    <div className="flex items-center gap-3">
      <Icon size={18} className="text-blue-600 dark:text-blue-400" />
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</span>
    </div>
    <ExternalLink size={14} className="text-slate-400" />
  </a>
);

const SettingsPage: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const { hasConsent } = useConsents(user?.id);

  const [section, setSection] = useState<SettingsSection | null>(null);

  const [permissions, setPermissions] = useState<Record<"notifications" | "camera" | "microphone", PermissionState>>({
    notifications: "unsupported",
    camera: "unsupported",
    microphone: "unsupported",
  });

  const [isExportingData, setIsExportingData] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<"idle" | "requesting" | "pending">("idle");
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(null);

  // Read current OS permission grants so they can be surfaced (read-only) in the
  // Permissions submenu. The Permissions API is best-effort: Safari rejects the
  // camera/microphone queries, so those gracefully fall back to "Via sistema".
  const syncPermissions = useCallback(() => {
    if (typeof navigator === "undefined") return;

    let notif: PermissionState = "unsupported";
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = window.Notification.permission;
      notif = perm === "default" ? "prompt" : perm;
    }
    setPermissions((prev) => ({ ...prev, notifications: notif }));

    if (!("permissions" in navigator)) return;
    (["camera", "microphone"] as const).forEach((name) => {
      navigator.permissions
        .query({ name: name as PermissionName })
        .then((res) => setPermissions((prev) => ({ ...prev, [name]: res.state as PermissionState })))
        .catch(() => {
          /* unsupported query — keep "Via sistema" */
        });
    });
  }, []);

  useEffect(() => {
    syncPermissions();
    const onFocus = () => syncPermissions();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [syncPermissions]);

  const handleExportData = useCallback(async () => {
    if (!user) return;
    setIsExportingData(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/user-data-export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error("Não foi possível exportar os dados. Tente novamente.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iphonerepasse-dados-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dados exportados com sucesso.", { title: "Exportação concluída" });
    } catch {
      toast.error("Erro ao exportar dados. Tente novamente.");
    } finally {
      setIsExportingData(false);
    }
  }, [toast, user]);

  const handleRequestAccountDeletion = useCallback(async () => {
    if (!user) return;
    const confirmed = await toast.confirm({
      title: "Excluir conta",
      description:
        "Sua conta será desativada imediatamente e excluída permanentemente em 30 dias. Você pode cancelar antes disso.",
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (!confirmed) return;

    setDeletionStatus("requesting");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Sessão expirada.");
        setDeletionStatus("idle");
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/user-account-delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Solicitado pelo usuário via Configurações do CRM Plus" }),
      });
      const json = (await res.json()) as { ok: boolean; scheduled_delete_at?: string; message?: string };
      if (json.ok) {
        setDeletionStatus("pending");
        setDeletionScheduledAt(json.scheduled_delete_at ?? null);
        toast.info(json.message ?? "Conta agendada para exclusão.", { title: "Exclusão solicitada", durationMs: 8000 });
        await signOut();
      } else {
        toast.error("Não foi possível solicitar a exclusão. Tente novamente.");
        setDeletionStatus("idle");
      }
    } catch {
      toast.error("Erro ao solicitar exclusão.");
      setDeletionStatus("idle");
    }
  }, [signOut, toast, user]);

  const handleCancelAccountDeletion = useCallback(async () => {
    if (!user) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/user-account-delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { ok: boolean };
      if (json.ok) {
        setDeletionStatus("idle");
        setDeletionScheduledAt(null);
        toast.success("Exclusão de conta cancelada.", { title: "Cancelado" });
      }
    } catch {
      toast.error("Erro ao cancelar exclusão.");
    }
  }, [toast, user]);

  const handleCheckForAppUpdate = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      toast.info("Não foi possível verificar atualizações.");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.waiting) await reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
        return;
      }
      toast.info("O CRM Plus já está na versão mais recente.", { title: "Sem atualizações" });
    } catch {
      toast.info("Não foi possível verificar atualizações.");
    }
  }, [toast]);

  const themeOptions: Array<{ value: "light" | "dark" | "system"; label: string; icon: LucideIcon }> = useMemo(
    () => [
      { value: "light", label: "Claro", icon: Sun },
      { value: "dark", label: "Escuro", icon: Moon },
      { value: "system", label: "Automático (sistema)", icon: Monitor },
    ],
    [],
  );

  // ── Landing list (master) ──────────────────────────────────────────────────
  if (section === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Configurações</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie sua conta, preferências e a configuração do CRM Plus.
          </p>
        </div>

        {SECTION_GROUPS.map((group) => (
          <section key={group.label} className="space-y-2">
            <p className="crm-nav-section px-1">{group.label}</p>
            <div className="crm-card overflow-hidden">
              {group.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <React.Fragment key={item.id}>
                    {index > 0 && <Divider />}
                    <button
                      type="button"
                      onClick={() => setSection(item.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-slate-300 dark:text-slate-600" />
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const meta = SECTION_LOOKUP[section];
  const back = () => setSection(null);

  // ── Detail views ───────────────────────────────────────────────────────────

  if (section === "account") {
    return (
      <SectionShell meta={meta} onBack={back}>
        <div className="crm-card overflow-hidden">
          <InfoRow icon={User} title={(user?.user_metadata?.full_name as string) || user?.email || "Usuário"} subtitle="Nome de exibição" />
          <Divider />
          <InfoRow icon={Info} title={user?.email || "—"} subtitle="E-mail de acesso" />
          <Divider />
          <InfoRow
            icon={ShieldCheck}
            title={ROLE_LABELS[role || "seller"]}
            subtitle="Perfil de acesso"
          />
        </div>

        <div className="crm-card overflow-hidden">
          <a
            href={MAIN_APP_URL}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <div className="flex items-center gap-3">
              <ArrowUpRight size={18} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Abrir aplicativo principal</span>
            </div>
            <ExternalLink size={14} className="text-slate-400" />
          </a>
          <Divider />
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <LogOut size={18} className="text-rose-500" />
            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">Sair da conta</span>
          </button>
        </div>
      </SectionShell>
    );
  }

  if (section === "appearance") {
    return (
      <SectionShell meta={meta} onBack={back}>
        <div className="crm-card overflow-hidden">
          {themeOptions.map((option, index) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            return (
              <React.Fragment key={option.value}>
                {index > 0 && <Divider />}
                <button
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{option.label}</span>
                  </div>
                  {isActive && <Check size={18} className="text-blue-600 dark:text-blue-400" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
          “Automático” acompanha a aparência do seu dispositivo, conforme recomendado pelas diretrizes da Apple para Dark
          Mode.
        </p>
      </SectionShell>
    );
  }

  if (section === "notifications") {
    return (
      <SectionShell meta={meta} onBack={back}>
        <PushOptIn variant="card" />
        <div className="crm-card p-4">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Tipos de notificação</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <li>• <strong>Mensagens CRM</strong> — novas respostas de leads e clientes</li>
            <li>• <strong>Novos leads</strong> — entradas novas no funil comercial</li>
            <li>• <strong>Transferências pendentes</strong> — atendimentos aguardando continuidade</li>
          </ul>
        </div>
        {isIOSDevice() && !isStandaloneDisplayMode() && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <Smartphone size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No iPhone, as notificações só funcionam com o CRM Plus instalado na Tela de Início (Safari → Compartilhar →
              Adicionar à Tela de Início).
            </p>
          </div>
        )}
      </SectionShell>
    );
  }

  if (section === "privacy") {
    return (
      <SectionShell meta={meta} onBack={back}>
        <div className="crm-card overflow-hidden">
          <button
            type="button"
            onClick={() => void handleExportData()}
            disabled={isExportingData}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-800/60"
          >
            <Download size={18} className="text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isExportingData ? "Exportando…" : "Exportar meus dados"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Baixa um arquivo JSON com todos os seus dados</p>
            </div>
          </button>
          <Divider />
          {deletionStatus === "pending" ? (
            <div className="space-y-2 bg-rose-50 px-4 py-3 dark:bg-rose-950/30">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Exclusão de conta agendada</p>
              {deletionScheduledAt && (
                <p className="text-xs text-rose-600 dark:text-rose-500">
                  Será excluída em: {new Date(deletionScheduledAt).toLocaleDateString("pt-BR")}
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleCancelAccountDeletion()}
                className="text-xs font-semibold text-rose-600 underline dark:text-rose-400"
              >
                Cancelar exclusão
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleRequestAccountDeletion()}
              disabled={deletionStatus === "requesting"}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-rose-50 disabled:opacity-60 dark:hover:bg-rose-950/30"
            >
              <Trash2 size={18} className="text-rose-500" />
              <div>
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {deletionStatus === "requesting" ? "Solicitando…" : "Excluir minha conta"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Exclusão com janela de 30 dias para cancelar</p>
              </div>
            </button>
          )}
        </div>

        <div className="crm-card overflow-hidden">
          <InfoRow
            icon={ShieldCheck}
            title="Política de Privacidade"
            subtitle="Consentimento registrado"
            trailing={
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${hasConsent("privacy_accepted") ? PERMISSION_BADGE.granted : PERMISSION_BADGE.prompt}`}>
                {hasConsent("privacy_accepted") ? "Aceito" : "Pendente"}
              </span>
            }
          />
          <Divider />
          <InfoRow
            icon={Info}
            title="Termos de Uso"
            subtitle="Consentimento registrado"
            trailing={
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${hasConsent("terms_accepted") ? PERMISSION_BADGE.granted : PERMISSION_BADGE.prompt}`}>
                {hasConsent("terms_accepted") ? "Aceito" : "Pendente"}
              </span>
            }
          />
        </div>

        <div className="crm-card overflow-hidden">
          <LegalLink href={LEGAL_LINKS.privacy} label="Política de Privacidade" icon={ShieldCheck} />
          <Divider />
          <LegalLink href={LEGAL_LINKS.terms} label="Termos de Uso" icon={Info} />
          <Divider />
          <LegalLink href={LEGAL_LINKS.data} label="O que coletamos e por quê" icon={Download} />
        </div>

        <p className="px-1 text-xs text-slate-400">
          Versão da política: {PRIVACY_POLICY_VERSION} · Encarregado de dados (DPO): {DPO_CONTACT_EMAIL}
        </p>
      </SectionShell>
    );
  }

  if (section === "permissions") {
    const rows: Array<{
      icon: LucideIcon;
      title: string;
      subtitle: string;
      state?: PermissionState;
      statusLabel?: string;
    }> = [
      {
        icon: Bell,
        title: "Notificações",
        subtitle: "Alertas de mensagens, leads e transferências",
        state: permissions.notifications,
      },
      { icon: Mic, title: "Microfone", subtitle: "Gravar áudios nas conversas", state: permissions.microphone },
      {
        icon: Images,
        title: "Fotos e vídeos",
        subtitle: "Somente itens escolhidos no seletor do sistema",
        statusLabel: "Via seletor",
      },
    ];
    return (
      <SectionShell meta={meta} onBack={back}>
        <div className="crm-card overflow-hidden">
          {rows.map((row, index) => (
            <React.Fragment key={row.title}>
              {index > 0 && <Divider />}
              <InfoRow
                icon={row.icon}
                title={row.title}
                subtitle={row.subtitle}
                trailing={
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    row.state ? PERMISSION_BADGE[row.state] : PERMISSION_BADGE.unsupported
                  }`}>
                    {row.state ? PERMISSION_LABEL[row.state] : row.statusLabel}
                  </span>
                }
              />
            </React.Fragment>
          ))}
        </div>
        <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
          Notificações e microfone são solicitados quando o recurso é usado. Para fotos e vídeos, o CRM Plus recebe
          somente os itens escolhidos no seletor do sistema.
        </p>
      </SectionShell>
    );
  }

  if (section === "channels") {
    return (
      <SectionShell meta={meta} onBack={back}>
        <Suspense fallback={<div className="crm-card p-6 text-sm text-slate-500">Carregando canais…</div>}>
          <CRMChannels />
        </Suspense>
      </SectionShell>
    );
  }

  if (section === "attribution") {
    return (
      <SectionShell meta={meta} onBack={back}>
        <CRMSimpleCrud
          table="crm_utm_config"
          title="Configuração UTM"
          description="Mapeamento de campanhas e tags para atribuição de origem."
          fields={[
            { key: "source_key", label: "Source", required: true },
            { key: "campaign_key", label: "Campaign", required: true },
            { key: "medium_key", label: "Medium" },
            { key: "default_channel_id", label: "Canal padrão (UUID)" },
            { key: "is_active", label: "Ativo", type: "boolean" },
          ]}
          columns={[
            { key: "source_key", label: "Source" },
            { key: "campaign_key", label: "Campaign" },
            { key: "medium_key", label: "Medium" },
            { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
          ]}
          defaultValues={{
            source_key: "",
            campaign_key: "",
            medium_key: "",
            default_channel_id: "",
            is_active: true,
          }}
          orderBy={{ column: "created_at", ascending: false }}
        />
      </SectionShell>
    );
  }

  if (section === "ai") {
    return (
      <SectionShell meta={meta} onBack={back}>
        <CRMSimpleCrud
          table="crm_ai_agent_configs"
          title="Configuração de Agente AI"
          description="Parâmetros do assistente de atendimento automático do CRM Plus."
          fields={[
            { key: "name", label: "Nome", required: true },
            { key: "is_active", label: "Ativo", type: "boolean" },
            { key: "model", label: "Modelo", required: true },
            { key: "system_prompt", label: "System Prompt", type: "textarea" },
            { key: "config", label: "Config (JSON)", type: "json" },
          ]}
          columns={[
            { key: "name", label: "Nome" },
            { key: "model", label: "Modelo" },
            { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
          ]}
          defaultValues={{
            name: "Agente CRM",
            is_active: false,
            model: "gpt-4.1-mini",
            system_prompt: "",
            config: "{}",
          }}
          orderBy={{ column: "created_at", ascending: false }}
        />
      </SectionShell>
    );
  }

  // section === "about"
  return (
    <SectionShell meta={meta} onBack={back}>
      <div className="crm-card p-5 text-center">
        <p className="text-lg font-bold text-slate-900 dark:text-slate-50">CRM Plus</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Atendimento e vendas para lojas de iPhones</p>
        <p className="mt-2 text-xs text-slate-400">
          Versão {PRIVACY_POLICY_VERSION} · Build {new Date().getFullYear()}
        </p>
      </div>

      <div className="crm-card overflow-hidden">
        <button
          type="button"
          onClick={() => void handleCheckForAppUpdate()}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          <RefreshCw size={18} className="text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Verificar atualizações</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Aplica a versão mais recente do app</p>
          </div>
        </button>
        <Divider />
        <LegalLink href={LEGAL_LINKS.privacy} label="Política de Privacidade" icon={ShieldCheck} />
        <Divider />
        <LegalLink href={LEGAL_LINKS.terms} label="Termos de Uso" icon={Info} />
      </div>

      <p className="px-1 text-center text-xs text-slate-400">Suporte: {DPO_CONTACT_EMAIL}</p>
    </SectionShell>
  );
};

export default SettingsPage;
