/**
 * PrecisionTest — o teste de precisão da quadra, na central (docs/53 §3b).
 * Quem organiza marca no chão um ponto a uma distância conhecida da linha,
 * escolhe aqui essa distância e solta a bola sobre a marca: o próximo quique
 * que chegar vira uma tentativa. O relatório segue as faixas da ITF (Bronze).
 * Nada vai ao banco; a planilha baixa no aparelho.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Ruler, Trash2, Download, Undo2 } from 'lucide-react';
import { V2Surface, V2Button, V2Badge } from '@/v2/ui/primitives';
import { TEST_DISTANCES, MIN_PER_BAND, makeTrial, precisionReport } from '@/modules/linecall/domain/precisionTest';
import { t, tk } from '@/core/i18n';

const BAND_LABEL = { near: tk('Até 2,5 cm da linha'), mid: tk('De 2,5 a 10 cm da linha') };
const VERDICT = {
  bronze: { tone: 'green', text: tk('Bate a meta do nível Bronze da ITF nas duas faixas.') },
  below: { tone: 'amber', text: tk('Abaixo da meta do nível Bronze. Confira calibração, luz e quadros por segundo e repita.') },
  insufficient: { tone: 'neutral', text: tk('Faça pelo menos {n} lances em cada faixa para ter o resultado.') },
};
const RESULT = { right: ['green', tk('acertou')], review: ['amber', tk('revisar')], wrong: ['red', tk('errou')] };

const dist = (m) => (m >= 0 ? t('{n} cm dentro', { n: Math.round(m * 100) }) : t('{n} cm fora', { n: Math.round(-m * 100) }));
const cmText = (m) => (m === null ? '—' : t('{n} cm', { n: String(Math.round(m * 1000) / 10).replace('.', ',') }));

/** @param {{ lances: Array<object>, onCsv: (text: string) => void }} props */
export default function PrecisionTest({ lances, onCsv }) {
  const [alvo, setAlvo] = useState(null); // distância esperando o próximo quique
  const [tentativas, setTentativas] = useState([]);
  const desde = useRef(0);
  const escolher = (d) => {
    desde.current = Date.now();
    setAlvo(alvo === d ? null : d);
  };

  // Conta o quique que ACONTECEU depois de escolher a distância (pela hora do
  // lance, já no relógio desta tela): o id do lance muda quando uma câmera
  // atrasada entra na junção, e um lance antigo voltaria como novo.
  useEffect(() => {
    if (alvo === null) return;
    const novo = lances.find((l) => l.kind === 'bounce' && l.t_ms >= desde.current);
    if (!novo) return;
    setTentativas((ts) => [...ts, { ...makeTrial(alvo, novo), id: novo.id }]);
    setAlvo(null);
  }, [alvo, lances]);

  const r = precisionReport(tentativas);
  const v = VERDICT[r.verdict];
  const csv = () => onCsv([
    [t('Marca (cm)'), t('Câmeras (cm)'), t('Chamada'), t('Resultado')].join(';'),
    ...tentativas.map((x) => [Math.round(x.expected * 100), x.measured === null ? '' : Math.round(x.measured * 1000) / 10, x.call, t(RESULT[x.result][1])].join(';')),
  ].join('\n'));

  return (
    <V2Surface className="space-y-3 p-4" data-dica="linhas-central-precisao">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Ruler className="h-4 w-4" aria-hidden="true" /> {t('Teste de precisão da quadra')}
      </p>
      <p className="text-sm text-gray-600">
        {t('Marque no chão, com fita, um ponto à distância escolhida da borda de fora da linha. Escolha a distância abaixo e solte a bola da altura da cintura para quicar na marca. Repita em vários pontos das linhas de fundo, laterais e da cozinha.')}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Distância da marca')}>
        {TEST_DISTANCES.map((d) => (
          <V2Button key={d} type="button" size="sm" variant={alvo === d ? 'primary' : 'secondary'} aria-pressed={alvo === d} onClick={() => escolher(d)}>
            {dist(d)}
          </V2Button>
        ))}
      </div>
      {alvo !== null && (
        <p className="text-sm font-medium text-ink" role="status">{t('Esperando o próximo quique na marca de {d}…', { d: dist(alvo) })}</p>
      )}

      {r.n > 0 && (
        <div className="space-y-3">
          <ul className="grid gap-2 sm:grid-cols-2">
            {r.bands.map((b) => (
              <li key={b.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                <p className="font-semibold text-ink">{t(BAND_LABEL[b.id])}</p>
                <p className="text-gray-600">
                  {b.n
                    ? t('{r} de {n} certos ({p}%) · meta {g}% · {v} para revisar', { r: b.right, n: b.n, p: Math.round(b.pct * 100), g: Math.round(b.goal * 100), v: b.review })
                    : t('Nenhum lance ainda.')}
                </p>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <V2Badge tone={v.tone}>{t(v.text, { n: MIN_PER_BAND })}</V2Badge>
            {r.meanErrorCm !== null && <span className="text-gray-600">{t('Erro médio: {e}', { e: cmText(r.meanErrorCm / 100) })}</span>}
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {[...tentativas].reverse().map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2">
                <V2Badge tone={RESULT[x.result][0]}>{t(RESULT[x.result][1])}</V2Badge>
                <span className="text-ink">{t('Marca: {d}', { d: dist(x.expected) })}</span>
                <span className="text-gray-500">{t('Câmeras: {m}', { m: cmText(x.measured) })}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <V2Button type="button" size="sm" variant="ghost" onClick={() => setTentativas((ts) => ts.slice(0, -1))}>
              <Undo2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t('Desfazer o último')}
            </V2Button>
            <V2Button type="button" size="sm" variant="ghost" onClick={csv}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t('Baixar o teste')}
            </V2Button>
            <V2Button type="button" size="sm" variant="ghost" onClick={() => setTentativas([])}>
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t('Recomeçar')}
            </V2Button>
          </div>
        </div>
      )}
    </V2Surface>
  );
}
