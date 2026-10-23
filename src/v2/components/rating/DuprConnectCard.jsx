import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Link2, Unlink } from 'lucide-react';
import { V2Badge, V2Button, V2ErrorState } from '@/v2/ui/primitives';
import { useDuprLink } from '@/modules/rating/hooks/useDuprLink';
import { originOf, parseSsoMessage } from '@/modules/rating/domain/duprSso';
import { t } from '@/core/i18n';

const fmt = (v) => (Number.isFinite(Number(v)) && v != null ? Number(v).toFixed(3) : 'NR');

/**
 * Conexão da conta com o DUPR (flag `dupr_official_sync`). O login acontece
 * dentro do site do próprio DUPR (iframe): a plataforma nunca vê a senha. O que
 * volta do login (tokens somente leitura) segue direto para o servidor, que
 * confirma quem é a pessoa pelo DUPR e grava o ID, o rating e o selo.
 */
export default function DuprConnectCard() {
  const { config, linked, link, unlink } = useDuprLink();
  const [aberto, setAberto] = useState(false);
  const frameRef = useRef(null);
  const ssoUrl = config.data?.ssoUrl || '';
  const ssoOrigin = useMemo(() => originOf(ssoUrl), [ssoUrl]);

  useEffect(() => {
    if (!aberto || !ssoOrigin) return undefined;
    const onMessage = (event) => {
      const dados = parseSsoMessage(event, { ssoOrigin, frameWindow: frameRef.current?.contentWindow });
      if (!dados) return;
      setAberto(false);
      link.mutate(dados, {
        onSuccess: () => toast.success(t('Conta DUPR conectada.')),
        onError: (err) => toast.error(err.message),
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [aberto, ssoOrigin, link]);

  if (config.isPending) return <p className="text-sm text-gray-500">{t('Carregando a conexão com o DUPR…')}</p>;
  if (config.isError) return <V2ErrorState inline onRetry={() => config.refetch()} />;
  if (!config.data?.enabled) return null;
  if (!config.data.configured) {
    return <p className="text-sm text-gray-500">{t('A conexão com o DUPR ainda não está disponível. Volte em breve.')}</p>;
  }

  const desconectar = () => unlink.mutate(undefined, {
    onSuccess: () => toast.success(t('Conta DUPR desconectada.')),
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4" data-testid="dupr-connect-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{t('Conta DUPR')}</p>
        {linked && <V2Badge tone="green"><BadgeCheck className="h-3.5 w-3.5" /> {t('Verificada pelo DUPR')}</V2Badge>}
      </div>

      {linked ? (
        <>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-gray-500">{t('ID DUPR')}</dt><dd className="font-semibold text-ink">{linked.duprId}</dd></div>
            <div><dt className="text-xs text-gray-500">{t('Duplas')}</dt><dd className="font-semibold text-ink">{fmt(linked.ratings?.doubles)}</dd></div>
            <div><dt className="text-xs text-gray-500">{t('Simples')}</dt><dd className="font-semibold text-ink">{fmt(linked.ratings?.singles)}</dd></div>
          </dl>
          {linked.entitlements?.includes('PREMIUM_L1') && <p className="text-xs text-gray-500">{t('Assinatura DUPR Premium ativa: você pode participar de eventos premium.')}</p>}
          <p className="text-xs leading-5 text-gray-500">
            {t('O ID e o rating vêm do DUPR e se atualizam sozinhos; por isso não se editam aqui. Para trocar de conta, desconecte e conecte de novo.')}
          </p>
          <V2Button variant="danger" size="sm" onClick={desconectar} disabled={unlink.isPending}>
            <Unlink className="mr-1.5 h-4 w-4" /> {unlink.isPending ? t('Desconectando…') : t('Desconectar')}
          </V2Button>
        </>
      ) : (
        <>
          <p className="text-xs leading-5 text-gray-500">
            {t('Entre com a sua conta DUPR para trazer o seu ID e o seu rating oficiais. O login é feito no site do DUPR: a plataforma não vê a sua senha.')}
          </p>
          {aberto ? (
            <div className="space-y-2">
              <iframe
                ref={frameRef}
                title={t('Login no DUPR')}
                src={ssoUrl}
                className="h-[480px] w-full rounded-xl border border-gray-100 bg-white"
                referrerPolicy="strict-origin"
              />
              <V2Button variant="ghost" size="sm" onClick={() => setAberto(false)}>{t('Cancelar')}</V2Button>
            </div>
          ) : (
            <V2Button size="sm" onClick={() => setAberto(true)} disabled={link.isPending}>
              <Link2 className="mr-1.5 h-4 w-4" /> {link.isPending ? t('Conectando…') : t('Conectar com o DUPR')}
            </V2Button>
          )}
        </>
      )}
    </div>
  );
}
