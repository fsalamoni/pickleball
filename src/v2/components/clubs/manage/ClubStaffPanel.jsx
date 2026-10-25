/**
 * Diretoria do clube (permissão `staff`): quem ocupa cada CARGO, o mandato de
 * cada um e os cargos do clube. Duas abas:
 *  - `equipe`: as pessoas — nomear (entre os membros do clube), mudar de
 *    cargo, prorrogar o mandato (com motivo), tirar e sair;
 *  - `cargos` (só quem administra ou tem o cargo master): os cargos do clube e o
 *    que cada um abre na Central.
 * Toda escrita é do servidor (`clubStaff`), que confere de novo quem pode. As
 * contas daqui (`staffActionAllowed`) só dizem antes, na tela. Quem
 * ADMINISTRA o clube aparece no topo, sem cargo: é o papel de `club_members`.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Crown, LogOut, Pencil, Plus, Save, Trash2, UserCog, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useClubMembers } from '@/modules/clubs/hooks/useClubs';
import { useClubStaffAction } from '@/modules/clubs/hooks/useClubAssociation';
import { ALL_CLUB_PERMS, CLUB_PERM_LABELS } from '@/modules/clubs/domain/association';
import {
  CLUB_PERM_HINTS, STAFF_TERM_MAX_MONTHS, actorOf, effectiveRoles, roleDescription, roleHolders, roleLabel, staffActionAllowed, staffIsMaster, termStatus, validateStaffRole, validateTerm,
} from '@/modules/clubs/domain/staff';
import { addMonthsISO, isoDate } from '@/modules/federations/domain/membership';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { quando } from '@/v2/components/federations/federationUi';
import { t, tn } from '@/core/i18n';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const fimPadrao = (role, inicio) => (role?.term_months ? addMonthsISO(inicio, role.term_months) : '');
const cargoNome = (s, roles) => roleLabel(roles.find((r) => r.id === (s.role_id || s.role))) || s.role_name || s.role || '';
const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A situação do mandato, em palavras. */
function MandatoChip({ s }) {
  const st = termStatus(s);
  if (st.kind === 'open') return <V2Badge>{s.term_start ? t('Desde {inicio}, sem data de fim', { inicio: quando(s.term_start) }) : t('Sem data de fim')}</V2Badge>;
  if (st.kind === 'active') return <V2Badge>{t('Mandato até {fim}', { fim: quando(s.term_end) })}</V2Badge>;
  if (st.kind === 'ending') return <V2Badge tone="amber">{tn(st.days, 'Termina em {n} dia ({fim})', 'Termina em {n} dias ({fim})', { fim: quando(s.term_end) })}</V2Badge>;
  return <V2Badge tone="red">{t('Mandato vencido em {fim}', { fim: quando(s.term_end) })}</V2Badge>;
}

/** Início e fim do mandato, com o alerta de mais de 4 anos. */
function CamposMandato({ prefixo, inicio, fim, onInicio, onFim }) {
  const v = validateTerm({ term_start: inicio, term_end: fim });
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label={t('Início do mandato')} htmlFor={`${prefixo}-ini`} required error={v.errors.term_start}>
          <V2Input id={`${prefixo}-ini`} type="date" value={inicio} onChange={(e) => onInicio(e.target.value)} />
        </V2Field>
        <V2Field label={t('Fim do mandato')} htmlFor={`${prefixo}-fim`} hint={t('Em branco: sem data de fim.')} error={v.errors.term_end}>
          <V2Input id={`${prefixo}-fim`} type="date" value={fim} min={inicio || undefined} onChange={(e) => onFim(e.target.value)} />
        </V2Field>
      </div>
      {v.longTerm && <p className="text-sm text-amber-700">{t('Mandato de mais de {anos} anos. Confira se o estatuto permite.', { anos: STAFF_TERM_MAX_MONTHS / 12 })}</p>}
    </div>
  );
}

