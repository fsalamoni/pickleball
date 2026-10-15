/**
 * Os avisos de aceite: "Antes de continuar" (plataforma) e "Antes de entrar no
 * Mercado". Os dois leem de cima para baixo, numa ordem só: os documentos
 * numerados, cada um abrindo o texto ali mesmo (`<details>` — nativo, sem
 * estado nem outra aba), e o botão de aceite POR ÚLTIMO, sem nada depois.
 *
 * 🐞 Antes cada documento tinha uma caixa, o botão só acendia com todas
 * marcadas e ficava preso no rodapé enquanto a lista rolava por trás: no
 * celular a pessoa via "2 de 4" com o botão apagado e termos abaixo dele.
 * Agora um toque no botão aceita os documentos acima (a frase diz isso), e a
 * rolagem é uma só — a da página ou a da camada inteira.
 */
import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { legalDocTranslation } from '@/modules/legal/domain/legalTranslation';
import { V2BulletList, V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

/** Os documentos, em ordem; tocar no título abre o texto no lugar. */
export function ConsentDocs({ pending, traducoes }) {
  return (
    <ol className="space-y-3">
      {pending.map((d, i) => {
        const visto = legalDocTranslation(d, traducoes);
        const texto = visto || d;
        return (
          <li key={d.key}>
            <details className="group rounded-2xl border border-gray-100 bg-paper open:border-ink/20">
              <summary className="flex cursor-pointer list-none items-start gap-3 p-3 coarse:min-h-11 [&::-webkit-details-marker]:hidden">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-acid" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{texto.title}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{texto.description}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 self-center text-xs font-semibold text-ink">
                  <span className="group-open:hidden">{t('Ler')}</span>
                  <span className="hidden group-open:inline">{t('Fechar')}</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <div className="border-t border-gray-100 px-3 pb-4 sm:px-4">
                {visto && (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    {t('Esta é uma tradução de cortesia. Em caso de divergência, prevalece a versão em português.')}
                  </p>
                )}
                {texto.sections.map((s, j) => (
                  <section key={j} className="mt-4 space-y-2 text-sm text-gray-700">
                    <h4 className="font-semibold text-ink">{s.title}</h4>
                    {s.description && <p className="text-gray-500">{s.description}</p>}
                    {(s.paragraphs || []).map((p, k) => <p key={k}>{p}</p>)}
                    {s.bullets?.length > 0 && <V2BulletList items={s.bullets} />}
                  </section>
                ))}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

/** O fim do aviso: o que o toque significa e o botão. Nada vem depois dele. */
export function ConsentAccept({ acceptLabel, onAccept, busy }) {
  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      <p className="text-center text-xs text-gray-500">
        {t('Ao selecionar “{botao}”, você declara que leu e aceita os documentos acima. O aceite fica registrado com data e versão.', { botao: acceptLabel })}
      </p>
      <V2Button type="button" className="w-full" onClick={onAccept} disabled={busy}>
        {busy ? t('Registrando…') : acceptLabel}
      </V2Button>
    </div>
  );
}

/**
 * O aviso que cobre a plataforma inteira (os essenciais). A camada é que rola,
 * com o cartão na altura do conteúdo. `pointer-events-auto` porque um diálogo
 * do Radix que abra por baixo desliga os toques no `body`.
 */
export default function ConsentNotice({ id, icon: Icon, title, subtitle, pending, traducoes, acceptLabel, onAccept, busy }) {
  const caixa = useRef(null);
  // O foco entra no aviso (leitor de tela e teclado começam por ele).
  useEffect(() => { caixa.current?.focus(); }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={id}
      className="pointer-events-auto fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-ink/70 p-4 backdrop-blur-sm"
    >
      <div
        ref={caixa}
        tabIndex={-1}
        className="mx-auto my-4 w-full max-w-lg space-y-4 rounded-4xl bg-paper-pure p-4 shadow-organic outline-none sm:my-10 sm:p-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id={id} className="font-display text-xl font-bold text-ink">{title}</h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
        <ConsentDocs pending={pending} traducoes={traducoes} />
        <ConsentAccept acceptLabel={acceptLabel} onAccept={onAccept} busy={busy} />
      </div>
    </div>
  );
}
