import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Bell, XCircle } from 'lucide-react';
import { DPO_CONTACT_EMAIL } from '../../constants';

export default function DataUsagePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-light-100 dark:bg-surface-dark-50 text-gray-900 dark:text-white">
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 safe-area-top">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            O Que Coletamos e Por Quê
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Transparência de dados — iPhoneRepasse Pro
          </p>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            Esta página explica, de forma simples e direta, quais dados o iPhoneRepasse Pro coleta sobre você.
          </p>
        </div>

        <div className="space-y-8">
          {/* Essential Data */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                Dados Essenciais
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal normal-case tracking-normal">
                (obrigatórios para o funcionamento)
              </span>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Conta de usuário</p>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">O quê:</span>
                  <span className="text-gray-600 dark:text-gray-300">nome, e-mail, telefone, papel (admin/gerente/vendedor)</span>
                  <span className="text-gray-500 dark:text-gray-400">Por quê:</span>
                  <span className="text-gray-600 dark:text-gray-300">identificação e controle de acesso</span>
                  <span className="text-gray-500 dark:text-gray-400">Onde fica:</span>
                  <span className="text-gray-600 dark:text-gray-300">Supabase (Brasil/EUA)</span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Atividade no app</p>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">O quê:</span>
                  <span className="text-gray-600 dark:text-gray-300">quais telas você acessou, quais ações realizou e quando</span>
                  <span className="text-gray-500 dark:text-gray-400">Por quê:</span>
                  <span className="text-gray-600 dark:text-gray-300">auditoria de segurança interna e relatórios gerenciais</span>
                  <span className="text-gray-500 dark:text-gray-400">Onde fica:</span>
                  <span className="text-gray-600 dark:text-gray-300">banco de dados da sua loja</span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Dados da loja inseridos por você</p>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">O quê:</span>
                  <span className="text-gray-600 dark:text-gray-300">estoque, vendas, clientes, financeiro — tudo que você digita</span>
                  <span className="text-gray-500 dark:text-gray-400">Por quê:</span>
                  <span className="text-gray-600 dark:text-gray-300">são a finalidade principal da plataforma</span>
                  <span className="text-gray-500 dark:text-gray-400">Onde fica:</span>
                  <span className="text-gray-600 dark:text-gray-300">banco de dados exclusivo da sua loja (isolado por RLS)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Data */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                Dados Opcionais
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal normal-case tracking-normal">
                (somente se você permitir)
              </span>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notificações push</p>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                <span className="text-gray-500 dark:text-gray-400">O quê:</span>
                <span className="text-gray-600 dark:text-gray-300">token criptografado do seu dispositivo</span>
                <span className="text-gray-500 dark:text-gray-400">Por quê:</span>
                <span className="text-gray-600 dark:text-gray-300">enviar alertas de vendas, leads e mensagens do CRM</span>
                <span className="text-gray-500 dark:text-gray-400">Onde fica:</span>
                <span className="text-gray-600 dark:text-gray-300">banco de dados + Apple/Google (apenas o token)</span>
                <span className="text-gray-500 dark:text-gray-400">Como revogar:</span>
                <span className="text-gray-600 dark:text-gray-300">Configurações &gt; Privacidade &gt; Notificações</span>
              </div>
            </div>
          </div>

          {/* What we do NOT collect */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                O Que Não Coletamos
              </h2>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <ul className="space-y-2">
                {[
                  'Localização geográfica',
                  'Contatos do celular',
                  'Histórico de navegação externo',
                  'Dados biométricos',
                  'Dados para publicidade ou rastreamento cross-site',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <XCircle className="w-4 h-4 text-red-400 dark:text-red-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Rights */}
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 p-5 space-y-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Seus Direitos
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Você pode exportar todos os seus dados em{' '}
              <span className="font-medium text-gray-700 dark:text-gray-200">
                Configurações &gt; Privacidade &gt; Exportar meus dados
              </span>
              .
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Dúvidas:{' '}
              <a
                href={`mailto:${DPO_CONTACT_EMAIL}`}
                className="text-blue-600 dark:text-blue-400 underline underline-offset-2"
              >
                {DPO_CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400">
            Dúvidas? Entre em contato: {DPO_CONTACT_EMAIL}
          </p>
        </div>
      </div>
    </div>
  );
}
