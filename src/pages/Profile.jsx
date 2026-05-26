import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Award, Printer, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { birthDateToBrtDate, validateRequiredProfile } from '@/core/lib/profileValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LEVEL_OPTIONS, getLevelByCode } from '@/modules/leveling/data/levels';
import { calculateAssessment } from '@/modules/leveling/domain/questionnaire';
import LevelingQuestionnaire from '@/modules/leveling/components/LevelingQuestionnaire';
import LevelingResultCard from '@/modules/leveling/components/LevelingResultCard';
import { PICKLEBALL_EXPERIENCE_LABELS, COMPETITION_GENDER_LABELS } from '@/modules/tournament/domain/constants';

export default function Profile() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const [platformName, setPlatformName] = useState(userProfile?.platform_name || userProfile?.full_name || '');
  const [birthDate, setBirthDate] = useState(userProfile?.birth_date || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [pickleballExperience, setPickleballExperience] = useState(userProfile?.pickleball_experience || '');
  const [competitionGender, setCompetitionGender] = useState(userProfile?.competition_gender || '');
  const [manualLevel, setManualLevel] = useState(userProfile?.leveling_level || '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [levelBusy, setLevelBusy] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [formVersion, setFormVersion] = useState(0);
  const [visibleResult, setVisibleResult] = useState(userProfile?.leveling_assessment?.result || null);

  const savedAssessment = userProfile?.leveling_assessment;
  const savedAnswers = savedAssessment?.answers;
  const selectedLevel = useMemo(() => getLevelByCode(manualLevel), [manualLevel]);

  useEffect(() => {
    setPlatformName(userProfile?.platform_name || userProfile?.full_name || '');
    setBirthDate(userProfile?.birth_date || '');
    setPhone(userProfile?.phone || '');
    setPickleballExperience(userProfile?.pickleball_experience || '');
    setCompetitionGender(userProfile?.competition_gender || '');
    setManualLevel(userProfile?.leveling_level || '');
    setVisibleResult(userProfile?.leveling_assessment?.result || null);
    setErrors({});
  }, [
    userProfile?.uid,
    userProfile?.platform_name,
    userProfile?.full_name,
    userProfile?.birth_date,
    userProfile?.phone,
    userProfile?.pickleball_experience,
    userProfile?.competition_gender,
    userProfile?.leveling_level,
    userProfile?.leveling_assessment,
  ]);

  const onSave = async (e) => {
    e.preventDefault();
    const validation = validateRequiredProfile({ platformName, birthDate, phone, pickleballExperience });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

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
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  const saveManualLevel = async () => {
    if (!manualLevel) {
      toast.error('Selecione um nível.');
      return;
    }
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
        leveling_assessment: {
          version: 'pickleball-nivelamento-104',
          answers,
          result,
          updated_at: new Date().toISOString(),
        },
      });
      setManualLevel(result.level);
      setVisibleResult(result);
      toast.success('Formulário e resultado salvos permanentemente no seu perfil.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar formulário.');
    } finally {
      setLevelBusy(false);
    }
  };

  const regenerateResultFromSavedAnswers = async () => {
    if (!savedAnswers) {
      toast.error('Não há respostas salvas para gerar o resultado.');
      return;
    }
    await saveAssessment({ answers: savedAnswers, result: calculateAssessment(savedAnswers) });
  };

  const startFromScratch = () => {
    setVisibleResult(null);
    setFormMode('scratch');
    setFormVersion((version) => version + 1);
  };

  const startFromSaved = () => {
    setVisibleResult(null);
    setFormMode('saved');
    setFormVersion((version) => version + 1);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
            <UserCheck className="h-5 w-5" />
          </div>
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Conta e elegibilidade</p>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Meu Perfil</h1>
            <p className="text-sm leading-6 text-emerald-50/85">Como você aparece para os outros participantes dos torneios.</p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Dados do participante</CardTitle>
          <CardDescription>Atualize nome público, data de nascimento, telefone e experiência no pickleball.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-6 flex items-center gap-4 rounded-md border border-emerald-950/10 bg-gradient-to-br from-white/85 to-emerald-50/70 p-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full border border-emerald-900/10" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-900 text-2xl font-semibold text-emerald-50">
                {(platformName || user?.email)?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-medium">{user?.email}</div>
              <div className="text-xs text-slate-500">Login via Google</div>
            </div>
          </div>

          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Nome de exibição</Label>
              <Input
                id="platform_name"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                maxLength={60}
                required
              />
              {errors.platformName && <p className="text-xs text-red-600">{errors.platformName}</p>}
              <p className="text-xs text-slate-500">Esse é o nome que aparece nos rankings.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birth_date">Data de nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                />
                {errors.birthDate && <p className="text-xs text-red-600">{errors.birthDate}</p>}
                <p className="text-xs text-slate-500">Obrigatória para validar participação.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                />
                {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
                <p className="text-xs text-slate-500">Use DDD e numero para contato.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickleball_experience">Tempo de experiência em pickleball</Label>
              <select
                id="pickleball_experience"
                value={pickleballExperience}
                onChange={(e) => setPickleballExperience(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecione uma opção</option>
                {Object.entries(PICKLEBALL_EXPERIENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {errors.pickleballExperience && <p className="text-xs text-red-600">{errors.pickleballExperience}</p>}
              <p className="text-xs text-slate-500">Usado como informação complementar para organização das categorias.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="competition_gender">Categoria em que deseja competir</Label>
              <select
                id="competition_gender"
                value={competitionGender}
                onChange={(e) => setCompetitionGender(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Não informar (decido na inscrição)</option>
                {Object.entries(COMPETITION_GENDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Trata-se exclusivamente de uma preferência competitiva (em qual chave você quer
                jogar) — não é uma pergunta sobre identidade de gênero. Usada para sugerir
                automaticamente as modalidades elegíveis (masculino, feminino, dupla mista, etc.)
                em torneios que tenham categorias separadas.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-100/80 p-3 text-sm text-amber-950">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Não é permitida a participação de menores em torneios.</span>
            </div>
            <Button type="submit" disabled={busy} className="bg-emerald-700 hover:bg-emerald-800">
              {busy ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="flex items-center gap-2 text-base text-slate-950">
            <Award className="h-5 w-5 text-emerald-700" /> Nivelamento
          </CardTitle>
          <CardDescription>Informe seu nível pela tabela detalhada ou preencha o formulário para obter a recomendação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="leveling_level">Meu nível informado</Label>
              <select
                id="leveling_level"
                value={manualLevel}
                onChange={(e) => setManualLevel(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecione um nível</option>
                {LEVEL_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
              {selectedLevel && <p className="text-xs text-slate-600">{selectedLevel.tagline}</p>}
            </div>
            <Button type="button" onClick={saveManualLevel} disabled={levelBusy} className="bg-emerald-700 hover:bg-emerald-800">
              Salvar nível
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={startFromScratch}>Preencher formulário do zero</Button>
            <Button type="button" variant="outline" onClick={startFromSaved} disabled={!savedAnswers}>Refazer com respostas anteriores</Button>
            <Button type="button" variant="outline" onClick={regenerateResultFromSavedAnswers} disabled={!savedAnswers || levelBusy}>Gerar resultado salvo</Button>
            <Button type="button" variant="outline" onClick={() => window.print()} disabled={!visibleResult}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir nivelamento
            </Button>
          </div>

          {visibleResult && <LevelingResultCard result={visibleResult} compact />}

          {formMode && (
            <div className="border-t pt-5">
              <LevelingQuestionnaire
                key={`${formMode}-${formVersion}`}
                initialAnswers={formMode === 'saved' ? savedAnswers : null}
                onComplete={saveAssessment}
                onSaveDraft={saveAssessment}
                saveLabel="Salvar respostas no perfil"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
