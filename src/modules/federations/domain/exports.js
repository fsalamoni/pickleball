/**
 * PLANILHAS da federação (Bloco 5): filiados, resultados, ranking e patrimônio em CSV,
 * para a contabilidade e para a confederação. Mesmo formato do CSV de
 * cobranças (`chargesCsv`): ";" como separador, cabeçalho legível, datas
 * DD/MM/AAAA e célula protegida contra fórmula (`csvCell`).
 *
 * Zero banco: recebe o que a tela já carregou. Nenhum dado privado entra —
 * o documento da filiação não guarda contato, CPF nem nascimento (esses
 * moram em `private/data`, que a lista não lê).
 */
import { t } from '@/core/i18n';
import { csvCell, csvData, csvReais } from './charges';
import { ASSET_CATEGORY_LABELS, ASSET_CONDITION_LABELS, assetState } from './management';
import { membershipState } from './membership';
import { REGISTRY_BOND_LABELS, memberBond } from './registry';
import { personTypeLabel } from './memberTypes';

const linha = (cells) => cells.map(csvCell).join(';');

/** Uma linha por filiação (a lista que está na tela, já filtrada). */
export function membersCsv(members = [], { catalog = null } = {}) {
  const out = [linha([t('Nome'), t('Número'), t('Tipo'), t('Vínculo'), t('Plano'), t('Situação'), t('Válida desde'), t('Válida até'), t('Responsável')])];
  members.forEach((m) => {
    const st = membershipState(m);
    out.push(linha([
      m.org_name || m.user_name, m.member_number, personTypeLabel(m, catalog), t(REGISTRY_BOND_LABELS[memberBond(m)]),
      m.plan_name, st.label || m.status, csvData(m.valid_from), csvData(st.validUntil), m.guardian_name,
    ]));
  });
  return out.join('\n');
}

/** Uma linha por atleta em cada resultado enviado (torneio, categoria, colocação). */
export function resultsCsv(results = []) {
  const out = [linha([t('Torneio'), t('Data'), t('Categoria'), t('Categoria do torneio'), t('Situação'), t('Colocação'), t('Atleta'), t('Jogos'), t('Vitórias')])];
  results.forEach((r) => {
    const situacao = r.status === 'rejected' ? t('Recusado') : t('Aceito');
    const rows = [...(r.rows || [])].sort((a, b) => (Number(a.position) || 999) - (Number(b.position) || 999));
    rows.forEach((x) => out.push(linha([
      r.tournament_name, csvData(r.date), r.modality_name, r.tier_label, situacao, x.position, x.name, x.played ?? '', x.won ?? '',
    ])));
  });
  return out.join('\n');
}

/** O ranking de uma temporada: o geral e cada classe, com a coluna "Classe". */
export function rankingCsv(ranking, { classLabel = (c) => c.key } = {}) {
  const out = [linha([t('Temporada'), t('Classe'), t('Posição'), t('Atleta'), t('Pontos'), t('Torneios'), t('Títulos')])];
  if (!ranking) return out.join('\n');
  const blocos = [{ nome: t('Geral'), rows: ranking.general || [] }, ...(ranking.categories || []).map((c) => ({ nome: classLabel(c), rows: c.rows || [] }))];
  blocos.forEach((b) => b.rows.forEach((l) => out.push(linha([ranking.season, b.nome, l.position, l.name, l.points, l.events ?? '', l.titles ?? '']))));
  return out.join('\n');
}

/** O inventário (para a contabilidade e o balanço patrimonial): uma linha por bem. */
export function assetsCsv(assets = [], hoje) {
  const out = [linha([t('Bem'), t('Categoria'), t('Código'), t('Quantidade'), t('Emprestados'), t('Estado'), t('Local'), t('Aquisição'), t('Valor'), t('Situação')])];
  assets.forEach((a) => {
    const st = assetState(a, hoje);
    out.push(linha([
      a.name, t(ASSET_CATEGORY_LABELS[a.category] || ASSET_CATEGORY_LABELS.other), a.code, a.quantity, st.lent,
      a.condition && ASSET_CONDITION_LABELS[a.condition] ? t(ASSET_CONDITION_LABELS[a.condition]) : '', a.location, csvData(a.acquired_at),
      a.value_cents ? csvReais(a.value_cents) : '', st.retired ? t('Baixado') : t('Ativo'),
    ]));
  });
  return out.join('\n');
}
