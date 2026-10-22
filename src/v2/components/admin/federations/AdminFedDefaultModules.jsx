/**
 * Painel admin → Federações → Configuração → Módulos iniciais: os módulos
 * que já nascem ligados quando a plataforma APROVA uma federação pela
 * primeira vez (`platform_settings/federations.default_modules`; o servidor
 * aplica em `federationReview`). Depois disso a federação liga e desliga o
 * que quiser em Configurações → Módulos; mudar aqui não mexe em federação já
 * aprovada.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Blocks } from 'lucide-react';
import { useFederationPlatformSettings, useSaveFederationPlatformCatalog } from '@/modules/federations/hooks/useFederations';
import { normalizeDefaultModules } from '@/modules/federations/domain/platformCatalog';
import { FED_MODULE_META } from '@/modules/federations/domain/constants';
import { V2Button, V2ErrorState, V2Skeleton, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function AdminFedDefaultModules() {
  const q = useFederationPlatformSettings();
  const salvar = useSaveFederationPlatformCatalog('default_modules');
  const [mapa, setMapa] = useState(null);
  useEffect(() => { if (q.isSuccess && mapa == null) setMapa(q.defaultModules); }, [q.isSuccess, q.defaultModules, mapa]);

  if (q.isError) return <V2ErrorState title={t('Não carregou a configuração das federações')} onRetry={() => q.refetch()} />;
  if (!mapa) return <V2Skeleton lines={6} />;

  // Desligar um módulo desliga o que depende dele; ligar leva junto o que ele exige.
  const alternar = (k, v) => setMapa((m) => {
    const prox = { ...m, [k]: v };
    if (!v) Object.keys(prox).forEach((x) => { if (FED_MODULE_META[x]?.requires === k) prox[x] = false; });
    return normalizeDefaultModules(prox);
  });
  const enviar = (e) => {
    e.preventDefault();
    salvar.mutate(mapa, {
      onSuccess: () => { toast.success(t('Módulos iniciais salvos.')); setMapa(null); },
      onError: (er) => toast.error(er.message),
    });
  };
  const ligados = Object.values(mapa).filter(Boolean).length;

  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="admin-federacoes-modulos">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Blocks className="h-5 w-5" aria-hidden="true" />{t('Módulos que já nascem ligados')}</h2>
        <p className="text-sm text-gray-500">{t('Valem para a federação aprovada pela primeira vez daqui em diante. Ela liga e desliga o que quiser depois, em Configurações → Módulos; as federações já aprovadas não mudam.')}</p>
      </div>
      <V2Surface variant="compacto" className="grid gap-3 p-4 sm:grid-cols-2">
        {Object.keys(mapa).map((k) => {
          const meta = FED_MODULE_META[k];
          const req = meta.requires ? FED_MODULE_META[meta.requires] : null;
          return (
            <V2Toggle
              key={k}
              id={`dm-${k}`}
              checked={mapa[k]}
              onChange={(v) => alternar(k, v)}
              label={t(meta.label)}
              hint={req ? `${t(meta.description)} ${t('Liga junto: {modulo}.', { modulo: t(req.label) })}` : t(meta.description)}
            />
          );
        })}
      </V2Surface>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{ligados ? t('{n} módulos ligados de início.', { n: ligados }) : t('Nenhum módulo ligado de início: a federação escolhe todos.')}</p>
        <div className="flex gap-2">
          <V2Button type="button" variant="ghost" onClick={() => setMapa(q.defaultModules)}>{t('Desfazer')}</V2Button>
          <V2Button type="submit" disabled={salvar.isPending}>{t('Salvar módulos')}</V2Button>
        </div>
      </div>
    </form>
  );
}
