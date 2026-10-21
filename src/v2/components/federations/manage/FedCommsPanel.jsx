/**
 * Comunicação da federação (permissão `comms`; cada aba atrás do seu módulo):
 *  - Notícias (`news`): escrever, publicar, fixar, arquivar; "Avisar os
 *    filiados" chama o SERVIDOR (`federationNews`) — um aviso por notícia,
 *    porque a comunicação não lê a lista de filiados;
 *  - Patrocinadores (`sponsors`, só `admin`): a lista que sai na página e na
 *    carteirinha;
 *  - Divulgação (`promos`): o MESMO console de cupons e campanhas da
 *    plataforma e dos professores (`PromoMarketingConsole`), com a federação
 *    como emissora.
 */
import React, { Suspense, lazy, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Newspaper, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { deleteNews, notifyNews, saveNews, updateFederationSponsors } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { canNotifyNews, newsSummaryLine, sortNews, validateNewsInput } from '@/modules/federations/domain/news';
import { SPONSORS_MAX, validateSponsors } from '@/modules/federations/domain/sponsors';
import { NEWS_AUDIENCE, NEWS_AUDIENCE_LABELS, NEWS_STATUS, NEWS_STATUS_LABELS, SPONSOR_TIER, SPONSOR_TIER_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { isFederationPublic } from '@/modules/federations/domain/federation';
import { quando } from '../federationUi';
import { federationIssuer } from '@/v2/components/promo/promoUi';

const PromoMarketingConsole = lazy(() => import('@/v2/components/promo/PromoMarketingConsole'));

/* ---------------------------------------------------------------- notícias -- */

const NOTICIA_VAZIA = { title: '', summary: '', body: '', status: NEWS_STATUS.DRAFT, audience: NEWS_AUDIENCE.PUBLIC, link: '', image_url: '', published_at: '', pinned: false };

function NoticiaForm({ federation, noticia, onFechar }) {
  const { user } = useAuth();
  const [f, setF] = useState(noticia ? { ...NOTICIA_VAZIA, ...noticia } : NOTICIA_VAZIA);
  const [erros, setErros] = useState({});
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const m = useFederationMutation((input) => saveNews(federation, input, { uid: user?.uid, newsId: noticia?.id || null }));
  const enviar = (e) => {
    e.preventDefault();
    const r = validateNewsInput(f);
    if (!r.ok) { setErros(r.errors); return; }
    m.mutate(f, { onSuccess: () => { toast.success(noticia ? t('Notícia atualizada.') : t('Notícia criada.')); onFechar(); }, onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); } });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="federacao-noticia-formulario">
      <V2Field label={t('Título')} htmlFor="nt-titulo" error={erros.title} required><V2Input id="nt-titulo" maxLength={140} value={f.title} onChange={(e) => set({ title: e.target.value })} /></V2Field>
      <V2Field label={t('Resumo (o que vai no aviso)')} htmlFor="nt-resumo" hint={t('Até 300 caracteres. Em branco, o aviso leva o começo do texto.')}><V2Input id="nt-resumo" maxLength={300} value={f.summary} onChange={(e) => set({ summary: e.target.value })} /></V2Field>
      <V2Field label={t('Texto')} htmlFor="nt-texto" error={erros.body} required><V2Textarea id="nt-texto" rows={8} maxLength={6000} value={f.body} onChange={(e) => set({ body: e.target.value })} /></V2Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <V2Field label={t('Estado')} htmlFor="nt-estado"><V2Select id="nt-estado" value={f.status} onChange={(e) => set({ status: e.target.value })}>{Object.values(NEWS_STATUS).map((v) => <option key={v} value={v}>{t(NEWS_STATUS_LABELS[v])}</option>)}</V2Select></V2Field>
        <V2Field label={t('Para quem')} htmlFor="nt-publico" hint={t('"Só filiados" aparece a quem tem filiação ativa.')}><V2Select id="nt-publico" value={f.audience} onChange={(e) => set({ audience: e.target.value })}>{Object.values(NEWS_AUDIENCE).map((v) => <option key={v} value={v}>{t(NEWS_AUDIENCE_LABELS[v])}</option>)}</V2Select></V2Field>
        <V2Field label={t('Data')} htmlFor="nt-data" error={erros.published_at} hint={t('Em branco, a de hoje ao publicar.')}><V2Input id="nt-data" type="date" value={f.published_at} onChange={(e) => set({ published_at: e.target.value })} /></V2Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <V2Field label={t('Link (opcional)')} htmlFor="nt-link" error={erros.link} hint={t('https:// ou um caminho do app, como /torneios.')}><V2Input id="nt-link" maxLength={300} value={f.link} onChange={(e) => set({ link: e.target.value })} /></V2Field>
        <V2Field label={t('Imagem (URL, opcional)')} htmlFor="nt-img" error={erros.image_url}><V2Input id="nt-img" type="url" maxLength={500} placeholder="https://" value={f.image_url} onChange={(e) => set({ image_url: e.target.value })} /></V2Field>
      </div>
      <V2Toggle id="nt-fixar" checked={f.pinned} onChange={(v) => set({ pinned: v })} label={t('Fixar no topo da página')} />
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="submit" disabled={m.isPending}>{noticia ? t('Salvar') : t('Criar notícia')}</V2Button></div>
    </form>
  );
}

