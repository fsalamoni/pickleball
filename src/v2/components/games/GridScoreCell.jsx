import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Button } from '@/v2/ui/primitives';
import SetScoreEditor from '@/v2/components/games/SetScoreEditor';
import { resultFromSets, setsForEdit, setsText, hasSets } from '@/modules/games/domain/gameSets';
import { t } from '@/core/i18n';

/**
 * O placar de um jogo na LISTA da grade (Americano e os demais formatos de
 * grade, no atleta, na arena e no clube legado).
 *
 * Um set (a regra): os dois campos de sempre, gravados ao sair do campo. Ao
 * lado, "Sets" abre o lançamento por sets; um jogo lançado por sets mostra o
 * resultado (2 × 1 · 11-9 · 9-11 · 11-7) e toca-se nele para corrigir.
 *
 * `onSave(updates)` recebe os campos do jogo prontos (`score_*`, `sets`,
 * `points_*`), pela mesma regra do serviço (`resultFromSets`).
 */
export default function GridScoreCell({ game, disabled = false, onSave }) {
  const [a, setA] = useState(game.score_a ?? '');
  const [b, setB] = useState(game.score_b ?? '');
  const [aberto, setAberto] = useState(false);
  useEffect(() => { setA(game.score_a ?? ''); setB(game.score_b ?? ''); }, [game.score_a, game.score_b]);

  const salvarUmSet = () => {
    const score_a = a === '' ? null : Number(a);
    const score_b = b === '' ? null : Number(b);
    if (score_a === game.score_a && score_b === game.score_b) return;
    onSave({ score_a, score_b });
  };

  const porSets = hasSets(game);
  return (
    <div className="flex items-center gap-1">
      {porSets ? (
        <button
          type="button"
          onClick={() => !disabled && setAberto(true)}
          disabled={disabled}
          className="flex flex-col items-center rounded-md px-2 py-0.5 hover:bg-gray-50 disabled:cursor-default"
          title={disabled ? undefined : t('Corrigir os sets')}
          aria-label={t('Placar por sets {a} a {b}: {sets}', { a: game.score_a, b: game.score_b, sets: setsText(game) })}
        >
          <span className="font-bold tabular-nums text-ink">{game.score_a} × {game.score_b}</span>
          <span className="text-2xs tabular-nums text-gray-500">{setsText(game)}</span>
        </button>
      ) : (
        <>
          <Input type="number" min={0} value={a} onChange={(e) => setA(e.target.value)} onBlur={salvarUmSet}
            disabled={disabled} className="h-8 w-12 px-1 text-center tabular-nums" aria-label={t('Placar lado A')} />
          <span className="text-xs text-gray-500">×</span>
          <Input type="number" min={0} value={b} onChange={(e) => setB(e.target.value)} onBlur={salvarUmSet}
            disabled={disabled} className="h-8 w-12 px-1 text-center tabular-nums" aria-label={t('Placar lado B')} />
          {!disabled && (
            <button
              type="button"
              onClick={() => setAberto(true)}
              className="ml-0.5 flex h-7 items-center gap-0.5 rounded-md px-1.5 text-2xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-ink"
              title={t('Lançar por sets')}
              aria-label={t('Lançar por sets')}
            >
              <Layers className="h-3 w-3" /> {t('Sets')}
            </button>
          )}
        </>
      )}
      {aberto && (
        <SetsDialog
          game={{ ...game, score_a: a === '' ? game.score_a : Number(a), score_b: b === '' ? game.score_b : Number(b) }}
          comecarComDois={!porSets}
          onClose={() => setAberto(false)}
          onSave={(updates) => { setAberto(false); onSave(updates); }}
        />
      )}
    </div>
  );
}

function SetsDialog({ game, comecarComDois, onClose, onSave }) {
  const [sets, setSets] = useState(() => {
    const atuais = setsForEdit(game);
    return comecarComDois ? [...atuais, { a: '', b: '' }] : atuais;
  });
  const r = resultFromSets(sets, { allowEmpty: true });
  const nomes = (side) => (side || []).map((p) => p?.name || p).join(' / ') || '—';
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Placar por sets')}</DialogTitle>
          <DialogDescription>
            {t('{a} contra {b}. Vence quem ganhou mais sets; os pontos de todos os sets contam no saldo. Remova sets até sobrar um para voltar ao placar simples.', { a: nomes(game.side_a), b: nomes(game.side_b) })}
          </DialogDescription>
        </DialogHeader>
        <SetScoreEditor value={sets} onChange={setSets} />
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button disabled={!r.ok} onClick={() => onSave(r.fields)}>{t('Salvar')}</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
