// Texto contratual do Repasse Care+ — fonte única das cláusulas (versão = CARE_CLAUSES_VERSION).
//
// É um contrato de PRESTAÇÃO DE SERVIÇOS de assistência técnica continuada, não um seguro:
// a CONTRATADA executa serviços com recursos próprios, nunca indeniza nem repõe o aparelho.
// Por isso o texto ao cliente evita o vocabulário de seguro: a "franquia" do contexto de negócio
// aparece como "valor por atendimento".
//
// Contrato de adesão (CDC art. 54): corpo mínimo 12 no PDF e cláusulas que limitam direitos em
// destaque — marque-as com limiting().
//
// Mudou uma cláusula? Suba CARE_CLAUSES_VERSION e a coluna default de care_settings.clauses_version:
// contratos já emitidos guardam a versão com que foram assinados.

export const CARE_CLAUSES_VERSION = "RC-2026.11-v1";
export const CARE_ACCEPTANCE_TEXT_VERSION = "ACEITE-2026.10-v1";

export type CareCondition = "NOVO" | "SEMINOVO";

export interface CareContractTextData {
  contractNumber: number;
  documentVersion: number;
  clausesVersion: string;
  issuedAt: Date;
  contractor: { legalName: string; cnpj: string | null; address: string | null };
  customer: { name: string; cpf: string | null; phone: string };
  device: { model: string; capacity: string | null; color: string | null; imei: string | null; condition: CareCondition };
  sale: { number: number | null; date: string | null };
  values: {
    salePrice: number;
    firstAmount: number;
    recurringPercent: number;
    subsequentCount: number;
    recurringAmount: number;
    subsequentTotal: number;
    totalProgrammed: number;
    billingIntervalMonths: number;
    firstSubsequentDueMonths: number;
    deductibleModality: "PERCENTUAL" | "VALOR_FIXO";
    deductibleRate: number;
    deductibleAmount: number;
  };
  bonuses: Array<{ name: string; quantity: number; description: string | null }>;
  servicesDescription: string | null;
  usageLimits: string | null;
  preventiveCheckupMonths: number | null;
  suspensionGraceDays: number;
  privacyContact: string | null;
}

// Parágrafo em destaque = cláusula que limita direito do consumidor (CDC art. 54, §4º).
export type ContractParagraph = string | { text: string; emphasis: true };

export const limiting = (text: string): ContractParagraph => ({ text, emphasis: true });
export const paragraphText = (p: ContractParagraph): string => (typeof p === "string" ? p : p.text);
export const isEmphasized = (p: ContractParagraph): boolean => typeof p !== "string";

export interface ContractSection {
  title: string;
  paragraphs: ContractParagraph[];
}

export interface ContractSummaryGroup {
  title: string;
  rows: Array<[string, string]>;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PCT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

export const formatBRL = (value: number): string => BRL.format(value);
export const formatPercent = (value: number): string => `${PCT.format(value)}%`;

export const conditionLabel = (condition: CareCondition): string => (condition === "NOVO" ? "Novo" : "Seminovo");

const formatCpf = (cpf: string | null): string => {
  const digits = (cpf ?? "").replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return digits || "não informado";
};

export const formatPhoneBR = (phone: string): string => {
  const digits = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
};

const formatDateBR = (date: Date): string =>
  date.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });

const WORDS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze",
  "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte"];

// "5 (cinco)" — número por extenso como de praxe em contrato (até vinte; acima, só o algarismo).
export const withWords = (n: number): string => (WORDS[n] ? `${n} (${WORDS[n]})` : String(n));

const months = (n: number): string => (n === 1 ? "1 (um) mês" : `${n} meses`);

// Vigência em meses a partir da ativação: o período coberto pela última parcela seguinte.
export const contractTermMonths = (v: CareContractTextData["values"]): number =>
  v.subsequentCount > 0
    ? v.firstSubsequentDueMonths + v.subsequentCount * v.billingIntervalMonths
    : Math.max(v.billingIntervalMonths, 1);

export const deductibleDescription = (v: CareContractTextData["values"]): string =>
  v.deductibleModality === "PERCENTUAL"
    ? `${formatBRL(v.deductibleAmount)} por atendimento executado (${formatPercent(v.deductibleRate)} do preço efetivo de venda do Aparelho, ${formatBRL(v.salePrice)}, fixado na contratação)`
    : `${formatBRL(v.deductibleAmount)} por atendimento executado (valor fixo)`;

