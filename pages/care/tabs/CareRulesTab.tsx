import React, { useState } from 'react';
import { fetchCareSettings, listCareBenefits, listCatalogModels, listConditionRules, listModelRules } from '../../../services/careApi';
import type { CareModelRule } from '../../../lib/care/careTypes';
import { useCareQuery } from '../useCareQuery';
import { CareLoadError, CareLoading } from '../CareStates';
import ConditionRulesSection from '../rules/ConditionRulesSection';
import ModelRulesSection from '../rules/ModelRulesSection';
import ModelRuleModal from '../rules/ModelRuleModal';
import BenefitCatalogSection from '../rules/BenefitCatalogSection';
import CareSettingsSection from '../rules/CareSettingsSection';

const loadRules = async () => {
  const [conditionRules, modelRules, benefits, settings, models] = await Promise.all([
    listConditionRules(), listModelRules(), listCareBenefits(), fetchCareSettings(), listCatalogModels(),
  ]);
  return { conditionRules, modelRules, benefits, settings, models };
};

// Toda a configuração comercial do Repasse Care+; alterações geram nova versão e nunca mudam contratos firmados.
const CareRulesTab: React.FC = () => {
  const [version, setVersion] = useState(0);
  const query = useCareQuery(loadRules, [version]);
  const [editing, setEditing] = useState<CareModelRule | null | undefined>(undefined);
  const reload = () => setVersion((v) => v + 1);

  if (query.loading && !query.data) return <CareLoading rows={4} />;
  if (query.error || !query.data) return <CareLoadError message={query.error ?? 'Sem dados.'} onRetry={query.reload} />;
  const data = query.data;

  return (
    <div className="space-y-8">
      <ConditionRulesSection rules={data.conditionRules} onSaved={reload} />
      <ModelRulesSection rules={data.modelRules} conditionRules={data.conditionRules} benefits={data.benefits} onEdit={setEditing} />
      <BenefitCatalogSection benefits={data.benefits} onSaved={reload} />
      <CareSettingsSection key={data.settings.clauses_version + version} settings={data.settings} onSaved={reload} />
      {editing !== undefined && (
        <ModelRuleModal
          rule={editing}
          conditionRules={data.conditionRules}
          benefits={data.benefits}
          models={data.models}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            reload();
          }}
        />
      )}
    </div>
  );
};

export default CareRulesTab;
