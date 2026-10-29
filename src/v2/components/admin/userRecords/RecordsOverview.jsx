/**
 * Panorama dos cadastros — "em que estágio estão os cadastros", antes da
 * lista. Cada número é um ATALHO: tocar aplica o filtro correspondente, para
 * o admin ir do "tem 312 sem cidade" direto para essas 312 pessoas.
 *
 * Os números contam a base inteira (não o recorte), para não mudarem
 * enquanto se filtra.
 */
import React from 'react';
import { BarChart3 } from 'lucide-react';
import { V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { NEW_ACCOUNT_DAYS, INACTIVE_DAYS } from '@/modules/admin/domain/userRecordsView';
import { t, fmtNumero } from '@/core/i18n';

function Atalho({ valor, rotulo, dica, ativo, tom = 'gray', onClick }) {
  const tons = {
    amber: 'text-amber-800',
    green: 'text-green-700',
    blue: 'text-blue-700',
    gray: 'text-ink',
  };
  return (
    <button type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
        ativo ? 'border-ink bg-gray-50' : 'border-gray-100 hover:border-gray-300',
      )}
    >
      <span className={cn('block font-display text-2xl font-bold tabular-nums', tons[tom])}>{fmtNumero(valor)}</span>
      <span className="block text-xs font-semibold text-ink">{rotulo}</span>
      {dica && <span className="block text-2xs text-gray-500">{dica}</span>}
    </button>
  );
}

/**
 * @param {object} props
 * @param {ReturnType<import('@/modules/admin/domain/userRecordsView').recordsOverview>} props.resumo
 * @param {ReturnType<import('@/modules/admin/domain/userRecordsView').readRecordFilters>} props.filtros
 * @param {(patch: object) => void} props.onFiltrar troca o recorte (os demais filtros são limpos)
 */
export default function RecordsOverview({ resumo, filtros, onFiltrar }) {
  const r = resumo;
  const maior = r.porCampo[0]?.count || 1;
  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-ink" aria-hidden="true" />
        <h2 className="font-display text-lg font-bold text-ink">{t('Panorama dos cadastros')}</h2>
      </div>

      <div className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold text-ink">
            {t('{pct}% dos cadastros estão completos', { pct: r.completosPct })}
          </span>
          <span className="text-xs text-gray-500">
            {t('{completos} de {total}', { completos: fmtNumero(r.completos), total: fmtNumero(r.total) })}
          </span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={r.completosPct}
          aria-label={t('Cadastros completos')}
        >
          <div className="h-full rounded-full bg-green-500" style={{ width: `${r.completosPct}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Atalho
          valor={r.pendentes}
          rotulo={t('Falta obrigatório')}
          dica={t('o cadastro ainda não está em dia')}
          tom="amber"
          ativo={filtros.situacao === 'pendentes'}
          onClick={() => onFiltrar({ situacao: 'pendentes' })}
        />
        <Atalho
          valor={r.dupr}
          rotulo={t('DUPR a conferir')}
          dica={t('rating ou ID suspeito')}
          tom="amber"
          ativo={filtros.situacao === 'dupr'}
          onClick={() => onFiltrar({ situacao: 'dupr' })}
        />
        <Atalho
          valor={r.novos}
          rotulo={t('Novos')}
          dica={t('cadastrados nos últimos {n} dias', { n: NEW_ACCOUNT_DAYS })}
          tom="blue"
          ativo={filtros.atividade === 'novos'}
          onClick={() => onFiltrar({ atividade: 'novos' })}
        />
        <Atalho
          valor={r.inativos}
          rotulo={t('Sem entrar')}
          dica={t('há mais de {n} dias', { n: INACTIVE_DAYS })}
          ativo={filtros.atividade === 'inativos'}
          onClick={() => onFiltrar({ atividade: 'inativos' })}
        />
      </div>

      {r.porCampo.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('O que mais falta (obrigatório)')}</h3>
          <ul className="mt-2 space-y-1">
            {r.porCampo.map((c) => {
              const ativo = filtros.falta === c.key;
              return (
                <li key={c.key}>
                  <button type="button"
                    onClick={() => onFiltrar({ falta: c.key })}
                    aria-pressed={ativo}
                    className={cn(
                      'grid w-full grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                      ativo && 'bg-gray-50 ring-1 ring-ink',
                    )}
                  >
                    <span className="truncate font-semibold text-ink">{t(c.label)}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                      <span className="block h-full rounded-full bg-amber-500" style={{ width: `${Math.max(4, (c.count / maior) * 100)}%` }} />
                    </span>
                    <span className="tabular-nums text-gray-600">{fmtNumero(c.count)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </V2Surface>
  );
}
