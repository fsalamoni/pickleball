/**
 * Formulários do acervo oficial (Central → Acervo oficial):
 *  - `AcervoUploader`: envia cada arquivo para a pasta privada de quem envia
 *    (`federacao-acervo/{uid}/`, ou `clube-acervo/{uid}/` no clube), com barra de progresso; o servidor copia
 *    para a pasta oficial só ao publicar;
 *  - `DocForm`: o RASCUNHO (tipo, título, data, quem assina, texto,
 *    arquivos, vídeos por link, relações com atos publicados, visibilidade).
 * Quem grava é o servidor (`federationAcervo`); a tela valida antes por
 * `validateDocInput` (a mesma regra da cópia do servidor).
 */
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileUp, Link2, MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { discardAcervoUpload, uploadAcervoFile } from '@/modules/federations/services/federationService';
import {
  ACERVO_ACCEPT, DOC_FILES_MAX, DOC_LINKS_MAX, DOC_RELATION, DOC_RELATION_LABELS, DOC_RELATIONS_MAX, DOC_RESTRICTED_FILE_MAX,
  DOC_VISIBILITY, docDisplayTitle, docType, fileSizeLabel, validateAcervoFile, validateDocInput,
} from '@/modules/federations/domain/acervo';
import { acervoFolder, allowedDocTypeIds, callAcervo, docCategoriesFor, docTypesFor, useAcervoMutation, visibilityHintFor, visibilityLabelFor } from '../acervo/acervoScope';
import { V2Button, V2Field, V2Input, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { useAvisoNaoSalvo } from './naoSalvo';

/** Lista de arquivos já enviados + os que estão subindo agora. */
export function AcervoUploader({ value, onAdd, onRemove, onBusy, max = DOC_FILES_MAX, restricted = false, id = 'acervo-arquivos', entity = null }) {
  const { user } = useAuth();
  const input = useRef(null);
  const [subindo, setSubindo] = useState([]); // { key, name, progress }
  // Envio que termina depois de o formulário fechar não tem mais dono: apaga.
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const atualizar = (fila) => { setSubindo(fila); onBusy?.(fila.length > 0); };
  const escolher = async (e) => {
    const escolhidos = [...(e.target.files || [])];
    e.target.value = '';
    const vagas = max - value.length - subindo.length;
    if (escolhidos.length > vagas) toast.error(t('No máximo {n} arquivos.', { n: max }));
    let fila = [...subindo];
    for (const file of escolhidos.slice(0, Math.max(0, vagas))) {
      const { error } = validateAcervoFile(file);
      if (error) { toast.error(`${file.name}: ${error}`); continue; }
      if (restricted && file.size > DOC_RESTRICTED_FILE_MAX) { toast.error(t('{nome}: documento só para filiados ou equipe aceita até 9 MB por arquivo.', { nome: file.name })); continue; }
      const key = `${file.name}-${file.size}-${Math.random()}`;
      fila = [...fila, { key, name: file.name, progress: 0 }];
      atualizar(fila);
      try {
        const enviado = await uploadAcervoFile({ uid: user?.uid, file, folder: acervoFolder(entity), onProgress: (p) => setSubindo((f) => f.map((x) => (x.key === key ? { ...x, progress: p } : x))) });
        if (vivo.current) onAdd(enviado);
        else discardAcervoUpload(enviado.path);
      } catch (er) {
        if (vivo.current) toast.error(`${file.name}: ${er.message || t('não foi possível enviar.')}`);
      } finally {
        fila = fila.filter((x) => x.key !== key);
        if (vivo.current) atualizar(fila);
      }
    }
  };
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((f) => (
            <li key={f.path} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm">
              <FileUp className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
              <span className="shrink-0 text-xs text-gray-500">{fileSizeLabel(f.size)}</span>
              <V2Button type="button" size="sm" variant="ghost" onClick={() => onRemove(f.path)} aria-label={t('Tirar {nome}', { nome: f.name })}><X className="h-4 w-4" /></V2Button>
            </li>
          ))}
        </ul>
      )}
      {subindo.map((x) => (
        <div key={x.key} className="rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm" role="status">
          <p className="truncate text-ink">{t('Enviando {nome}…', { nome: x.name })} <span className="text-gray-500">{Math.round(x.progress * 100)}%</span></p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-ink transition-all" style={{ width: `${Math.round(x.progress * 100)}%` }} /></div>
        </div>
      ))}
      <input ref={input} id={id} type="file" multiple accept={ACERVO_ACCEPT} className="sr-only" onChange={escolher} />
      {value.length + subindo.length < max && (
        <V2Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} data-dica="federacao-acervo-anexar"><FileUp className="h-4 w-4" />{t('Anexar arquivos')}</V2Button>
      )}
      <p className="text-xs text-gray-500">{t('PDF, documento, planilha ou apresentação até 25 MB; imagem até 10 MB; áudio até 50 MB; vídeo até 100 MB. Vídeo longo: prefira o link do YouTube ou do Vimeo.')}</p>
    </div>
  );
}

