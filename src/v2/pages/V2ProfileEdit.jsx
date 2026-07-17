import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Shield } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { birthDateToBrtDate, validateRequiredProfile, isRequiredProfileComplete } from '@/core/lib/profileValidation';
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
import {
  V2Button, V2Field, V2Input, V2SectionHeader, V2Select, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';

export default function V2ProfileEdit() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const { track } = useFunnel();
  const coachDirectoryOn = useFeatureFlag(FEATURE_FLAG.COACH_DIRECTORY);

  const [platformName, setPlatformName] = useState(userProfile?.platform_name || userProfile?.full_name || '');
  const [birthDate, setBirthDate] = useState(userProfile?.birth_date || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [pickleballExperience, setPickleballExperience] = useState(userProfile?.pickleball_experience || '');
  const [competitionGender, setCompetitionGender] = useState(userProfile?.competition_gender || '');
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
    setVisibleResult(userProfile?.leveling_assessment?.result || null);
  }, [userProfile, user?.photoURL]);

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

  const saveCoach = async () => {
    setCoachBusy(true);
    try {
      await updateUserProfile({
        is_coach: isCoach,
        coach_bio: isCoach ? coachBio.trim() : '',
        coach_price: isCoach ? coachPrice.trim() : '',
        coach_regions: isCoach ? coachRegions.trim() : '',
      });
      toast.success('Informações de treinador salvas.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar informações de treinador.');
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
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300">Organize identidade, privacidade, nível e informações de treinador. Cada bloco salva de forma independente.</p>
      </div>

      <div className="space-y-6">
        {/* Identity */}
        <V2Surface>
          <V2SectionHeader eyebrow="Identidade" title="Dados do participante" titleClassName="text-xl" />
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
            <div className="flex justify-end">
              <V2Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</V2Button>
            </div>
          </form>
        </V2Surface>

        {/* Community & privacy */}
        <V2Surface>
          <V2SectionHeader eyebrow="Comunidade" title="Comunidade e privacidade" titleClassName="text-xl"
            description="Defina como você aparece no diretório e quais contatos são públicos." />
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

        {/* Coach */}
        {coachDirectoryOn && (
          <V2Surface>
            <V2SectionHeader eyebrow="Treinador" title="Perfil de aulas e clínicas" titleClassName="text-xl"
              description="Ative para aparecer no filtro de treinadores do diretório." />
            <div className="mt-5 rounded-3xl border border-gray-100 bg-paper p-5">
              <V2Toggle id="is_coach" label="Sou treinador(a)" hint="Aparecer no filtro de treinadores e exibir informações de aula" checked={isCoach} onChange={setIsCoach} />
            </div>
            {isCoach && (
              <div className="mt-4 space-y-4">
                <V2Field label="Sobre suas aulas"><V2Textarea value={coachBio} onChange={(e) => setCoachBio(e.target.value)} maxLength={400} rows={3} placeholder="Ex.: Aulas para iniciantes e intermediários, foco em fundamentos e tática." /></V2Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <V2Field label="Valor (opcional)"><V2Input value={coachPrice} onChange={(e) => setCoachPrice(e.target.value)} maxLength={60} placeholder="Ex.: R$ 80/aula" /></V2Field>
                  <V2Field label="Regiões de atuação (opcional)"><V2Input value={coachRegions} onChange={(e) => setCoachRegions(e.target.value)} maxLength={120} placeholder="Ex.: Zona Sul, online" /></V2Field>
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <V2Button onClick={saveCoach} disabled={coachBusy}>{coachBusy ? 'Salvando…' : 'Salvar informações de treinador'}</V2Button>
            </div>
          </V2Surface>
        )}

        <V2ParticipationHistoryCard />

        {/* Leveling */}
        <V2Surface>
          <V2SectionHeader eyebrow="Nivelamento" title="Seu nível competitivo" titleClassName="text-xl"
            description="Informe pela tabela detalhada ou preencha o formulário para obter a recomendação." />
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