export const acceptanceText = (contractNumber: number, documentVersion: number, clausesVersion: string): string =>
  `Li e concordo com o contrato Repasse Care+ nº ${contractNumber} (documento versão ${documentVersion}, cláusulas ${clausesVersion}) e quero assinar eletronicamente.`;

const contractGroup = (d: CareContractTextData): ContractSummaryGroup => ({
  title: "Contrato",
  rows: [
    ["Número", String(d.contractNumber)],
    ["Versão do documento", `${d.documentVersion} · cláusulas ${d.clausesVersion}`],
    ["Emitido em", formatDateBR(d.issuedAt)],
  ],
});

const contractorGroup = ({ contractor }: CareContractTextData): ContractSummaryGroup => ({
  title: "Contratada",
  rows: [
    ["Razão social", contractor.legalName],
    ["CNPJ", contractor.cnpj ? formatCpf(contractor.cnpj) : "não informado"],
    ["Endereço", contractor.address || "não informado"],
  ],
});

const customerGroup = ({ customer }: CareContractTextData): ContractSummaryGroup => ({
  title: "Contratante",
  rows: [
    ["Nome", customer.name],
    ["CPF/CNPJ", formatCpf(customer.cpf)],
    ["WhatsApp", formatPhoneBR(customer.phone)],
  ],
});

const deviceGroup = ({ device, sale }: CareContractTextData): ContractSummaryGroup => ({
  title: "Aparelho",
  rows: [
    ["Modelo", [device.model, device.capacity, device.color].filter(Boolean).join(" · ")],
    ["IMEI / nº de série", device.imei || "não informado"],
    ["Condição comercial", conditionLabel(device.condition)],
    ["Venda de origem", sale.number ? `nº ${sale.number}` : "registrada no sistema"],
  ],
});

const subsequentSummary = (v: CareContractTextData["values"]): string =>
  v.subsequentCount > 0
    ? `${v.subsequentCount} × ${formatBRL(v.recurringAmount)} (${formatPercent(v.recurringPercent)} do preço efetivo)`
    : "não há";

const valuesGroup = ({ values: v }: CareContractTextData): ContractSummaryGroup => ({
  title: "Valores",
  rows: [
    ["Preço efetivo de venda do Aparelho (base de cálculo)", formatBRL(v.salePrice)],
    ["1ª parcela (inicial)", formatBRL(v.firstAmount)],
    ["Parcelas seguintes", subsequentSummary(v)],
    ["Total programado", `${formatBRL(v.totalProgrammed)} em ${1 + v.subsequentCount} cobrança(s): 1 inicial + ${v.subsequentCount} seguinte(s)`],
    ["Periodicidade das seguintes", `a cada ${months(v.billingIntervalMonths)}, a 1ª ${months(v.firstSubsequentDueMonths)} após a ativação`],
    ["Valor por atendimento executado", deductibleDescription(v)],
    ["Vigência", `${months(contractTermMonths(v))} contados da ativação`],
  ],
});

const bonusGroup = ({ bonuses }: CareContractTextData): ContractSummaryGroup => ({
  title: "Benefício de adesão",
  rows: bonuses.length > 0
    ? bonuses.map((b) => [`${b.quantity}× ${b.name}`, b.description || "—"] as [string, string])
    : [["Benefício", "não há benefício de adesão nesta contratação"]],
});

export const buildContractSummary = (d: CareContractTextData): ContractSummaryGroup[] =>
  [contractGroup, contractorGroup, customerGroup, deviceGroup, valuesGroup, bonusGroup].map((group) => group(d));

interface ClauseContext {
  d: CareContractTextData;
  v: CareContractTextData["values"];
  term: number;
  bonusText: string | null;
}

const clauseContext = (d: CareContractTextData): ClauseContext => ({
  d,
  v: d.values,
  term: contractTermMonths(d.values),
  bonusText: d.bonuses.length > 0 ? d.bonuses.map((b) => `${b.quantity}× ${b.name}`).join("; ") : null,
});

// Serviços e limites são obrigatórios para emitir (care_compute_quote bloqueia sem eles); o texto
// abaixo só aparece se um contrato antigo for reemitido sem esses dados.
const servicesText = (d: CareContractTextData): string =>
  d.servicesDescription?.trim() || "os serviços descritos no quadro-resumo";
