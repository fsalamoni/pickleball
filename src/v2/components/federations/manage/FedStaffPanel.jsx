/**
 * Equipe da federação (permissão `staff`): quem ocupa cada CARGO, o mandato
 * de cada um e os admins master. Duas abas:
 *  - `equipe`: as pessoas — nomear (pela lista de usuários), mudar de cargo,
 *    prorrogar o mandato (com motivo e ato), tirar, sair e passar a
 *    administração;
 *  - `cargos` (só admin master): os cargos da federação e o que cada um abre.
 * Toda escrita é do servidor (`staffAction` → `federationStaff`), que confere
 * de novo quem pode e que sempre sobra um admin master. As contas daqui
 * (`staffActionAllowed`, `isLastMaster`) só dizem antes, na tela.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Crown, LogOut, Pencil, Plus, Save, Trash2, UserCog, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { staffAction } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import {
  ALL_PERMISSIONS, effectiveRoles, isLastMaster, roleDescription, roleHolders, roleLabel, staffActionAllowed, staffIsMaster, staffRoleName, termStatus, validateStaffRole, validateTerm,
} from '@/modules/federations/domain/staff';
import { addMonthsISO, isoDate } from '@/modules/federations/domain/membership';
import { FED_PERMISSION_META, STAFF_TERM_MAX_MONTHS } from '@/modules/federations/domain/constants';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2SearchInput, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { quando } from '@/v2/components/federations/federationUi';
import { t, tn } from '@/core/i18n';

const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nomeDe = (a) => a.platform_name || a.full_name || a.display_name || '';
const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const fimPadrao = (role, inicio) => (role?.term_months ? addMonthsISO(inicio, role.term_months) : '');

/** A situação do mandato, em palavras. */
function MandatoChip({ s }) {
  const st = termStatus(s);
  if (st.kind === 'open') return <V2Badge>{s.term_start ? t('Desde {inicio}, sem data de fim', { inicio: quando(s.term_start) }) : t('Sem data de fim')}</V2Badge>;
  if (st.kind === 'active') return <V2Badge>{t('Mandato até {fim}', { fim: quando(s.term_end) })}</V2Badge>;
  if (st.kind === 'ending') return <V2Badge tone="amber">{tn(st.days, 'Termina em {n} dia ({fim})', 'Termina em {n} dias ({fim})', { fim: quando(s.term_end) })}</V2Badge>;
  if (st.kind === 'held') return <V2Badge tone="amber">{t('Mandato vencido em {fim}: segue como admin master até haver outro', { fim: quando(s.term_end) })}</V2Badge>;
  return <V2Badge tone="red">{t('Mandato vencido em {fim}', { fim: quando(s.term_end) })}</V2Badge>;
}