/**
 * O menu "⋯" das linhas com muitas ações (Acervo e Agenda): a ação principal
 * fica à vista na linha e o resto entra aqui, com o nome escrito.
 * `itens`: `{ id, icon, label, perigo? }`. Sem itens, não aparece.
 * `modal={false}`: o item abre um diálogo, e o menu modal deixaria a página
 * travada para clique depois que o diálogo fecha.
 */
export function MaisAcoes({ nome, itens, onEscolher }) {
  if (!itens.length) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t('Mais ações para {nome}', { nome })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-paper hover:text-ink coarse:h-11 coarse:w-11">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {itens.map(({ id, icon: Icone, label, perigo }) => (
          <DropdownMenuItem key={id} onSelect={() => onEscolher(id)} className={perigo ? 'text-red-700' : undefined}>
            {Icone && <Icone className="mr-2 h-4 w-4" aria-hidden="true" />}{label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** O seletor de tipo, por categoria. */
export function DocTypeSelect({ id, value, onChange, disabled, entity = null }) {
  const tipos = docTypesFor(entity);
  return (
    <V2Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('Escolha…')}</option>
      {docCategoriesFor(entity).map((c) => (
        <optgroup key={c.id} label={t(c.label)}>
          {tipos.filter((x) => x.category === c.id).map((x) => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
        </optgroup>
      ))}
    </V2Select>
  );
}

/** Vídeos por link (YouTube/Vimeo). */
export function MediaLinksEditor({ value, onChange, errors = {} }) {
  const set = (i, patch) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-12">
          <V2Field label={t('Link do vídeo')} htmlFor={`ac-link-${i}`} error={errors[`media_links.${i}`]} className="sm:col-span-6"><V2Input id={`ac-link-${i}`} type="url" maxLength={300} placeholder="https://www.youtube.com/watch?v=…" value={l.url} onChange={(e) => set(i, { url: e.target.value })} /></V2Field>
          <V2Field label={t('Título (opcional)')} htmlFor={`ac-link-t-${i}`} className="sm:col-span-5"><V2Input id={`ac-link-t-${i}`} maxLength={120} value={l.title} onChange={(e) => set(i, { title: e.target.value })} /></V2Field>
          <div className="flex items-end sm:col-span-1"><V2Button type="button" size="sm" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={t('Remover o link')}><Trash2 className="h-4 w-4" /></V2Button></div>
        </div>
      ))}
      {value.length < DOC_LINKS_MAX && <V2Button type="button" size="sm" variant="ghost" onClick={() => onChange([...value, { url: '', title: '' }])}><Link2 className="h-4 w-4" />{t('Adicionar vídeo por link')}</V2Button>}
    </div>
  );
}

/**
 * Os arquivos enviados NESTA abertura do formulário que não chegaram a ser
 * salvos são apagados do Storage quando ele fecha, por qualquer caminho
 * (Cancelar, o X, Esc, clique fora). Antes só o "Cancelar" limpava, e fechar
 * o diálogo deixava os arquivos parados na pasta de quem enviou.
 * Devolve `marcarSalvo`, chamado quando o servidor aceitou.
 */
