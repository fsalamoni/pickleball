import React from 'react';
import { Server, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { V2ErrorState } from '@/v2/ui/primitives';
import { useFunctionsHealth } from '@/modules/admin/hooks/usePlatformUsers';
import { describeFunctionsHealth } from '@/modules/admin/domain/functionsHealth';
import { formatarMomento } from '@/modules/rating/domain/rankingWorkerStatus';
import { t, tn } from '@/core/i18n';
import { cn } from '@/core/lib/utils';

/**
 * "FUNÇÕES NO AR" — Painel admin → Sistema → Diagnóstico.
 *
 * Compara as funções que o código exporta com as publicadas (a vigilância,
 * a cada 30 min) e diz se o último deploy das funções deu certo. 🐞 Do #315
 * ao #321 o passo de deploy das funções (não fatal) falhou calado: o site e
 * as regras saíram, as funções novas da federação não, e nada avisou.
 * Leitura que falha é dita, nunca "tudo certo".
 */
function Link({ href, children }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink underline">
      {children}<ExternalLink aria-hidden="true" className="h-3 w-3" />
    </a>
  );
}

export default function FunctionsHealthCard() {
  const { data, isLoading, isError, refetch } = useFunctionsHealth();
  if (isLoading) return null;
  if (isError) {
    return <V2ErrorState inline title={t('Não deu para ler o registro das funções')} onRetry={refetch} className="sm:col-span-2" />;
  }
  const { estado, conferencia: c, deploy: d } = describeFunctionsHealth(data, Date.now());
  const atencao = estado === 'atencao';
  return (
    <div className={cn('rounded-[1.25rem] border p-4 sm:col-span-2', atencao ? 'border-amber-200 bg-amber-50/60' : 'border-gray-100 bg-paper-pure')}>
      <div className="flex items-center gap-2">
        <Server aria-hidden="true" className="h-4 w-4 text-gray-500" />
        <span className="font-semibold text-ink">{t('Funções no ar')}</span>
        {estado === 'ok' && <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check aria-hidden="true" className="h-3.5 w-3.5" />{t('Tudo publicado')}</span>}
        {atencao && <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />{t('Precisa de atenção')}</span>}
      </div>

      {estado === 'sem_registro' && (
        <p className="mt-2 text-xs leading-5 text-gray-500">
          {t('Ainda não há registro. A vigilância (a cada 30 minutos) e o próximo deploy gravam aqui o que encontraram.')}
        </p>
      )}

      {c && (
        <div className="mt-2 space-y-1 text-xs leading-5 text-gray-600">
          <p>
            <strong className="text-ink">{t('Última conferência:')}</strong> {formatarMomento(c.ms)}
            {' · '}{t('{p} de {e} funções publicadas', { p: c.publicadas, e: c.esperadas })}
            {' '}<Link href={c.runUrl}>{t('ver execução')}</Link>
          </p>
          {c.velha && <p className="text-amber-700">{t('A vigilância não confere há mais de 90 minutos. Veja se o fluxo “Vigilância das Cloud Functions” está rodando no GitHub.')}</p>}
          {c.faltando.length > 0 && (
            <p className="text-amber-700">
              {tn(c.faltando.length, '{n} função faltando:', '{n} funções faltando:')} <span className="font-mono">{c.faltando.join(', ')}</span>
              {'. '}{t('A vigilância tenta publicar de novo sozinha.')}
            </p>
          )}
          {c.semRotulo.length > 0 && <p>{t('Sem o codebase próprio (reetiquetadas no próximo deploy):')} <span className="font-mono">{c.semRotulo.join(', ')}</span></p>}
        </div>
      )}

      {d && (
        <div className="mt-2 space-y-1 text-xs leading-5 text-gray-600">
          <p>
            <strong className="text-ink">{t('Último deploy das funções:')}</strong> {formatarMomento(d.ms)}
            {' · '}{d.ok ? t('deu certo') : <span className="font-semibold text-amber-700">{t('falhou')}</span>}
            {d.commit ? <span className="font-mono"> · {d.commit}</span> : null}
            {' '}<Link href={d.runUrl}>{t('ver execução')}</Link>
          </p>
          {!d.ok && (
            <>
              {d.erro && <p className="break-words font-mono text-[11px] text-amber-800">{d.erro}</p>}
              <p>
                {d.ultimoOkMs ? t('O último que deu certo foi em {quando}; as funções seguem nessa versão.', { quando: formatarMomento(d.ultimoOkMs) }) : t('As funções seguem na versão anterior.')}
                {' '}{t('O site e as regras não dependem disso.')}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
