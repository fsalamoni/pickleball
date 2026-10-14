import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  PlatformFormSection,
  PlatformMetricCard,
  PlatformSurfaceCard,
} from '@/components/ui/platform-page';
import { toast } from 'sonner';
import { AthletePicker } from '@/v2/components/arenas/marketing/coupons/VoucherReception';
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  FileStack,
  Lock,
  LockOpen,
  Play,
  Save,
  Settings2,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  Archive,
  ArchiveRestore,
  Ban,
  Wallet,
} from 'lucide-react';
import {
  useTournamentAdmins,
  useAddTournamentAdmin,
  useRemoveTournamentAdmin,
  useSetTournamentStatus,
  useUpdateTournament,
  useSetResultsLocked,
  useArchiveTournament,
  useUnarchiveTournament,
} from '@/modules/tournament/hooks/useTournament';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_ADMIN_ROLE,
  RULESET,
  RULESET_LABELS,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import DuplicateTournamentDialog from '@/modules/tournament/components/DuplicateTournamentDialog';
import TournamentAnnouncementsCard from '@/modules/tournament/components/TournamentAnnouncementsCard';
import { t, tk } from '@/core/i18n';

function buildFormState(tournament) {
  return {
    name: tournament?.name || '',
    description: tournament?.description || '',
    city: tournament?.city || '',
    state: tournament?.state || '',
    venue: tournament?.venue || '',
    visibility: tournament?.visibility || 'private',
    ruleset: tournament?.scoring?.ruleset || tournament?.ruleset || RULESET.CBP,
    starts_at: tournament?.starts_at || '',
    ends_at: tournament?.ends_at || '',
    registration_deadline: tournament?.registration_deadline || '',
    payment_pix_key: tournament?.payment_pix_key || '',
    payment_pix_name: tournament?.payment_pix_name || '',
    payment_pix_city: tournament?.payment_pix_city || '',
    payment_instructions: tournament?.payment_instructions || '',
  };
}

const STATUS_ACTIONS = [
  {
    value: TOURNAMENT_STATUS.REGISTRATIONS_OPEN,
    label: tk('Abrir inscrições'),
    description: tk('Permite novas entradas nas modalidades.'),
    icon: Play,
  },
  {
    value: TOURNAMENT_STATUS.REGISTRATIONS_CLOSED,
    label: tk('Encerrar inscrições'),
    description: tk('Fecha novas entradas e estabiliza a lista.'),
    icon: Lock,
  },
  {
    value: TOURNAMENT_STATUS.IN_PROGRESS,
    label: tk('Iniciar torneio'),
    description: tk('Marca o evento como em andamento.'),
    icon: Settings2,
  },
  {
    value: TOURNAMENT_STATUS.FINISHED,
    label: tk('Encerrar torneio'),
    description: tk('Fecha a operação e mantém o histórico publicado.'),
    icon: CheckCircle2,
  },
];

