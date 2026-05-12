import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DPO_CONTACT_EMAIL } from '../../constants';

const sections = [
  {
    title: '1. Aceitação',
    content:
      'Ao acessar o iPhoneRepasse Pro, você confirma que é um usuário autorizado pela empresa contratante e concorda com estes termos.',
  },
  {
    title: '2. Licença de Uso',
    content:
      'A empresa contratante recebe uma licença não-exclusiva, intransferível e revogável para uso da plataforma enquanto o contrato de prestação de serviços estiver vigente. Cada conta de usuário é pessoal e intransferível.',
  },
  {
    title: '3. Responsabilidades do Usuário',
    listItems: [
      'Manter a confidencialidade das credenciais de acesso.',
      'Usar a plataforma apenas para finalidades legítimas de gestão da loja.',
      'Não compartilhar acesso com terceiros não autorizados.',
      'Comunicar imediatamente qualquer suspeita de acesso indevido.',
      'Garantir que dados de clientes inseridos sejam obtidos com as devidas autorizações.',
    ],
  },
  {
    title: '4. Dados Inseridos',
    content:
      'O usuário é responsável pela veracidade e legalidade dos dados inseridos na plataforma. A operadora não se responsabiliza por dados inseridos incorretamente ou sem autorização dos titulares.',
  },
  {
    title: '5. Disponibilidade',
    content:
      'A plataforma é fornecida "como está", com meta de disponibilidade de 99,5% mensais. Manutenções programadas serão comunicadas com antecedência mínima de 24h.',
  },
  {
    title: '6. Limitação de Responsabilidade',
    content:
      'A responsabilidade máxima da operadora fica limitada ao valor pago pelos serviços no mês do evento. Não nos responsabilizamos por lucros cessantes, perda de dados por falha de terceiros ou força maior.',
  },
  {
    title: '7. Rescisão',
    content:
      'O acesso pode ser suspenso imediatamente em caso de violação destes termos, uso indevido ou término do contrato. Os dados serão tratados conforme nossa Política de Privacidade.',
  },
  {
    title: '8. Lei Aplicável',
    content:
      'Estes termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de Fortaleza/CE para dirimir controvérsias.',
  },
  {
    title: '9. Contato',
    content: DPO_CONTACT_EMAIL,
  },
];

export default function TermsOfServicePage() {
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
            Termos de Uso
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Vigente desde maio de 2026
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
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {section.content}
                </p>
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