function NoticiasTab({ federation, newsQ }) {
  const { user } = useAuth();
  const [editando, setEditando] = useState(null); // null | 'nova' | noticia
  const avisar = useFederationMutation((id) => notifyNews(id));
  const apagar = useFederationMutation((n) => deleteNews(n, { uid: user?.uid }));
  const lista = newsQ.isSuccess ? sortNews(newsQ.data) : null;
  return (
    <section className="space-y-4" aria-label={t('Notícias da federação')} data-dica="federacao-noticias">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-display text-xl font-bold text-ink">{t('Notícias e avisos')}</h2><p className="text-sm text-gray-500">{t('Publicada e pública, sai na página da federação. "Só filiados" só aparece a quem tem filiação ativa. "Avisar os filiados" manda um aviso (sino, e-mail…) a cada filiado ativo — uma vez por notícia.')}</p></div>
        <V2Button type="button" onClick={() => setEditando('nova')} data-dica="federacao-noticia-nova"><Plus className="h-4 w-4" />{t('Nova notícia')}</V2Button>
      </div>
      {newsQ.isError && <V2ErrorState inline title={t('Não carregaram as notícias')} onRetry={() => newsQ.refetch()} />}
      {newsQ.isLoading && <V2Skeleton lines={3} />}
      {lista && lista.length === 0 && <V2EmptyState icon={Newspaper} title={t('Nenhuma notícia ainda')} description={t('Resultados, assembleias, calendário, avisos: escreva a primeira.')} />}
      {lista && lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((n) => (
            <li key={n.id}>
              <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
                {n.pinned ? <Pin className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" /> : <Newspaper className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{n.title}<V2Badge tone={n.status === NEWS_STATUS.PUBLISHED ? 'green' : 'neutral'}>{t(NEWS_STATUS_LABELS[n.status] || n.status)}</V2Badge><V2Badge tone="ink">{t(NEWS_AUDIENCE_LABELS[n.audience] || n.audience)}</V2Badge></p>
                  <p className="text-xs text-gray-500">{[n.published_at ? quando(n.published_at) : null, newsSummaryLine(n)].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canNotifyNews(n) && <V2Button type="button" size="sm" variant="secondary" disabled={avisar.isPending} onClick={() => avisar.mutate(n.id, { onSuccess: (r) => toast.success(tn(r?.count || 0, 'Aviso enviado a {n} filiado.', 'Aviso enviado a {n} filiados.')), onError: (e) => toast.error(e.message) })}><Bell className="h-4 w-4" />{t('Avisar os filiados')}</V2Button>}
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => setEditando(n)} aria-label={t('Editar {titulo}', { titulo: n.title })}><Pencil className="h-4 w-4" /></V2Button>
                  <V2Button type="button" size="sm" variant="ghost" disabled={apagar.isPending} onClick={() => { if (window.confirm(t('Apagar a notícia "{titulo}"?', { titulo: n.title }))) apagar.mutate(n, { onSuccess: () => toast.success(t('Notícia apagada.')), onError: (e) => toast.error(e.message) }); }} aria-label={t('Apagar {titulo}', { titulo: n.title })}><Trash2 className="h-4 w-4" /></V2Button>
                </div>
              </V2Surface>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editando != null} onOpenChange={(o) => { if (!o) setEditando(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogTitle>{editando && editando !== 'nova' ? t('Editar notícia') : t('Nova notícia')}</DialogTitle>
          <DialogDescription>{t('O que a federação quer contar. Salve como rascunho e publique quando estiver pronta.')}</DialogDescription>
          {editando != null && <NoticiaForm federation={federation} noticia={editando === 'nova' ? null : editando} onFechar={() => setEditando(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ---------------------------------------------------------- patrocinadores -- */

function PatrocinadoresTab({ federation }) {
  const { user } = useAuth();
  const [lista, setLista] = useState(() => (federation.sponsors || []).map((s) => ({ name: s.name || '', logo_url: s.logo_url || '', url: s.url || '', tier: s.tier || SPONSOR_TIER.SUPPORT })));
  const [erros, setErros] = useState({});
  const m = useFederationMutation(() => updateFederationSponsors(federation.id, lista, { uid: user?.uid }));
  const set = (i, patch) => { setLista((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s))); setErros({}); };
  const salvar = (e) => {
    e.preventDefault();
    const r = validateSponsors(lista);
    if (!r.ok) { setErros(r.errors); return; }
    m.mutate(undefined, { onSuccess: () => toast.success(t('Patrocinadores salvos.')), onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); } });
  };
  return (
    <section className="space-y-4" aria-label={t('Patrocinadores')} data-dica="federacao-patrocinadores">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Patrocinadores')}</h2><p className="text-sm text-gray-500">{t('Saem na página da federação e na carteirinha (os quatro primeiros), com o módulo "Patrocinadores" ligado. Até {n}.', { n: SPONSORS_MAX })}</p></div>
      <form onSubmit={salvar} noValidate className="space-y-3">
        {lista.length === 0 && <p className="text-sm text-gray-500">{t('Nenhum patrocinador cadastrado.')}</p>}
        {lista.map((s, i) => (
          <V2Surface key={i} variant="compacto" className="grid gap-3 p-4 sm:grid-cols-12">
            <V2Field label={t('Nome')} htmlFor={`sp-nome-${i}`} error={erros[`${i}.name`]} required className="sm:col-span-3"><V2Input id={`sp-nome-${i}`} maxLength={60} value={s.name} onChange={(e) => set(i, { name: e.target.value })} /></V2Field>
            <V2Field label={t('Faixa')} htmlFor={`sp-faixa-${i}`} className="sm:col-span-2"><V2Select id={`sp-faixa-${i}`} value={s.tier} onChange={(e) => set(i, { tier: e.target.value })}>{Object.values(SPONSOR_TIER).map((v) => <option key={v} value={v}>{t(SPONSOR_TIER_LABELS[v])}</option>)}</V2Select></V2Field>
            <V2Field label={t('Logo (URL)')} htmlFor={`sp-logo-${i}`} error={erros[`${i}.logo_url`]} className="sm:col-span-3"><V2Input id={`sp-logo-${i}`} type="url" maxLength={500} placeholder="https://" value={s.logo_url} onChange={(e) => set(i, { logo_url: e.target.value })} /></V2Field>
            <V2Field label={t('Site (URL)')} htmlFor={`sp-url-${i}`} error={erros[`${i}.url`]} className="sm:col-span-3"><V2Input id={`sp-url-${i}`} type="url" maxLength={300} placeholder="https://" value={s.url} onChange={(e) => set(i, { url: e.target.value })} /></V2Field>
            <div className="flex items-end sm:col-span-1"><V2Button type="button" size="sm" variant="ghost" onClick={() => setLista((l) => l.filter((_, j) => j !== i))} aria-label={t('Remover {nome}', { nome: s.name || t('patrocinador') })}><Trash2 className="h-4 w-4" /></V2Button></div>
          </V2Surface>
        ))}
        {erros.sponsors && <p className="text-sm text-red-600">{erros.sponsors}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          <V2Button type="button" variant="secondary" disabled={lista.length >= SPONSORS_MAX} onClick={() => setLista((l) => [...l, { name: '', logo_url: '', url: '', tier: SPONSOR_TIER.SUPPORT }])}><Plus className="h-4 w-4" />{t('Acrescentar patrocinador')}</V2Button>
          <V2Button type="submit" disabled={m.isPending}>{t('Salvar patrocinadores')}</V2Button>
        </div>
      </form>
    </section>
  );
}

/* -------------------------------------------------------------- divulgação -- */

function DivulgacaoTab({ federation }) {
  return (
    <section className="space-y-4" aria-label={t('Cupons e campanhas da federação')} data-dica="federacao-divulgacao">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Cupons e campanhas')}</h2><p className="text-sm text-gray-500">{t('Cupons de desconto e vales para os filiados (ou para todos) e banners de campanha na página da federação e na tela inicial. O aviso aos filiados vai pelas Notícias.')}</p></div>
      {isFederationPublic(federation) ? (
        <Suspense fallback={<V2Skeleton lines={6} />}>
          <PromoMarketingConsole issuer={federationIssuer(federation)} />
        </Suspense>
      ) : (
        // A promoção aparece na tela inicial de todo mundo: só a federação publicada cria.
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('Cupons e campanhas abrem depois que a federação for publicada (Configurações → Publicação): eles aparecem para todo mundo.')}</p>
      )}
    </section>
  );
}

export default function FedCommsPanel({ federation, newsQ, tab }) {
  if (tab === 'patrocinadores') return <PatrocinadoresTab federation={federation} />;
  if (tab === 'divulgacao') return <DivulgacaoTab federation={federation} />;
  return <NoticiasTab federation={federation} newsQ={newsQ} />;
}
