/**
 * PROTEÇÃO DE MENORES (Central → Proteção de menores; só a permissão
 * `safeguarding`; módulo `safeguarding`): quem trabalha com menores e se está
 * em dia (curso de proteção válido + certidão de antecedentes conferida), a
 * conferência da certidão (o arquivo é apagado quando a decisão é
 * registrada), as DENÚNCIAS de proteção de menor (prioridade, acesso
 * restrito) e as regras. Toda escrita é do servidor (`federationCoaching`);
 * a denúncia segue a regra da ouvidoria, só que para o responsável.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Save, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { coachingAction, fetchBackgroundFile } from '@/modules/federations/services/coachingService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { reportProtocol, sortReports } from '@/modules/federations/domain/discipline';
import {
  BACKGROUND_STATUS_LABELS, SG_FOREVER, SG_LIMITS, SG_ROLES, SG_ROLE_LABELS, SG_ROLE_SHORT, expiresSoon, normalizeSgRules, sortOverview, validateSgRules,
} from '@/modules/federations/domain/safeguarding';
import { isoDateBR } from '@/modules/federations/domain/referees';
import { BuscaLista, MostrarMais, useBuscaLista, useFiltroNaUrl } from '../manage/listTools';
import { useAvisoNaoSalvo } from '../manage/naoSalvo';
import { RelatoRow } from '../manage/FedDisciplinePanel';
import { baixarBlob } from '../acervo/acervoFiles';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { dataCurta } from '../referees/refUi';
import SafeguardingReport from '../institutional/SafeguardingReport';

const ate = (iso) => (iso === SG_FOREVER ? t('sem vencimento') : t('até {data}', { data: dataCurta(iso) }));

/** Baixa a certidão em conferência (o servidor registra quem abriu). */
async function abrirCertidao(fedId, row) {
  const r = await fetchBackgroundFile(fedId, row.user_id);
  const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
  const ext = (r.contentType || '').split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  baixarBlob(new Blob([bytes], { type: r.contentType }), `${t('Certidão')} - ${row.name || ''}.${ext}`);
}