const limitsText = (d: CareContractTextData): string =>
  d.usageLimits?.trim() || "conforme o quadro-resumo";

const partiesClause = (_: ClauseContext): ContractSection => ({
  title: "Cláusula 1 — Das partes e das definições",
  paragraphs: [
    `1.1. São partes deste contrato a CONTRATADA e o(a) CONTRATANTE identificados no quadro-resumo, que integra este instrumento.`,
    `1.2. Para este contrato: (a) "Aparelho" é o dispositivo identificado no quadro-resumo pelo modelo e pelo IMEI/nº de série; (b) "Atendimento" ou "Acionamento" é cada solicitação de serviço técnico feita pelo(a) CONTRATANTE; (c) "Valor por atendimento" é o valor pago pelo(a) CONTRATANTE por atendimento executado; (d) "Ativação" é a data em que, cumulativamente, o contrato está assinado e o pagamento da 1ª parcela foi recebido; (e) "Suspensão" é a paralisação temporária dos serviços prevista na Cláusula 12.`,
  ],
});

const objectClause = ({ d }: ClauseContext): ContractSection => ({
  title: "Cláusula 2 — Do objeto",
  paragraphs: [
    `2.1. O objeto deste contrato é a prestação, pela CONTRATADA, de serviços de assistência técnica continuada ao Aparelho, compreendendo: (a) os serviços contemplados listados na Cláusula 6.1${d.preventiveCheckupMonths ? "; e (b) check-ups técnicos preventivos periódicos, conforme a Cláusula 6.3" : ""}.`,
    `2.2. Os serviços são executados pela própria CONTRATADA, com equipe e recursos próprios ou por assistência técnica por ela contratada e sob sua responsabilidade.`,
    `2.3. O programa é denominado comercialmente "Repasse Care+" e está vinculado exclusivamente ao Aparelho e ao(à) CONTRATANTE aqui identificados.`,
  ],
});

const natureClause = (_: ClauseContext): ContractSection => ({
  title: "Cláusula 3 — Da natureza do contrato",
  paragraphs: [
    `3.1. Este é um contrato de prestação de serviços, regido pelo Código Civil e pelo Código de Defesa do Consumidor (Lei nº 8.078/1990).`,
    `3.2. Este contrato NÃO constitui contrato de seguro, garantia estendida securitária, título de capitalização ou qualquer operação privativa de sociedade seguradora. A CONTRATADA não paga indenização em dinheiro, não reembolsa o valor do Aparelho e não repõe o Aparelho em caso de perda, roubo, furto ou extravio: sua obrigação é exclusivamente executar os serviços técnicos descritos neste instrumento.`,
    `3.3. Este contrato não substitui nem reduz a garantia legal (art. 26 do CDC) nem a garantia contratual concedidas na venda do Aparelho, que permanecem válidas de forma independente.`,
  ],
});

const priceClause = ({ v }: ClauseContext): ContractSection => ({
  title: "Cláusula 4 — Do preço e da forma de pagamento",
  paragraphs: [
    `4.1. Pela prestação dos serviços, o(a) CONTRATANTE pagará uma 1ª parcela (inicial) de ${formatBRL(v.firstAmount)}.`,
    v.subsequentCount > 0
      ? `4.2. Após a 1ª parcela, o(a) CONTRATANTE pagará ${v.subsequentCount} parcela(s) seguinte(s) de ${formatBRL(v.recurringAmount)} cada, valor que corresponde a ${formatPercent(v.recurringPercent)} do preço efetivamente praticado na venda do Aparelho (${formatBRL(v.salePrice)}), fixado na data da contratação.`
      : `4.2. Não há parcelas seguintes nesta contratação.`,
    `4.3. O valor total programado deste contrato é de ${formatBRL(v.totalProgrammed)}, distribuído em ${1 + v.subsequentCount} cobrança(s): 1 (uma) parcela inicial e ${v.subsequentCount} parcela(s) seguinte(s). Não há outra taxa de adesão além da 1ª parcela.`,
    `4.4. A 1ª parcela seguinte vence ${months(v.firstSubsequentDueMonths)} após a Ativação, e as demais a cada ${months(v.billingIntervalMonths)}, conforme o cronograma informado ao(à) CONTRATANTE na Ativação.`,
    `4.5. Os valores deste contrato remuneram exclusivamente os serviços aqui previstos: não são juros, não financiam o Aparelho e não serão recalculados por alteração posterior do preço de tabela do Aparelho ou das regras comerciais da CONTRATADA, salvo renegociação formal, por escrito, aceita pelo(a) CONTRATANTE.`,
    `4.6. O pagamento do Aparelho não quita parcelas deste contrato, e o pagamento deste contrato não integra o preço do Aparelho.`,
  ],
});