export default function TournamentAdminTab({ tournament }) {
  const { user, isPlatformAdmin } = useAuth();
  const { data: admins = [] } = useTournamentAdmins(tournament.id);
  const addMutation = useAddTournamentAdmin(tournament.id);
  const removeMutation = useRemoveTournamentAdmin(tournament.id);
  const statusMutation = useSetTournamentStatus(tournament.id);
  const updateMutation = useUpdateTournament(tournament.id);
  const archiveMutation = useArchiveTournament(tournament.id);
  const unarchiveMutation = useUnarchiveTournament(tournament.id);
  const [email, setEmail] = useState('');
  const [form, setForm] = useState(() => buildFormState(tournament));
  const duplicationOn = true;
  const templatesOn = true;
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const lifecycleOn = true;
  const cancelActionOn = true;
  const paymentOn = true;
  const announcementsOn = true;
  const lockMutation = useSetResultsLocked(tournament.id);
  const isFinished = tournament.status === TOURNAMENT_STATUS.FINISHED;
  const isLocked = Boolean(tournament.results_locked);
  const isCreator = user?.uid && tournament.creator_uid === user.uid;
  const canArchive = isCreator || isPlatformAdmin;
  const isCancelled = tournament.status === TOURNAMENT_STATUS.CANCELLED;
  const isArchived = Boolean(tournament.archived);

  async function handleArchiveToggle() {
    try {
      if (isArchived) {
        await unarchiveMutation.mutateAsync();
        toast.success(t('Torneio desarquivado. Ele voltou a aparecer publicamente.'));
      } else {
        await archiveMutation.mutateAsync();
        toast.success(t('Torneio arquivado. Saiu das listas públicas e do /p/:id.'));
      }
    } catch (err) {
      toast.error(err?.message || t('Falha ao atualizar o arquivo.'));
    }
  }

  async function handleSetLocked(locked) {
    try {
      await lockMutation.mutateAsync(locked);
      toast.success(locked ? t('Alterações bloqueadas.') : t('Alterações desbloqueadas.'));
    } catch (err) {
      toast.error(err?.message || t('Falha ao atualizar o bloqueio.'));
    }
  }

  useEffect(() => {
    setForm(buildFormState(tournament));
  }, [tournament]);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleAddAdmin() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', trimmed));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error(t('Usuário não encontrado. Peça para a pessoa fazer login uma vez na plataforma.'));
        return;
      }
      const data = snap.docs[0].data();
      await addMutation.mutateAsync({ uid: data.uid, email: data.email, displayName: data.platform_name || data.full_name });
      toast.success(t('Admin adicionado.'));
      setEmail('');
    } catch (err) {
      toast.error(err.message || t('Falha ao adicionar.'));
    }
  }

  async function handlePickAdmin(a) {
    if (!a?.id) return;
    if (admins.some((x) => x.user_id === a.id)) {
      toast.info(t('Essa pessoa já administra o torneio.'));
      return;
    }
    try {
      await addMutation.mutateAsync({ uid: a.id, displayName: a.platform_name || a.full_name });
      toast.success(t('Admin adicionado.'));
    } catch (err) {
      toast.error(err.message || t('Falha ao adicionar.'));
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error(t('Informe o nome do torneio.'));
    try {
      await updateMutation.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        venue: form.venue.trim(),
        visibility: form.visibility,
        ruleset: form.ruleset,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        registration_deadline: form.registration_deadline || null,
        ...(paymentOn ? {
          payment_pix_key: form.payment_pix_key.trim(),
          payment_pix_name: form.payment_pix_name.trim(),
          payment_pix_city: form.payment_pix_city.trim(),
          payment_instructions: form.payment_instructions.trim(),
        } : {}),
        scoring: {
          ...(tournament?.scoring || {}),
          ruleset: form.ruleset,
          win_by_two: tournament?.scoring?.win_by_two ?? true,
        },
      });
      toast.success(t('Parâmetros do torneio atualizados.'));
    } catch (err) {
      toast.error(err.message || t('Falha ao salvar.'));
    }
  }

  async function setStatus(s) {
    try {
      await statusMutation.mutateAsync(s);
      toast.success(t('Status atualizado.'));
    } catch (err) {
      toast.error(err.message);
    }
  }

  const infoCards = [
    {
      label: t('Status atual'),
      value: TOURNAMENT_STATUS_LABELS[tournament.status],
      icon: ShieldAlert,
    },
    {
      label: t('Acesso'),
      value: TOURNAMENT_VISIBILITY_LABELS[form.visibility],
      icon: Lock,
    },
    {
      label: t('Admins ativos'),
      value: admins.length,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-5">
      <PlatformSurfaceCard>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{t('Parâmetros centrais')}</div>
              <h3 className="mt-2 text-2xl font-semibold text-ink">{t('Edite o torneio sem perder contexto operacional')}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                {t('Nome, local, regras, datas e acesso ficam concentrados aqui para facilitar revisão antes de abrir inscrições ou iniciar partidas.')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {duplicationOn && (
                <Button variant="outline" onClick={() => setDuplicateOpen(true)}>
                  <Copy className="w-4 h-4 mr-1" />
                  {t('Duplicar torneio')}
                </Button>
              )}
              {templatesOn && (
                <Button
                  variant={tournament.is_template ? 'default' : 'outline'}
                  onClick={() => updateMutation.mutate(
                    { is_template: !tournament.is_template },
                    {
                      onSuccess: () => toast.success(tournament.is_template ? t('Não é mais um modelo.') : t('Torneio marcado como modelo.')),
                      onError: (err) => toast.error(err?.message || t('Não foi possível atualizar.')),
                    },
                  )}
                  disabled={updateMutation.isPending}
                >
                  <FileStack className="w-4 h-4 mr-1" />
                  {tournament.is_template ? t('É um modelo') : t('Marcar como modelo')}
                </Button>
              )}
              {lifecycleOn && isFinished && (
                isLocked ? (
                  <ConfirmDialog
                    title={t('Desbloquear alterações?')}
                    description={t('O torneio voltará a permitir sorteios e ajustes. Os dados seguem valendo para o ranking enquanto o torneio estiver encerrado.')}
                    confirmLabel={t('Desbloquear')}
                    destructive={false}
                    onConfirm={() => handleSetLocked(false)}
                    trigger={(
                      <Button variant="outline" disabled={lockMutation.isPending}>
                        <LockOpen className="w-4 h-4 mr-1" /> {t('Desbloquear alterações')}
                      </Button>
                    )}
                  />
                ) : (
                  <ConfirmDialog
                    title={t('Bloquear alterações?')}
                    description={t('Congela o resultado oficial do torneio: sorteios e ajustes ficam bloqueados até você desbloquear. Você pode reverter a qualquer momento.')}
                    confirmLabel={t('Bloquear')}
                    destructive={false}
                    onConfirm={() => handleSetLocked(true)}
                    trigger={(
                      <Button variant="outline" disabled={lockMutation.isPending}>
                        <Lock className="w-4 h-4 mr-1" /> {t('Bloquear alterações')}
                      </Button>
                    )}
                  />
                )
              )}
              <Button onClick={handleSave} disabled={updateMutation.isPending || (lifecycleOn && isLocked)}>
                <Save className="w-4 h-4 mr-1" />
                {updateMutation.isPending ? t('Salvando…') : t('Salvar alterações')}
              </Button>
            </div>
          </div>

          {lifecycleOn && isFinished && (
            <div className={`mt-4 rounded-[1.25rem] border p-4 text-sm ${isLocked ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-900'}`}>
              {isLocked
                ? t('Torneio encerrado e bloqueado: os resultados estão congelados e valendo para o ranking da plataforma. Desbloqueie para permitir ajustes.')
                : t('Torneio encerrado: os resultados já valem para o ranking da plataforma. Você pode bloquear as alterações para congelar o resultado oficial.')}
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {infoCards.map(({ label, value, icon: Icon }) => (
              <PlatformMetricCard key={label} label={label} value={value} icon={Icon} />
            ))}
          </div>
      </PlatformSurfaceCard>

      <div className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr]">
        <PlatformSurfaceCard contentClassName="space-y-6 p-6 sm:p-7">
            <section className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{t('Identidade e contexto')}</div>
                <h4 className="mt-2 text-xl font-semibold text-ink">{t('Como o torneio aparece para o público')}</h4>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>{t('Nome do torneio')}</Label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-2" />
                </div>
                <div className="md:col-span-2">
                  <Label>{t('Descrição')}</Label>
                  <textarea
                    className="mt-2 flex min-h-28 w-full rounded-[1rem] border border-input bg-background px-3 py-3 text-sm"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('Cidade')}</Label>
                  <Input value={form.city} onChange={(e) => set('city', e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label>{t('UF')}</Label>
                  <Input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} className="mt-2" />
                </div>
                <div className="md:col-span-2">
                  <Label>{t('Local (quadra/clube)')}</Label>
                  <Input value={form.venue} onChange={(e) => set('venue', e.target.value)} className="mt-2" />
                </div>
              </div>
            </section>

            <PlatformFormSection
              icon={Settings2}
              title={t('Acesso e regras-base')}
              description={t('Defina quem encontra o torneio e qual conjunto de regras-base será herdado pelas modalidades.')}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>{t('Tipo de acesso')}</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm"
                    value={form.visibility}
                    onChange={(e) => set('visibility', e.target.value)}
                  >
                    {Object.entries(TOURNAMENT_VISIBILITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <Label>{t('Conjunto de regras')}</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm"
                    value={form.ruleset}
                    onChange={(e) => set('ruleset', e.target.value)}
                  >
                    {Object.values(RULESET).map((ruleset) => (
                      <option key={ruleset} value={ruleset}>{RULESET_LABELS[ruleset]}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 rounded-[1.25rem] border border-gray-200 bg-acid/10 p-4 text-sm leading-6 text-green-800">
                  {t('Pontos por game e sets por partida agora são definidos dentro de cada modalidade, fase por fase. Aqui ficam apenas as regras-base do torneio.')}
                </div>
              </div>
            </PlatformFormSection>

            <PlatformFormSection
              icon={CalendarDays}
              title={t('Datas operacionais')}
              description={t('Controle o período do evento e o fechamento das inscrições sem sair da área administrativa.')}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>{t('Início')}</Label>
                  <Input type="date" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label>{t('Fim')}</Label>
                  <Input type="date" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label>{t('Fim das inscrições')}</Label>
                  <Input type="date" value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} className="mt-2" />
                </div>
              </div>
            </PlatformFormSection>

            {paymentOn && (
              <PlatformFormSection
                icon={Wallet}
                title={t('Pagamento das inscrições (PIX)')}
                description={t('Com a chave configurada, o atleta vê o QR Code e o código copia e cola ao se inscrever em modalidades pagas, e pode avisar quando pagar. A confirmação continua manual, feita por você.')}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>{t('Chave PIX (CPF/CNPJ, e-mail, telefone ou chave aleatória)')}</Label>
                    <Input
                      value={form.payment_pix_key}
                      onChange={(e) => set('payment_pix_key', e.target.value)}
                      placeholder={t('ex.: organizador@email.com')}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>{t('Nome do recebedor')}</Label>
                    <Input
                      value={form.payment_pix_name}
                      onChange={(e) => set('payment_pix_name', e.target.value)}
                      maxLength={25}
                      placeholder={t('como aparece no banco')}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>{t('Cidade do recebedor')}</Label>
                    <Input
                      value={form.payment_pix_city}
                      onChange={(e) => set('payment_pix_city', e.target.value)}
                      maxLength={15}
                      placeholder={t('ex.: Sao Paulo')}
                      className="mt-2"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>{t('Instruções adicionais (opcional)')}</Label>
                    <textarea
                      className="mt-2 flex min-h-20 w-full rounded-[1rem] border border-input bg-background px-3 py-3 text-sm"
                      value={form.payment_instructions}
                      onChange={(e) => set('payment_instructions', e.target.value)}
                      placeholder={t('ex.: envie o comprovante no WhatsApp (11) 99999-9999')}
                    />
                  </div>
                  <div className="md:col-span-2 rounded-[1.25rem] border border-gray-200 bg-acid/10 p-4 text-sm leading-6 text-green-800">
                    {t('Deixe a chave em branco para não exibir instruções de pagamento. O valor cobrado é a taxa definida em cada modalidade.')}
                  </div>
                </div>
              </PlatformFormSection>
            )}
        </PlatformSurfaceCard>

        <div className="space-y-5">
          <PlatformSurfaceCard data-dica="torneio-status">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{t('Status da operação')}</div>
            <h4 className="mt-2 text-xl font-semibold text-ink">{t('Atualize o estado do evento com clareza')}</h4>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {t('Escolha uma ação abaixo para refletir o momento atual do torneio em toda a plataforma.')}
            </p>

            <div className="mt-5 space-y-3">
              {STATUS_ACTIONS.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className="flex w-full items-start gap-3 rounded-[1.35rem] border border-gray-100 bg-white/75 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-acid/15 text-ink">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-ink">{t(label)}</div>
                    <p className="mt-1 text-sm leading-6 text-gray-500">{t(description)}</p>
                  </div>
                </button>
              ))}

              {cancelActionOn && !isCancelled && (
                <ConfirmDialog
                  title={t('Cancelar o torneio?')}
                  description={t('O torneio passa ao status "Cancelado": sai das listas ativas e fica liberado para arquivamento. Os dados (modalidades, inscrições e jogos) são preservados e você pode reverter escolhendo outro status depois.')}
                  confirmLabel={t('Cancelar torneio')}
                  onConfirm={() => setStatus(TOURNAMENT_STATUS.CANCELLED)}
                  trigger={(
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 rounded-[1.35rem] border border-red-100 bg-red-50/60 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                        <Ban className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-red-700">{t('Cancelar torneio')}</div>
                        <p className="mt-1 text-sm leading-6 text-red-600/80">
                          {t('Marca o evento como cancelado e libera o arquivamento. Reversível.')}
                        </p>
                      </div>
                    </button>
                  )}
                />
              )}
            </div>
          </PlatformSurfaceCard>

          <PlatformSurfaceCard>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acid/15 text-ink">
                <Users className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink">{t('Admins do torneio')}</div>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  {t('O owner permanece fixo. Os demais admins compartilham gestão deste torneio sem impactar o admin geral da plataforma.')}
                </p>
              </div>
            </div>

            <ul className="mt-5 space-y-3">
              {admins.map((a) => (
                <li key={a.user_id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-gray-100 bg-white/75 px-4 py-3">
                  <div className="min-w-0">
                    {/* P1-01: `tournament_admins` é lido por qualquer conta
                        logada; o e-mail do organizador saiu do documento e da
                        tela. O nome identifica quem administra. */}
                    <div className="truncate font-medium text-ink">{a.user_name || t('Organizador')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shadow-none">
                      {a.role === TOURNAMENT_ADMIN_ROLE.OWNER ? t('Owner') : t('Admin')}
                    </Badge>
                    {a.role !== TOURNAMENT_ADMIN_ROLE.OWNER && (
                      <Button size="icon" variant="ghost" onClick={() => removeMutation.mutate(a.user_id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-[1.5rem] border border-gray-100 bg-paper p-4">
              <Label>{t('Adicionar admin pela lista de usuários')}</Label>
              <div className="mt-3">
                <AthletePicker value={null} onChange={handlePickAdmin} inputId="torneio-admin-pessoa" placeholder={t('Buscar pelo nome…')} />
              </div>
              <Label className="mt-4 block">{t('Ou pelo e-mail do usuário já cadastrado')}</Label>
              <div className="mt-3 flex gap-2">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" type="email" />
                <Button onClick={handleAddAdmin} disabled={addMutation.isPending}>
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </PlatformSurfaceCard>

          {canArchive && (
            <PlatformSurfaceCard>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  {isArchived ? <ArchiveRestore className="h-4.5 w-4.5" /> : <Archive className="h-4.5 w-4.5" />}
                </div>
                <div>
                  <div className="text-base font-semibold text-ink">
                    {isArchived ? t('Torneio arquivado') : t('Arquivamento')}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    {isArchived
                      ? t('O torneio está fora das listas públicas e da visão de espectador. Você ainda consegue consultá-lo por aqui para reabri-lo quando quiser.')
                      : t('Arquivar esconde o torneio da UI pública, do /p/:id e da Dashboard dos atletas. O histórico (modalidades, jogos, ranking) fica preservado para você e para o admin da plataforma.')}
                  </p>
                </div>
              </div>

              {!isArchived && !isCancelled && (
                <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  {t('Para arquivar, o torneio precisa estar com o status')}
                  <strong> {t('"Cancelado"')}</strong>. {t('Cancele o torneio primeiro (use o card "Status da operação" à esquerda) e só depois arquive — assim a galera é avisada do cancelamento antes do torneio sumir.')}
                </div>
              )}

              {isArchived && (
                <div className="mt-4 rounded-[1.25rem] border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                  {t('Desarquivar faz o torneio voltar a aparecer nas listas (respeitando a visibilidade configurada) e na Dashboard.')}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {isArchived ? (
                  <Button
                    variant="outline"
                    onClick={handleArchiveToggle}
                    disabled={unarchiveMutation.isPending}
                  >
                    <ArchiveRestore className="w-4 h-4 mr-1" />
                    {unarchiveMutation.isPending ? t('Desarquivando…') : t('Desarquivar torneio')}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleArchiveToggle}
                    disabled={!isCancelled || archiveMutation.isPending}
                    title={!isCancelled ? t('Cancele o torneio antes de arquivar') : undefined}
                  >
                    <Archive className="w-4 h-4 mr-1" />
                    {archiveMutation.isPending ? t('Arquivando…') : t('Arquivar torneio')}
                  </Button>
                )}
              </div>
            </PlatformSurfaceCard>
          )}
        </div>
      </div>

      {announcementsOn && <TournamentAnnouncementsCard tournament={tournament} />}

      {duplicationOn && duplicateOpen && (
        <DuplicateTournamentDialog
          tournament={tournament}
          open={duplicateOpen}
          onClose={() => setDuplicateOpen(false)}
        />
      )}
    </div>
  );
}
