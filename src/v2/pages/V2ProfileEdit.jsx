import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Shield } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { birthDateToBrtDate, validateRequiredProfile, isRequiredProfileComplete } from '@/core/lib/profileValidation';
import { cn } from '@/core/lib/utils';
import { useFunnel } from '@/modules/analytics/hooks/useFunnel';
import { FUNNEL_EVENT } from '@/modules/analytics/domain/funnelEvents';
import { ImageUpload } from '@/components/ui/image-upload';
import { ATHLETE_GENDER_LABELS } from '@/modules/athletes/domain/constants';
import { LEVEL_OPTIONS, getLevelByCode } from '@/modules/leveling/data/levels';
import { calculateAssessment } from '@/modules/leveling/domain/questionnaire';
import { V2LevelingQuestionnaire } from '@/v2/components/leveling/V2LevelingQuestionnaire';
import { V2LevelingResultCard } from '@/v2/components/leveling/V2LevelingQuestionnaire';
import { PICKLEBALL_EXPERIENCE_LABELS, COMPETITION_GENDER_LABELS } from '@/modules/tournament/domain/constants';
import V2ParticipationHistoryCard from '@/v2/components/tournament/V2ParticipationHistoryCard';
import { useCoach, useSyncCoachFromProfile } from '@/modules/coaches/hooks/useCoaches';
import { useRoleConsent } from '@/v2/components/legal/useRoleConsent';
import {
  COURT_SIDE_OPTIONS, PLATFORM_INTEREST_META, sanitizeInterests,
} from '@/modules/athletes/domain/profileMeta';
import { interestIcon } from '@/v2/components/profile/profileMetaIcons';
import {
  V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';

/**
 * Converte o campo "rating DUPR atual" em número na escala 2.000–8.000, ou null
 * quando vazio/inválido. Aceita vírgula ou ponto.
 */
function parseDuprRating(raw) {
  const n = Number(String(raw ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(8, Math.max(2, Math.round(n * 1000) / 1000));
}

export default function V2ProfileEdit() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const { track } = useFunnel();
  const coachDirectoryOn = true;
  // Perfil completo de professor (coleção coaches) — fonte para pré-preencher
  // e para manter em sincronia com o "Sou professor" do perfil.
  const { data: myCoach } = useCoach(user?.uid);
  const syncCoach = useSyncCoachFromProfile();
  const coachConsent = useRoleConsent('termos-professor');

  const [platformName, setPlatformName] = useState(userProfile?.platform_name || userProfile?.full_name || '');
  const [birthDate, setBirthDate] = useState(userProfile?.birth_date || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [pickleballExperience, setPickleballExperience] = useState(userProfile?.pickleball_experience || '');
  const [competitionGender, setCompetitionGender] = useState(userProfile?.competition_gender || '');
  const [duprId, setDuprId] = useState(userProfile?.dupr_id || '');
  const [duprRating, setDuprRating] = useState(
    userProfile?.dupr_rating != null ? String(userProfile.dupr_rating) : '',
  );
  const skillRatingOn = true;
  const [courtSide, setCourtSide] = useState(userProfile?.court_side || '');
  const [interests, setInterests] = useState(sanitizeInterests(userProfile?.interests));
  const [interestsBusy, setInterestsBusy] = useState(false);
  const [manualLevel, setManualLevel] = useState(userProfile?.leveling_level || '');
  const [gender, setGender] = useState(userProfile?.gender || '');
  const [city, setCity] = useState(userProfile?.city || '');
  const [stateUf, setStateUf] = useState(userProfile?.state || '');
  const [address, setAddress] = useState(userProfile?.address || '');
  const [phonePublic, setPhonePublic] = useState(userProfile?.phone_public === true);
  const [emailPublic, setEmailPublic] = useState(userProfile?.email_public === true);
  const [addressPublic, setAddressPublic] = useState(userProfile?.address_public === true);
  const [directoryListed, setDirectoryListed] = useState(userProfile?.directory_listed !== false);
  const [photoUrl, setPhotoUrl] = useState(userProfile?.photo_url || user?.photoURL || '');
  const [isCoach, setIsCoach] = useState(userProfile?.is_coach === true);
  const [coachBio, setCoachBio] = useState(userProfile?.coach_bio || '');
  const [coachPrice, setCoachPrice] = useState(userProfile?.coach_price || '');
  const [coachRegions, setCoachRegions] = useState(userProfile?.coach_regions || '');
  const [coachModalities, setCoachModalities] = useState(userProfile?.coach_modalities || '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [coachBusy, setCoachBusy] = useState(false);
  const [levelBusy, setLevelBusy] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [formVersion, setFormVersion] = useState(0);
  const [visibleResult, setVisibleResult] = useState(userProfile?.leveling_assessment?.result || null);

  const savedAnswers = userProfile?.leveling_assessment?.answers;
  const selectedLevel = useMemo(() => getLevelByCode(manualLevel), [manualLevel]);

  useEffect(() => {
    setPlatformName(userProfile?.platform_name || userProfile?.full_name || '');
    setBirthDate(userProfile?.birth_date || '');
    setPhone(userProfile?.phone || '');
    setPickleballExperience(userProfile?.pickleball_experience || '');
    setCompetitionGender(userProfile?.competition_gender || '');
    setDuprId(userProfile?.dupr_id || '');
    setDuprRating(userProfile?.dupr_rating != null ? String(userProfile.dupr_rating) : '');
    setCourtSide(userProfile?.court_side || '');
    setInterests(sanitizeInterests(userProfile?.interests));
    setManualLevel(userProfile?.leveling_level || '');
    setGender(userProfile?.gender || '');
    setCity(userProfile?.city || '');
    setStateUf(userProfile?.state || '');
    setAddress(userProfile?.address || '');
    setPhonePublic(userProfile?.phone_public === true);
    setEmailPublic(userProfile?.email_public === true);
    setAddressPublic(userProfile?.address_public === true);
    setDirectoryListed(userProfile?.directory_listed !== false);
    setPhotoUrl(userProfile?.photo_url || user?.photoURL || '');
    setIsCoach(userProfile?.is_coach === true);
    setCoachBio(userProfile?.coach_bio || '');
    setCoachPrice(userProfile?.coach_price || '');
    setCoachRegions(userProfile?.coach_regions || '');
    setCoachModalities(userProfile?.coach_modalities || '');
    setVisibleResult(userProfile?.leveling_assessment?.result || null);
  }, [userProfile, user?.photoURL]);

  // Pré-preenche a seção "Sou professor" a partir do perfil completo (coleção
  // coaches) quando o espelho em users ainda não tem os dados — ex.: cadastro
  // feito só na página /coaches. Mantém as duas fontes coerentes na tela.
  useEffect(() => {
    if (!myCoach) return;
    if (userProfile?.is_coach !== true && myCoach.active !== false) setIsCoach(true);
    if (!userProfile?.coach_bio && myCoach.bio) setCoachBio(myCoach.bio);
    if (!userProfile?.coach_price && myCoach.hourly_rate != null) setCoachPrice(String(myCoach.hourly_rate));
    if (!userProfile?.coach_regions && (myCoach.regions || []).length) setCoachRegions(myCoach.regions.join(', '));
    if (!userProfile?.coach_modalities && (myCoach.modalities || []).length) setCoachModalities(myCoach.modalities.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCoach]);

  const onSaveIdentity = async (e) => {
    e.preventDefault();
    const validation = validateRequiredProfile({ platformName, birthDate, phone, pickleballExperience });
    if (!validation.isValid) { setErrors(validation.errors); return; }
    const wasComplete = isRequiredProfileComplete(userProfile);
    setBusy(true);
    try {
      await updateUserProfile({
        platform_name: platformName.trim(),
        birth_date: birthDate,
        birth_date_at: Timestamp.fromDate(birthDateToBrtDate(birthDate)),
        phone: phone.trim(),
        pickleball_experience: pickleballExperience,
        competition_gender: competitionGender || null,
        dupr_id: duprId.trim() || null,
        dupr_rating: parseDuprRating(duprRating),
        court_side: courtSide || null,
      });
      toast.success('Perfil atualizado.');
      // Marco de funil: só na transição incompleto → completo.
      if (!wasComplete) track(FUNNEL_EVENT.PROFILE_COMPLETED);
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  const savePhoto = async (url) => {
    const previous = photoUrl;
    setPhotoUrl(url);
    try {
      await updateUserProfile({ photo_url: url });
      toast.success(url ? 'Foto atualizada.' : 'Foto removida.');
    } catch (err) {
      setPhotoUrl(previous);
      toast.error(err.message || 'Erro ao salvar a foto.');
    }
  };

  const saveCommunity = async () => {
    setCommunityBusy(true);
    try {
      await updateUserProfile({
        gender: gender || '',
        city: city.trim(),
        state: stateUf.trim().toUpperCase(),
        address: address.trim(),
        phone_public: phonePublic,
        email_public: emailPublic,
        address_public: addressPublic,
        directory_listed: directoryListed,
      });
      toast.success('Preferências de comunidade e privacidade salvas.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar preferências.');
    } finally {
      setCommunityBusy(false);
    }
  };

  const toggleInterest = (value) => {
    setInterests((cur) => (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]));
  };

  const saveInterests = async () => {
    if (interests.length === 0) { toast.error('Escolha ao menos um interesse.'); return; }
    setInterestsBusy(true);
    try {
      await updateUserProfile({ interests: sanitizeInterests(interests) });
      toast.success('Interesses atualizados.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar interesses.');
    } finally {
      setInterestsBusy(false);
    }
  };

  const saveCoach = async () => {
    if (isCoach && !coachModalities.trim() && !(myCoach?.modalities || []).length) {
      toast.error('Informe ao menos uma modalidade (ex.: Iniciantes, Avançado, DUPR 4.0+).');
      return;
    }
    // Consentimento aos Termos do Professor exigido só ao ativar o papel.
    if (isCoach && !coachConsent.guardBeforeSubmit()) return;
    setCoachBusy(true);
    try {
      // 1) Espelho no perfil do usuário (users + diretório de atletas).
      await updateUserProfile({
        is_coach: isCoach,
        coach_bio: isCoach ? coachBio.trim() : '',
        coach_price: isCoach ? coachPrice.trim() : '',
        coach_regions: isCoach ? coachRegions.trim() : '',
        coach_modalities: isCoach ? coachModalities.trim() : '',
      });
      // 2) Perfil completo de professor (coleção coaches), preservando os campos
      //    avançados (certificações, fotos, contatos). Vincula as duas fontes.
      await syncCoach.mutateAsync({
        coachId: user.uid,
        essentials: {
          is_coach: isCoach,
          bio: coachBio,
          hourly_rate: coachPrice,
          regions: coachRegions,
          modalities: coachModalities,
          display_name: platformName,
        },
      });
      if (isCoach) await coachConsent.recordAfterSuccess();
      toast.success('Informações de professor salvas.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar informações de professor.');
    } finally {
      setCoachBusy(false);
    }
  };

  const saveManualLevel = async () => {
    if (!manualLevel) { toast.error('Selecione um nível.'); return; }
    const level = getLevelByCode(manualLevel);
    setLevelBusy(true);
    try {
      await updateUserProfile({
        level: level ? `${level.name} (USAP ${level.usap})` : manualLevel,
        leveling_level: manualLevel,
        leveling_method: 'manual',
        leveling_manual_level: manualLevel,
      });
      toast.success('Nível salvo no perfil.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar nível.');
    } finally {
      setLevelBusy(false);
    }
  };

  const saveAssessment = async ({ answers, result }) => {
    setLevelBusy(true);
    try {
      await updateUserProfile({
        level: result.levelName,
        leveling_level: result.level,
        leveling_method: 'form',
        leveling_assessment: { version: 'pickleball-nivelamento-104', answers, result, updated_at: new Date().toISOString() },
      });
      setManualLevel(result.level);
      setVisibleResult(result);
      toast.success('Formulário e resultado salvos no seu perfil.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar formulário.');
    } finally {
      setLevelBusy(false);
    }
  };

  const startFromScratch = () => { setVisibleResult(null); setFormMode('scratch'); setFormVersion((v) => v + 1); };
  const startFromSaved = () => { setVisibleResult(null); setFormMode('saved'); setFormVersion((v) => v + 1); };
  const regenerateResult = async () => {
    if (!savedAnswers) { toast.error('Não há respostas salvas.'); return; }
    await saveAssessment({ answers: savedAnswers, result: calculateAssessment(savedAnswers) });
  };

  return (
    <div className="mx-auto max-w-[900px]">
      <Link to="/perfil" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar ao perfil
      </Link>

      <div className="relative mb-6 overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">Seu perfil</span>
        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">Como você aparece para a comunidade.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300">Organize identidade, privacidade, nível e informações de professor. Cada bloco salva de forma independente.</p>
      </div>

      <div className="space-y-6">
        {/* Identity */}
        <V2Surface collapsible collapseId="perfil-identidade" eyebrow="Identidade" title="Dados do participante">
          <div className="mt-5">
            <ImageUpload
              value={photoUrl}
              onChange={savePhoto}
              folder="profile"
              shape="circle"
              label="Enviar foto"
              hint="Sua foto aparece no perfil, no diretório de atletas e nos clubes."
            />
            <p className="mt-2 text-xs text-gray-400">{user?.email} · Login via Google</p>
          </div>

          <form onSubmit={onSaveIdentity} className="mt-6 space-y-4">
            <V2Field label="Nome de exibição" required error={errors.platformName} hint="Esse é o nome que aparece nos rankings.">
              <V2Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} maxLength={60} />
            </V2Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <V2Field label="Data de nascimento" required error={errors.birthDate}>
                <V2Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </V2Field>
              <V2Field label="Telefone" required error={errors.phone}>
                <V2Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </V2Field>
            </div>
            <V2Field label="Tempo de experiência em pickleball" required error={errors.pickleballExperience}>
              <V2Select value={pickleballExperience} onChange={(e) => setPickleballExperience(e.target.value)}>
                <option value="">Selecione uma opção</option>
                {Object.entries(PICKLEBALL_EXPERIENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </V2Select>
            </V2Field>
            <V2Field label="Categoria em que deseja competir" hint="Preferência competitiva (não é sobre identidade de gênero).">
              <V2Select value={competitionGender} onChange={(e) => setCompetitionGender(e.target.value)}>
                <option value="">Não informar (decido na inscrição)</option>
                {Object.entries(COMPETITION_GENDER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </V2Select>
            </V2Field>
            <V2Field label="ID DUPR" hint="Seu identificador no DUPR (Dynamic Universal Pickleball Rating). Fica visível no seu perfil e nos torneios.">
              <V2Input value={duprId} onChange={(e) => setDuprId(e.target.value)} maxLength={20} placeholder="Ex.: ABC123" />
            </V2Field>
            {skillRatingOn && (
              <V2Field label="Meu rating DUPR atual (opcional)" hint="Se você já tem um rating DUPR, informe-o (2.000 a 8.000) para servir de ponto de partida no ranking de nível da plataforma. Opcional — se vazio, usamos o seu nivelamento.">
                <V2Input value={duprRating} onChange={(e) => setDuprRating(e.target.value)} inputMode="decimal" maxLength={6} placeholder="Ex.: 3.500" />
              </V2Field>
            )}
            <V2Field label="Lado da quadra que prefere jogar" hint="Ajuda a encontrar parcerias compatíveis.">
              <V2Select value={courtSide} onChange={(e) => setCourtSide(e.target.value)}>
                <option value="">Selecione</option>
                {COURT_SIDE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </V2Select>
            </V2Field>
            <div className="flex justify-end">
              <V2Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</V2Button>
            </div>
          </form>
        </V2Surface>

        {/* Community & privacy */}
        <V2Surface collapsible collapseId="perfil-comunidade" eyebrow="Comunidade" title="Comunidade e privacidade"
          description="Defina como você aparece no diretório e quais contatos são públicos.">
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <V2Field label="Gênero">
              <V2Select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Não informar</option>
                {Object.entries(ATHLETE_GENDER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </V2Select>
            </V2Field>
            <div className="grid grid-cols-[1fr,80px] gap-3">
              <V2Field label="Cidade"><V2Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} /></V2Field>
              <V2Field label="UF"><V2Input value={stateUf} onChange={(e) => setStateUf(e.target.value)} maxLength={2} placeholder="SP" /></V2Field>
            </div>
          </div>
          <V2Field label="Endereço" className="mt-4" hint="Só é exibido se você marcar como público abaixo.">
            <V2Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={160} />
          </V2Field>

          <div className="mt-5 rounded-3xl border border-gray-100 bg-paper p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-ink"><Shield className="h-4 w-4" /> Visibilidade dos contatos</div>
            <div className="mt-4 space-y-4">
              <V2Toggle id="phone_public" label="Telefone público" hint="Outros atletas veem seu telefone" checked={phonePublic} onChange={setPhonePublic} />
              <V2Toggle id="email_public" label="E-mail público" hint="Outros atletas veem seu e-mail" checked={emailPublic} onChange={setEmailPublic} />
              <V2Toggle id="address_public" label="Endereço público" hint="Outros atletas veem seu endereço" checked={addressPublic} onChange={setAddressPublic} />
            </div>
          </div>
          <div className="mt-4 rounded-3xl border border-gray-100 bg-paper p-5">
            <V2Toggle id="directory_listed" label="Aparecer no diretório de atletas" hint="Se desativado, seu perfil não é listado" checked={directoryListed} onChange={setDirectoryListed} />
          </div>

          <div className="mt-5 flex justify-end">
            <V2Button onClick={saveCommunity} disabled={communityBusy}>{communityBusy ? 'Salvando…' : 'Salvar comunidade e privacidade'}</V2Button>
          </div>
        </V2Surface>

        {/* Interesses na plataforma */}
        <V2Surface collapsible collapseId="perfil-interesses" eyebrow="Interesses" title="Meus interesses na plataforma"
          description="O que você quer fazer por aqui. Usamos isso para destacar o que importa para você no painel.">
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {PLATFORM_INTEREST_META.map(({ value, label, hint, icon }) => {
              const Icon = interestIcon(icon);
              const active = interests.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleInterest(value)}
                  aria-pressed={active}
                  className={cn(
                    'btn-press flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors',
                    active ? 'border-transparent bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink',
                  )}
                >
                  <Icon className={cn('mt-0.5 h-4.5 w-4.5 shrink-0', active ? 'text-acid' : 'text-gray-400')} />
                  <span>
                    {label}
                    {hint && <span className={cn('mt-0.5 block text-xs font-normal', active ? 'text-white/70' : 'text-gray-400')}>{hint}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-end">
            <V2Button onClick={saveInterests} disabled={interestsBusy || interests.length === 0}>
              {interestsBusy ? 'Salvando…' : 'Salvar interesses'}
            </V2Button>
          </div>
        </V2Surface>

        {/* Coach */}
        {coachDirectoryOn && (
          <V2Surface collapsible collapseId="perfil-professor" eyebrow="Professor" title="Perfil de aulas e clínicas"
            description="Ative para aparecer na busca de professores. Depois de salvar, você acessa o Painel do Professor (horários, aulas, alunos, pacotes) por aqui ou pelo menu Aulas.">
            <div className="mt-5 rounded-3xl border border-gray-100 bg-paper p-5">
              <V2Toggle id="is_coach" label="Sou professor(a)" hint="Aparecer na busca de professores e exibir informações de aula" checked={isCoach} onChange={setIsCoach} />
            </div>
            {isCoach && (
              <div className="mt-4 space-y-4">
                {myCoach && (
                  <Link
                    to="/aulas"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-ink/15 bg-ink/[0.03] px-4 py-3 transition-colors hover:border-ink/30"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-ink">
                      <Shield className="h-4 w-4" /> Painel do Professor
                    </span>
                    <span className="text-xs font-semibold text-gray-500">Horários, aulas, alunos e pacotes →</span>
                  </Link>
                )}
                <V2Field label="Sobre suas aulas"><V2Textarea value={coachBio} onChange={(e) => setCoachBio(e.target.value)} maxLength={1000} rows={3} placeholder="Ex.: Aulas para iniciantes e intermediários, foco em fundamentos e tática." /></V2Field>
                <V2Field label="Modalidades (separadas por vírgula)" required>
                  <V2Input value={coachModalities} onChange={(e) => setCoachModalities(e.target.value)} maxLength={160} placeholder="Ex.: Iniciantes, Avançado, DUPR 4.0+" />
                </V2Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <V2Field label="Valor (opcional)"><V2Input value={coachPrice} onChange={(e) => setCoachPrice(e.target.value)} maxLength={60} placeholder="Ex.: 80 (R$/hora)" /></V2Field>
                  <V2Field label="Regiões de atuação (opcional)"><V2Input value={coachRegions} onChange={(e) => setCoachRegions(e.target.value)} maxLength={120} placeholder="Ex.: Zona Sul, online" /></V2Field>
                </div>
                <p className="text-xs text-gray-500">
                  Estas informações formam seu perfil público de professor. Para foto, certificações e contatos,
                  {' '}<Link to="/coaches" className="font-semibold text-ink underline">gerencie seu perfil completo em Professores</Link>. Tudo fica sincronizado.
                </p>
                {coachConsent.field}
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <V2Button onClick={saveCoach} disabled={coachBusy || syncCoach.isPending}>{(coachBusy || syncCoach.isPending) ? 'Salvando…' : 'Salvar informações de professor'}</V2Button>
            </div>
          </V2Surface>
        )}

        <V2ParticipationHistoryCard />

        {/* Leveling */}
        <V2Surface collapsible collapseId="perfil-nivelamento" eyebrow="Nivelamento" title="Seu nível competitivo"
          description="Informe pela tabela detalhada ou preencha o formulário para obter a recomendação.">
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr,auto] sm:items-end">
            <V2Field label="Meu nível informado" hint={selectedLevel?.tagline}>
              <V2Select value={manualLevel} onChange={(e) => setManualLevel(e.target.value)}>
                <option value="">Selecione um nível</option>
                {LEVEL_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
              </V2Select>
            </V2Field>
            <V2Button onClick={saveManualLevel} disabled={levelBusy}>Salvar nível</V2Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <V2Button variant="ghost" size="sm" onClick={startFromScratch}>Preencher formulário do zero</V2Button>
            <V2Button variant="ghost" size="sm" onClick={startFromSaved} disabled={!savedAnswers}>Refazer com respostas anteriores</V2Button>
            <V2Button variant="ghost" size="sm" onClick={regenerateResult} disabled={!savedAnswers || levelBusy}>Gerar resultado salvo</V2Button>
            <V2Button variant="ghost" size="sm" onClick={() => window.print()} disabled={!visibleResult}><Printer className="h-4 w-4" /> Imprimir</V2Button>
          </div>

          {visibleResult && <div className="mt-5"><V2LevelingResultCard result={visibleResult} compact /></div>}

          {formMode && (
            <div className="mt-5 border-t border-gray-100 pt-5">
              <V2LevelingQuestionnaire
                key={`${formMode}-${formVersion}`}
                initialAnswers={formMode === 'saved' ? savedAnswers : null}
                onComplete={saveAssessment}
                onSaveDraft={saveAssessment}
                saveLabel="Salvar respostas no perfil"
              />
            </div>
          )}
        </V2Surface>
      </div>
    </div>
  );
}
