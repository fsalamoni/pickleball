import React, { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import V2LevelTable from '@/v2/components/leveling/V2LevelTable';
import { V2LevelingQuestionnaire } from '@/v2/components/leveling/V2LevelingQuestionnaire';
import { V2ContentHero, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

export default function V2Leveling() {
  const [tab, setTab] = useState('formulario');
  const { isAuthenticated, updateUserProfile, userProfile } = useAuth();
  const savedAnswers = userProfile?.leveling_assessment?.answers;

  async function saveAssessment({ answers, result }) {
    if (!isAuthenticated) return;
    try {
      await updateUserProfile({
        level: result.levelName,
        leveling_level: result.level,
        leveling_method: 'form',
        leveling_assessment: { version: 'pickleball-nivelamento-104', answers, result, updated_at: new Date().toISOString() },
      });
      toast.success('Nivelamento salvo no seu perfil.');
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar o nivelamento.');
    }
  }

  async function saveDraft({ answers, result }) {
    if (!isAuthenticated) { toast.info('Entre na sua conta para salvar suas respostas permanentemente.'); return; }
    await saveAssessment({ answers, result });
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <V2ContentHero
        eyebrow="Sobre o esporte"
        title="Nivelamento de Pickleball"
        description="Formulário comportamental de avaliação e tabela detalhada de níveis USAP adaptados ao Brasil."
      />

      <div className="mb-6 inline-flex rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
        <button type="button" onClick={() => setTab('formulario')}
          className={cn('rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', tab === 'formulario' ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
          Formulário
        </button>
        <button type="button" onClick={() => setTab('tabela')}
          className={cn('rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', tab === 'tabela' ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
          Tabela
        </button>
      </div>

      {!isAuthenticated && (
        <V2Surface className="mb-6 border-amber-200 bg-amber-50" contentClassName="p-4">
          <p className="text-sm text-amber-800">Entre na sua conta para salvar o resultado do nivelamento permanentemente no seu perfil.</p>
        </V2Surface>
      )}

      {tab === 'formulario' ? (
        <V2Surface className="p-4 sm:p-6">
          <V2LevelingQuestionnaire
            initialAnswers={savedAnswers}
            onComplete={saveAssessment}
            onSaveDraft={saveDraft}
            saveLabel="Salvar nível no perfil"
          />
        </V2Surface>
      ) : (
        <V2Surface className="p-4 sm:p-6">
          <V2LevelTable />
        </V2Surface>
      )}
    </div>
  );
}