/** Escolher um membro do clube (a lista já aberta; a busca só estreita). Quem já tem cargo aparece com o motivo. */
function MembroPicker({ id, membros, excluir, escolhido, onEscolher }) {
  const [busca, setBusca] = useState('');
  const termo = normaliza(busca.trim());
  const achados = useMemo(() => membros.filter((m) => !termo || normaliza(m.user_name).includes(termo)), [membros, termo]);
  if (escolhido) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper px-3 py-2">
        <V2Avatar name={escolhido.user_name} photoUrl={escolhido.photo_url} size="sm" />
        <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{escolhido.user_name}</span>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => onEscolher(null)}>{t('Trocar')}</V2Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <V2Input id={id} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Filtrar por nome')} aria-label={t('Filtrar os membros do clube')} />
      {achados.length === 0 ? <p className="text-sm text-gray-500">{t('Ninguém com esse nome. A pessoa precisa ser membro do clube.')}</p> : (
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-100" aria-label={t('Membros do clube')}>
          {achados.slice(0, 50).map((m) => {
            const motivo = excluir.get(m.user_id);
            return (
              <li key={m.user_id}>
                <button type="button" disabled={Boolean(motivo)} onClick={() => onEscolher(m)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink disabled:cursor-not-allowed disabled:hover:bg-transparent coarse:min-h-11">
                  <V2Avatar name={m.user_name} photoUrl={m.photo_url} size="sm" />
                  <span className={`min-w-0 flex-1 truncate text-sm ${motivo ? 'text-gray-500' : 'text-ink'}`}>{m.user_name}</span>
                  {motivo && <V2Badge tone="neutral">{motivo}</V2Badge>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Nomear({ clubId, ator, lista, roles, membros }) {
  const acao = useClubStaffAction(clubId);
  const [pessoa, setPessoa] = useState(null);
  const possiveis = roles.filter((r) => staffActionAllowed({ actor: ator, role: r }));
  const [roleId, setRoleId] = useState(possiveis.find((r) => !r.is_master)?.id || possiveis[0]?.id || '');
  const role = roles.find((r) => r.id === roleId);
  const [inicio, setInicio] = useState(isoDate());
  const [fim, setFim] = useState(fimPadrao(role, isoDate()));
  const excluir = useMemo(() => new Map([
    ...membros.filter((m) => m.role === 'admin').map((m) => [m.user_id, t('Administra o clube')]),
    ...lista.map((s) => [s.user_id, t('Já na diretoria')]),
  ]), [lista, membros]);
  if (!possiveis.length) return null;
  const valido = pessoa && role && validateTerm({ term_start: inicio, term_end: fim }).ok;
  return (
    <V2Surface className="space-y-4" data-dica="clube-equipe-adicionar">
      <h3 className="font-display text-lg font-bold text-ink">{t('Nomear para um cargo')}</h3>
      <MembroPicker id="eq-busca" membros={membros} excluir={excluir} escolhido={pessoa} onEscolher={setPessoa} />
      <V2Field label={t('Cargo')} htmlFor="eq-cargo" hint={roleDescription(role)}>
        <V2Select id="eq-cargo" value={roleId} onChange={(e) => { const r = roles.find((x) => x.id === e.target.value); setRoleId(e.target.value); setFim(fimPadrao(r, inicio)); }}>
          {possiveis.map((r) => <option key={r.id} value={r.id}>{roleLabel(r)}{r.is_master ? ` · ${t('presidência')}` : ''}</option>)}
        </V2Select>
      </V2Field>
      <CamposMandato prefixo="eq" inicio={inicio} fim={fim} onInicio={(v) => { setInicio(v); setFim(fimPadrao(role, v)); }} onFim={setFim} />
      <div className="flex justify-end">
        <V2Button type="button" disabled={!valido || acao.isPending}
          onClick={() => acao.mutate({ action: 'appoint', userId: pessoa.user_id, userName: pessoa.user_name, roleId, termStart: inicio, termEnd: fim }, ok(t('{nome} foi nomeado(a) {cargo}.', { nome: pessoa.user_name, cargo: roleLabel(role) }), () => setPessoa(null)))}>
          <UserPlus className="h-4 w-4" />{t('Nomear')}
        </V2Button>
      </div>
    </V2Surface>
  );
}

function Pessoa({ clubId, s, ator, roles, uid }) {
  const acao = useClubStaffAction(clubId);
  const [aberto, setAberto] = useState(null); // 'cargo' | 'prorrogar' | 'tirar'
  const [confirmarCargo, setConfirmarCargo] = useState(false);
  const role = roles.find((r) => r.id === (s.role_id || s.role)) || null;
  const euMesmo = s.user_id === uid;
  const podeMexer = staffActionAllowed({ actor: ator, target: s, role });
  const outrosCargos = roles.filter((r) => r.id !== role?.id && staffActionAllowed({ actor: ator, target: s, role: r }));
  const [novoCargo, setNovoCargo] = useState(outrosCargos[0]?.id || '');
  const [fim, setFim] = useState(s.term_end || '');
  const [motivo, setMotivo] = useState('');
  const fechar = () => { setAberto(null); setMotivo(''); };
  const abrir = (qual) => { setMotivo(''); setAberto(aberto === qual ? null : qual); };
  const fimValido = (!fim || !s.term_end || fim > s.term_end) && fim !== (s.term_end || '') && validateTerm({ term_start: s.term_start || isoDate(), term_end: fim }).ok;
  const historico = Array.isArray(s.term_history) ? s.term_history : [];
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <V2Avatar name={s.user_name} photoUrl={s.photo_url} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{s.user_name}{euMesmo ? ` (${t('você')})` : ''}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <V2Badge tone="ink">{cargoNome(s, roles)}</V2Badge>
              {staffIsMaster(s) && <V2Badge tone="acid"><Crown className="h-3 w-3" aria-hidden="true" />{t('Presidência')}</V2Badge>}
              <MandatoChip s={s} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {podeMexer && outrosCargos.length > 0 && <V2Button type="button" size="sm" variant="secondary" aria-expanded={aberto === 'cargo'} onClick={() => abrir('cargo')}><UserCog className="h-4 w-4" />{t('Mudar cargo')}</V2Button>}
            {podeMexer && <V2Button type="button" size="sm" variant="secondary" aria-expanded={aberto === 'prorrogar'} onClick={() => abrir('prorrogar')}><CalendarClock className="h-4 w-4" />{t('Prorrogar')}</V2Button>}
            {(podeMexer || euMesmo) && (
              <V2Button type="button" size="sm" variant="ghost" aria-expanded={aberto === 'tirar'} onClick={() => abrir('tirar')}>
                {euMesmo ? <><LogOut className="h-4 w-4" />{t('Sair da diretoria')}</> : <><Trash2 className="h-4 w-4" />{t('Tirar')}</>}
              </V2Button>
            )}
          </div>
        </div>

        {aberto === 'cargo' && (
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-paper p-3">
            <V2Field label={t('Novo cargo')} htmlFor={`cargo-${s.user_id}`} className="min-w-[12rem] flex-1">
              <V2Select id={`cargo-${s.user_id}`} value={novoCargo} onChange={(e) => setNovoCargo(e.target.value)}>
                {outrosCargos.map((r) => <option key={r.id} value={r.id}>{roleLabel(r)}{r.is_master ? ` · ${t('presidência')}` : ''}</option>)}
              </V2Select>
            </V2Field>
            <V2Button type="button" disabled={!novoCargo || acao.isPending} onClick={() => setConfirmarCargo(true)}>{t('Salvar')}</V2Button>
          </div>
        )}
        <ConfirmDialog
          open={confirmarCargo}
          onOpenChange={setConfirmarCargo}
          loading={acao.isPending}
          title={t('Mudar o cargo de {nome} para {cargo}?', { nome: s.user_name, cargo: roleLabel(roles.find((r) => r.id === novoCargo)) })}
          description={t('Na hora, {nome} passa a ver só o que o cargo novo abre na Central e recebe um aviso. O mandato continua com as mesmas datas.', { nome: s.user_name })}
          confirmLabel={t('Mudar o cargo')}
          cancelLabel={t('Voltar')}
          onConfirm={() => acao.mutate({ action: 'appoint', userId: s.user_id, roleId: novoCargo, termStart: s.term_start || isoDate(), termEnd: s.term_end || '' }, ok(t('Cargo atualizado.'), () => { setConfirmarCargo(false); fechar(); }))}
        />

        {aberto === 'prorrogar' && (
          <div className="space-y-3 rounded-2xl bg-paper p-3">
            <V2Field label={t('Novo fim do mandato')} htmlFor={`fim-${s.user_id}`} hint={t('Em branco: sem data de fim.')}>
              <V2Input id={`fim-${s.user_id}`} type="date" value={fim} min={s.term_end || s.term_start || undefined} onChange={(e) => setFim(e.target.value)} />
            </V2Field>
            <V2Field label={t('Motivo')} htmlFor={`motivo-${s.user_id}`} required hint={t('Ex.: reeleição em assembleia, ata de 12/03.')}>
              <V2Textarea id={`motivo-${s.user_id}`} rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </V2Field>
            <div className="flex justify-end gap-2">
              <V2Button type="button" variant="ghost" onClick={fechar}>{t('Cancelar')}</V2Button>
              <V2Button type="button" disabled={!fimValido || motivo.trim().length < 3 || acao.isPending}
                onClick={() => acao.mutate({ action: 'extend', userId: s.user_id, termEnd: fim, reason: motivo.trim() }, ok(t('Mandato prorrogado.'), fechar))}>{t('Prorrogar')}</V2Button>
            </div>
          </div>
        )}

        {aberto === 'tirar' && (
          <div className="space-y-3 rounded-2xl bg-paper p-3">
            <p className="text-sm text-ink">{euMesmo ? t('Você deixa a diretoria e perde o acesso à Central do clube (continua como membro).') : t('{nome} deixa a diretoria e recebe um aviso. Continua como membro do clube.', { nome: s.user_name })}</p>
            {!euMesmo && (
              <V2Field label={t('Motivo (opcional)')} htmlFor={`tirar-${s.user_id}`}>
                <V2Input id={`tirar-${s.user_id}`} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </V2Field>
            )}
            <div className="flex justify-end gap-2">
              <V2Button type="button" variant="ghost" onClick={fechar}>{t('Cancelar')}</V2Button>
              <V2Button type="button" variant="danger" disabled={acao.isPending}
                onClick={() => acao.mutate({ action: 'remove', userId: s.user_id, reason: motivo.trim() }, ok(euMesmo ? t('Você saiu da diretoria.') : t('{nome} saiu da diretoria.', { nome: s.user_name }), fechar))}>
                {euMesmo ? t('Sair da diretoria') : t('Tirar da diretoria')}
              </V2Button>
            </div>
          </div>
        )}

        {historico.length > 0 && (
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">{tn(historico.length, '{n} prorrogação', '{n} prorrogações')}</summary>
            <ul className="mt-2 space-y-1">
              {[...historico].reverse().map((h) => (
                <li key={h.at_ms}>{t('{quando}: de {de} para {para}. {motivo}', { quando: quando(h.at_ms), de: h.from ? quando(h.from) : t('sem fim'), para: h.to ? quando(h.to) : t('sem fim'), motivo: h.reason })}</li>
              ))}
            </ul>
          </details>
        )}
      </V2Surface>
    </li>
  );
}

function Pessoas({ clubId, lista, ator, roles, uid, membros }) {
  const ordem = roles.map((r) => r.id);
  const ordenada = [...lista].sort((a, b) => Number(staffIsMaster(b)) - Number(staffIsMaster(a)) || ordem.indexOf(a.role_id || a.role) - ordem.indexOf(b.role_id || b.role) || String(a.user_name).localeCompare(String(b.user_name), 'pt-BR'));
  const admins = membros.filter((m) => m.role === 'admin');
  return (
    <section className="space-y-4" aria-label={t('Diretoria do clube')} data-dica="clube-equipe">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Diretoria')}</h2>
        <p className="text-sm text-gray-500">{t('Cada cargo abre só a parte da Central que lhe cabe. Mandato vencido fecha o acesso. Quem sai do clube perde o cargo.')}</p>
      </div>
      {admins.length > 0 && (
        <V2Surface variant="compacto" className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-ink"><Crown className="h-4 w-4" aria-hidden="true" />{t('Administração do clube')}</p>
          <ul className="flex flex-wrap gap-2">
            {admins.map((m) => <li key={m.user_id} className="inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-sm"><V2Avatar name={m.user_name} photoUrl={m.photo_url} size="xs" />{m.user_name}</li>)}
          </ul>
          <p className="text-xs text-gray-500">{t('Quem administra o clube tem todos os poderes, sem precisar de cargo. Para mudar isso, use os papéis em Membros.')}</p>
        </V2Surface>
      )}
      {!ordenada.length ? <V2EmptyState icon={Users} title={t('Ninguém na diretoria ainda')} description={t('Nomeie a secretaria, a tesouraria e quem mais o clube precisa.')} /> : <ul className="space-y-3">{ordenada.map((s) => <Pessoa key={s.user_id} clubId={clubId} s={s} ator={ator} roles={roles} uid={uid} />)}</ul>}
      <Nomear clubId={clubId} ator={ator} lista={lista} roles={roles} membros={membros} />
    </section>
  );
}

const CARGO_VAZIO = { name: '', description: '', perms: [], is_master: false, term_months: 0 };

function EditorDeCargo({ clubId, inicial, onFim }) {
  const acao = useClubStaffAction(clubId);
  const [c, setC] = useState({ ...CARGO_VAZIO, ...inicial, perms: [...(inicial?.perms || [])] });
  const v = validateStaffRole(c);
  const alternar = (p) => setC((x) => ({ ...x, perms: x.perms.includes(p) ? x.perms.filter((y) => y !== p) : [...x.perms, p] }));
  const pre = inicial?.id || 'novo';
  return (
    <form className="space-y-3 rounded-2xl bg-paper p-4" onSubmit={(e) => { e.preventDefault(); acao.mutate({ action: 'role_save', role: v.value }, ok(t('Cargo salvo.'), onFim)); }}>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <V2Field label={t('Nome do cargo')} htmlFor={`${pre}-nome`} required error={c.name && v.errors.name}>
          <V2Input id={`${pre}-nome`} maxLength={60} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder={t('Ex.: Diretor de eventos')} />
        </V2Field>
        <V2Field label={t('Mandato padrão (meses)')} htmlFor={`${pre}-meses`} hint={t('0 = sem data de fim.')} error={v.errors.term_months}>
          <V2Input id={`${pre}-meses`} type="number" min={0} max={120} value={c.term_months} onChange={(e) => setC({ ...c, term_months: e.target.value })} />
        </V2Field>
      </div>
      <V2Field label={t('Atribuições')} htmlFor={`${pre}-desc`} error={v.errors.description}>
        <V2Textarea id={`${pre}-desc`} rows={2} maxLength={300} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
      </V2Field>
      <V2Toggle id={`${pre}-master`} checked={c.is_master} onChange={(x) => setC({ ...c, is_master: x })} label={t('Presidência')} hint={t('Todos os poderes: monta os cargos, nomeia e tira qualquer pessoa da diretoria.')} />
      {!c.is_master && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-ink">{t('O que o cargo abre na Central')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_CLUB_PERMS.filter((p) => p !== 'admin').map((p) => (
              <div key={p} className="rounded-xl border border-gray-100 bg-white p-3">
                <V2Toggle id={`${pre}-perm-${p}`} checked={c.perms.includes(p)} onChange={() => alternar(p)} label={t(CLUB_PERM_LABELS[p])} hint={t(CLUB_PERM_HINTS[p])} />
              </div>
            ))}
          </div>
          {v.errors.perms && <p className="text-xs text-red-700">{v.errors.perms}</p>}
        </fieldset>
      )}
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFim}>{t('Cancelar')}</V2Button>
        <V2Button type="submit" disabled={!v.ok || acao.isPending}><Save className="h-4 w-4" />{t('Salvar cargo')}</V2Button>
      </div>
    </form>
  );
}

function Cargos({ clubId, lista, roles, proprios }) {
  const acao = useClubStaffAction(clubId);
  const [editando, setEditando] = useState(null); // id | 'novo'
  const [apagando, setApagando] = useState(null);
  return (
    <section className="space-y-4" aria-label={t('Cargos do clube')} data-dica="clube-cargos">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-ink">{t('Cargos')}</h2>
          <p className="text-sm text-gray-500">{proprios ? t('Os cargos deste clube e o que cada um abre na Central. Mudar as permissões vale na hora para quem ocupa o cargo.') : t('Estes são os cargos de modelo. Edite, crie ou apague para espelhar o estatuto do clube.')}</p>
        </div>
        {editando !== 'novo' && <V2Button type="button" onClick={() => setEditando('novo')}><Plus className="h-4 w-4" />{t('Novo cargo')}</V2Button>}
      </div>
      {editando === 'novo' && <EditorDeCargo clubId={clubId} onFim={() => setEditando(null)} />}
      <ul className="space-y-3">
        {roles.map((r) => {
          const ocupantes = roleHolders(r.id, lista);
          return (
            <li key={r.id}>
              <V2Surface variant="compacto" className="space-y-3 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{roleLabel(r)}{r.is_master && <V2Badge tone="acid"><Crown className="h-3 w-3" aria-hidden="true" />{t('Presidência')}</V2Badge>}</p>
                    {roleDescription(r) && <p className="text-sm text-gray-500">{roleDescription(r)}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      {r.term_months ? tn(r.term_months, 'Mandato de {n} mês', 'Mandato de {n} meses') : t('Sem data de fim')} · {tn(ocupantes, '{n} pessoa', '{n} pessoas')}
                    </p>
                    {!r.is_master && <p className="mt-2 flex flex-wrap gap-1">{r.perms.map((p) => <V2Badge key={p}>{t(CLUB_PERM_LABELS[p] || p)}</V2Badge>)}</p>}
                  </div>
                  <div className="flex gap-2">
                    <V2Button type="button" size="sm" variant="secondary" aria-label={t('Editar {cargo}', { cargo: roleLabel(r) })} onClick={() => setEditando(editando === r.id ? null : r.id)}><Pencil className="h-4 w-4" /></V2Button>
                    {ocupantes === 0 && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Apagar {cargo}', { cargo: roleLabel(r) })} disabled={acao.isPending} onClick={() => setApagando(r)}><Trash2 className="h-4 w-4" /></V2Button>}
                  </div>
                </div>
                {editando === r.id && <EditorDeCargo clubId={clubId} inicial={{ ...r, name: roleLabel(r), description: roleDescription(r) }} onFim={() => setEditando(null)} />}
              </V2Surface>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={apagando != null}
        onOpenChange={(v) => { if (!v) setApagando(null); }}
        destructive
        loading={acao.isPending}
        title={t('Apagar o cargo {cargo}?', { cargo: roleLabel(apagando) })}
        description={t('Ninguém ocupa este cargo hoje. Ele sai da lista e não dá para desfazer: para tê-lo de volta, é preciso criar de novo, com as permissões.')}
        confirmLabel={t('Apagar o cargo')}
        cancelLabel={t('Voltar')}
        onConfirm={() => acao.mutate({ action: 'role_delete', roleId: apagando.id }, ok(t('Cargo apagado.'), () => setApagando(null)))}
      />
    </section>
  );
}

export default function ClubStaffPanel({ club, staffQ, rolesQ, papel, tab }) {
  const { user } = useAuth();
  const membrosQ = useClubMembers(club.id);
  if (staffQ.isError || rolesQ.isError || membrosQ.isError) {
    return <V2ErrorState title={t('Não carregou a diretoria')} onRetry={() => { staffQ.refetch(); rolesQ.refetch(); membrosQ.refetch(); }} />;
  }
  if (staffQ.isLoading || rolesQ.isLoading || membrosQ.isLoading) return <V2Skeleton lines={5} />;
  const lista = (staffQ.data || []).map((s) => ({ ...s, user_id: s.user_id || s.id }));
  const proprios = Array.isArray(rolesQ.data) && rolesQ.data.length > 0;
  const roles = effectiveRoles(rolesQ.data);
  const ator = actorOf({ isClubAdmin: papel.isAdmin, uid: user?.uid, staffDoc: papel.staffDoc });
  const souMaster = staffIsMaster(ator);
  const membros = membrosQ.data || [];
  if (tab === 'cargos' && souMaster) return <Cargos clubId={club.id} lista={lista} roles={roles} proprios={proprios} />;
  return <Pessoas clubId={club.id} lista={lista} ator={ator} roles={roles} uid={user?.uid} membros={membros} />;
}