const bonusClause = ({ bonusText }: ClauseContext): ContractSection => ({
  title: "Cláusula 5 — Do benefício de adesão",
  paragraphs: bonusText
    ? [
      `5.1. Vinculado à 1ª parcela, o(a) CONTRATANTE receberá o seguinte benefício de adesão: ${bonusText}.`,
      limiting(`5.2. O benefício somente é liberado após o recebimento, pela CONTRATADA, do pagamento da 1ª parcela. Não havendo pagamento, o benefício não é concedido.`),
      `5.3. A entrega é registrada com data, itens entregues e responsável. O benefício não é convertível em dinheiro.`,
    ]
    : [`5.1. Esta contratação não inclui benefício de adesão.`],
});

const checkupParagraph = (monthsBetween: number): ContractParagraph =>
  `6.3. Independentemente da ocorrência de qualquer defeito, o(a) CONTRATANTE tem direito, sem custo adicional e mediante agendamento, a um check-up técnico preventivo do Aparelho a cada ${months(monthsBetween)} de vigência, com avaliação de bateria, tela, câmeras, sensores, conectores e alto-falantes e entrega de relatório do estado do Aparelho.`;

const servicesClause = ({ d }: ClauseContext): ContractSection => ({
  title: "Cláusula 6 — Dos serviços, do orçamento e das peças",
  paragraphs: [
    `6.1. Serviços contemplados: ${servicesText(d)}.`,
    limiting(`6.2. Limites de utilização: ${limitsText(d)}.`),
    d.preventiveCheckupMonths ? checkupParagraph(d.preventiveCheckupMonths) : `6.3. Esta contratação não inclui check-up preventivo periódico.`,
    `6.4. O acionamento é feito pelos canais oficiais da CONTRATADA (WhatsApp ou loja), com a apresentação do Aparelho para análise.`,
    `6.5. Antes de qualquer execução, a CONTRATADA entregará orçamento prévio, válido por 10 (dez) dias (art. 40 do CDC), informando o diagnóstico, se o serviço está contemplado, o valor por atendimento, o prazo estimado e eventuais custos não contemplados, que só serão executados com aprovação expressa do(a) CONTRATANTE. O enquadramento de um serviço como contemplado segue exclusivamente a lista da Cláusula 6.1; havendo dúvida, prevalece a interpretação mais favorável ao(à) CONTRATANTE (art. 47 do CDC).`,
    `6.6. A CONTRATADA empregará componentes de reposição originais adequados e novos ou, mediante autorização expressa do(a) CONTRATANTE no orçamento, componentes compatíveis com as especificações técnicas do fabricante (art. 21 do CDC).`,
    limiting(`6.7. Somente após a Ativação e com o contrato ativo (não suspenso) o(a) CONTRATANTE pode realizar acionamentos.`),
    `6.8. Os serviços executados contam com a garantia legal de 90 (noventa) dias prevista no art. 26, II, do CDC.`,
  ],
});

const copayClause = ({ v }: ClauseContext): ContractSection => ({
  title: "Cláusula 7 — Do valor por atendimento",
  paragraphs: [
    limiting(`7.1. O valor por atendimento é de ${deductibleDescription(v)}.`),
    `7.2. O valor por atendimento foi fixado na data da contratação e não se altera por mudança posterior no preço de tabela do Aparelho ou nas regras comerciais da CONTRATADA.`,
    `7.3. O valor por atendimento só é devido quando o serviço for aprovado pelo(a) CONTRATANTE e executado. Diagnóstico de serviço não executado não é cobrado.`,
  ],
});

const exclusionsClause = (_: ClauseContext): ContractSection => ({
  title: "Cláusula 8 — Do que não está contemplado",
  paragraphs: [
    limiting(`8.1. Não estão contemplados por este contrato: (a) perda, roubo, furto ou extravio do Aparelho; (b) danos causados intencionalmente; (c) componentes do Aparelho abertos ou reparados por terceiros não indicados pela CONTRATADA após a contratação; (d) recuperação de dados, backup, contas, senhas e softwares de terceiros; (e) acessórios que não integram o Aparelho; (f) Aparelho com IMEI ou número de série divergente, removido ou adulterado; (g) bloqueios de operadora ou de conta (por exemplo, iCloud); (h) danos ou defeitos ocorridos durante a Suspensão ou constatados na vistoria de reativação (Cláusula 12); (i) serviços não descritos na Cláusula 6.1.`),
  ],
});