function ConferirDialog({ federation, row, onFechar }) {
  const [decisao, setDecisao] = useState('valid');
  const [validade, setValidade] = useState(row.pending?.valid_until || '');
  const [motivo, setMotivo] = useState('');
  const m = useFederationMutation(() => coachingAction({
    federationId: federation.id, action: 'sg_verify', userId: row.user_id, decision: decisao,
    ...(decisao === 'valid' ? { validUntil: validade } : { reason: motivo }),
  }));
  const enviar = (e) => {
    e.preventDefault();
    m.mutate(undefined, { onSuccess: () => { toast.success(decisao === 'valid' ? t('Certidão conferida. O arquivo foi apagado.') : t('Certidão não aceita. A pessoa foi avisada.')); onFechar(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{t('Conferir a certidão de {nome}', { nome: row.name })}</DialogTitle>
        <DialogDescription>{t('Abra o arquivo, confira se é a pessoa, se a certidão é negativa e a data de emissão. Registrada a decisão, o arquivo é apagado: a federação guarda só a data, a validade e quem conferiu.')}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          <p className="text-sm text-gray-700">{t('Emitida em {data}.', { data: dataCurta(row.pending?.issued_at) })}</p>
          <V2Button type="button" size="sm" variant="ghost" onClick={() => abrirCertidao(federation.id, row).catch((er) => toast.error(er.message))}><FileText className="h-4 w-4" />{t('Abrir o arquivo')}</V2Button>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink">{t('Decisão')}</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="sg-dec" checked={decisao === 'valid'} onChange={() => setDecisao('valid')} />{t('Conferida: está em ordem')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="sg-dec" checked={decisao === 'rejected'} onChange={() => setDecisao('rejected')} />{t('Não aceita')}</label>
          </fieldset>
          {decisao === 'valid' ? (
            <V2Field label={t('Vale até')} htmlFor="sg-validade" hint={t('Pelas regras da federação; mude se a certidão disser outra data.')}>
              <V2Input id="sg-validade" type="date" min={isoDateBR()} value={validade} onChange={(e) => setValidade(e.target.value)} />
            </V2Field>
          ) : (
            <V2Field label={t('Motivo')} htmlFor="sg-motivo" required hint={t('Vai para a pessoa, que pode enviar outra.')}>
              <V2Textarea id="sg-motivo" rows={3} maxLength={SG_LIMITS.NOTE_MAX} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </V2Field>
          )}
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
            <V2Button type="submit" disabled={m.isPending || (decisao === 'rejected' && motivo.trim().length < SG_LIMITS.REASON_MIN) || (decisao === 'valid' && !validade)}>{t('Registrar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevogarDialog({ federation, row, onFechar }) {
  const [motivo, setMotivo] = useState('');
  const m = useFederationMutation(() => coachingAction({ federationId: federation.id, action: 'sg_revoke', userId: row.user_id, reason: motivo }));
  const enviar = (e) => {
    e.preventDefault();
    m.mutate(undefined, { onSuccess: () => { toast.success(t('Conferência revogada. A pessoa foi avisada.')); onFechar(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{t('Revogar a certidão de {nome}', { nome: row.name })}</DialogTitle>
        <DialogDescription>{t('Até enviar uma nova certidão, a pessoa não pode ser escalada nem licenciada para trabalhar com menores.')}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          <V2Field label={t('Motivo')} htmlFor="sg-rev-motivo" required><V2Textarea id="sg-rev-motivo" rows={3} maxLength={SG_LIMITS.NOTE_MAX} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending || motivo.trim().length < SG_LIMITS.REASON_MIN}>{t('Revogar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PessoaRow({ federation, row, hoje }) {
  const [dialogo, setDialogo] = useState(null);
  const bg = row.background || {};
  return (
    <li>
      <V2Surface variant="compacto" className="flex flex-wrap items-start gap-3 p-4">
        <V2Avatar photoUrl={row.photo_url} name={row.name} size="sm" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
            {row.name || t('Sem nome')}
            {row.ok ? <V2Badge tone={expiresSoon(row.until, hoje) ? 'amber' : 'green'}>{t('Em dia {ate}', { ate: ate(row.until) })}</V2Badge>
              : <V2Badge tone={row.required ? 'red' : 'neutral'}>{row.required ? t('Não pode trabalhar com menores') : t('Não exigido')}</V2Badge>}
            {row.pending && <V2Badge tone="amber">{t('Certidão para conferir')}</V2Badge>}
          </p>
          <p className="text-xs text-gray-500">{row.roles.map((r) => t(SG_ROLE_SHORT[r] || r)).join(' · ')}</p>
          <ul className="text-xs text-gray-600">
            <li>{row.training_ok ? t('Curso de proteção válido {ate}', { ate: ate(row.training_until) }) : t('Sem curso de proteção válido')}</li>
            <li>{bg.valid ? t('Certidão conferida {ate}', { ate: ate(bg.until) }) : t(BACKGROUND_STATUS_LABELS[bg.status] || 'Sem certidão conferida')}</li>
            {row.last_rejection?.reason && !row.pending && <li>{t('Última não aceita: {motivo}', { motivo: row.last_rejection.reason })}</li>}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          {row.pending && <V2Button type="button" size="sm" onClick={() => setDialogo('conferir')} data-dica="federacao-protecao-conferir">{t('Conferir certidão')}</V2Button>}
          {bg.valid && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('revogar')}>{t('Revogar')}</V2Button>}
        </div>
      </V2Surface>
      {dialogo === 'conferir' && <ConferirDialog federation={federation} row={row} onFechar={() => setDialogo(null)} />}
      {dialogo === 'revogar' && <RevogarDialog federation={federation} row={row} onFechar={() => setDialogo(null)} />}
    </li>
  );
}

const FILTROS = ['todos', 'conferir', 'pendentes', 'vencendo', 'em-dia'];
const noFiltro = (r, filtro, hoje) => ({
  todos: true,
  conferir: Boolean(r.pending),
  pendentes: r.required && !r.ok,
  vencendo: r.ok && expiresSoon(r.until, hoje),
  'em-dia': r.ok,
}[filtro]);

function QuadroTab({ federation, overviewQ }) {
  const hoje = isoDateBR();
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'todos', FILTROS);
  const todas = useMemo(() => sortOverview(overviewQ.data?.rows || [], hoje), [overviewQ.data, hoje]);
  const lista = useMemo(() => todas.filter((r) => noFiltro(r, filtro, hoje)), [todas, filtro, hoje]);
  const busca = useBuscaLista(lista, (r) => r.name || '');
  if (overviewQ.isError) return <V2ErrorState title={t('Não carregou quem trabalha com menores')} onRetry={() => overviewQ.refetch()} />;
  if (overviewQ.isLoading) return <V2Skeleton lines={5} />;
  const rotulos = { todos: t('Todos'), conferir: t('Certidão para conferir'), pendentes: t('Não podem trabalhar'), vencendo: t('Vencendo em 30 dias'), 'em-dia': t('Em dia') };
  const regras = normalizeSgRules(overviewQ.data?.rules);
  return (
    <section className="space-y-4" aria-label={t('Quem trabalha com menores')} data-dica="federacao-protecao">
      <p className="text-sm text-gray-500">{t('Exigido de: {papeis}. Em dia = curso de proteção válido e certidão de antecedentes conferida. Sem isso, a escala de arbitragem, a licença de professor e a chancela com diretor de torneio são recusadas.', { papeis: regras.required_for.map((r) => t(SG_ROLE_LABELS[r])).join(', ') || t('ninguém') })}</p>
      <div className="flex flex-wrap gap-2">{FILTROS.map((id) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{`${rotulos[id]} (${todas.filter((r) => noFiltro(r, id, hoje)).length})`}</V2FilterChip>)}</div>
      {lista.length > 0 && <BuscaLista id="sg-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar pelo nome')} total={lista.length} achados={busca.filtrados.length} />}
      {!busca.filtrados.length
        ? <V2EmptyState icon={ShieldCheck} title={todas.length ? t('Ninguém neste filtro') : t('Ninguém trabalhando com menores ainda')} description={todas.length ? undefined : t('Aparecem aqui os professores licenciados, os árbitros do quadro, os diretores de torneio e quem enviou a certidão.')} />
        : <ul className="space-y-3">{busca.visiveis.map((r) => <PessoaRow key={r.user_id} federation={federation} row={r} hoje={hoje} />)}</ul>}
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
    </section>
  );
}

function DenunciasTab({ federation, minorReportsQ }) {
  const lista = useMemo(() => sortReports(minorReportsQ.data || []), [minorReportsQ.data]);
  if (minorReportsQ.isError) return <V2ErrorState title={t('Não carregaram as denúncias')} onRetry={() => minorReportsQ.refetch()} />;
  if (minorReportsQ.isLoading) return <V2Skeleton lines={4} />;
  const abertas = lista.filter((r) => r.status !== 'closed');
  return (
    <section className="space-y-4" aria-label={t('Denúncias de proteção de menor')} data-dica="federacao-protecao-denuncias">
      <V2Surface variant="compacto" className="flex items-start gap-3 border-l-4 border-red-500 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <p className="text-sm text-gray-700">{t('Prioridade: trate antes de qualquer outra manifestação. Só quem tem a permissão de proteção de menores vê estas denúncias; a disciplina e a ouvidoria comum, não. Havendo risco a criança ou adolescente, acione o Conselho Tutelar ou o Disque 100.')}</p>
      </V2Surface>
      {!fedModuleOn(federation, 'safeguarding') && <p className="text-sm text-amber-700">{t('A proteção de menores está desligada: novas denúncias deste tipo não chegam. Conclua as que estão em aberto.')}</p>}
      {!lista.length
        ? <V2EmptyState icon={ShieldCheck} title={t('Nenhuma denúncia de proteção de menor')} />
        : <ul className="space-y-3" aria-label={t('{n} em aberto', { n: abertas.length })}>{lista.map((r) => <RelatoRow key={r.id} rep={r} />)}</ul>}
      {lista.length > 0 && <p className="text-xs text-gray-500">{t('O protocolo (ex.: {p}) é o que a pessoa usa para acompanhar o estado.', { p: reportProtocol(lista[0].id) })}</p>}
    </section>
  );
}

function RegrasTab({ federation }) {
  const atual = normalizeSgRules(federation.safeguarding_rules);
  const [f, setF] = useState({ required_for: atual.required_for, background_months: String(atual.background_months) });
  const [base] = useState(f);
  useAvisoNaoSalvo(JSON.stringify(f) !== JSON.stringify(base));
  const r = validateSgRules({ required_for: f.required_for, background_months: f.background_months === '' ? undefined : Number(f.background_months) });
  const m = useFederationMutation(() => coachingAction({ federationId: federation.id, action: 'sg_rules', rules: r.value }));
  const toggle = (role) => setF((x) => ({ ...x, required_for: x.required_for.includes(role) ? x.required_for.filter((y) => y !== role) : [...x.required_for, role] }));
  const enviar = (e) => {
    e.preventDefault();
    if (!r.ok) { toast.error(Object.values(r.errors)[0]); return; }
    m.mutate(undefined, { onSuccess: () => toast.success(t('Regras da proteção de menores salvas.')), onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" aria-label={t('Regras da proteção de menores')} data-dica="federacao-protecao-regras">
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <h3 className="font-bold text-ink">{t('Quem precisa estar em dia')}</h3>
        <p className="text-sm text-gray-500">{t('O curso de proteção é um curso da federação do tipo "Proteção de menores": quem é aprovado recebe a credencial. A certidão de antecedentes é enviada pela própria pessoa e conferida aqui.')}</p>
        {SG_ROLES.map((role) => <V2Toggle key={role} id={`sg-role-${role}`} checked={f.required_for.includes(role)} onChange={() => toggle(role)} label={t(SG_ROLE_LABELS[role])} />)}
      </V2Surface>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <V2Field label={t('Validade da certidão (meses)')} htmlFor="sg-meses" error={r.errors.background_months} hint={t('Contada da data de emissão. Quem confere pode mudar a data de uma certidão específica.')}>
          <V2Input id="sg-meses" type="number" min={SG_LIMITS.MONTHS_MIN} max={SG_LIMITS.MONTHS_MAX} value={f.background_months} onChange={(e) => setF((x) => ({ ...x, background_months: e.target.value }))} />
        </V2Field>
      </V2Surface>
      <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending}><Save className="h-4 w-4" />{m.isPending ? t('Salvando…') : t('Salvar regras')}</V2Button></div>
    </form>
  );
}

export default function FedSafeguardingPanel({ federation, tab = 'protecao', overviewQ, minorReportsQ }) {
  return (
    <div className="space-y-4" data-dica="federacao-protecao-painel">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Proteção de menores')}</h2>
        <p className="text-sm text-gray-500">{t('No modelo SafeSport: quem trabalha com crianças e adolescentes precisa de curso de proteção válido e certidão de antecedentes conferida. Acesso restrito ao responsável pela proteção.')}</p>
      </div>
      {tab === 'protecao-denuncias' && <DenunciasTab federation={federation} minorReportsQ={minorReportsQ} />}
      {tab === 'protecao-regras' && <RegrasTab key={JSON.stringify(federation.safeguarding_rules || {})} federation={federation} />}
      {tab === 'protecao' && <QuadroTab federation={federation} overviewQ={overviewQ} />}
      {tab === 'protecao-relatorio' && <SafeguardingReport federation={federation} overviewQ={overviewQ} minorReportsQ={minorReportsQ} />}
    </div>
  );
}
