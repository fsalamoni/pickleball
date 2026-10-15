/**
 * V2TrainingEditor — criar e editar um item do Centro de Treino (flag
 * `training_center`). Rotas: `/treino/novo` e `/treino/item/:itemId/editar`.
 *
 * Parâmetros: `?tipo=<kind>` já escolhe o tipo; `?copiar=<id>` abre a cópia
 * de um item (com crédito e a trava de cópia de conteúdo não público);
 * `?como=plataforma` (só admin) cria com autoria "Equipe PickleRush".
 *
 * Um formulário só, por seções, mostrando só o que vale para o tipo. O que é
 * gravado é decidido por `normalizeItemInput` (a tela mostra os erros, o
 * serviço confere de novo). O rascunho fica no navegador, por pessoa e por
 * item; salvar o apaga.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, History, Save, Sparkles } from 'lucide-react';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import { useTrainingSettings } from '@/modules/training/hooks/useTrainingSettings';
import { useCreateTrainingItem, useTrainingItem, useUpdateTrainingItem } from '@/modules/training/hooks/useTrainingItems';
import { deleteTrainingMedia } from '@/modules/training/services/mediaUploadService';
import { itemQuality, normalizeItemInput } from '@/modules/training/domain/trainingItem';
import { ITEM_KINDS } from '@/modules/training/domain/taxonomy';
import {
  AUTHOR_ROLE, REVIEW, VISIBILITY, authorBadge, authorRoleFor, canEditItem, visibilityOptionsFor,
} from '@/modules/training/domain/visibility';
import { buildCopyInput, canCopyItem, derivedFromFor } from '@/modules/training/domain/copy';
import { cn } from '@/core/lib/utils';
import { rolarAte } from '@/v2/ui/rolarAte';
import {
  V2Button, V2ErrorState, V2PageIntro, V2Skeleton, V2Surface, V2BackLink,
} from '@/v2/ui/primitives';
import TrainingGate from '@/v2/components/training/TrainingGate';
import KindPicker from '@/v2/components/training/editor/KindPicker';
import AiAssistPanel from '@/v2/components/training/editor/AiAssistPanel';
import TrainingItemForm from '@/v2/components/training/editor/TrainingItemForm';
import VisibilityPicker from '@/v2/components/training/editor/VisibilityPicker';
import ItemPreviewDialog from '@/v2/components/training/editor/ItemPreviewDialog';
import {
  campoId, clearDraft, draftKey, fillFromAi, firstErrorKey, formFromItem, orphanUploads, readDraft,
  sameForm, saveNotice, secaoPreenchida, secoesVisiveis, writeDraft,
} from '@/v2/components/training/editor/editorForm';
import { fmtData, t } from '@/core/i18n';

const LEGADO = 'cc_';

export default function V2TrainingEditor() {
  return (
    <TrainingGate>
      <EditorPage />
    </TrainingGate>
  );
}

function Voltar({ to = '/treino', children = t('Voltar ao treino') }) {
  return (
    <V2BackLink to={to} className="mb-4">{children}</V2BackLink>
  );
}

function Recado({ titulo, children, acoes }) {
  return (
    <V2Surface className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-ink">{titulo}</h1>
      <div className="mt-2 text-sm text-gray-500">{children}</div>
      {acoes && <div className="mt-5 flex flex-wrap gap-3">{acoes}</div>}
    </V2Surface>
  );
}

function EditorPage() {
  const { itemId } = useParams();
  const [params] = useSearchParams();
  const identity = useTrainingIdentity();
  const { settings } = useTrainingSettings();

  const legado = !!itemId && itemId.startsWith(LEGADO);
  const copiarId = !itemId ? params.get('copiar') : null;
  const alvoId = legado ? null : (itemId || copiarId || null);
  const leitura = useTrainingItem(alvoId);
  const item = leitura.data?.item || null;

  if (legado) {
    return (
      <div className="mx-auto max-w-[720px]">
        <Voltar />
        <Recado
          titulo={t('Conteúdo da área do professor')}
          acoes={<V2Button asChild><Link to="/aulas?aba=conteudo">{t('Abrir a área do professor')}</Link></V2Button>}
        >
          {t('Este é um conteúdo antigo, publicado pela área do professor. Ele é editado lá, em Conteúdo.')}
        </Recado>
      </div>
    );
  }

  if (alvoId && leitura.isPending) {
    return (
      <div className="mx-auto max-w-[720px] space-y-4" aria-busy="true">
        <V2Skeleton className="h-10 w-2/3" />
        <V2Skeleton className="h-64 rounded-4xl" />
      </div>
    );
  }

  if (alvoId && leitura.isError) {
    return (
      <div className="mx-auto max-w-[720px]">
        <Voltar />
        <V2ErrorState
          title={t('Não foi possível abrir o item')}
          description={t('A conexão falhou no meio do caminho. O item continua lá; tente de novo.')}
          onRetry={() => leitura.refetch()}
        />
      </div>
    );
  }

  if (alvoId && !item) {
    return (
      <div className="mx-auto max-w-[720px]">
        <Voltar />
        <Recado titulo={t('Este item não está disponível')}>
          {t('Ele pode ter sido apagado pelo autor, ou não foi compartilhado com a sua conta.')}
        </Recado>
      </div>
    );
  }

  if (itemId && item.legacy) {
    return (
      <div className="mx-auto max-w-[720px]">
        <Voltar />
        <Recado
          titulo={t('Conteúdo da área do professor')}
          acoes={<V2Button asChild><Link to="/aulas?aba=conteudo">{t('Abrir a área do professor')}</Link></V2Button>}
        >
          {t('Este conteúdo antigo é editado na área do professor, em Conteúdo.')}
        </Recado>
      </div>
    );
  }

  if (itemId && !canEditItem(item, { uid: identity.uid, isAdmin: identity.isAdmin })) {
    const copia = canCopyItem(item, { uid: identity.uid });
    return (
      <div className="mx-auto max-w-[720px]">
        <Voltar to={`/treino/item/${item.id}`}>{t('Voltar ao item')}</Voltar>
        <Recado
          titulo={t('Só quem criou pode editar')}
          acoes={(
            <>
              <V2Button asChild variant="secondary"><Link to={`/treino/item/${item.id}`}>{t('Abrir o item')}</Link></V2Button>
              {copia.ok && <V2Button asChild><Link to={`/treino/novo?copiar=${item.id}`}>{t('Copiar e adaptar')}</Link></V2Button>}
            </>
          )}
        >
          {t('“{titulo}” é de {autor}. Você pode fazer uma cópia sua e adaptar como quiser — o crédito à origem fica na ficha.', { titulo: item.title, autor: authorBadge(item).label })}
        </Recado>
      </div>
    );
  }

  if (copiarId) {
    const copia = canCopyItem(item, { uid: identity.uid });
    if (!copia.ok) {
      return (
        <div className="mx-auto max-w-[720px]">
          <Voltar />
          <Recado titulo={t('Não dá para copiar este item')}>{copia.reason}</Recado>
        </div>
      );
    }
  }

  const tipo = params.get('tipo');
  return (
    <EditorBody
      key={alvoId || 'novo'}
      identity={identity}
      settings={settings}
      item={itemId ? item : null}
      source={copiarId ? item : null}
      tipoInicial={ITEM_KINDS.includes(tipo) ? tipo : null}
      asPlatform={!itemId && params.get('como') === 'plataforma' && identity.isAdmin}
    />
  );
}

function EditorBody({ identity, settings, item, source, tipoInicial, asPlatform }) {
  const navigate = useNavigate();
  const criar = useCreateTrainingItem(identity, settings);
  const atualizar = useUpdateTrainingItem(identity, settings);

  const inicial = useMemo(() => {
    if (item) return formFromItem(item);
    if (source) return formFromItem(buildCopyInput(source));
    return formFromItem({ kind: tipoInicial || undefined });
  }, [item, source, tipoInicial]);

  const chave = draftKey(identity.uid, { itemId: item?.id || null, copiar: source?.id || null });
  const [oferta, setOferta] = useState(() => {
    const d = readDraft(chave);
    return d && !sameForm(d.form, inicial) ? d : null;
  });
  const [form, setForm] = useState(inicial);
  const [tipoEscolhido, setTipoEscolhido] = useState(!!(item || source || tipoInicial));
  const [comIa, setComIa] = useState(item ? item.ai_assisted === true : source?.ai_assisted === true);
  const [tentou, setTentou] = useState(false);
  const [errosServidor, setErrosServidor] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [previa, setPrevia] = useState(false);
  const enviadosNaSessao = useRef([]);

  const alterado = !sameForm(form, inicial);

  // Rascunho: grava enquanto a pessoa digita (com folga), nunca por cima de um
  // rascunho que ela ainda não decidiu se quer continuar.
  useEffect(() => {
    if (oferta || !chave) return undefined;
    if (!alterado) { clearDraft(chave); return undefined; }
    const espera = setTimeout(() => writeDraft(chave, { form, aiAssisted: comIa }), 600);
    return () => clearTimeout(espera);
  }, [form, comIa, oferta, chave, alterado]);

  // Fechar a aba com alterações: o navegador pergunta antes.
  useEffect(() => {
    if (!alterado) return undefined;
    const avisar = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [alterado]);

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrosServidor({});
  };

  const role = item ? item.author_role : authorRoleFor({ asPlatform, isAdmin: identity.isAdmin, isCoach: identity.isCoach });
  const opcoes = visibilityOptionsFor(role);
  const travadaPorCopia = source
    ? derivedFromFor(source, identity.uid).locked
    : !!item?.derived_from?.locked && !identity.isAdmin;
  const publicoTravado = travadaPorCopia
    ? t('Esta é a adaptação de um item que não é público: ela pode ser sua ou dos seus alunos, mas não vai para a biblioteca.')
    : role === AUTHOR_ROLE.ATLETA && settings?.allow_public_athlete === false && !identity.isAdmin
      ? t('A publicação de itens por atletas está pausada. Salve como "Só eu" e compartilhe com quem quiser.')
      : '';
  const aviso = saveNotice({
    visibility: form.visibility,
    role,
    settings,
    isAdmin: identity.isAdmin,
    uid: identity.uid,
    wasApproved: item?.review === REVIEW.APROVADO,
    ageYears: identity.ageYears,
  });

  const validacao = normalizeItemInput(form);
  const qualidade = itemQuality(validacao.value);
  const erros = tentou ? { ...validacao.errors, ...errosServidor } : errosServidor;

  const irPara = (key) => {
    const el = key && document.getElementById(campoId(key));
    if (!el) return;
    rolarAte(el);
    const foco = el.matches?.('input, textarea, select') ? el : el.querySelector?.('input, textarea, select, button');
    foco?.focus?.({ preventScroll: true });
  };

  const escolherTipo = (k) => { setField('kind', k); setTipoEscolhido(true); };

  const continuarRascunho = () => {
    setForm(oferta.form);
    setComIa(oferta.aiAssisted);
    setTipoEscolhido(true);
    setOferta(null);
  };
  const descartarRascunho = () => { clearDraft(chave); setOferta(null); };

  const aplicarIa = (value, { onlyEmpty }) => {
    setForm((f) => fillFromAi(f, value, { onlyEmpty }));
    setComIa(true);
    setTipoEscolhido(true);
    setErrosServidor({});
  };

  const salvando = criar.isPending || atualizar.isPending;
  // O papel de autoria (professor ou atleta) só se sabe com o cadastro de professor carregado.
  const esperandoPapel = !item && !identity.coachReady;

  const salvar = async () => {
    if (salvando || enviando || esperandoPapel) return;
    setTentou(true);
    const errs = { ...validacao.errors };
    if (!tipoEscolhido) errs.kind = t('Escolha o tipo.');
    if (!opcoes.includes(form.visibility) || (form.visibility === VISIBILITY.PUBLICO && publicoTravado)) {
      errs.visibility = t('Escolha quem pode ver este item.');
    }
    if (Object.keys(errs).length) {
      setErrosServidor(errs.visibility ? { visibility: errs.visibility } : {});
      irPara(firstErrorKey(errs));
      toast.error(t('Revise os campos destacados.'));
      return;
    }
    try {
      let id = item?.id;
      let mensagem;
      if (item) {
        const { review } = await atualizar.mutateAsync({ item, input: form, aiAssisted: comIa });
        mensagem = review === REVIEW.PENDENTE ? t('Salvo. A equipe revisa antes de publicar; enquanto isso, só você vê.') : t('Alterações salvas.');
      } else {
        id = await criar.mutateAsync({ input: form, source: source || null, aiAssisted: comIa, asPlatform: !!asPlatform });
        mensagem = aviso ? `${t('Item salvo.')} ${aviso}` : t('Item salvo.');
      }
      clearDraft(chave);
      orphanUploads({
        before: item?.media, sessionPaths: enviadosNaSessao.current, after: validacao.value.media, uid: identity.uid,
      }).forEach((p) => { deleteTrainingMedia(p); });
      toast.success(mensagem);
      navigate(`/treino/item/${id}`, { replace: true });
    } catch (err) {
      if (err?.fieldErrors && Object.keys(err.fieldErrors).length) {
        setErrosServidor(err.fieldErrors);
        irPara(firstErrorKey(err.fieldErrors));
      }
      toast.error(err?.message || t('Não foi possível salvar. Tente de novo.'));
    }
  };

  const titulo = item ? t('Editar item') : source ? t('Copiar e adaptar') : t('Novo item de treino');
  const subtitulo = item
    ? t('Mude o que precisar. O que está na ficha é o que vai para quem treina.')
    : t('Escolha o tipo e preencha o que fizer sentido. Só nome e resumo são obrigatórios; o medidor mostra o que deixa a ficha completa.');
  const secoes = tipoEscolhido ? secoesVisiveis(form.kind, form) : [];
  const itemDaPrevia = previa ? {
    ...validacao.value,
    id: item?.id || 'previa',
    visibility: form.visibility,
    author_role: role,
    author_name: item?.author_name || identity.name,
    author_photo: item?.author_photo || identity.photo,
    ai_assisted: comIa,
    derived_from: item?.derived_from || (source ? derivedFromFor(source, identity.uid) : null),
  } : null;

  return (
    <div className="mx-auto max-w-[1000px]">
      <Voltar to={item ? `/treino/item/${item.id}` : '/treino'}>{item ? t('Voltar ao item') : t('Voltar ao treino')}</Voltar>
      <V2PageIntro title={titulo} subtitle={subtitulo} />

      <div className="space-y-6">
        {oferta && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
            <History className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {t('Você tem um rascunho deste item, de {data}.', { data: fmtData(new Date(oferta.savedAt), { dateStyle: 'short', timeStyle: 'short' }) })}
            </span>
            <V2Button type="button" size="sm" onClick={continuarRascunho}>{t('Continuar rascunho')}</V2Button>
            <V2Button type="button" size="sm" variant="ghost" onClick={descartarRascunho}>{t('Descartar')}</V2Button>
          </div>
        )}

        {source && (
          <p className="rounded-3xl border border-gray-100 bg-paper px-5 py-4 text-sm text-gray-600">
            {t('Cópia de')}{' '}<strong className="text-ink">“{source.title}”</strong>{t(', de {autor}. A ficha mostra de onde veio.', { autor: authorBadge(source).label })}
          </p>
        )}
        {asPlatform && (
          <p className="rounded-3xl border border-gray-100 bg-paper px-5 py-4 text-sm text-gray-600">
            {t('Você está criando como')}{' '}<strong className="text-ink">{t('Equipe PickleRush')}</strong>{t(': é essa a autoria que aparece na ficha.')}
          </p>
        )}
        {comIa && (
          <p className="flex gap-2 rounded-3xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t('Feito com ajuda de IA. Revise cada parte antes de publicar: quem assina a ficha é você.')}
          </p>
        )}

        <V2Surface className="p-5 sm:p-8">
          <KindPicker value={tipoEscolhido ? form.kind : null} onChange={escolherTipo} erro={erros.kind} />
        </V2Surface>

        <AiAssistPanel form={form} onApply={aplicarIa} />

        {tipoEscolhido && (
          <>
            <nav aria-label={t('Partes da ficha')} className="flex flex-wrap gap-2">
              {secoes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => rolarAte(document.getElementById(`secao-${s.id}`))}
                  className={cn(
                    'min-h-[44px] rounded-full border px-4 text-xs font-bold transition-colors',
                    secaoPreenchida(s, form) ? 'border-transparent bg-acid/30 text-ink' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink',
                  )}
                >
                  {secaoPreenchida(s, form) ? '✓ ' : ''}{t(s.titulo)}
                </button>
              ))}
            </nav>

            <TrainingItemForm
              form={form}
              setField={setField}
              errors={erros}
              identity={identity}
              settings={settings}
              currentItemId={item?.id || null}
              onUploadBusy={setEnviando}
              onUploaded={(path) => { enviadosNaSessao.current = [...enviadosNaSessao.current, path]; }}
            />

            <V2Surface className="p-5 sm:p-8">
              <VisibilityPicker
                value={form.visibility}
                onChange={(v) => setField('visibility', v)}
                options={opcoes}
                notice={aviso}
                publicoTravado={publicoTravado}
              />
              {erros.visibility && <p className="mt-2 text-xs font-medium text-red-500">{erros.visibility}</p>}
            </V2Surface>

            <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-3xl border border-gray-200 bg-paper-pure p-3 shadow-organic-sm lg:bottom-4">
              <details data-dica="treino-editor-qualidade" className="min-w-0 flex-1 text-sm">
                <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 font-bold text-ink">
                  <span>{t('Ficha {n} de {total}', { n: qualidade.score, total: qualidade.total })}</span>
                  <span className="h-2 w-16 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                    <span className="block h-full bg-acid" style={{ width: `${qualidade.total ? (qualidade.score / qualidade.total) * 100 : 0}%` }} />
                  </span>
                  {qualidade.missing.length > 0 && <span className="truncate text-xs font-medium text-gray-500">{t('· o que falta')}</span>}
                </summary>
                {qualidade.missing.length > 0 ? (
                  <p className="pb-2 text-xs text-gray-500">{t('Falta: {lista}. Não impede salvar.', { lista: qualidade.missing.join(', ') })}</p>
                ) : (
                  <p className="pb-2 text-xs text-gray-500">{t('A ficha está completa.')}</p>
                )}
              </details>
              <V2Button type="button" variant="secondary" size="sm" onClick={() => setPrevia(true)}>
                <Eye className="h-4 w-4" aria-hidden="true" />{' '}{t('Ver prévia')}
              </V2Button>
              <V2Button type="button" size="sm" data-dica="treino-editor-salvar" onClick={salvar} disabled={salvando || enviando || esperandoPapel}>
                <Save className="h-4 w-4" aria-hidden="true" /> {salvando ? t('Salvando…') : enviando ? t('Enviando arquivo…') : esperandoPapel ? t('Carregando…') : t('Salvar')}
              </V2Button>
            </div>
          </>
        )}
      </div>

      <ItemPreviewDialog open={previa} onOpenChange={setPrevia} item={itemDaPrevia} identity={identity} />
    </div>
  );
}
