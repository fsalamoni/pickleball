/**
 * V2TutorialLauncher — o botão "Como funciona" e o tutorial que ele abre.
 *
 * Um componente só para a tela usar numa linha:
 *
 *   <V2TutorialLauncher tutorialId={TUTORIAL_ID.TOURNAMENT} />
 *
 * Ele cuida de tudo: mostra o tutorial na PRIMEIRA vez que a pessoa abre
 * aquela ferramenta, deixa DISPENSAR, e mantém o botão ali para REVER quando
 * quiser. O conteúdo vem de `modules/help/domain/tutorials.js`.
 *
 * ## Onde fica a memória (e por que não no banco)
 *
 * "Esta pessoa já viu este tutorial" é preferência de interface, não dado do
 * produto. Vai para o `localStorage` por usuário
 * (`v2:view:<uid>:tutorial:<id>`), pelo mesmo caminho das outras preferências
 * de tela. **Nada aqui toca o Firestore.**
 *
 * ## A armadilha do modal que reaparece
 *
 * Já aconteceu nesta plataforma: um modal de onboarding que voltava toda
 * sessão porque a trava era só de sessão. Aqui a abertura automática é
 * LATCHEADA por um ref — dentro de uma mesma montagem ela acontece no máximo
 * uma vez — e a marca de "já viu" é gravada por usuário, não por sessão nem
 * por navegador inteiro.
 *
 * Fechar de qualquer jeito (X, "Entendi", clicar fora) marca como visto. A
 * intenção de quem fecha é sempre a mesma: "não precisa me mostrar isso de
 * novo sozinho". Rever continua a um clique.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GraduationCap, ChevronLeft, ChevronRight, Lightbulb, Check } from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Button } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { getTutorial } from '@/modules/help/domain/tutorials';
import { cn } from '@/core/lib/utils';

/** Prefixo da preferência. Junto com o id do tutorial, é o CONTRATO da memória. */
const PREF_PREFIX = 'tutorial:';

/** Chave de "já viu" de um tutorial. */
export function tutorialPrefId(tutorialId) {
  return `${PREF_PREFIX}${tutorialId}`;
}

/** Esta pessoa já viu (e dispensou) este tutorial? */
export function tutorialJaVisto(uid, tutorialId) {
  return readViewPreference(uid, tutorialPrefId(tutorialId)) === '1';
}

/* --------------------------------------------------------------- o diálogo */

function PassoAtual({ passo }) {
  return (
    <div className="space-y-3">
      {passo.body.map((paragrafo) => (
        <p key={paragrafo.slice(0, 40)} className="text-sm leading-6 text-gray-600">
          {paragrafo}
        </p>
      ))}
      {passo.tip && (
        <p className="flex items-start gap-2 rounded-2xl bg-paper px-3.5 py-2.5 text-xs leading-5 text-gray-600">
          <Lightbulb aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acid-dark" />
          <span>{passo.tip}</span>
        </p>
      )}
    </div>
  );
}

/** Bolinhas de progresso — e atalho para pular direto a um passo. */
function Progresso({ total, atual, onIr }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Passos do tutorial">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === atual}
          aria-label={`Passo ${i + 1} de ${total}`}
          onClick={() => onIr(i)}
          className={cn(
            'h-2 rounded-full transition-all',
            i === atual ? 'w-6 bg-ink' : 'w-2 bg-gray-200 hover:bg-gray-300',
          )}
        />
      ))}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.tutorialId id em `TUTORIAL_ID`
 * @param {string} [props.label='Como funciona'] texto do botão
 * @param {boolean} [props.autoOpen=true] abre sozinho na primeira vez
 * @param {string} [props.variant='ghost'] variante do botão
 * @param {string} [props.size='sm']
 */
export default function V2TutorialLauncher({
  tutorialId, label = 'Como funciona', autoOpen = true, variant = 'ghost', size = 'sm',
}) {
  const { user } = useAuth();
  const tutorial = useMemo(() => getTutorial(tutorialId), [tutorialId]);

  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  // Trava da abertura automática: dentro de uma montagem, no máximo uma vez.
  const jaTentouAbrir = useRef(false);

  useEffect(() => {
    if (!autoOpen || !tutorial) return;
    if (jaTentouAbrir.current) return;
    jaTentouAbrir.current = true;
    if (!tutorialJaVisto(user?.uid, tutorial.id)) {
      setPasso(0);
      setAberto(true);
    }
  }, [autoOpen, tutorial, user?.uid]);

  // Id desconhecido: não oferece nada em vez de quebrar a tela.
  if (!tutorial) return null;

  const total = tutorial.steps.length;
  const ultimo = passo >= total - 1;

  /** Fechar de qualquer jeito significa "não me mostre sozinho de novo". */
  const fechar = () => {
    writeViewPreference(user?.uid, tutorialPrefId(tutorial.id), '1');
    setAberto(false);
  };

  const abrir = () => { setPasso(0); setAberto(true); };

  return (
    <>
      <V2Button variant={variant} size={size} onClick={abrir}>
        <GraduationCap className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {label}
      </V2Button>

      <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
        {/* `max-h-[90dvh] overflow-y-auto`: sem isto, em tablet deitado o
            rodapé com os botões fica fora da tela e o tutorial não fecha. */}
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Passo {passo + 1} de {total}
            </p>
            <DialogTitle>{tutorial.steps[passo].title}</DialogTitle>
            <DialogDescription>
              {passo === 0 ? tutorial.subtitle : tutorial.title}
            </DialogDescription>
          </DialogHeader>

          <PassoAtual passo={tutorial.steps[passo]} />

          <div className="mt-4">
            <Progresso total={total} atual={passo} onIr={setPasso} />
          </div>

          <DialogFooter className="mt-2 flex-row items-center justify-between gap-2 sm:justify-between">
            <V2Button variant="ghost" size="sm" onClick={fechar}>
              {ultimo ? 'Fechar' : 'Dispensar'}
            </V2Button>

            <div className="flex items-center gap-2">
              {/* "Anterior" em `subtle`: voltar é ação secundária e não pode
                  competir visualmente com "Próximo". */}
              {passo > 0 && (
                <V2Button variant="subtle" size="sm" onClick={() => setPasso((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
                </V2Button>
              )}
              {ultimo ? (
                <V2Button size="sm" onClick={fechar}>
                  <Check className="mr-1.5 h-4 w-4" aria-hidden="true" /> Entendi
                </V2Button>
              ) : (
                <V2Button size="sm" onClick={() => setPasso((p) => p + 1)}>
                  Próximo <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </V2Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