/** Busca na lista de usuários da plataforma (o diretório de atletas). */
function BuscaPessoa({ excluir, escolhido, onEscolher, id }) {
  const atletas = useAthletes();
  const [busca, setBusca] = useState('');
  const termo = normaliza(busca.trim());
  const sugestoes = useMemo(() => (termo.length < 2 || !atletas.isSuccess ? [] : (atletas.data || []).filter((a) => !excluir.has(a.id) && normaliza(nomeDe(a)).includes(termo)).slice(0, 8)), [termo, atletas.isSuccess, atletas.data, excluir]);
  if (atletas.isError) return <V2ErrorState inline title={t('Não carregou a lista de usuários')} onRetry={() => atletas.refetch()} />;
  return (
    <div className="space-y-2">
      <V2SearchInput id={id} value={escolhido ? nomeDe(escolhido) : busca} onChange={(e) => { setBusca(e.target.value); onEscolher(null); }} placeholder={t('Nome da pessoa (com conta no PickleRush)')} aria-label={t('Buscar pessoa')} />
      {!escolhido && sugestoes.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
          {sugestoes.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => { onEscolher(a); setBusca(''); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                <V2Avatar name={nomeDe(a)} photoUrl={a.photo_url} size="sm" />
                <span className="text-sm text-ink">{nomeDe(a)}</span>
                {a.city && <span className="text-xs text-gray-500">· {a.city}{a.state ? `/${a.state}` : ''}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!escolhido && termo.length >= 2 && atletas.isSuccess && sugestoes.length === 0 && <p className="text-sm text-gray-500">{t('Ninguém com esse nome. A pessoa precisa ter conta e perfil visível.')}</p>}
    </div>
  );
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

function Nomear({ federation, ator, lista, roles }) {
  const [pessoa, setPessoa] = useState(null);
  const possiveis = roles.filter((r) => staffActionAllowed({ actor: ator, role: r, staff: lista }));
  const [roleId, setRoleId] = useState(possiveis.find((r) => !r.is_master)?.id || possiveis[0]?.id || '');
  const role = roles.find((r) => r.id === roleId);
  const [inicio, setInicio] = useState(isoDate());
  const [fim, setFim] = useState(fimPadrao(role, isoDate()));
  const excluir = useMemo(() => new Set(lista.map((s) => s.user_id)), [lista]);
  const m = useFederationMutation(() => staffAction(federation.id, 'appoint', { userId: pessoa.id, userName: nomeDe(pessoa), roleId, termStart: inicio, termEnd: fim }));
  if (!possiveis.length) return null;
  const valido = pessoa && role && validateTerm({ term_start: inicio, term_end: fim }).ok;
  return (
    <V2Surface className="space-y-4" data-dica="federacao-equipe-adicionar">
      <h3 className="font-display text-lg font-bold text-ink">{t('Nomear para um cargo')}</h3>
      <BuscaPessoa id="eq-busca" excluir={excluir} escolhido={pessoa} onEscolher={setPessoa} />
      <V2Field label={t('Cargo')} htmlFor="eq-cargo" hint={roleDescription(role)}>
        <V2Select id="eq-cargo" value={roleId} onChange={(e) => { const r = roles.find((x) => x.id === e.target.value); setRoleId(e.target.value); setFim(fimPadrao(r, inicio)); }}>
          {possiveis.map((r) => <option key={r.id} value={r.id}>{roleLabel(r)}{r.is_master ? ` · ${t('admin master')}` : ''}</option>)}
        </V2Select>
      </V2Field>
      <CamposMandato prefixo="eq" inicio={inicio} fim={fim} onInicio={(v) => { setInicio(v); setFim(fimPadrao(role, v)); }} onFim={setFim} />
      <div className="flex justify-end">
        <V2Button type="button" disabled={!valido || m.isPending} onClick={() => m.mutate(undefined, ok(t('{nome} foi nomeado(a) {cargo}.', { nome: nomeDe(pessoa), cargo: roleLabel(role) }), () => setPessoa(null)))}>
          <UserPlus className="h-4 w-4" />{t('Nomear')}
        </V2Button>
      </div>
    </V2Surface>
  );
}

function Pessoa({ federation, s, ator, lista, roles, uid }) {
  const [aberto, setAberto] = useState(null); // 'cargo' | 'prorrogar' | 'tirar'
  const role = roles.find((r) => r.id === (s.role_id || s.role)) || null;
  const euMesmo = s.user_id === uid;
  const podeMexer = staffActionAllowed({ actor: ator, target: s, role, staff: lista });
  const ultimo = isLastMaster(s, lista);
  const outrosCargos = roles.filter((r) => r.id !== role?.id && staffActionAllowed({ actor: ator, target: s, role: r, staff: lista }) && !(ultimo && !r.is_master));
  const [novoCargo, setNovoCargo] = useState(outrosCargos[0]?.id || '');
  const [fim, setFim] = useState(s.term_end || '');
  const [motivo, setMotivo] = useState('');
  const [ato, setAto] = useState('');
  const mudar = useFederationMutation(() => staffAction(federation.id, 'appoint', { userId: s.user_id, roleId: novoCargo, termStart: s.term_start || isoDate(), termEnd: s.term_end || '' }));
  const prorrogar = useFederationMutation(() => staffAction(federation.id, 'extend', { userId: s.user_id, termEnd: fim, reason: motivo.trim(), act: ato.trim() }));
  const tirar = useFederationMutation(() => staffAction(federation.id, 'remove', { userId: s.user_id, reason: motivo.trim() }));
  const fechar = () => { setAberto(null); setMotivo(''); setAto(''); };
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
              <V2Badge tone="ink">{staffRoleName(s)}</V2Badge>
              {staffIsMaster(s) && <V2Badge tone="acid"><Crown className="h-3 w-3" aria-hidden="true" />{t('Admin master')}</V2Badge>}
              <MandatoChip s={s} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {podeMexer && outrosCargos.length > 0 && <V2Button type="button" size="sm" variant="secondary" aria-expanded={aberto === 'cargo'} onClick={() => setAberto(aberto === 'cargo' ? null : 'cargo')}><UserCog className="h-4 w-4" />{t('Mudar cargo')}</V2Button>}
            {podeMexer && <V2Button type="button" size="sm" variant="secondary" aria-expanded={aberto === 'prorrogar'} onClick={() => setAberto(aberto === 'prorrogar' ? null : 'prorrogar')}><CalendarClock className="h-4 w-4" />{t('Prorrogar')}</V2Button>}
            {(podeMexer || euMesmo) && !ultimo && (
              <V2Button type="button" size="sm" variant="ghost" aria-expanded={aberto === 'tirar'} onClick={() => setAberto(aberto === 'tirar' ? null : 'tirar')}>
                {euMesmo ? <><LogOut className="h-4 w-4" />{t('Sair da equipe')}</> : <><Trash2 className="h-4 w-4" />{t('Tirar')}</>}
              </V2Button>
            )}
          </div>
        </div>
        {ultimo && (podeMexer || euMesmo) && <p className="text-xs text-gray-500">{t('Único admin master: para sair ou mudar de cargo, nomeie outro admin master antes.')}</p>}

        {aberto === 'cargo' && (
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-paper p-3">
            <V2Field label={t('Novo cargo')} htmlFor={`cargo-${s.id}`} className="min-w-[12rem] flex-1">
              <V2Select id={`cargo-${s.id}`} value={novoCargo} onChange={(e) => setNovoCargo(e.target.value)}>
                {outrosCargos.map((r) => <option key={r.id} value={r.id}>{roleLabel(r)}{r.is_master ? ` · ${t('admin master')}` : ''}</option>)}
              </V2Select>
            </V2Field>
            <V2Button type="button" disabled={!novoCargo || mudar.isPending} onClick={() => mudar.mutate(undefined, ok(t('Cargo atualizado.'), fechar))}>{t('Salvar')}</V2Button>
          </div>
        )}

        {aberto === 'prorrogar' && (
          <div className="space-y-3 rounded-2xl bg-paper p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <V2Field label={t('Novo fim do mandato')} htmlFor={`fim-${s.id}`} hint={t('Em branco: sem data de fim.')}>
                <V2Input id={`fim-${s.id}`} type="date" value={fim} min={s.term_end || s.term_start || undefined} onChange={(e) => setFim(e.target.value)} />
              </V2Field>
              <V2Field label={t('Ato (opcional)')} htmlFor={`ato-${s.id}`} hint={t('Ex.: Ata da AGE de 12/03, Portaria 4/2026.')}>
                <V2Input id={`ato-${s.id}`} maxLength={120} value={ato} onChange={(e) => setAto(e.target.value)} />
              </V2Field>
            </div>
            <V2Field label={t('Motivo')} htmlFor={`motivo-${s.id}`} required>
              <V2Textarea id={`motivo-${s.id}`} rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </V2Field>
            <div className="flex justify-end gap-2">
              <V2Button type="button" variant="ghost" onClick={fechar}>{t('Cancelar')}</V2Button>
              <V2Button type="button" disabled={!fimValido || motivo.trim().length < 3 || prorrogar.isPending} onClick={() => prorrogar.mutate(undefined, ok(t('Mandato prorrogado.'), fechar))}>{t('Prorrogar')}</V2Button>
            </div>
          </div>
        )}

        {aberto === 'tirar' && (
          <div className="space-y-3 rounded-2xl bg-paper p-3">
            <p className="text-sm text-ink">{euMesmo ? t('Você deixa a equipe e perde o acesso à Central da federação.') : t('{nome} deixa a equipe e recebe um aviso.', { nome: s.user_name })}</p>
            {!euMesmo && (
              <V2Field label={t('Motivo (opcional)')} htmlFor={`tirar-${s.id}`}>
                <V2Input id={`tirar-${s.id}`} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </V2Field>
            )}
            <div className="flex justify-end gap-2">
              <V2Button type="button" variant="ghost" onClick={fechar}>{t('Cancelar')}</V2Button>
              <V2Button type="button" variant="danger" disabled={tirar.isPending} onClick={() => tirar.mutate(undefined, ok(euMesmo ? t('Você saiu da equipe.') : t('{nome} saiu da equipe.', { nome: s.user_name }), fechar))}>{euMesmo ? t('Sair da equipe') : t('Tirar da equipe')}</V2Button>
            </div>
          </div>
        )}

        {historico.length > 0 && (
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">{tn(historico.length, '{n} prorrogação', '{n} prorrogações')}</summary>
            <ul className="mt-2 space-y-1">
              {[...historico].reverse().map((h) => (
                <li key={h.at_ms}>{t('{quando}: de {de} para {para}. {motivo}', { quando: quando(h.at_ms), de: h.from ? quando(h.from) : t('sem fim'), para: h.to ? quando(h.to) : t('sem fim'), motivo: h.reason })}{h.act ? ` (${h.act})` : ''}</li>
              ))}
            </ul>
          </details>
        )}
      </V2Surface>
    </li>
  );
}

/** Passar a administração para outra pessoa (só admin master da própria federação). */
function PassarAdministracao({ federation, lista, roles, uid }) {
  const [aberto, setAberto] = useState(false);
  const [pessoa, setPessoa] = useState(null);
  const masters = roles.filter((r) => r.is_master);
  const [roleId, setRoleId] = useState(masters[0]?.id || '');
  const [sair, setSair] = useState(false);
  const excluir = useMemo(() => new Set([uid]), [uid]);
  const m = useFederationMutation(() => staffAction(federation.id, 'transfer', { userId: pessoa.id, roleId, leave: sair }));
  const naEquipe = lista.filter((s) => s.user_id !== uid && !staffIsMaster(s));
  return (
    <V2Surface className="space-y-3" data-dica="federacao-equipe-passar">
      <div className="flex flex-wrap items-center gap-3">
        <Crown className="h-5 w-5 text-ink" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold text-ink">{t('Passar a administração')}</h3>
          <p className="text-sm text-gray-500">{t('A pessoa vira admin master, com todos os poderes. Pode haver mais de um admin master; quem recebe pode depois tirar quem passou.')}</p>
        </div>
        <V2Button type="button" variant="secondary" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? t('Fechar') : t('Passar')}</V2Button>
      </div>
      {aberto && (
        <div className="space-y-3">
          {naEquipe.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label={t('Da equipe')}>
              {naEquipe.map((s) => <V2Button key={s.id} type="button" size="sm" variant={pessoa?.id === s.user_id ? 'primary' : 'secondary'} onClick={() => setPessoa({ id: s.user_id, platform_name: s.user_name, photo_url: s.photo_url })}>{s.user_name}</V2Button>)}
            </div>
          )}
          <BuscaPessoa id="passar-busca" excluir={excluir} escolhido={pessoa} onEscolher={setPessoa} />
          {masters.length > 1 && (
            <V2Field label={t('Cargo de admin master')} htmlFor="passar-cargo">
              <V2Select id="passar-cargo" value={roleId} onChange={(e) => setRoleId(e.target.value)}>{masters.map((r) => <option key={r.id} value={r.id}>{roleLabel(r)}</option>)}</V2Select>
            </V2Field>
          )}
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={sair} onChange={(e) => setSair(e.target.checked)} />
            <span>{t('E sair da administração (você deixa a equipe na mesma hora)')}</span>
          </label>
          <div className="flex justify-end">
            <V2Button type="button" disabled={!pessoa || !roleId || m.isPending} onClick={() => m.mutate(undefined, ok(t('{nome} agora é admin master.', { nome: nomeDe(pessoa) }), () => { setAberto(false); setPessoa(null); }))}>
              <Crown className="h-4 w-4" />{sair ? t('Passar e sair') : t('Passar a administração')}
            </V2Button>
          </div>
        </div>
      )}
    </V2Surface>
  );
}

function Pessoas({ federation, lista, ator, roles, uid, souMaster, plataforma }) {
  const ordem = roles.map((r) => r.id);
  const ordenada = [...lista].sort((a, b) => Number(staffIsMaster(b)) - Number(staffIsMaster(a)) || ordem.indexOf(a.role_id || a.role) - ordem.indexOf(b.role_id || b.role) || String(a.user_name).localeCompare(String(b.user_name), 'pt-BR'));
  return (
    <section className="space-y-4" aria-label={t('Equipe da federação')} data-dica="federacao-equipe">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Equipe')}</h2>
        <p className="text-sm text-gray-500">{t('Cada cargo abre só a parte da Central que lhe cabe. Mandato vencido fecha o acesso; o admin master segue até haver outro, para a federação nunca ficar sem administração.')}</p>
      </div>
      {!ordenada.length ? <V2EmptyState icon={Users} title={t('Ninguém na equipe')} /> : <ul className="space-y-3">{ordenada.map((s) => <Pessoa key={s.id} federation={federation} s={s} ator={ator} lista={lista} roles={roles} uid={uid} />)}</ul>}
      <Nomear federation={federation} ator={ator} lista={lista} roles={roles} />
      {souMaster && !plataforma && <PassarAdministracao federation={federation} lista={lista} roles={roles} uid={uid} />}
    </section>
  );
}

const CARGO_VAZIO = { name: '', description: '', perms: [], is_master: false, term_months: 0 };

function EditorDeCargo({ federation, inicial, onFim }) {
  const [c, setC] = useState({ ...CARGO_VAZIO, ...inicial, perms: [...(inicial?.perms || [])] });
  const v = validateStaffRole(c);
  const m = useFederationMutation(() => staffAction(federation.id, 'role_save', { role: v.value }));
  const alternar = (p) => setC((x) => ({ ...x, perms: x.perms.includes(p) ? x.perms.filter((y) => y !== p) : [...x.perms, p] }));
  const pre = inicial?.id || 'novo';
  return (
    <form className="space-y-3 rounded-2xl bg-paper p-4" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, ok(t('Cargo salvo.'), onFim)); }}>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <V2Field label={t('Nome do cargo')} htmlFor={`${pre}-nome`} required error={c.name && v.errors.name}>
          <V2Input id={`${pre}-nome`} maxLength={60} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder={t('Ex.: Diretor técnico, Conselheiro fiscal')} />
        </V2Field>
        <V2Field label={t('Mandato padrão (meses)')} htmlFor={`${pre}-meses`} hint={t('0 = sem data de fim.')} error={v.errors.term_months}>
          <V2Input id={`${pre}-meses`} type="number" min={0} max={120} value={c.term_months} onChange={(e) => setC({ ...c, term_months: e.target.value })} />
        </V2Field>
      </div>
      <V2Field label={t('Atribuições')} htmlFor={`${pre}-desc`} error={v.errors.description}>
        <V2Textarea id={`${pre}-desc`} rows={2} maxLength={300} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
      </V2Field>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={c.is_master} onChange={(e) => setC({ ...c, is_master: e.target.checked })} />
        <span><strong>{t('Admin master')}</strong> — {t('todos os poderes: monta os cargos, nomeia e tira qualquer pessoa, passa a administração.')}</span>
      </label>
      {!c.is_master && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-ink">{t('O que o cargo abre na Central')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-start gap-2 rounded-xl border border-gray-100 bg-white p-2 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={c.perms.includes(p)} onChange={() => alternar(p)} />
                <span><span className="font-semibold text-ink">{t(FED_PERMISSION_META[p].label)}</span><span className="block text-xs text-gray-500">{t(FED_PERMISSION_META[p].description)}</span></span>
              </label>
            ))}
          </div>
          {v.errors.perms && <p className="text-xs text-red-700">{v.errors.perms}</p>}
        </fieldset>
      )}
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFim}>{t('Cancelar')}</V2Button>
        <V2Button type="submit" disabled={!v.ok || m.isPending}><Save className="h-4 w-4" />{t('Salvar cargo')}</V2Button>
      </div>
    </form>
  );
}

