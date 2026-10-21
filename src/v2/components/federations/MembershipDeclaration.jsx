/**
 * A declaração de vínculo: a folha que a federação "assina" (Bolsa Atleta,
 * escola, empregador, patrocínio), com o QR que confere a filiação na
 * verificação pública. O texto sai de `buildMembershipDeclaration`; aqui só se
 * desenha e imprime (a mesma folha de impressão do recibo do Mercado:
 * `cartao-folha-raiz recibo-folha`). Nada é gravado.
 */
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Printer, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildMembershipDeclaration } from '@/modules/federations/domain/declaration';
import { normalizeFederationRules } from '@/modules/federations/domain/federation';
import { usePersonFederationResults } from '@/modules/federations/hooks/useFederations';
import { V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { useQrDataUrl } from './federationUi';

/** A folha (tela e papel desenham a MESMA). */
export function DeclarationSheet({ decl, qrDataUrl }) {
  const f = decl.federation;
  return (
    <article className="space-y-5 bg-white p-6 text-sm leading-relaxed text-ink sm:p-8" aria-label={t('Declaração de vínculo')}>
      <header className="flex items-center gap-4 border-b border-gray-200 pb-4">
        {f.logo ? <img src={f.logo} alt="" className="h-14 w-14 rounded-lg object-contain" /> : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 font-display text-lg font-bold text-ink" aria-hidden="true">{(f.acronym || f.name).slice(0, 3)}</span>}
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{f.name}</p>
          <p className="text-xs text-gray-600">{[f.acronym, f.cnpj ? t('CNPJ {n}', { n: f.cnpj }) : '', f.city].filter(Boolean).join(' · ')}</p>
        </div>
      </header>
      <h2 className="text-center font-display text-base font-bold uppercase tracking-wider">{t('Declaração de vínculo')}</h2>
      <p className="text-justify">{decl.body}</p>
      {decl.guardian && <p className="text-justify text-gray-700">{t('Responsável pelo(a) filiado(a): {nome}.', { nome: decl.guardian })}</p>}
      {decl.results.length > 0 && (
        <div className="space-y-2">
          <p className="font-bold">{t('Resultados oficiais registrados nesta federação')}</p>
          <table className="w-full border-collapse text-left text-xs">
            <thead><tr className="border-b border-gray-200 text-gray-600"><th className="py-1 pr-2 font-semibold">{t('Data')}</th><th className="py-1 pr-2 font-semibold">{t('Torneio')}</th><th className="py-1 pr-2 font-semibold">{t('Categoria')}</th><th className="py-1 font-semibold">{t('Colocação')}</th></tr></thead>
            <tbody>
              {decl.results.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-1 pr-2 tabular-nums">{r.date ? r.date.split('-').reverse().join('/') : '—'}</td>
                  <td className="py-1 pr-2">{r.tournament}</td>
                  <td className="py-1 pr-2">{r.modality}</td>
                  <td className="py-1 tabular-nums">{r.position ? t('{n}º', { n: r.position }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p>{t('Por ser verdade, firmamos a presente. Emitida em {data}.', { data: decl.issuedOn })}</p>
      <footer className="flex items-end justify-between gap-4 border-t border-gray-200 pt-4">
        <p className="max-w-[75%] text-xs text-gray-600">
          {t('Documento emitido pela PickleRush em nome da {federacao}. Confira a autenticidade em {url} ou pelo QR. O código {codigo} muda quando a filiação é renovada ou suspensa: depois disso, emita uma declaração nova.', { federacao: f.acronym || f.name, url: decl.verifyUrl, codigo: decl.code })}
        </p>
        {qrDataUrl && <img src={qrDataUrl} alt={t('QR de verificação')} className="h-20 w-20 shrink-0" />}
      </footer>
    </article>
  );
}

/**
 * O diálogo: prévia + imprimir/salvar em PDF. `member` é a filiação; os
 * resultados oficiais são lidos aqui (leitura pública, só de quem tem conta).
 * `federationQ` (opcional) é a leitura da federação quando quem abre ainda não
 * a tem (Minha área). `selfService`: quem pede é o próprio filiado (ou o
 * responsável) — a regra `member_declarations` da federação decide; a
 * secretaria emite sempre.
 */
export default function MembershipDeclarationDialog({ open, onOpenChange, member, federation, federationQ, selfService = false }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const results = usePersonFederationResults(member?.user_id, { enabled: open && Boolean(member?.user_id) });
  const fed = federation || federationQ?.data || null;
  const decl = useMemo(() => buildMembershipDeclaration({ member, federation: fed || {}, results: results.data || [], origin }), [member, fed, results.data, origin]);
  const bloqueadaPelaRegra = Boolean(fed) && selfService && !normalizeFederationRules(fed.rules).member_declarations;
  const pode = Boolean(fed) && decl.canIssue && !bloqueadaPelaRegra;
  const qr = useQrDataUrl(pode ? decl.verifyUrl : '');

  function imprimir() {
    if (typeof document === 'undefined') return;
    document.body.classList.add('imprimindo-cartao');
    const fim = () => { document.body.classList.remove('imprimindo-cartao'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    requestAnimationFrame(() => { window.print(); setTimeout(fim, 2000); });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" sheet>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" aria-hidden="true" />{t('Declaração de vínculo')}</DialogTitle>
          <DialogDescription>{t('Para Bolsa Atleta, escola, empregador ou patrocinador. Quem receber confere pelo QR, sem precisar de conta.')}</DialogDescription>
        </DialogHeader>
        {!fed ? (
          federationQ?.isError ? <V2ErrorState inline title={t('Não carregou a federação')} onRetry={() => federationQ.refetch()} /> : <V2Skeleton lines={6} />
        ) : !pode ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{bloqueadaPelaRegra ? t('Esta federação emite a declaração pela secretaria. Peça a ela pelos contatos da página da federação.') : decl.block}</p>
        ) : (
          <>
            <div className="tema-claro overflow-hidden rounded-2xl border border-gray-200"><DeclarationSheet decl={decl} qrDataUrl={qr} /></div>
            {results.isError && <p className="text-xs text-amber-700">{t('Os resultados oficiais não carregaram: a declaração sai sem a tabela. Feche e abra de novo para tentar.')}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <V2Button type="button" onClick={imprimir} disabled={results.isLoading}><Printer className="h-4 w-4" />{results.isLoading ? t('Carregando resultados…') : t('Imprimir / PDF')}</V2Button>
            </div>
            <p className="flex items-start gap-2 text-xs text-gray-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t('A verificação pública mostra só nome, federação, categoria e validade.')}</p>
            {open && typeof document !== 'undefined' && createPortal(
              <div className="cartao-folha-raiz recibo-folha tema-claro hidden" aria-hidden="true"><DeclarationSheet decl={decl} qrDataUrl={qr} /></div>,
              document.body,
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