export function useDescarteAoFechar(novos) {
  const atual = useRef(novos);
  atual.current = novos;
  const salvo = useRef(false);
  useEffect(() => {
    const lista = atual;
    salvo.current = false;
    return () => { if (!salvo.current) lista.current.forEach((x) => discardAcervoUpload(x.path)); };
  }, []);
  return () => { salvo.current = true; };
}

const VAZIO = { type: '', title: '', act_date: '', signed_by: '', summary: '', body: '', visibility: DOC_VISIBILITY.PUBLIC, tags: '', relations: [], files: [], media_links: [] };

/**
 * Rascunho novo ou edição de um rascunho.
 * @param {{ federation: object, doc?: object, preset?: object, publicados: object[], onFechar: Function }} props
 */
export function DocForm({ federation, doc = null, preset = null, publicados = [], onFechar }) {
  const original = useRef(new Set((doc?.files || []).map((x) => x.path)));
  const [f, setF] = useState(() => {
    const base = { ...VAZIO, ...(preset || {}), ...(doc || {}) };
    return { ...base, tags: Array.isArray(base.tags) ? base.tags.join(', ') : base.tags || '', relations: base.relations || [], files: base.files || [], media_links: base.media_links || [] };
  });
  const [base] = useState(f);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const m = useAcervoMutation(federation, (value) => callAcervo(federation, { action: 'save', docId: doc?.id || null, doc: value }));
  const marcarSalvo = useDescarteAoFechar(f.files.filter((x) => !original.current.has(x.path)));
  useAvisoNaoSalvo(enviando || JSON.stringify(f) !== JSON.stringify(base));
  const addArquivo = (x) => { setF((s) => ({ ...s, files: [...s.files, x] })); setErros({}); };
  const tirarArquivo = (path) => {
    if (!original.current.has(path)) discardAcervoUpload(path);
    setF((s) => ({ ...s, files: s.files.filter((x) => x.path !== path) }));
  };
  const enviar = (e) => {
    e.preventDefault();
    const r = validateDocInput(f, { allowedTypes: allowedDocTypeIds(federation) });
    if (!r.ok) { setErros(r.errors); toast.error(Object.values(r.errors)[0]); return; }
    m.mutate(r.value, {
      onSuccess: () => { marcarSalvo(); toast.success(doc ? t('Rascunho salvo.') : t('Rascunho criado. Confira e publique quando estiver pronto.')); onFechar(); },
      onError: (er) => toast.error(er.message),
    });
  };
  const tipo = docType(f.type);
  const alvos = publicados.filter((x) => x.id !== doc?.id);
  const setRel = (i, patch) => set({ relations: f.relations.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="federacao-acervo-formulario">
      <div className="grid gap-4 sm:grid-cols-2">
        <V2Field label={t('Tipo')} htmlFor="ac-tipo" error={erros.type} required hint={tipo?.numbered ? t('Numerado: o número sai na publicação, por tipo e ano.') : null}><DocTypeSelect id="ac-tipo" entity={federation} value={f.type} onChange={(type) => set({ type })} /></V2Field>
        <V2Field label={t('Quem vê')} htmlFor="ac-visib" hint={t(visibilityHintFor(federation, f.visibility))}>
          <V2Select id="ac-visib" value={f.visibility} onChange={(e) => set({ visibility: e.target.value })}>{Object.values(DOC_VISIBILITY).map((v) => <option key={v} value={v}>{t(visibilityLabelFor(federation, v))}</option>)}</V2Select>
        </V2Field>
      </div>
      <V2Field label={t('Título')} htmlFor="ac-titulo" error={erros.title} required hint={t('Sem o número: "Dispõe sobre o calendário de 2027", "Ata da Assembleia Geral Ordinária".')}><V2Input id="ac-titulo" maxLength={200} value={f.title} onChange={(e) => set({ title: e.target.value })} /></V2Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <V2Field label={t('Data do ato')} htmlFor="ac-data" error={erros.act_date} hint={t('Em branco, vale a data de publicação.')}><V2Input id="ac-data" type="date" value={f.act_date} onChange={(e) => set({ act_date: e.target.value })} /></V2Field>
        <V2Field label={t('Quem assina (opcional)')} htmlFor="ac-assina"><V2Input id="ac-assina" maxLength={160} placeholder={t('Nome e cargo')} value={f.signed_by} onChange={(e) => set({ signed_by: e.target.value })} /></V2Field>
      </div>
      <V2Field label={t('Ementa ou resumo')} htmlFor="ac-resumo" hint={t('Uma ou duas frases do que o documento decide ou contém.')}><V2Textarea id="ac-resumo" rows={2} maxLength={600} value={f.summary} onChange={(e) => set({ summary: e.target.value })} /></V2Field>
      <V2Field label={t('Texto (opcional se houver arquivo)')} htmlFor="ac-texto" error={erros.content}><V2Textarea id="ac-texto" rows={6} maxLength={30000} value={f.body} onChange={(e) => set({ body: e.target.value })} /></V2Field>
      <V2Field label={t('Arquivos')} htmlFor="acervo-arquivos" error={Object.keys(erros).some((k) => k.startsWith('files')) ? t('Um arquivo não serve. Tire-o e envie de novo.') : null}>
        <AcervoUploader entity={federation} value={f.files} onAdd={addArquivo} onRemove={tirarArquivo} onBusy={setEnviando} restricted={f.visibility !== DOC_VISIBILITY.PUBLIC} />
      </V2Field>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">{t('Vídeos por link')}</p>
        <MediaLinksEditor value={f.media_links} onChange={(media_links) => set({ media_links })} errors={erros} />
      </div>
      <div className="space-y-2" data-dica="federacao-acervo-relacoes">
        <p className="text-sm font-semibold text-ink">{t('Relação com documentos publicados')}</p>
        <p className="text-xs text-gray-500">{t('Ao publicar, o documento escolhido ganha a faixa "Revogado por", "Alterado por" ou "Errata publicada". Ele não some.')}</p>
        {erros.relations && <p className="text-sm text-red-600">{erros.relations}</p>}
        {f.relations.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-12">
            <V2Field label={t('Relação')} htmlFor={`ac-rel-k-${i}`} error={erros[`relations.${i}`]} className="sm:col-span-4"><V2Select id={`ac-rel-k-${i}`} value={r.kind} onChange={(e) => setRel(i, { kind: e.target.value })}><option value="">{t('Escolha…')}</option>{Object.values(DOC_RELATION).map((k) => <option key={k} value={k}>{t(DOC_RELATION_LABELS[k])}</option>)}</V2Select></V2Field>
            <V2Field label={t('Documento')} htmlFor={`ac-rel-d-${i}`} className="sm:col-span-7"><V2Select id={`ac-rel-d-${i}`} value={r.doc_id} onChange={(e) => setRel(i, { doc_id: e.target.value })}><option value="">{t('Escolha…')}</option>{alvos.map((x) => <option key={x.id} value={x.id}>{docDisplayTitle(x)}</option>)}</V2Select></V2Field>
            <div className="flex items-end sm:col-span-1"><V2Button type="button" size="sm" variant="ghost" onClick={() => set({ relations: f.relations.filter((_, j) => j !== i) })} aria-label={t('Remover a relação')}><Trash2 className="h-4 w-4" /></V2Button></div>
          </div>
        ))}
        {f.relations.length < DOC_RELATIONS_MAX && alvos.length > 0 && <V2Button type="button" size="sm" variant="ghost" onClick={() => set({ relations: [...f.relations, { kind: '', doc_id: '' }] })}><Plus className="h-4 w-4" />{t('Adicionar relação')}</V2Button>}
        {alvos.length === 0 && <p className="text-xs text-gray-500">{t('As relações ficam disponíveis depois do primeiro documento publicado.')}</p>}
      </div>
      <V2Field label={t('Palavras-chave (opcional)')} htmlFor="ac-tags" error={erros.tags} hint={t('Separadas por vírgula. Ajudam na busca.')}><V2Input id="ac-tags" maxLength={320} value={f.tags} onChange={(e) => set({ tags: e.target.value })} /></V2Field>
      <div className="flex flex-wrap justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button>
        <V2Button type="submit" disabled={m.isPending || enviando}>{enviando ? t('Aguarde o envio…') : t('Salvar rascunho')}</V2Button>
      </div>
    </form>
  );
}
