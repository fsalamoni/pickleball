/**
 * As CATEGORIAS DE TORNEIO da federação (Central → Competições → Ranking):
 * cada tipo de torneio com sigla e grupo (ex.: FGP 1000 · G1), a tabela de
 * pontos por colocação, a participação e os requisitos. Quem edita é quem
 * salva a pontuação (admin e competições); a gravação é `updateRankingConfig`.
 *
 * Sem categorias próprias, a federação usa as três padrão (regional,
 * estadual, principal) derivadas da tabela × peso — e pode partir delas.
 * Arquivar tira a categoria da escolha nos torneios novos sem mexer nos que
 * já a usam (nem nos pontos já lançados).
 */
import React, { useState } from 'react';
import { Archive, ArchiveRestore, Minus, Pencil, Plus, Sparkles, Tags } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { TIER_MAX, TIER_MAX_PLACES, newTierId, normalizeTier, tierLabel, tierTableFromChampion, validateTiers } from '@/modules/federations/domain/officialRanking';
import { V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { fmtNumero, t, tn } from '@/core/i18n';

const ALCANCES = [4, 8, 16, 32, 64];
const pts = (v) => fmtNumero(Number(v) || 0);

/** "Campeão 1.000 · até o 32º · participação 10" */
function resumoDaTabela(tt) {
  return [
    t('Campeão {p}', { p: pts(tt.points_by_place[1]) }),
    tt.places > 1 ? t('até o {n}º', { n: tt.places }) : '',
    t('participação {p}', { p: pts(tt.participation) }),
  ].filter(Boolean).join(' · ');
}

function resumoDosRequisitos(req = {}) {
  return [
    req.min_entrants ? tn(req.min_entrants, 'mínimo de {n} inscrição', 'mínimo de {n} inscrições') : '',
    req.prize ? t('premiação: {p}', { p: req.prize }) : '',
  ].filter(Boolean).join(' · ');
}

function TierDialog({ inicial, todas, onSave, onClose }) {
  const [tier, setTier] = useState(inicial);
  const [campeao, setCampeao] = useState(String(inicial.points_by_place[1] || 1000));
  const [alcance, setAlcance] = useState(String(ALCANCES.find((n) => n >= (inicial.places || 32)) || 32));
  const [erro, setErro] = useState('');
  const set = (patch) => { setTier((x) => ({ ...x, ...patch })); setErro(''); };
  const setReq = (patch) => set({ requirements: { ...tier.requirements, ...patch } });
  const linhas = Array.from({ length: tier.places }, (_, i) => i + 1);
  const setPonto = (p, v) => set({ points_by_place: { ...tier.points_by_place, [p]: v === '' ? '' : Number(v) } });
  const gerar = () => {
    const g = tierTableFromChampion(Number(campeao) || 0, Number(alcance));
    set({ points_by_place: g.points_by_place, places: g.places, participation: g.participation });
  };
  const maisUma = () => set({ points_by_place: { ...tier.points_by_place, [tier.places + 1]: tier.points_by_place[tier.places] ?? 0 }, places: tier.places + 1 });
  const menosUma = () => {
    const { [tier.places]: _fora, ...resto } = tier.points_by_place;
    set({ points_by_place: resto, places: tier.places - 1 });
  };
  const salvar = (e) => {
    e.preventDefault();
    const limpa = normalizeTier({ ...tier, legacy: false });
    const lista = todas.some((x) => x.id === limpa.id) ? todas.map((x) => (x.id === limpa.id ? limpa : x)) : [...todas, limpa];
    const v = validateTiers(lista);
    if (v.erros[limpa.id]) return setErro(v.erros[limpa.id]);
    if (!v.ok && !Object.keys(v.erros).length) return setErro(v.geral);
    onSave(limpa);
  };
  const nova = !todas.some((x) => x.id === inicial.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-2xl">
        <DialogTitle>{nova ? t('Nova categoria de torneio') : t('Editar {categoria}', { categoria: tierLabel(inicial) || t('categoria') })}</DialogTitle>
        <DialogDescription>{t('A sigla e o grupo aparecem no selo do torneio e no ranking. A tabela diz quantos pontos cada colocação ganha. Mudar a tabela vale para os próximos resultados: o que já foi lançado não muda.')}</DialogDescription>
        <form className="space-y-5" onSubmit={salvar} data-dica="federacao-categoria-form">
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Sigla')} htmlFor="tier-code" hint={t('Ex.: FGP 1000')}><V2Input id="tier-code" value={tier.code} maxLength={24} onChange={(e) => set({ code: e.target.value })} /></V2Field>
            <V2Field label={t('Grupo')} htmlFor="tier-group" hint={t('Ex.: G1')}><V2Input id="tier-group" value={tier.group} maxLength={12} onChange={(e) => set({ group: e.target.value })} /></V2Field>
            <V2Field label={t('Nome (opcional)')} htmlFor="tier-name" hint={t('Ex.: Etapa estadual')}><V2Input id="tier-name" value={tier.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} /></V2Field>
          </div>

          <fieldset className="space-y-3 rounded-2xl border border-gray-100 p-3">
            <legend className="px-1 text-sm font-semibold text-ink">{t('Gerar a tabela pelos pontos do campeão')}</legend>
            <p className="text-xs text-gray-500">{t('Padrão dos circuitos: vice 60%, semifinal 36%, quartas 18%, oitavas 9%, e assim por diante. Depois ajuste o que quiser.')}</p>
            <div className="flex flex-wrap items-end gap-2">
              <V2Field label={t('Pontos do campeão')} htmlFor="tier-champ" className="w-40"><V2Input id="tier-champ" type="number" min={1} inputMode="numeric" value={campeao} onChange={(e) => setCampeao(e.target.value)} /></V2Field>
              <V2Field label={t('Até a colocação')} htmlFor="tier-alcance" className="w-40">
                <V2Select id="tier-alcance" value={alcance} onChange={(e) => setAlcance(e.target.value)} options={ALCANCES.map((n) => ({ value: String(n), label: `${n}º` }))} />
              </V2Field>
              <V2Button type="button" variant="secondary" onClick={gerar}><Sparkles className="h-4 w-4" />{t('Gerar tabela')}</V2Button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t('Pontos por colocação')}</legend>
            <p className="text-xs text-gray-500">{t('No mata-mata, quem cai nas quartas fica em 5º, nas oitavas em 9º, nos 16 avos em 17º.')}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {linhas.map((p) => (
                <V2Field key={p} label={`${p}º`} htmlFor={`tier-p${p}`}>
                  <V2Input id={`tier-p${p}`} type="number" min={0} inputMode="numeric" value={tier.points_by_place[p] ?? ''} onChange={(e) => setPonto(p, e.target.value)} />
                </V2Field>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <V2Button type="button" size="sm" variant="ghost" disabled={tier.places >= TIER_MAX_PLACES} onClick={maisUma}><Plus className="h-4 w-4" />{t('Mais uma colocação')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" disabled={tier.places <= 1} onClick={menosUma}><Minus className="h-4 w-4" />{t('Tirar a última')}</V2Button>
            </div>
          </fieldset>

          <V2Field label={t('Participação')} htmlFor="tier-part" hint={t('Para quem jogou e ficou fora da tabela. Não pode valer mais que a última colocação.')}>
            <V2Input id="tier-part" type="number" min={0} inputMode="numeric" value={tier.participation} onChange={(e) => set({ participation: e.target.value === '' ? '' : Number(e.target.value) })} className="sm:w-40" />
          </V2Field>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink">{t('Requisitos e regulamento')}</legend>
            <p className="text-xs text-gray-500">{t('Aparecem para quem pede a chancela e para a equipe ao aprovar. Servem de referência: quem confere é a federação.')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <V2Field label={t('Mínimo de inscrições')} htmlFor="tier-min"><V2Input id="tier-min" type="number" min={0} inputMode="numeric" value={tier.requirements.min_entrants || ''} onChange={(e) => setReq({ min_entrants: Number(e.target.value) || 0 })} /></V2Field>
              <V2Field label={t('Premiação mínima')} htmlFor="tier-prize" hint={t('Ex.: R$ 2.000 ou troféus')}><V2Input id="tier-prize" value={tier.requirements.prize} maxLength={120} onChange={(e) => setReq({ prize: e.target.value })} /></V2Field>
            </div>
            <V2Field label={t('Outras exigências')} htmlFor="tier-notes" hint={t('Arbitragem, quadras, bola oficial, prazo de pedido…')}><V2Textarea id="tier-notes" rows={3} maxLength={500} value={tier.requirements.notes} onChange={(e) => setReq({ notes: e.target.value })} /></V2Field>
          </fieldset>

          <V2Toggle id="tier-active" checked={tier.active} onChange={(v) => set({ active: v })} label={t('Disponível para torneios novos')} hint={t('Desligada, a categoria fica arquivada: some da escolha, e os torneios que já a usam seguem como estão.')} />
          {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="submit">{nova ? t('Incluir categoria') : t('Aplicar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * @param {{ tiers: object[], explicit: boolean, onChange: (tiers: object[]) => void }} props
 *   `onChange` recebe a lista nova de categorias PRÓPRIAS (nunca as derivadas).
 */
export default function FedTiersEditor({ tiers, explicit, onChange }) {
  const [editando, setEditando] = useState(null);
  const proprias = explicit ? tiers : [];
  const novaCategoria = () => setEditando(normalizeTier({ id: newTierId('categoria', proprias.map((x) => x.id)), ...tierTableFromChampion(1000, 32) }));
  const aplicar = (tt) => {
    const id = proprias.some((x) => x.id === tt.id) ? tt.id : newTierId(tt.code || tt.name, proprias.map((x) => x.id));
    const limpa = { ...tt, id };
    onChange(proprias.some((x) => x.id === tt.id) ? proprias.map((x) => (x.id === tt.id ? limpa : x)) : [...proprias, limpa]);
    setEditando(null);
  };
  const partirDasPadrao = () => onChange(tiers.map((x) => ({ ...x, legacy: false })));
  const alternar = (tt) => onChange(proprias.map((x) => (x.id === tt.id ? { ...x, active: !x.active } : x)));
  const ativas = proprias.filter((x) => x.active).length;

  return (
    <div className="space-y-3" data-dica="federacao-categorias">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Tags className="h-5 w-5" aria-hidden="true" />{t('Categorias de torneio')}</h3>
          <p className="text-sm text-gray-500">{t('Cada tipo de torneio com sigla, grupo e a própria tabela de pontos — por exemplo FGP 1000 (G1), FGP 500 (G2). A equipe escolhe a categoria ao chancelar, e os pontos do ranking saem da tabela dela.')}</p>
        </div>
        {explicit && proprias.length < TIER_MAX && <V2Button type="button" size="sm" onClick={novaCategoria}><Plus className="h-4 w-4" />{t('Nova categoria')}</V2Button>}
      </div>

      {!explicit && (
        <V2Surface variant="compacto" className="space-y-3 p-4">
          <p className="text-sm text-gray-700">{t('Hoje a federação usa os três tipos padrão — Etapa regional, Etapa estadual e Campeonato principal —, com a tabela e os pesos abaixo. Crie as suas categorias para ter siglas, grupos e tabelas próprias.')}</p>
          <ul className="space-y-1 text-sm text-gray-600">
            {tiers.map((tt) => <li key={tt.id}><span className="font-semibold text-ink">{tierLabel(tt)}</span> · {resumoDaTabela(tt)}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <V2Button type="button" size="sm" onClick={partirDasPadrao}><Pencil className="h-4 w-4" />{t('Editar a partir das três padrão')}</V2Button>
            <V2Button type="button" size="sm" variant="secondary" onClick={novaCategoria}><Plus className="h-4 w-4" />{t('Começar do zero')}</V2Button>
          </div>
          <p className="text-xs text-gray-500">{t('Partindo das padrão, os torneios que já usam cada uma continuam ligados a ela.')}</p>
        </V2Surface>
      )}

      {explicit && (
        <ul className="space-y-2">
          {proprias.map((tt) => (
            <li key={tt.id}>
              <V2Surface variant="compacto" className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
                    {tierLabel(tt) || t('Sem nome')}
                    {!tt.active && <V2Badge tone="neutral">{t('Arquivada')}</V2Badge>}
                  </p>
                  <p className="text-xs text-gray-500">{resumoDaTabela(tt)}</p>
                  {resumoDosRequisitos(tt.requirements) && <p className="text-xs text-gray-500">{resumoDosRequisitos(tt.requirements)}</p>}
                  {tt.requirements.notes && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{tt.requirements.notes}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <V2Button type="button" size="sm" variant="secondary" onClick={() => setEditando(tt)}><Pencil className="h-4 w-4" />{t('Editar')}</V2Button>
                  <V2Button type="button" size="sm" variant="ghost" disabled={tt.active && ativas <= 1} onClick={() => alternar(tt)}>
                    {tt.active ? <><Archive className="h-4 w-4" />{t('Arquivar')}</> : <><ArchiveRestore className="h-4 w-4" />{t('Reativar')}</>}
                  </V2Button>
                </div>
              </V2Surface>
            </li>
          ))}
        </ul>
      )}

      {editando && <TierDialog inicial={editando} todas={proprias} onSave={aplicar} onClose={() => setEditando(null)} />}
    </div>
  );
}
