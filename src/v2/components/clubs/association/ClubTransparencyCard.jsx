/**
 * A TRANSPARÊNCIA do clube (Bloco F3): o que uma associação deve deixar aberto a quem quer
 * entrar ou conferir — estatuto, contas, parecer do conselho fiscal, atas, calendário — item
 * a item, com o link do documento ou "não publicado". Mostrar a falta é de propósito: um clube
 * que esconde o que não publicou não está sendo transparente. Zero banco: usa a lista de
 * documentos que a página já carregou (só vale o aberto ao público).
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { clubTransparencyChecklist } from '@/modules/clubs/domain/compliance';
import { docCode } from '@/modules/federations/domain/acervo';
import { t } from '@/core/i18n';
import { docPathFor } from '../../federations/acervo/acervoScope';

export default function ClubTransparencyCard({ entity, docs }) {
  const itens = useMemo(() => clubTransparencyChecklist(docs), [docs]);
  const ok = itens.filter((x) => x.ok).length;
  return (
    <section className="space-y-3" aria-label={t('Transparência')} data-dica="clube-transparencia">
      <div>
        <h3 className="font-display text-lg font-bold text-ink">{t('Transparência')}</h3>
        <p className="text-sm text-gray-700">{t('O que o clube deixa aberto a qualquer pessoa. {ok} de {total} publicados.', { ok, total: itens.length })}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {itens.map((x) => (
          <li key={x.id} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3 text-sm">
            {x.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{t(x.label)}</p>
              <p className="text-xs text-gray-500">{t(x.basis)}</p>
              {x.doc
                ? <Link className="mt-1 inline-block break-words text-sm font-semibold text-ink underline" to={docPathFor(entity, x.doc.id)}>{docCode(x.doc) || x.doc.title}</Link>
                : <p className="mt-1 text-sm text-amber-700">{t('não publicado')}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
