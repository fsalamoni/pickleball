/**
 * Os DOCUMENTOS OFICIAIS do clube para quem lê (Bloco D2): na página do clube (aba
 * "Documentos" do associado e bloco do visitante) e na vitrine sem login (`/c/:id`).
 *
 * Cada pessoa vê o que a regra deixa: o público lê `pub`, o membro do clube lê
 * `members` (que inclui o público) — o filtro da consulta é o que prova a regra, e a
 * "equipe" só aparece na Central. Falha de consulta diz que não carregou, nunca
 * "sem documentos". Documento indisponível não distingue "não existe" de "não pode
 * ver" (a regra também não distingue).
 *
 * Modos: `compacto` mostra os últimos e o caminho para todos (vitrine); sem ele,
 * a listagem com busca e filtros. Com `docId`, a página do documento.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Library } from 'lucide-react';
import { useReadableClubDocs } from '@/modules/clubs/hooks/useClubDocs';
import { muralDocs } from '@/modules/federations/domain/acervo';
import { visibleClubDocs } from '@/modules/clubs/domain/docs';
import { V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { acervoPathFor, clubDocsEntity } from '../../federations/acervo/acervoScope';
import { AcervoDocItem, AcervoListagem } from '../../federations/acervo/AcervoPublic';
import AcervoDocView from '../../federations/acervo/AcervoDocView';

export default function ClubDocsPublic({ club, member = false, docId = null, compacto = false, publica = false, enabled = true }) {
  const q = useReadableClubDocs(club.id, { member, enabled });
  const entity = useMemo(() => clubDocsEntity(club, { publica }), [club, publica]);
  const docs = useMemo(() => (q.isSuccess ? visibleClubDocs(q.data) : null), [q.isSuccess, q.data]);

  if (!enabled) return null;
  if (q.isLoading) return <V2Skeleton lines={compacto ? 2 : 4} />;
  if (q.isError) {
    return (
      <section id="clube-documentos" className="scroll-mt-4 space-y-2" aria-label={t('Documentos oficiais')}>
        <V2ErrorState inline title={t('Os documentos não carregaram')} onRetry={() => q.refetch()} />
      </section>
    );
  }

  // Vitrine: sem nada publicado a seção não existe — não há o que mostrar nem convidar a procurar.
  if (compacto && !docId && docs.length === 0) return null;

  if (docId) {
    const doc = docs.find((d) => d.id === docId);
    return (
      <section id="clube-documentos" className="scroll-mt-4 space-y-3" aria-label={t('Documento oficial')}>
        {doc
          ? <AcervoDocView federation={entity} doc={doc} relacionados={docs} />
          : (
            <div className="rounded-2xl border border-gray-100 bg-paper-pure p-6 text-center">
              <p className="font-semibold text-ink">{t('Documento indisponível')}</p>
              <p className="mt-1 text-sm text-gray-500">{t('Ele pode ter sido retirado, ou ser só para associados. Entre com a sua conta de associado para conferir.')}</p>
              <V2Button asChild variant="secondary" size="sm" className="mt-3"><Link to={acervoPathFor(entity)}>{t('Ver os documentos do clube')}</Link></V2Button>
            </div>
          )}
      </section>
    );
  }

  if (compacto) {
    const ultimos = muralDocs(docs, 4);
    return (
      <section id="clube-documentos" aria-labelledby="clube-documentos-titulo" className="scroll-mt-4 space-y-3" data-dica="clube-documentos-publicos">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="clube-documentos-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Library className="h-5 w-5" aria-hidden="true" />{t('Documentos oficiais')}</h2>
          {docs.length > ultimos.length && <V2Button asChild variant="ghost" size="sm"><Link to={acervoPathFor(entity)}>{t('Ver todos')}</Link></V2Button>}
        </div>
        <ul className="space-y-2">{ultimos.map((d) => <AcervoDocItem key={d.id} federation={entity} doc={d} />)}</ul>
      </section>
    );
  }

  return (
    <section id="clube-documentos" className="scroll-mt-4 space-y-3" aria-label={t('Documentos oficiais')} data-dica="clube-documentos-publicos">
      <p className="text-sm text-gray-500">{member
        ? t('Estatuto, regimento, atas, convocações e prestação de contas, sempre atualizados.')
        : t('Os documentos que o clube deixa abertos a qualquer pessoa.')}</p>
      <AcervoListagem federation={entity} docs={docs} vazio={t('O clube ainda não publicou documentos oficiais.')} />
    </section>
  );
}