const customerDutiesClause = (_: ClauseContext): ContractSection => ({
  title: "Cláusula 9 — Das obrigações do(a) CONTRATANTE",
  paragraphs: [
    `9.1. Pagar as parcelas e os valores por atendimento nos vencimentos; manter atualizados seus dados de contato; apresentar o Aparelho quando solicitado; fazer cópia de segurança (backup) dos seus dados antes de entregar o Aparelho; e informar com veracidade as circunstâncias da ocorrência.`,
    limiting(`9.2. A abertura ou o reparo do Aparelho por terceiros não indicados pela CONTRATADA durante a vigência exclui deste contrato os componentes afetados, sem prejuízo dos demais serviços.`),
  ],
});

const providerDutiesClause = (_: ClauseContext): ContractSection => ({
  title: "Cláusula 10 — Das obrigações da CONTRATADA",
  paragraphs: [
    `10.1. Prestar os serviços com técnica e qualidade adequadas; entregar orçamento prévio; registrar cada atendimento; tratar os dados do(a) CONTRATANTE com sigilo; e disponibilizar cópia deste contrato assinado ao(à) CONTRATANTE.`,
    `10.2. Havendo indisponibilidade de peças no mercado ou outro evento alheio ao controle da CONTRATADA, o prazo de execução será prorrogado pelo tempo necessário, com comunicação ao(à) CONTRATANTE, que poderá desistir do atendimento sem custo e sem consumo do limite de utilização.`,
  ],
});

const termClause = ({ term }: ClauseContext): ContractSection => ({
  title: "Cláusula 11 — Da vigência",
  paragraphs: [
    `11.1. O contrato produz efeitos a partir da Ativação e vigora por ${months(term)}. A CONTRATADA registra o pagamento da 1ª parcela no ato do recebimento.`,
    `11.2. Não há renovação automática. Nova contratação depende de novo instrumento assinado pelas partes.`,
  ],
});

const latePaymentClause = ({ d }: ClauseContext): ContractSection => ({
  title: "Cláusula 12 — Do atraso no pagamento e da suspensão",
  paragraphs: [
    limiting(`12.1. O atraso superior a ${withWords(d.suspensionGraceDays)} dias no pagamento de qualquer parcela suspende automaticamente este contrato.`),
    limiting(`12.2. Durante a Suspensão não podem ser abertos acionamentos nem realizados check-ups, e os danos ou defeitos ocorridos no período de Suspensão não estão contemplados, mesmo após a reativação. Atendimentos aprovados antes da Suspensão serão concluídos.`),
    limiting(`12.3. A reativação depende do pagamento de todas as parcelas em atraso e de vistoria técnica do Aparelho, realizada pela CONTRATADA sem custo. As avarias constatadas na vistoria são registradas e ficam excluídas deste contrato.`),
    `12.4. A Suspensão não altera o prazo de vigência nem o vencimento das parcelas seguintes.`,
    `12.5. Encargos por atraso somente serão aplicados se expressamente previstos em aditivo assinado pelas partes.`,
  ],
});

const withdrawalClause = (_: ClauseContext): ContractSection => ({
  title: "Cláusula 13 — Do arrependimento e da rescisão",
  paragraphs: [
    `13.1. Por se tratar de contratação concluída por meio eletrônico, o(a) CONTRATANTE pode desistir no prazo de 7 (sete) dias contados da assinatura (art. 49 do CDC), com devolução integral dos valores pagos. Os itens do benefício de adesão ainda não utilizados devem ser devolvidos; os já aplicados ao Aparelho ou utilizados não serão cobrados.`,
    `13.2. Após esse prazo, o(a) CONTRATANTE pode rescindir o contrato a qualquer tempo, sem multa, mediante solicitação pelos canais oficiais. Permanecem devidas as parcelas vencidas e não pagas e os valores por atendimento de serviços executados; as parcelas futuras são canceladas.`,
    limiting(`13.3. A CONTRATADA pode rescindir o contrato em caso de fraude, adulteração do Aparelho ou de seu IMEI/nº de série, ou de atraso não regularizado em até 15 (quinze) dias após notificação ao(à) CONTRATANTE.`),
  ],
});

