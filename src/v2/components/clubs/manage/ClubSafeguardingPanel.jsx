/**
 * PROTEÇÃO DE MENORES DO CLUBE (Central → Proteção de menores; permissão `discipline` ou
 * `admin`): quem trabalha com crianças e adolescentes e se está em dia (compromisso de conduta
 * aceito + certidão de antecedentes conferida), a conferência da certidão (o arquivo é apagado
 * quando a decisão é registrada), os associados menores de idade com o responsável legal e as
 * regras. Toda escrita é do servidor (`clubSafeguarding`). As denúncias de proteção de menor
 * chegam pela Ouvidoria (assunto próprio, com aviso de prioridade).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Phone, Plus, Save, ShieldCheck, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useClubMinors, useClubSafeguardingAction, useClubSgOverview } from '@/modules/clubs/hooks/useClubSafeguarding';
import { fetchClubBackgroundFile } from '@/modules/clubs/services/clubSafeguardingService';
import {
  CLUB_SG_LABEL_MAX, CLUB_SG_PLEDGE_MAX, CLUB_SG_ROLES, CLUB_SG_ROLE_LABELS, CLUB_SG_ROLE_SHORT, GUARDIAN_RELATION_LABELS, SG_FOREVER, SG_LIMITS,
  defaultPledgeText, normalizeClubSgRules, validateClubSgRules,
} from '@/modules/clubs/domain/safeguarding';
import { BACKGROUND_STATUS_LABELS, expiresSoon, sortOverview } from '@/modules/federations/domain/safeguarding';
import { LIVE_MEMBER_STATUSES } from '@/modules/federations/domain/membership';
import { isoDateBR } from '@/modules/federations/domain/referees';
import { BuscaLista, MostrarMais, normalizaBusca as normaliza, useBuscaLista, useFiltroNaUrl } from '../../federations/manage/listTools';
import { useAvisoNaoSalvo } from '../../federations/manage/naoSalvo';
import { baixarBlob } from '../../federations/acervo/acervoFiles';
import { dataCurta } from '../../federations/referees/refUi';
import ClubGuardianForm from '../association/ClubGuardianForm';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2SearchInput, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const ate = (iso) => (iso === SG_FOREVER ? t('sem vencimento') : t('até {data}', { data: dataCurta(iso) }));

/** Baixa a certidão em conferência (o servidor registra quem abriu). */
async function abrirCertidao(clubId, row) {
  const r = await fetchClubBackgroundFile(clubId, row.user_id);
  const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
  const ext = (r.contentType || '').split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  baixarBlob(new Blob([bytes], { type: r.contentType }), `${t('Certidão')} - ${row.name || ''}.${ext}`);
}

/* ------------------------------------------------------------------ quadro -- */

