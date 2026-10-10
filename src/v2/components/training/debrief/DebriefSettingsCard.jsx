/**
 * Configurações → Balanço do jogo: liga ou desliga, para a pessoa, as
 * perguntas depois de jogar. Some sem as duas flags (treino + balanço).
 * Link direto: `/configuracoes#balanco-do-jogo`.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ClipboardCheck } from 'lucide-react';
import { useDebriefActions, useDebriefSettings } from '@/modules/training/hooks/useDebriefs';
import { V2Button, V2ErrorState, V2Surface, V2Toggle } from '@/v2/ui/primitives';

export default function DebriefSettingsCard() {
  const s = useDebriefSettings();
  const { setEnabled } = useDebriefActions(s.uid);
  if (!s.available) return null;

  return (
    <V2Surface id="balanco-do-jogo" data-dica="config-balanco" className="scroll-mt-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Balanço do jogo</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Depois de um dia de jogo, torneio ou jogo na arena, a plataforma pergunta como foi e sugere drills para a semana.
        Você decide se eles entram nos seus treinos. Só você vê as respostas.
      </p>
      <div className="mt-4">
        {s.isError ? (
          <V2ErrorState inline title="Não deu para saber se está ligado" onRetry={() => s.refetch()} />
        ) : (
          <V2Toggle
            id="config-balanco-ligado"
            checked={s.enabled}
            label={s.enabled ? 'Ligado para mim' : 'Desligado'}
            hint={s.enabled ? 'Os jogos dos últimos 7 dias aparecem na aba Balanço do treino e no início.' : 'Ligando, só os próximos jogos pedem balanço.'}
            onChange={(on) => {
              if (s.isLoading || setEnabled.isPending) return;
              setEnabled.mutate(on, {
                onSuccess: () => toast.success(on ? 'Balanço do jogo ligado.' : 'Balanço do jogo desligado.'),
                onError: () => toast.error('Não foi possível salvar agora. Tente de novo.'),
              });
            }}
          />
        )}
      </div>
      {s.enabled && (
        <div className="mt-3">
          <V2Button asChild variant="secondary" size="sm"><Link to="/treino?aba=balanco">Abrir os balanços</Link></V2Button>
        </div>
      )}
    </V2Surface>
  );
}