const transferClause = (_: ClauseContext): ContractSection => ({
  title: "Cláusula 14 — Da transferência",
  paragraphs: [
    `14.1. Este contrato é vinculado ao Aparelho e ao(à) CONTRATANTE. A transferência para outro aparelho ou outro titular depende de concordância expressa da CONTRATADA, formalizada por aditivo.`,
  ],
});

const controllerText = ({ contractor }: CareContractTextData): string =>
  `${contractor.legalName}${contractor.cnpj ? `, CNPJ ${formatCpf(contractor.cnpj)}` : ""}`;

const privacyClause = ({ d }: ClauseContext): ContractSection => ({
  title: "Cláusula 15 — Da proteção de dados pessoais",
  paragraphs: [
    `15.1. A controladora dos dados pessoais é ${controllerText(d)}. Os dados do(a) CONTRATANTE são tratados para a execução deste contrato, o cumprimento de obrigações legais e o exercício regular de direitos (art. 7º, II, V e VI, da Lei nº 13.709/2018 — LGPD).`,
    `15.2. Para comprovar a assinatura eletrônica são registrados data e hora do servidor, endereço IP, identificação do navegador, eventos do processo e o identificador da mensagem de WhatsApp. A localização do dispositivo só é registrada com o consentimento do(a) CONTRATANTE no momento da assinatura (art. 7º, I, da LGPD); a recusa não impede a assinatura.`,
    `15.3. Os dados podem ser compartilhados com operadores necessários à execução do contrato, como o provedor de mensagens (WhatsApp) e de hospedagem em nuvem, o que pode envolver transferência internacional com as salvaguardas do art. 33 da LGPD. Os dados não são usados para publicidade sem consentimento específico.`,
    `15.4. O contrato, o certificado e os registros de assinatura são mantidos por até 5 (cinco) anos após o fim da vigência (art. 27 do CDC) e depois eliminados, salvo obrigação legal de guarda.`,
    `15.5. O(a) CONTRATANTE pode exercer os direitos do art. 18 da LGPD pelo canal do encarregado: ${d.privacyContact?.trim() || "canais oficiais da CONTRATADA"}.`,
  ],
});

const signatureClause = (_: ClauseContext): ContractSection => ({
  title: "Cláusula 16 — Da assinatura eletrônica",
  paragraphs: [
    `16.1. As partes admitem como válida a assinatura eletrônica deste contrato, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001.`,
    `16.2. A assinatura do(a) CONTRATANTE é feita na página segura do contrato, após a visualização do documento integral e o aceite expresso, com a digitação de código numérico de 6 (seis) dígitos, de uso único e prazo limitado, enviado ao WhatsApp informado no quadro-resumo, que o(a) CONTRATANTE declara ser de sua titularidade e uso pessoal.`,
    `16.3. O documento assinado é identificado por seu resumo criptográfico (hash SHA-256) e acompanhado de certificado com a trilha de evidências da assinatura. Esta assinatura não é assinatura qualificada no padrão ICP-Brasil.`,
    `16.4. Após a assinatura, cópia deste contrato e do certificado é disponibilizada ao(à) CONTRATANTE.`,
  ],
});

const generalClause = (_: ClauseContext): ContractSection => ({
  title: "Cláusula 17 — Disposições gerais e foro",
  paragraphs: [
    `17.1. O quadro-resumo integra este contrato. A tolerância de qualquer das partes não implica renúncia ou novação. A nulidade de uma cláusula não prejudica as demais.`,
    `17.2. Fica eleito o foro do domicílio do(a) CONTRATANTE para dirimir questões oriundas deste contrato (art. 101, I, do CDC).`,
  ],
});

const CLAUSES = [
  partiesClause,
  objectClause,
  natureClause,
  priceClause,
  bonusClause,
  servicesClause,
  copayClause,
  exclusionsClause,
  customerDutiesClause,
  providerDutiesClause,
  termClause,
  latePaymentClause,
  withdrawalClause,
  transferClause,
  privacyClause,
  signatureClause,
  generalClause,
];

export function buildContractClauses(d: CareContractTextData): ContractSection[] {
  const context = clauseContext(d);
  return CLAUSES.map((clause) => clause(context));
}