function ConferirDialog({ club, row, onFechar }) {
  const [decisao, setDecisao] = useState('valid');
  const [validade, setValidade] = useState(row.pending?.valid_until || '');
  const [motivo, setMotivo] = useState('');
  const m = useClubSafeguardingAction(club.id);
  const enviar = (e) => {
    e.preventDefault();
    m.mutate({ action: 'sg_verify', userId: row.user_id, decision: decisao, ...(decisao === 'valid' ? { validUntil: validade } : { reason: motivo }) }, {
      onSuccess: () => { toast.success(decisao === 'valid' ? t('Certidão conferida. O arquivo foi apagado.') : t('Certidão não aceita. A pessoa foi avisada.')); onFechar(); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{t('Conferir a certidão de {nome}', { nome: row.name })}</DialogTitle>
        <DialogDescription>{t('Abra o arquivo, confira se é a pessoa, se a certidão é negativa e a data de emissão. Registrada a decisão, o arquivo é apagado: o clube guarda só a data, a validade e quem conferiu.')}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          <p className="text-sm text-gray-700">{t('Emitida em {data}.', { data: dataCurta(row.pending?.issued_at) })}</p>
          <V2Button type="button" size="sm" variant="ghost" onClick={() => abrirCertidao(club.id, row).catch((er) => toast.error(er.message))}><FileText className="h-4 w-4" />{t('Abrir o arquivo')}</V2Button>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink">{t('Decisão')}</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="csg-dec" checked={decisao === 'valid'} onChange={() => setDecisao('valid')} />{t('Conferida: está em ordem')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="csg-dec" checked={decisao === 'rejected'} onChange={() => setDecisao('rejected')} />{t('Não aceita')}</label>
          </fieldset>
          {decisao === 'valid' ? (
            <V2Field label={t('Vale até')} htmlFor="csg-validade" hint={t('Pelas regras do clube; mude se a certidão disser outra data.')}>
              <V2Input id="csg-validade" type="date" min={isoDateBR()} value={validade} onChange={(e) => setValidade(e.target.value)} />
            </V2Field>
          ) : (
            <V2Field label={t('Motivo')} htmlFor="csg-motivo" required hint={t('Vai para a pessoa, que pode enviar outra.')}>
              <V2Textarea id="csg-motivo" rows={3} maxLength={SG_LIMITS.NOTE_MAX} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
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

function RevogarDialog({ club, row, onFechar }) {
  const [motivo, setMotivo] = useState('');
  const m = useClubSafeguardingAction(club.id);
  const enviar = (e) => {
    e.preventDefault();
    m.mutate({ action: 'sg_revoke', userId: row.user_id, reason: motivo }, {
      onSuccess: () => { toast.success(t('Conferência revogada. A pessoa foi avisada.')); onFechar(); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{t('Revogar a certidão de {nome}', { nome: row.name })}</DialogTitle>
        <DialogDescription>{t('Até enviar uma nova certidão, a pessoa não pode trabalhar com menores pelo clube.')}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          <V2Field label={t('Motivo')} htmlFor="csg-rev-motivo" required><V2Textarea id="csg-rev-motivo" rows={3} maxLength={SG_LIMITS.NOTE_MAX} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending || motivo.trim().length < SG_LIMITS.REASON_MIN}>{t('Revogar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Inclui no quadro um treinador, monitor ou voluntário (quem não tem cargo na diretoria). */
function DesignarDialog({ club, affiliationsQ, jaNoQuadro, onFechar }) {
  const [busca, setBusca] = useState('');
  const [alvo, setAlvo] = useState(null);
  const [rotulo, setRotulo] = useState('');
  const m = useClubSafeguardingAction(club.id);
  const termo = normaliza(busca.trim());
  const candidatos = useMemo(
    () => (affiliationsQ.data || []).filter((mb) => LIVE_MEMBER_STATUSES.includes(mb.status) && mb.user_id && !jaNoQuadro.has(mb.user_id) && (!termo || normaliza(mb.user_name).includes(termo))).slice(0, 8),
    [affiliationsQ.data, jaNoQuadro, termo],
  );
  const enviar = (e) => {
    e.preventDefault();
    if (!alvo) return;
    m.mutate({ action: 'sg_designate', userId: alvo.user_id, label: rotulo }, {
      onSuccess: () => { toast.success(t('Incluído no quadro. A pessoa foi avisada.')); onFechar(); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{t('Incluir no quadro de quem trabalha com menores')}</DialogTitle>
        <DialogDescription>{t('Para treinadores, monitores e voluntários que não têm cargo na diretoria. A pessoa é avisada e precisa aceitar o compromisso e enviar a certidão de antecedentes.')}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          <V2Field label={t('Associado')} htmlFor="csg-des-busca" required>
            {alvo ? (
              <div className="flex items-center gap-2 text-sm"><span className="font-bold text-ink">{alvo.user_name}</span><V2Button type="button" size="sm" variant="ghost" onClick={() => setAlvo(null)}>{t('Trocar')}</V2Button></div>
            ) : (
              <>
                <V2SearchInput id="csg-des-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Nome do associado')} aria-label={t('Buscar associado')} />
                {affiliationsQ.isError && <p className="mt-1 text-xs text-red-600">{t('Não carregaram os associados.')}</p>}
                {termo && candidatos.length > 0 && <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100">{candidatos.map((mb) => <li key={mb.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => setAlvo(mb)}>{mb.user_name}</button></li>)}</ul>}
                {termo && affiliationsQ.isSuccess && !candidatos.length && <p className="mt-1 text-xs text-gray-500">{t('Ninguém com esse nome entre os associados.')}</p>}
              </>
            )}
          </V2Field>
          <V2Field label={t('Função (opcional)')} htmlFor="csg-des-rotulo" hint={t('Ex.: Treinador da escolinha, Monitor das quartas.')}>
            <V2Input id="csg-des-rotulo" maxLength={CLUB_SG_LABEL_MAX} value={rotulo} onChange={(e) => setRotulo(e.target.value)} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
            <V2Button type="submit" disabled={m.isPending || !alvo}>{t('Incluir no quadro')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PessoaRow({ club, row, hoje }) {
  const [dialogo, setDialogo] = useState(null);
  const m = useClubSafeguardingAction(club.id);
  const bg = row.background || {};
  const tirar = () => m.mutate({ action: 'sg_designate', userId: row.user_id, designated: false }, {
    onSuccess: () => toast.success(t('Tirado do quadro.')),
    onError: (er) => toast.error(er.message),
  });
  const designado = row.roles.includes('designated');
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
          <p className="text-xs text-gray-500">{row.roles.map((r) => t(CLUB_SG_ROLE_SHORT[r] || r)).join(' · ')}{row.label ? ` · ${row.label}` : ''}</p>
          <ul className="text-xs text-gray-600">
            <li>{row.pledge_ok ? t('Compromisso de conduta aceito') : t('Compromisso de conduta ainda não aceito')}</li>
            <li>{bg.valid ? t('Certidão conferida {ate}', { ate: ate(bg.until) }) : t(BACKGROUND_STATUS_LABELS[bg.status] || 'Sem certidão conferida')}</li>
            {row.last_rejection?.reason && !row.pending && <li>{t('Última não aceita: {motivo}', { motivo: row.last_rejection.reason })}</li>}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          {row.pending && <V2Button type="button" size="sm" onClick={() => setDialogo('conferir')} data-dica="clube-protecao-conferir">{t('Conferir certidão')}</V2Button>}
          {bg.valid && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('revogar')}>{t('Revogar')}</V2Button>}
          {designado && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={tirar}>{t('Tirar do quadro')}</V2Button>}
        </div>
      </V2Surface>
      {dialogo === 'conferir' && <ConferirDialog club={club} row={row} onFechar={() => setDialogo(null)} />}
      {dialogo === 'revogar' && <RevogarDialog club={club} row={row} onFechar={() => setDialogo(null)} />}
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

function QuadroTab({ club, overviewQ, affiliationsQ }) {
  const hoje = isoDateBR();
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'todos', FILTROS);
  const [designar, setDesignar] = useState(false);
  const todas = useMemo(() => sortOverview(overviewQ.data?.rows || [], hoje), [overviewQ.data, hoje]);
  const lista = useMemo(() => todas.filter((r) => noFiltro(r, filtro, hoje)), [todas, filtro, hoje]);
  const busca = useBuscaLista(lista, (r) => r.name || '');
  const noQuadro = useMemo(() => new Set(todas.filter((r) => r.roles.includes('designated')).map((r) => r.user_id)), [todas]);
  if (overviewQ.isError) return <V2ErrorState title={t('Não carregou quem trabalha com menores')} onRetry={() => overviewQ.refetch()} />;
  if (overviewQ.isLoading) return <V2Skeleton lines={5} />;
  const rotulos = { todos: t('Todos'), conferir: t('Certidão para conferir'), pendentes: t('Não podem trabalhar'), vencendo: t('Vencendo em 30 dias'), 'em-dia': t('Em dia') };
  const regras = normalizeClubSgRules(overviewQ.data?.rules);
  return (
    <section className="space-y-4" aria-label={t('Quem trabalha com menores')} data-dica="clube-protecao">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-gray-500">{t('Exigido de: {papeis}. Em dia = compromisso de conduta aceito e certidão de antecedentes conferida.', { papeis: regras.required_for.map((r) => t(CLUB_SG_ROLE_LABELS[r])).join(', ') || t('ninguém') })}</p>
        <V2Button type="button" size="sm" onClick={() => setDesignar(true)} data-dica="clube-protecao-designar"><Plus className="h-4 w-4" />{t('Incluir no quadro')}</V2Button>
      </div>
      <div className="flex flex-wrap gap-2">{FILTROS.map((id) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{`${rotulos[id]} (${todas.filter((r) => noFiltro(r, id, hoje)).length})`}</V2FilterChip>)}</div>
      {lista.length > 0 && <BuscaLista id="csg-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar pelo nome')} total={lista.length} achados={busca.filtrados.length} />}
      {!busca.filtrados.length
        ? <V2EmptyState icon={ShieldCheck} title={todas.length ? t('Ninguém neste filtro') : t('Ninguém no quadro ainda')} description={todas.length ? undefined : t('Aparecem aqui os cargos da diretoria, os treinadores e voluntários que você incluir e quem enviou a certidão.')} />
        : <ul className="space-y-3">{busca.visiveis.map((r) => <PessoaRow key={r.user_id} club={club} row={r} hoje={hoje} />)}</ul>}
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
      {designar && <DesignarDialog club={club} affiliationsQ={affiliationsQ} jaNoQuadro={noQuadro} onFechar={() => setDesignar(false)} />}
    </section>
  );
}

/* ------------------------------------------------------------------ menores -- */

function ResponsavelDialog({ club, row, onFechar }) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{t('Responsável de {nome}', { nome: row.name })}</DialogTitle>
        <DialogDescription>{t('Registre o responsável legal do menor. Os dados ficam só com a disciplina do clube e são apagados quando o associado completa 18 anos.')}</DialogDescription>
        <div className="mt-4"><ClubGuardianForm clubId={club.id} userId={row.user_id} initial={row.guardian} onDone={onFechar} onCancel={onFechar} /></div>
      </DialogContent>
    </Dialog>
  );
}

function MenorRow({ club, row }) {
  const [editar, setEditar] = useState(false);
  const g = row.guardian;
  return (
    <li>
      <V2Surface variant="compacto" className="flex flex-wrap items-start gap-3 p-4">
        <V2Avatar photoUrl={row.photo_url} name={row.name} size="sm" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
            {row.name || t('Sem nome')}
            <V2Badge tone="neutral">{t('{n} anos', { n: row.age })}</V2Badge>
            {g ? <V2Badge tone={g.consent ? 'green' : 'amber'}>{g.consent ? t('Participação autorizada') : t('Participação não autorizada')}</V2Badge> : <V2Badge tone="red">{t('Sem responsável registrado')}</V2Badge>}
          </p>
          {g && (
            <ul className="text-xs text-gray-600">
              <li className="flex flex-wrap items-center gap-2"><UserRound className="h-3.5 w-3.5" aria-hidden="true" />{g.name} · {t(GUARDIAN_RELATION_LABELS[g.relation] || g.relation)}</li>
              <li><a className="inline-flex items-center gap-2 text-brand-700 underline" href={`tel:+${g.phone.length <= 11 ? `55${g.phone}` : g.phone}`}><Phone className="h-3.5 w-3.5" aria-hidden="true" />{g.phone}</a></li>
              <li>{g.image_consent ? t('Uso de imagem autorizado') : t('Uso de imagem não autorizado')}</li>
              {g.note && <li>{t('Observações: {obs}', { obs: g.note })}</li>}
            </ul>
          )}
        </div>
        <V2Button type="button" size="sm" variant={g ? 'ghost' : 'primary'} onClick={() => setEditar(true)}>{g ? t('Editar responsável') : t('Registrar responsável')}</V2Button>
      </V2Surface>
      {editar && <ResponsavelDialog club={club} row={row} onFechar={() => setEditar(false)} />}
    </li>
  );
}

const FILTROS_MENORES = ['todos', 'sem-responsavel', 'sem-autorizacao'];

function MenoresTab({ club, minorsQ }) {
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'todos', FILTROS_MENORES);
  const todas = useMemo(() => [...(minorsQ.data?.rows || [])].sort((a, b) => Number(Boolean(a.guardian)) - Number(Boolean(b.guardian)) || String(a.name).localeCompare(String(b.name), 'pt-BR')), [minorsQ.data]);
  const noFiltro2 = (r, f) => ({ todos: true, 'sem-responsavel': !r.guardian, 'sem-autorizacao': Boolean(r.guardian) && !r.guardian.consent }[f]);
  const lista = useMemo(() => todas.filter((r) => noFiltro2(r, filtro)), [todas, filtro]);
  const busca = useBuscaLista(lista, (r) => r.name || '');
  if (minorsQ.isError) return <V2ErrorState title={t('Não carregaram os associados menores')} onRetry={() => minorsQ.refetch()} />;
  if (minorsQ.isLoading) return <V2Skeleton lines={4} />;
  const rotulos = { todos: t('Todos'), 'sem-responsavel': t('Sem responsável'), 'sem-autorizacao': t('Sem autorização') };
  return (
    <section className="space-y-4" aria-label={t('Associados menores de idade')} data-dica="clube-protecao-menores">
      <p className="text-sm text-gray-500">{t('Associados com menos de 18 anos pela data de nascimento do cadastro. O menor (ou a secretaria) registra o responsável legal; os dados ficam só com a disciplina e somem aos 18 anos.')}</p>
      <div className="flex flex-wrap gap-2">{FILTROS_MENORES.map((id) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{`${rotulos[id]} (${todas.filter((r) => noFiltro2(r, id)).length})`}</V2FilterChip>)}</div>
      {lista.length > 0 && <BuscaLista id="csg-menores-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar pelo nome')} total={lista.length} achados={busca.filtrados.length} />}
      {!busca.filtrados.length
        ? <V2EmptyState icon={ShieldCheck} title={todas.length ? t('Ninguém neste filtro') : t('Nenhum associado menor de idade')} description={todas.length ? undefined : t('Aparecem aqui os associados com menos de 18 anos.')} />
        : <ul className="space-y-3">{busca.visiveis.map((r) => <MenorRow key={r.user_id} club={club} row={r} />)}</ul>}
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
    </section>
  );
}

/* ------------------------------------------------------------------- regras -- */

function RegrasTab({ club, rules }) {
  const atual = normalizeClubSgRules(rules);
  const [f, setF] = useState({ required_for: atual.required_for, background_months: String(atual.background_months), pledge_text: atual.pledge_text });
  const [base] = useState(f);
  const [novoAceite, setNovoAceite] = useState(false);
  useAvisoNaoSalvo(JSON.stringify(f) !== JSON.stringify(base) || novoAceite);
  const r = validateClubSgRules({ required_for: f.required_for, background_months: f.background_months === '' ? undefined : Number(f.background_months), pledge_text: f.pledge_text, pledge_version: atual.pledge_version + (novoAceite ? 1 : 0) });
  const m = useClubSafeguardingAction(club.id);
  const toggle = (role) => setF((x) => ({ ...x, required_for: x.required_for.includes(role) ? x.required_for.filter((y) => y !== role) : [...x.required_for, role] }));
  const enviar = (e) => {
    e.preventDefault();
    if (!r.ok) { toast.error(Object.values(r.errors)[0]); return; }
    m.mutate({ action: 'sg_rules', rules: r.value }, { onSuccess: () => { toast.success(t('Regras da proteção de menores salvas.')); setNovoAceite(false); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" aria-label={t('Regras da proteção de menores')} data-dica="clube-protecao-regras">
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <h3 className="font-bold text-ink">{t('Quem precisa estar em dia')}</h3>
        <p className="text-sm text-gray-500">{t('O compromisso de conduta é aceito pela própria pessoa em Minha filiação; a certidão de antecedentes é enviada por ela e conferida aqui.')}</p>
        {CLUB_SG_ROLES.map((role) => <V2Toggle key={role} id={`csg-role-${role}`} checked={f.required_for.includes(role)} onChange={() => toggle(role)} label={t(CLUB_SG_ROLE_LABELS[role])} />)}
      </V2Surface>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <V2Field label={t('Validade da certidão (meses)')} htmlFor="csg-meses" error={r.errors.background_months} hint={t('Contada da data de emissão. Quem confere pode mudar a data de uma certidão específica.')}>
          <V2Input id="csg-meses" type="number" min={SG_LIMITS.MONTHS_MIN} max={SG_LIMITS.MONTHS_MAX} value={f.background_months} onChange={(e) => setF((x) => ({ ...x, background_months: e.target.value }))} />
        </V2Field>
      </V2Surface>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <V2Field label={t('Texto do compromisso de conduta')} htmlFor="csg-compromisso" hint={t('Em branco, vale o texto-padrão abaixo.')}>
          <V2Textarea id="csg-compromisso" rows={5} maxLength={CLUB_SG_PLEDGE_MAX} value={f.pledge_text} onChange={(e) => setF((x) => ({ ...x, pledge_text: e.target.value }))} placeholder={defaultPledgeText()} />
        </V2Field>
        <V2Toggle id="csg-novo-aceite" checked={novoAceite} onChange={setNovoAceite} label={t('Pedir novo aceite de todos')} hint={t('Muda o texto para valer de novo: quem já aceitou precisa aceitar outra vez para continuar em dia. Use quando o compromisso mudar de verdade.')} />
      </V2Surface>
      <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending}><Save className="h-4 w-4" />{m.isPending ? t('Salvando…') : t('Salvar regras')}</V2Button></div>
    </form>
  );
}

export default function ClubSafeguardingPanel({ club, affiliationsQ, tab = 'protecao' }) {
  // Cada aba consulta só o que mostra (a regra da leitura é a mesma; o resto é peso à toa).
  const overviewQ = useClubSgOverview(club.id, { enabled: tab === 'protecao' || tab === 'protecao-regras' });
  const minorsQ = useClubMinors(club.id, { enabled: tab === 'menores' });
  return (
    <div className="space-y-4" data-dica="clube-protecao-painel">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Proteção de menores')}</h2>
        <p className="text-sm text-gray-500">{t('Quem trabalha com crianças e adolescentes no clube precisa ter aceitado o compromisso de conduta e ter a certidão de antecedentes conferida. Acesso restrito à disciplina e à administração.')}</p>
      </div>
      {tab === 'menores' && <MenoresTab club={club} minorsQ={minorsQ} />}
      {tab === 'protecao-regras' && (overviewQ.isError
        ? <V2ErrorState title={t('Não carregaram as regras')} onRetry={() => overviewQ.refetch()} />
        : !overviewQ.isSuccess ? <V2Skeleton lines={4} /> : <RegrasTab key={JSON.stringify(overviewQ.data.rules)} club={club} rules={overviewQ.data.rules} />)}
      {tab === 'protecao' && <QuadroTab club={club} overviewQ={overviewQ} affiliationsQ={affiliationsQ} />}
    </div>
  );
}
