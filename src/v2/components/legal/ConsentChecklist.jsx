/**
 * O miolo dos dois avisos de aceite (plataforma e Mercado): cada documento com
 * a caixa de "li e concordo" e o "Ler documento", que abre o texto AQUI DENTRO.
 * Antes o documento abria em outra aba — no celular (e no app instalado) isso
 * tirava a pessoa do aviso, e na aba nova o aviso da plataforma cobria o
 * próprio documento. Lido, "Li e concordo" marca a caixa e volta à lista.
 *
 * É a área que rola; quem a usa põe o cabeçalho e o botão de aceite em volta,
 * sempre à vista.
 */
import React, { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { legalDocTranslation } from '@/modules/legal/domain/legalTranslation';
import { V2BulletList, V2Button } from '@/v2/ui/primitives';
import { legalIcon } from './legalIcons';
import { t } from '@/core/i18n';

export default function ConsentChecklist({ pending, traducoes, checked, onCheck, describe, children }) {
  const [lendo, setLendo] = useState(null);
  const rolagem = useRef(null);
  // Abrir ou fechar um documento começa do topo da área (não do meio do anterior).
  useEffect(() => { if (rolagem.current) rolagem.current.scrollTop = 0; }, [lendo]);
  const aberto = lendo && pending.find((d) => d.key === lendo);

  return (
    <div ref={rolagem} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
      {aberto ? (
        <Documento
          doc={aberto}
          visto={legalDocTranslation(aberto, traducoes)}
          onVoltar={() => setLendo(null)}
          onConcordo={() => { onCheck(aberto.key, true); setLendo(null); }}
        />
      ) : (
        <div className="space-y-3">
          {children}
          {pending.map((d) => {
            const Icon = legalIcon(d.icon);
            const visto = legalDocTranslation(d, traducoes) || d;
            return (
              <div key={d.key} className={cn('rounded-2xl border bg-paper', checked[d.key] ? 'border-ink/30' : 'border-gray-100')}>
                <label className="flex cursor-pointer items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={!!checked[d.key]}
                    onChange={(e) => onCheck(d.key, e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-1.5 font-semibold text-ink">
                      <Icon className="mt-1 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" /> {visto.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">{describe(d, visto)}</span>
                  </span>
                </label>
                <button type="button"
                  onClick={() => setLendo(d.key)}
                  className="flex min-h-9 w-full items-center gap-1.5 border-t border-gray-100 px-3 text-xs font-semibold text-ink underline-offset-2 hover:underline coarse:min-h-11"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" /> {t('Ler documento')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Abaixo do botão de aceite: quantos documentos faltam. No celular a lista
 * pode começar fora da vista, e um botão apagado sem dizer o porquê parece
 * travado.
 */
export function AceiteProgresso({ pending, checked }) {
  const feitos = pending.filter((d) => checked[d.key]).length;
  return (
    <p className="text-center text-2xs text-gray-500" aria-live="polite">
      {feitos < pending.length
        ? t('Marque os {total} documentos para continuar: {feitos} de {total}.', { feitos, total: pending.length })
        : t('O aceite fica registrado com data e versão.')}
    </p>
  );
}

function Documento({ doc, visto, onVoltar, onConcordo }) {
  const texto = visto || doc;
  return (
    <article>
      <button type="button"
        onClick={onVoltar}
        className="-ml-1 mb-3 inline-flex min-h-9 items-center px-1 text-sm font-semibold text-ink underline underline-offset-2 coarse:min-h-11"
      >
        {t('Voltar aos termos')}
      </button>
      <h3 className="font-display text-lg font-bold text-ink">{texto.title}</h3>
      {visto && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          {t('Esta é uma tradução de cortesia. Em caso de divergência, prevalece a versão em português.')}
        </p>
      )}
      {texto.sections.map((s, i) => (
        <section key={i} className="mt-4 space-y-2 text-sm text-gray-700">
          <h4 className="font-semibold text-ink">{s.title}</h4>
          {s.description && <p className="text-gray-500">{s.description}</p>}
          {(s.paragraphs || []).map((p, j) => <p key={j}>{p}</p>)}
          {s.bullets?.length > 0 && <V2BulletList items={s.bullets} />}
        </section>
      ))}
      <V2Button type="button" className="mt-6 w-full" onClick={onConcordo}>{t('Li e concordo')}</V2Button>
    </article>
  );
}
