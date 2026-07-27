import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Send,
  Phone,
} from 'lucide-react';
import {
  DEFAULT_SCRIPTS,
  SCRIPT_CATEGORIES,
  formatScriptTemplate,
  buildWhatsAppLink,
} from '../../lib/marketing/scriptLibrary';

const ScriptsTab: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Variáveis interativas para substituição no preview dos scripts
  const [variables, setVariables] = useState<Record<string, string>>({
    nome: 'Cliente',
    modelo: 'iPhone 13 128GB',
  });

  const [targetPhone, setTargetPhone] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (scriptId: string, formattedText: string) => {
    navigator.clipboard.writeText(formattedText);
    setCopiedId(scriptId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const filteredScripts = DEFAULT_SCRIPTS.filter((script) => {
    const categoryMatch = selectedCategory === 'all' || script.category === selectedCategory;
    const searchMatch =
      !searchTerm ||
      script.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      script.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      script.template.toLowerCase().includes(searchTerm.toLowerCase());
    return categoryMatch && searchMatch;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header com variador interativo */}
      <section className="ios-card p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-ios-title-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles size={20} className="text-brand-500" />
              Biblioteca de Copywriting & Scripts de Vendas
            </h2>
            <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-1">
              Modelos de abordagem com gatilhos mentais validados para o mercado de revenda de iPhones.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 dark:border-surface-dark-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="ios-label flex items-center gap-1">
              Nome do Cliente no Preview
            </label>
            <input
              type="text"
              className="ios-input"
              value={variables.nome}
              onChange={(e) => setVariables({ ...variables, nome: e.target.value })}
              placeholder="Ex: Carlos"
            />
          </div>
          <div>
            <label className="ios-label flex items-center gap-1">
              Modelo no Preview
            </label>
            <input
              type="text"
              className="ios-input"
              value={variables.modelo}
              onChange={(e) => setVariables({ ...variables, modelo: e.target.value })}
              placeholder="Ex: iPhone 13"
            />
          </div>
          <div>
            <label className="ios-label flex items-center gap-1">
              <Phone size={14} /> Telefone Destino (WhatsApp)
            </label>
            <input
              type="text"
              className="ios-input"
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              placeholder="Ex: (85) 99999-8888"
            />
          </div>
        </div>
      </section>

      {/* Categorias & Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`ios-chip text-ios-footnote ${
              selectedCategory === 'all' ? 'ios-chip-active' : 'bg-gray-100 dark:bg-surface-dark-200 text-gray-700 dark:text-surface-dark-700'
            }`}
          >
            Todos os Scripts
          </button>
          {Object.entries(SCRIPT_CATEGORIES).map(([catKey, meta]) => (
            <button
              key={catKey}
              onClick={() => setSelectedCategory(catKey)}
              className={`ios-chip text-ios-footnote flex items-center gap-1.5 ${
                selectedCategory === catKey
                  ? 'ios-chip-active'
                  : 'bg-gray-100 dark:bg-surface-dark-200 text-gray-700 dark:text-surface-dark-700'
              }`}
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64 min-w-0">
          <input
            type="text"
            className="ios-input text-ios-subhead"
            placeholder="Buscar por palavras-chave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid de Cards de Scripts */}
      {filteredScripts.length === 0 ? (
        <div className="ios-card p-8 text-center">
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500">
            Nenhum script encontrado para a busca selecionada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {filteredScripts.map((script) => {
            const formattedText = formatScriptTemplate(script.template, variables);
            const waLink = buildWhatsAppLink(targetPhone, formattedText);

            return (
              <div
                key={script.id}
                className="ios-card p-4 md:p-6 flex flex-col justify-between space-y-4 hover:border-brand-500/30 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{script.emoji}</span>
                      <div>
                        <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">
                          {script.title}
                        </h3>
                        <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                          {script.categoryLabel} • Indicado para: {script.recommendedSegment}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 leading-relaxed">
                    {script.description}
                  </p>

                  <div className="p-3 rounded-ios-lg bg-gray-50 dark:bg-surface-dark-200/80 border border-gray-200/60 dark:border-surface-dark-200 text-ios-subhead font-mono text-gray-800 dark:text-surface-dark-800 leading-relaxed whitespace-pre-wrap select-all">
                    {formattedText}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-surface-dark-200">
                  <button
                    onClick={() => handleCopy(script.id, formattedText)}
                    className="ios-button-secondary text-ios-footnote flex items-center gap-1.5"
                  >
                    {copiedId === script.id ? (
                      <>
                        <Check size={14} className="text-green-600 dark:text-green-400" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copiar Script</span>
                      </>
                    )}
                  </button>

                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ios-button-primary text-ios-footnote flex items-center gap-1.5"
                    >
                      <Send size={14} />
                      <span>Enviar no WhatsApp</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      title="Informe o telefone acima para habilitar o envio direto"
                      className="ios-button-primary text-ios-footnote flex items-center gap-1.5 opacity-50 cursor-not-allowed"
                    >
                      <Send size={14} />
                      <span>WhatsApp Direct</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScriptsTab;
