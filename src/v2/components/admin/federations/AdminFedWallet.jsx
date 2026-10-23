/**
 * Painel admin → Federações → Configuração → Carteira do celular (Bloco 6b):
 * as credenciais da PLATAFORMA para a carteirinha entrar no Google Wallet
 * (emissor + conta de serviço) e no Apple Wallet (Pass Type ID + certificado).
 * Vão só para o servidor (`federationWallet`, `platform_secrets/wallet`): a
 * tela vê o emissor e o Pass Type ID, nunca a chave. Sem credencial, os botões
 * "Adicionar à carteira" não aparecem para ninguém.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';
import { federationWallet } from '@/modules/federations/services/federationService';
import { useFederationMutation, useWalletConfig } from '@/modules/federations/hooks/useFederations';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const VAZIO_G = { issuer_id: '', client_email: '', private_key: '' };
const VAZIO_A = { pass_type_id: '', team_id: '', cert_pem: '', key_pem: '', key_passphrase: '', wwdr_pem: '' };

function Credencial({ titulo, ligado, resumo, onDesligar, desligando, children }) {
  return (
    <V2Surface className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-bold text-ink">{titulo}</h3>
        {ligado ? <V2Badge tone="green">{t('Configurado')}</V2Badge> : <V2Badge tone="neutral">{t('Não configurado')}</V2Badge>}
        {ligado && <span className="text-sm text-gray-500">{resumo}</span>}
      </div>
      {children}
      {ligado && <V2Button type="button" size="sm" variant="ghost" disabled={desligando} onClick={onDesligar}>{t('Desligar e apagar a credencial')}</V2Button>}
    </V2Surface>
  );
}

export default function AdminFedWallet() {
  const q = useWalletConfig();
  const [g, setG] = useState(VAZIO_G);
  const [a, setA] = useState(VAZIO_A);
  const [erro, setErro] = useState({});
  const salvar = useFederationMutation((input) => federationWallet({ action: 'config_save', ...input }));
  const setGv = (k) => (e) => setG((x) => ({ ...x, [k]: e.target.value }));
  const setAv = (k) => (e) => setA((x) => ({ ...x, [k]: e.target.value }));

  if (q.isError) return <V2ErrorState title={t('Não carregou a configuração da carteira')} onRetry={() => q.refetch()} />;
  if (!q.data) return <V2Skeleton lines={6} />;
  const cfg = q.data;

  const enviar = (provider, dados, limpar) => (e) => {
    e?.preventDefault?.();
    salvar.mutate({ provider, ...dados }, {
      onSuccess: () => { limpar?.(); setErro({}); toast.success(provider.endsWith('_off') ? t('Credencial apagada.') : t('Credencial conferida e salva.')); },
      onError: (er) => (provider.endsWith('_off') ? toast.error(er.message) : setErro({ [provider]: er.message })),
    });
  };

  return (
    <section className="space-y-4" aria-label={t('Carteira do celular')} data-dica="admin-federacoes-carteira">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Wallet className="h-5 w-5" aria-hidden="true" />{t('Carteira do celular')}</h2>
        <p className="text-sm text-gray-500">{t('Com as credenciais da plataforma, o filiado adiciona a carteirinha ao Google Wallet ou ao Apple Wallet, e ela se atualiza sozinha quando a filiação vence, é suspensa ou renovada. Sem credencial, nada muda.')}</p>
      </div>

      <Credencial
        titulo="Google Wallet" ligado={cfg.google?.enabled} resumo={cfg.google?.enabled ? `${cfg.google.issuer_id} · ${cfg.google.client_email}` : ''}
        desligando={salvar.isPending} onDesligar={enviar('google_off', {})}
      >
        <form onSubmit={enviar('google', g, () => setG(VAZIO_G))} noValidate className="space-y-4">
          <p className="text-sm text-gray-500">{t('Google Pay & Wallet Console → ID do emissor. No Google Cloud, crie uma conta de serviço com a API Google Wallet ligada, gere uma chave JSON e autorize o e-mail dela no console do emissor.')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('ID do emissor')} htmlFor="gw-issuer" required><V2Input id="gw-issuer" inputMode="numeric" value={g.issuer_id} onChange={setGv('issuer_id')} /></V2Field>
            <V2Field label={t('E-mail da conta de serviço')} htmlFor="gw-email" required><V2Input id="gw-email" value={g.client_email} onChange={setGv('client_email')} /></V2Field>
          </div>
          <V2Field label={t('Chave privada (private_key do JSON)')} htmlFor="gw-key" error={erro.google} required>
            <V2Textarea id="gw-key" rows={4} autoComplete="off" spellCheck={false} value={g.private_key} onChange={setGv('private_key')} />
          </V2Field>
          <div className="flex justify-end"><V2Button type="submit" disabled={salvar.isPending}>{t('Salvar Google Wallet')}</V2Button></div>
        </form>
      </Credencial>

      <Credencial
        titulo="Apple Wallet" ligado={cfg.apple?.enabled} resumo={cfg.apple?.enabled ? `${cfg.apple.pass_type_id} · ${cfg.apple.team_id}` : ''}
        desligando={salvar.isPending} onDesligar={enviar('apple_off', {})}
      >
        <form onSubmit={enviar('apple', a, () => setA(VAZIO_A))} noValidate className="space-y-4">
          <p className="text-sm text-gray-500">{t('Apple Developer → Identifiers → Pass Type IDs: crie o identificador e o certificado dele. Exporte o certificado e a chave em PEM e cole aqui, junto com o certificado intermediário WWDR da Apple (G4).')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Pass Type ID')} htmlFor="aw-pass" required><V2Input id="aw-pass" placeholder="pass.br.com.picklerush.carteirinha" value={a.pass_type_id} onChange={setAv('pass_type_id')} /></V2Field>
            <V2Field label={t('Team ID')} htmlFor="aw-team" required><V2Input id="aw-team" maxLength={10} value={a.team_id} onChange={setAv('team_id')} /></V2Field>
          </div>
          <V2Field label={t('Certificado do Pass Type ID (PEM)')} htmlFor="aw-cert" required><V2Textarea id="aw-cert" rows={3} spellCheck={false} value={a.cert_pem} onChange={setAv('cert_pem')} /></V2Field>
          <V2Field label={t('Chave do certificado (PEM)')} htmlFor="aw-key" required><V2Textarea id="aw-key" rows={3} autoComplete="off" spellCheck={false} value={a.key_pem} onChange={setAv('key_pem')} /></V2Field>
          <V2Field label={t('Senha da chave (se houver)')} htmlFor="aw-pass-key"><V2Input id="aw-pass-key" type="password" autoComplete="off" value={a.key_passphrase} onChange={setAv('key_passphrase')} /></V2Field>
          <V2Field label={t('Certificado WWDR da Apple (PEM)')} htmlFor="aw-wwdr" error={erro.apple} required><V2Textarea id="aw-wwdr" rows={3} spellCheck={false} value={a.wwdr_pem} onChange={setAv('wwdr_pem')} /></V2Field>
          <div className="flex justify-end"><V2Button type="submit" disabled={salvar.isPending}>{t('Salvar Apple Wallet')}</V2Button></div>
        </form>
      </Credencial>
    </section>
  );
}