function Cargos({ federation, lista, roles }) {
  const [editando, setEditando] = useState(null); // id | 'novo'
  const apagar = useFederationMutation((id) => staffAction(federation.id, 'role_delete', { roleId: id }));
  const proprios = Array.isArray(federation.staff_roles) && federation.staff_roles.length > 0;
  return (
    <section className="space-y-4" aria-label={t('Cargos da federação')} data-dica="federacao-cargos">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-ink">{t('Cargos')}</h2>
          <p className="text-sm text-gray-500">{proprios ? t('Os cargos desta federação e o que cada um abre na Central. Mudar as permissões vale na hora para quem ocupa o cargo.') : t('Estes são os cargos de modelo. Edite, crie ou apague para espelhar o estatuto da federação.')}</p>
        </div>
        {editando !== 'novo' && <V2Button type="button" onClick={() => setEditando('novo')}><Plus className="h-4 w-4" />{t('Novo cargo')}</V2Button>}
      </div>
      {editando === 'novo' && <EditorDeCargo federation={federation} onFim={() => setEditando(null)} />}
      <ul className="space-y-3">
        {roles.map((r) => {
          const ocupantes = roleHolders(r.id, lista);
          return (
            <li key={r.id}>
              <V2Surface variant="compacto" className="space-y-3 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{roleLabel(r)}{r.is_master && <V2Badge tone="acid"><Crown className="h-3 w-3" aria-hidden="true" />{t('Admin master')}</V2Badge>}</p>
                    {roleDescription(r) && <p className="text-sm text-gray-500">{roleDescription(r)}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      {r.term_months ? tn(r.term_months, 'Mandato de {n} mês', 'Mandato de {n} meses') : t('Sem data de fim')} · {tn(ocupantes, '{n} pessoa', '{n} pessoas')}
                    </p>
                    {!r.is_master && <p className="mt-2 flex flex-wrap gap-1">{r.perms.map((p) => <V2Badge key={p}>{t(FED_PERMISSION_META[p]?.label || p)}</V2Badge>)}</p>}
                  </div>
                  <div className="flex gap-2">
                    <V2Button type="button" size="sm" variant="secondary" aria-label={t('Editar {cargo}', { cargo: roleLabel(r) })} onClick={() => setEditando(editando === r.id ? null : r.id)}><Pencil className="h-4 w-4" /></V2Button>
                    {ocupantes === 0 && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Apagar {cargo}', { cargo: roleLabel(r) })} disabled={apagar.isPending} onClick={() => apagar.mutate(r.id, ok(t('Cargo apagado.')))}><Trash2 className="h-4 w-4" /></V2Button>}
                  </div>
                </div>
                {editando === r.id && <EditorDeCargo federation={federation} inicial={{ ...r, name: roleLabel(r), description: roleDescription(r) }} onFim={() => setEditando(null)} />}
              </V2Surface>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function FedStaffPanel({ federation, staffQ, papel, tab }) {
  const { user } = useAuth();
  if (staffQ.isError) return <V2ErrorState title={t('Não carregou a equipe')} onRetry={() => staffQ.refetch()} />;
  if (staffQ.isLoading) return <V2Skeleton lines={5} />;
  const lista = staffQ.data || [];
  const roles = effectiveRoles(federation);
  // O admin da plataforma com o acesso valendo age como admin master (o servidor confere o acesso).
  const ator = papel.grant ? { user_id: user?.uid, is_master: true } : papel.staff;
  if (tab === 'cargos' && papel.isMaster) return <Cargos federation={federation} lista={lista} roles={roles} />;
  return <Pessoas federation={federation} lista={lista} ator={ator} roles={roles} uid={user?.uid} souMaster={papel.isMaster} plataforma={Boolean(papel.grant)} />;
}
