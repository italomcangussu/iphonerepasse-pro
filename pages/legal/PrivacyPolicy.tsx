import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DPO_CONTACT_EMAIL, PRIVACY_POLICY_VERSION } from '../../constants';

const sections = [
  {
    title: '1. Quem Somos',
    content:
      'iPhoneRepasse Pro é uma plataforma de gestão interna para lojas de iPhones, desenvolvida e operada pela equipe do Hospital dos iPhones. Esta plataforma é de uso exclusivo B2B — apenas funcionários e gestores autorizados têm acesso.',
  },
  {
    title: '2. Dados que Coletamos',
    items: [
      {
        label: '2.1 Dados de autenticação',
        text: 'E-mail, nome, telefone e senha (armazenada com hash seguro) dos usuários cadastrados pelos administradores da loja.',
      },
      {
        label: '2.2 Dados operacionais',
        text: 'Informações de estoque, vendas, orçamentos e movimentações financeiras inseridas pelos usuários durante o uso da plataforma.',
      },
      {
        label: '2.3 Dados de clientes da loja',
        text: 'Nome, CPF, e-mail e telefone de clientes inseridos pelos funcionários nas funcionalidades de CRM, garantias e vendas.',
      },
      {
        label: '2.4 Dados de dispositivos',
        text: 'Informações sobre iPhones e iPads (modelo, IMEI, estado, preço) inseridas no estoque.',
      },
      {
        label: '2.5 Dados técnicos',
        text: 'Logs de acesso, versão do navegador, timestamps de ações (para auditoria interna). Não coletamos dados de geolocalização nem de comportamento cross-site.',
      },
    ],
  },
  {
    title: '3. Base Legal (LGPD art. 7º)',
    listItems: [
      'Execução de contrato (art. 7º, V): dados necessários para a prestação do serviço contratado.',
      'Legítimo interesse (art. 7º, IX): logs de auditoria para segurança e conformidade interna.',
      'Consentimento (art. 7º, I): quando solicitado explicitamente para funcionalidades opcionais (ex.: notificações push).',
    ],
  },
  {
    title: '4. Como Usamos os Dados',
    listItems: [
      'Autenticação e controle de acesso ao sistema.',
      'Operação das funcionalidades: PDV, estoque, CRM, financeiro e garantias.',
      'Auditoria interna de ações dos usuários.',
      'Envio de notificações push (apenas se você optar por ativar).',
      'Não vendemos, alugamos nem compartilhamos seus dados com terceiros para fins comerciais ou de publicidade.',
    ],
  },
  {
    title: '5. Compartilhamento',
    content:
      'Seus dados são processados pelos seguintes subprocessadores:',
    listItems: [
      'Supabase Inc. (EUA): banco de dados, autenticação e armazenamento de arquivos. Contrato de DPA em conformidade com LGPD/GDPR.',
      'Serviços de push notification (Apple/Google): apenas token de dispositivo criptografado, sem dados pessoais identificáveis.',
    ],
    footer: 'Não transferimos dados para outros terceiros além dos subprocessadores acima.',
  },
  {
    title: '6. Retenção',
    listItems: [
      'Dados de conta: mantidos enquanto o vínculo empregatício estiver ativo. Excluídos em até 30 dias após solicitação ou desligamento.',
      'Dados operacionais (vendas, estoque): retidos por 5 anos para fins contábeis e fiscais, conforme legislação brasileira.',
      'Logs de auditoria: retidos por 1 ano.',
    ],
  },
  {
    title: '7. Seus Direitos (LGPD art. 18)',
    content: 'Como titular de dados, você tem direito a:',
    listItems: [
      'Confirmação da existência de tratamento;',
      'Acesso aos seus dados (via "Exportar meus dados" em Configurações > Privacidade);',
      'Correção de dados incompletos ou desatualizados;',
      'Anonimização ou bloqueio de dados desnecessários;',
      'Portabilidade dos dados;',
      'Eliminação dos dados tratados com consentimento (via "Excluir minha conta" em Configurações > Privacidade);',
      'Revogação do consentimento a qualquer momento;',
      'Informação sobre compartilhamento com terceiros.',
    ],
  },
  {
    title: '8. Segurança',
    content: 'Adotamos medidas técnicas e administrativas para proteger seus dados:',
    listItems: [
      'Comunicação criptografada via HTTPS/TLS 1.3.',
      'Senhas armazenadas com bcrypt.',
      'Controle de acesso por papéis (RBAC).',
      'Row Level Security (RLS) no banco de dados.',
      'Backups automáticos com retenção de 7 dias.',
    ],
  },
  {
    title: '9. Notificações Push',
    content:
      'Se você optar por ativar notificações push, seu token de dispositivo será armazenado de forma segura e usado exclusivamente para enviar alertas do iPhoneRepasse Pro (novos leads, vendas, mensagens do CRM). Você pode revogar esse consentimento a qualquer momento em Configurações > Privacidade.',
  },
  {
    title: '10. Alterações nesta Política',
    content:
      'Notificaremos usuários sobre alterações materiais via notificação no app com 15 dias de antecedência. A versão atual estará sempre disponível em Configurações > Sobre > Política de Privacidade.',
  },
  {
    title: '11. Contato e DPO',
    content: `Para exercer seus direitos ou esclarecer dúvidas, entre em contato pelo e-mail ${DPO_CONTACT_EMAIL}. Responderemos em até 15 dias úteis.\n\nAutoridade Nacional de Proteção de Dados (ANPD): www.gov.br/anpd`,
  },
];

export default function PrivacyPolicyPage() {
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
            Política de Privacidade
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Vigente desde maio de 2026 · Versão {PRIVACY_POLICY_VERSION}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {section.title}
              </h2>

              {section.content && (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              )}

              {'items' in section && section.items && (
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div key={item.label}>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {item.label}:{' '}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {'listItems' in section && section.listItems && (
                <ul className="space-y-1.5 pl-4">
                  {section.listItems.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed list-disc"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {'footer' in section && section.footer && (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {section.footer}
                </p>
              )}
            </div>
          ))}
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
