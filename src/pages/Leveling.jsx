import { useState } from 'react';
import { toast } from 'sonner';
import { Award } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import LevelTable from '@/modules/leveling/components/LevelTable';
import LevelingQuestionnaire from '@/modules/leveling/components/LevelingQuestionnaire';

export default function Leveling() {
  const [tab, setTab] = useState('formulario');
  const { isAuthenticated, updateUserProfile, userProfile } = useAuth();
  const savedAssessment = userProfile?.leveling_assessment;

  async function saveAssessment({ answers, result }) {
    if (!isAuthenticated) return;
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
      toast.success('Nivelamento salvo no seu perfil.');
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar o nivelamento.');
    }
  }

  async function saveDraft({ answers, result }) {
    if (!isAuthenticated) {
      toast.info('Entre na sua conta para salvar suas respostas permanentemente.');
      return;
    }
    await saveAssessment({ answers, result });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="arena-heading flex items-center gap-2 text-2xl font-bold">
              <Award className="h-6 w-6 text-emerald-600" /> Nivelamento de Pickleball
            </h1>
            <div className="flex gap-2">
              <Button size="sm" variant={tab === 'formulario' ? 'default' : 'outline'} onClick={() => setTab('formulario')}>Formulário</Button>
              <Button size="sm" variant={tab === 'tabela' ? 'default' : 'outline'} onClick={() => setTab('tabela')}>Tabela</Button>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Formulário comportamental importado da plataforma de nivelamento, direto na avaliação e com tabela detalhada de níveis USAP adaptados ao Brasil.
          </p>
          {!isAuthenticated && (
            <p className="mt-2 text-xs text-amber-700">
              Você pode preencher sem login, mas entre na sua conta para salvar permanentemente respostas e resultado no seu perfil.
            </p>
          )}
        </CardContent>
      </Card>

      {tab === 'tabela' ? (
        <LevelTable />
      ) : (
        <LevelingQuestionnaire
          initialAnswers={savedAssessment?.answers}
          onComplete={saveAssessment}
          onSaveDraft={saveDraft}
          saveLabel="Salvar rascunho no perfil"
        />
      )}
    </div>
  );
}
