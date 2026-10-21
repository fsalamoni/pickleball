/**
 * Cursos e credenciais da federação (permissão `courses`, módulo `courses`):
 * criar/editar o curso (rascunho → abrir → encerrar → realizado), ver os
 * inscritos e dar o resultado (aprovado emite a credencial, se o curso emite);
 * e a lista de credenciais emitidas, com revogar/devolver. Inscrição, vaga,
 * cobrança e credencial são do SERVIDOR (`courseAction`); o curso em si a
 * equipe grava pelo cliente — a regra confere.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { GraduationCap, Pencil, Plus, ShieldCheck, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { courseAction, deleteCourse, reviewCredential, saveCourse } from '@/modules/federations/services/federationService';
import { useCourseEnrollments, useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { courseState, credentialState, seatsLeft, sortCourses, validateCourseInput } from '@/modules/federations/domain/courses';
import { formatBrlCents, parseBrlCents } from '@/modules/federations/domain/charges';
import { COURSE_KIND, COURSE_KIND_LABELS, FED_PERMISSION, COURSE_STATUS, COURSE_STATUS_LABELS, CREDENTIAL_STATUS, CREDENTIAL_STATUS_LABELS, ENROLLMENT_STATUS, ENROLLMENT_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { quando } from '../federationUi';

const reais = (c) => (Number(c || 0) / 100).toFixed(2).replace('.', ',');
const cents = parseBrlCents;
const CURSO_VAZIO = { name: '', kind: COURSE_KIND.CLINIC, level: '', description: '', starts_at: '', ends_at: '', place: '', online: false, link: '', seats: '', hours: '', preco: '0,00', preco_filiado: '', instructors: '', requires_membership: false, issues_credential: false, credential_months: '', status: COURSE_STATUS.DRAFT };

function CursoForm({ federation, curso, onFechar }) {
  const { user } = useAuth();
  const [f, setF] = useState(curso ? { ...CURSO_VAZIO, ...curso, preco: reais(curso.price_cents), preco_filiado: curso.member_price_cents != null && curso.member_price_cents !== curso.price_cents ? reais(curso.member_price_cents) : '', seats: curso.seats || '', hours: curso.hours || '', credential_months: curso.credential_months || '' } : CURSO_VAZIO);
  const [erros, setErros] = useState({});
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const m = useFederationMutation((input) => saveCourse(federation, input, { uid: user?.uid, courseId: curso?.id || null }));
  const enviar = (e) => {
    e.preventDefault();
    const price_cents = cents(f.preco || '0');
    const input = { ...f, price_cents, member_price_cents: f.preco_filiado === '' ? price_cents : cents(f.preco_filiado) };
    const r = validateCourseInput(input);
    if (!r.ok) { setErros(r.errors); return; }
    m.mutate(input, { onSuccess: () => { toast.success(curso ? t('Curso atualizado.') : t('Curso criado.')); onFechar(); }, onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); } });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="federacao-curso-formulario">
      <div className="grid gap-4 sm:grid-cols-3">
        <V2Field label={t('Nome do curso')} htmlFor="cu-nome" error={erros.name} required className="sm:col-span-2"><V2Input id="cu-nome" maxLength={120} value={f.name} onChange={(e) => set({ name: e.target.value })} /></V2Field>
        <V2Field label={t('Tipo')} htmlFor="cu-tipo"><V2Select id="cu-tipo" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{Object.values(COURSE_KIND).map((v) => <option key={v} value={v}>{t(COURSE_KIND_LABELS[v])}</option>)}</V2Select></V2Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <V2Field label={t('Início')} htmlFor="cu-ini" error={erros.starts_at} required><V2Input id="cu-ini" type="date" value={f.starts_at} onChange={(e) => set({ starts_at: e.target.value })} /></V2Field>
        <V2Field label={t('Fim')} htmlFor="cu-fim" error={erros.ends_at}><V2Input id="cu-fim" type="date" value={f.ends_at} onChange={(e) => set({ ends_at: e.target.value })} /></V2Field>
        <V2Field label={t('Vagas (0 = sem limite)')} htmlFor="cu-vagas" error={erros.seats}><V2Input id="cu-vagas" inputMode="numeric" value={f.seats} onChange={(e) => set({ seats: e.target.value })} /></V2Field>
        <V2Field label={t('Carga horária (h)')} htmlFor="cu-horas"><V2Input id="cu-horas" inputMode="numeric" value={f.hours} onChange={(e) => set({ hours: e.target.value })} /></V2Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <V2Field label={t('Valor (R$)')} htmlFor="cu-preco" error={erros.price_cents} hint={t('0,00 = gratuito.')}><V2Input id="cu-preco" inputMode="decimal" value={f.preco} onChange={(e) => set({ preco: e.target.value })} /></V2Field>
        <V2Field label={t('Valor para filiado (R$)')} htmlFor="cu-preco-fil" error={erros.member_price_cents} hint={t('Em branco = o mesmo valor.')}><V2Input id="cu-preco-fil" inputMode="decimal" value={f.preco_filiado} onChange={(e) => set({ preco_filiado: e.target.value })} /></V2Field>
        <V2Field label={t('Nível / turma')} htmlFor="cu-nivel"><V2Input id="cu-nivel" maxLength={60} value={f.level} onChange={(e) => set({ level: e.target.value })} placeholder={t('Ex.: Árbitro nível 1')} /></V2Field>
      </div>
      <V2Toggle id="cu-online" checked={f.online} onChange={(v) => set({ online: v })} label={t('Curso on-line')} />
      {f.online
        ? <V2Field label={t('Link (https://)')} htmlFor="cu-link" error={erros.link}><V2Input id="cu-link" maxLength={300} value={f.link} onChange={(e) => set({ link: e.target.value })} /></V2Field>
        : <V2Field label={t('Local')} htmlFor="cu-local"><V2Input id="cu-local" maxLength={160} value={f.place} onChange={(e) => set({ place: e.target.value })} /></V2Field>}
      <V2Field label={t('Instrutores')} htmlFor="cu-instr"><V2Input id="cu-instr" maxLength={300} value={f.instructors} onChange={(e) => set({ instructors: e.target.value })} /></V2Field>
      <V2Field label={t('Descrição')} htmlFor="cu-desc"><V2Textarea id="cu-desc" rows={3} maxLength={2000} value={f.description} onChange={(e) => set({ description: e.target.value })} /></V2Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Toggle id="cu-fil" checked={f.requires_membership} onChange={(v) => set({ requires_membership: v })} label={t('Só para filiados em dia')} />
        <V2Toggle id="cu-cred" checked={f.issues_credential} onChange={(v) => set({ issues_credential: v })} label={t('Aprovado recebe credencial')} hint={t('Com código verificável, como a carteirinha.')} />
      </div>
      {f.issues_credential && <V2Field label={t('Validade da credencial (meses; 0 = sem prazo)')} htmlFor="cu-cred-m"><V2Input id="cu-cred-m" inputMode="numeric" value={f.credential_months} onChange={(e) => set({ credential_months: e.target.value })} className="sm:max-w-xs" /></V2Field>}
      <V2Field label={t('Situação')} htmlFor="cu-status" hint={t('Rascunho ninguém vê; "Inscrições abertas" publica na página da federação.')}><V2Select id="cu-status" value={f.status} onChange={(e) => set({ status: e.target.value })} className="sm:max-w-xs">{Object.values(COURSE_STATUS).map((v) => <option key={v} value={v}>{t(COURSE_STATUS_LABELS[v])}</option>)}</V2Select></V2Field>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button>
        <V2Button type="submit" disabled={m.isPending} data-dica="federacao-curso-salvar">{curso ? t('Salvar curso') : t('Criar curso')}</V2Button>
      </div>
    </form>
  );
}

const TOM_INSC = { awaiting_payment: 'amber', confirmed: 'ink', passed: 'green', failed: 'red', cancelled: 'neutral' };

function InscritosDialog({ curso, federation, onClose }) {
  const q = useCourseEnrollments(curso.id, federation.id);
  const [nota, setNota] = useState('');
  const m = useFederationMutation(({ action, userId }) => courseAction({ action, courseId: curso.id, userId, note: nota }));
  const agir = (action, userId) => m.mutate({ action, userId }, { onSuccess: () => toast.success(action === 'pass' ? t('Aprovação registrada.') : t('Resultado registrado.')), onError: (e) => toast.error(e.message) });
  const lista = [...(q.data || [])].sort((a, b) => String(a.user_name).localeCompare(String(b.user_name)));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-2xl">
        <DialogTitle>{t('Inscritos — {curso}', { curso: curso.name })}</DialogTitle>
        <DialogDescription>{t('Dê o resultado a quem está inscrito e pago. Aprovado em curso que emite credencial recebe a credencial na hora.')}</DialogDescription>
        {q.isError && <V2ErrorState inline title={t('Não carregaram os inscritos')} onRetry={() => q.refetch()} />}
        {q.isLoading && <V2Skeleton lines={4} />}
        {q.isSuccess && !lista.length && <V2EmptyState icon={Users} title={t('Ninguém inscrito ainda')} />}
        {q.isSuccess && lista.length > 0 && (
          <>
            <V2Input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} placeholder={t('Observação do resultado (opcional)')} aria-label={t('Observação do resultado')} />
            <ul className="max-h-[50dvh] space-y-2 overflow-y-auto">
              {lista.map((en) => (
                <li key={en.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 p-3">
                  <V2Avatar name={en.user_name} photoUrl={en.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">{en.user_name}<V2Badge tone={TOM_INSC[en.status] || 'neutral'}>{t(ENROLLMENT_STATUS_LABELS[en.status] || en.status)}</V2Badge>{en.is_member && <V2Badge tone="green">{t('filiado')}</V2Badge>}</p>
                    <p className="text-xs text-gray-500">{en.amount_cents > 0 ? formatBrlCents(en.amount_cents) : t('Grátis')} · {t('inscrito em {data}', { data: quando(en.created_at_ms) })}{en.grade_note ? ` · ${en.grade_note}` : ''}</p>
                  </div>
                  {en.status === ENROLLMENT_STATUS.CONFIRMED && (
                    <div className="flex gap-2">
                      <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir('pass', en.user_id)}>{t('Aprovar')}</V2Button>
                      <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => agir('fail', en.user_id)}>{t('Não aprovar')}</V2Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CursosTab({ federation, coursesQ, podeApagar }) {
  const { user } = useAuth();
  const [editando, setEditando] = useState(null); // null | 'novo' | course
  const [inscritosDe, setInscritosDe] = useState(null);
  const apagar = useFederationMutation((c) => deleteCourse(c, { uid: user?.uid }));
  if (coursesQ.isError) return <V2ErrorState title={t('Não carregaram os cursos')} onRetry={() => coursesQ.refetch()} />;
  if (coursesQ.isLoading) return <V2Skeleton lines={5} />;
  const cursos = sortCourses(coursesQ.data || []);
  return (
    <section className="space-y-4" aria-label={t('Cursos')} data-dica="federacao-cursos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-display text-xl font-bold text-ink">{t('Cursos e clínicas')}</h2><p className="text-sm text-gray-500">{t('Arbitragem, formação de treinador, clínicas. Com inscrições abertas, o curso aparece na página da federação.')}</p></div>
        {editando == null && <V2Button type="button" size="sm" onClick={() => setEditando('novo')} data-dica="federacao-curso-novo"><Plus className="h-4 w-4" />{t('Novo curso')}</V2Button>}
      </div>
      {editando != null && <V2Surface><CursoForm federation={federation} curso={editando === 'novo' ? null : editando} onFechar={() => setEditando(null)} /></V2Surface>}
      {!cursos.length && editando == null ? <V2EmptyState icon={GraduationCap} title={t('Nenhum curso ainda')} action={<V2Button type="button" onClick={() => setEditando('novo')}>{t('Criar o primeiro curso')}</V2Button>} /> : (
        <ul className="space-y-3">
          {cursos.map((c) => {
            const st = courseState(c);
            const vagas = seatsLeft(c);
            return (
              <li key={c.id}>
                <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{c.name}<V2Badge tone={st.open ? 'green' : c.status === COURSE_STATUS.DRAFT ? 'neutral' : 'amber'}>{st.label}</V2Badge>{c.issues_credential && <V2Badge tone="ink">{t('emite credencial')}</V2Badge>}</p>
                    <p className="text-xs text-gray-500">{t(COURSE_KIND_LABELS[c.kind] || COURSE_KIND_LABELS.clinic)}{c.level ? ` · ${c.level}` : ''} · {quando(c.starts_at)}{c.ends_at && c.ends_at !== c.starts_at ? ` – ${quando(c.ends_at)}` : ''} · {c.price_cents > 0 ? formatBrlCents(c.price_cents) : t('Grátis')} · {tn(c.enrolled_count || 0, '{n} inscrito', '{n} inscritos')}{vagas != null ? ` · ${tn(vagas, '{n} vaga', '{n} vagas')}` : ''}</p>
                  </div>
                  <V2Button type="button" size="sm" variant="secondary" onClick={() => setInscritosDe(c)}><Users className="h-4 w-4" />{t('Inscritos')}</V2Button>
                  <V2Button type="button" size="sm" variant="ghost" aria-label={t('Editar {nome}', { nome: c.name })} onClick={() => setEditando(c)}><Pencil className="h-4 w-4" /></V2Button>
                  {podeApagar && !(Number(c.enrolled_count) > 0) && <V2Button type="button" size="sm" variant="ghost" disabled={apagar.isPending} onClick={() => apagar.mutate(c, { onSuccess: () => toast.success(t('Curso apagado.')), onError: (e) => toast.error(e.message) })}>{t('Apagar')}</V2Button>}
                </V2Surface>
              </li>
            );
          })}
        </ul>
      )}
      {inscritosDe && <InscritosDialog curso={inscritosDe} federation={federation} onClose={() => setInscritosDe(null)} />}
    </section>
  );
}

function CredencialRow({ cred }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [revogando, setRevogando] = useState(false);
  const m = useFederationMutation((action) => reviewCredential(cred, action, { uid: user?.uid, reason: motivo }));
  const st = credentialState(cred);
  const tom = { active: 'green', expired: 'amber', revoked: 'red' }[st.status] || 'neutral';
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <V2Avatar name={cred.user_name} photoUrl={cred.photo_url} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{cred.user_name}<V2Badge tone={tom}>{t(CREDENTIAL_STATUS_LABELS[st.status] || st.status)}</V2Badge>{cred.public && <V2Badge tone="ink">{t('no diretório')}</V2Badge>}</p>
            <p className="text-xs text-gray-500">{t(COURSE_KIND_LABELS[cred.kind] || COURSE_KIND_LABELS.clinic)}{cred.level ? ` · ${cred.level}` : ''} · {cred.course_name} · {t('emitida em {data}', { data: quando(cred.issued_at) })}{cred.valid_until ? ` · ${t('até {data}', { data: quando(cred.valid_until) })}` : ''} · {cred.code}</p>
            {cred.review?.reason && st.status === CREDENTIAL_STATUS.REVOKED && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: cred.review.reason })}</p>}
          </div>
        </div>
        {st.status === CREDENTIAL_STATUS.REVOKED
          ? <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate('restore', { onSuccess: () => toast.success(t('Credencial devolvida.')), onError: (e) => toast.error(e.message) })}>{t('Devolver')}</V2Button>
          : !revogando ? <V2Button type="button" size="sm" variant="danger" onClick={() => setRevogando(true)}>{t('Revogar')}</V2Button> : (
            <div className="flex flex-wrap items-center gap-2">
              <V2Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder={t('Motivo (a pessoa lê)')} aria-label={t('Motivo da revogação')} className="sm:max-w-xs" autoFocus />
              <V2Button type="button" size="sm" variant="danger" disabled={m.isPending || motivo.trim().length < 3} onClick={() => m.mutate('revoke', { onSuccess: () => { toast.success(t('Credencial revogada.')); setRevogando(false); }, onError: (e) => toast.error(e.message) })}>{t('Confirmar')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" onClick={() => setRevogando(false)}>{t('Voltar')}</V2Button>
            </div>
          )}
      </V2Surface>
    </li>
  );
}

function CredenciaisTab({ credentialsQ }) {
  const [filtro, setFiltro] = useState('todas');
  if (credentialsQ.isError) return <V2ErrorState title={t('Não carregaram as credenciais')} onRetry={() => credentialsQ.refetch()} />;
  if (credentialsQ.isLoading) return <V2Skeleton lines={5} />;
  const todas = [...(credentialsQ.data || [])].sort((a, b) => String(b.issued_at).localeCompare(String(a.issued_at)));
  const lista = filtro === 'todas' ? todas : todas.filter((c) => credentialState(c).status === filtro);
  return (
    <section className="space-y-4" aria-label={t('Credenciais')} data-dica="federacao-credenciais">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Credenciais emitidas')}</h2><p className="text-sm text-gray-500">{t('Quem foi aprovado em curso que emite credencial. Cada uma tem código verificável em /f/verificar; a pessoa escolhe se aparece no diretório público.')}</p></div>
      <div className="flex flex-wrap gap-2">{[['todas', t('Todas')], [CREDENTIAL_STATUS.ACTIVE, t('Válidas')], [CREDENTIAL_STATUS.EXPIRED, t('Vencidas')], [CREDENTIAL_STATUS.REVOKED, t('Revogadas')]].map(([id, label]) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{label}</V2FilterChip>)}</div>
      {!lista.length ? <V2EmptyState icon={ShieldCheck} title={t('Nenhuma credencial neste filtro')} /> : <ul className="space-y-3">{lista.map((c) => <CredencialRow key={c.id} cred={c} />)}</ul>}
    </section>
  );
}

export default function FedCoursesPanel({ federation, coursesQ, credentialsQ, tab, perms = [] }) {
  const podeApagar = perms.includes(FED_PERMISSION.ADMIN); // a regra só deixa o admin apagar — botão que a regra recusa é "permissão negada" sem saída
  if (tab === 'credenciais') return <CredenciaisTab credentialsQ={credentialsQ} />;
  return <CursosTab federation={federation} coursesQ={coursesQ} podeApagar={podeApagar} />;
}
