/**
 * Fotos e vídeos do item: por LINK (YouTube, Vimeo ou imagem https) ou por
 * ENVIO de arquivo. Os limites aparecem ANTES de escolher o arquivo — ninguém
 * deveria descobrir o limite depois de esperar um vídeo subir. Menor de 18
 * anos não envia arquivo (decisão do plano), mas o link continua valendo.
 *
 * O arquivo removido aqui só é apagado do Storage DEPOIS de salvar (quem
 * apaga é a página, por `orphanUploads`): desistir de salvar não pode levar
 * junto um arquivo que o item gravado ainda usa.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, Trash2, Upload, X } from 'lucide-react';
import {
  IMAGE_MIME, MAX_MEDIA, MEDIA_TAGS, MEDIA_TAG_LABELS, VIDEO_MIME, formatTimeSeconds, normalizeMedia,
  parseTimeSeconds, parseVideoUrl, uploadLimits, uploadPermission,
} from '@/modules/training/domain/media';
import { countMyUploads, prepareUpload, uploadTrainingMedia } from '@/modules/training/services/mediaUploadService';
import { V2Button, V2ErrorState, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { IconBtn } from './editorFields';
import { removeAt, replaceAt } from './editorForm';

const num = (n) => String(n).replace('.', ',');

/** Campo de minuto do vídeo: aceita "1:30", "90" ou "1m30s"; grava segundos. */
function TempoInput({ id, label, segundos, onCommit }) {
  const [texto, setTexto] = useState(segundos ? formatTimeSeconds(segundos) : '');
  const [erro, setErro] = useState('');
  return (
    <V2Field label={label} htmlFor={id} error={erro}>
      <V2Input
        id={id}
        inputMode="numeric"
        placeholder="0:00"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          if (!texto.trim()) { setErro(''); onCommit(null); return; }
          const s = parseTimeSeconds(texto);
          if (s === null) { setErro('Use 1:30, 90 ou 1m30s.'); return; }
          setErro('');
          setTexto(s ? formatTimeSeconds(s) : '');
          onCommit(s || null);
        }}
      />
    </V2Field>
  );
}

/** O link vira vídeo (YouTube, Vimeo, arquivo de vídeo) ou imagem. */
function mediaFromLink(url) {
  const limpo = String(url || '').trim();
  if (!limpo.startsWith('https://')) return { erro: 'Use um link que comece com https://' };
  const tipo = parseVideoUrl(limpo) ? 'video' : 'image';
  const m = normalizeMedia({ type: tipo, source: 'url', url: limpo, tag: 'demo' });
  return m ? { media: m } : { erro: 'Não reconheci esse link. Use YouTube, Vimeo ou o endereço direto de uma imagem.' };
}

export default function MediaInput({ value = [], onChange, identity, settings, onBusyChange, onUploaded }) {
  const lista = Array.isArray(value) ? value : [];
  const cheio = lista.length >= MAX_MEDIA;
  const limits = uploadLimits(settings || {});
  const menor = Number.isFinite(identity?.ageYears) && identity.ageYears < 18;
  const uid = identity?.uid || null;

  const contagem = useQuery({
    queryKey: ['treino', 'midia', 'contagem', uid],
    queryFn: () => countMyUploads(uid),
    enabled: !!uid && limits.enabled && !menor,
    staleTime: 60_000,
  });

  const [link, setLink] = useState('');
  const [erroLink, setErroLink] = useState('');
  const [envio, setEnvio] = useState(null); // { progresso, nome }
  const [aviso, setAviso] = useState('');
  const [erroEnvio, setErroEnvio] = useState('');
  const arquivoRef = useRef(null);
  const tarefaRef = useRef(null);
  // A lista ATUAL ao fim do envio (a pessoa pode ter mexido nas legendas enquanto subia).
  const listaRef = useRef(lista);
  listaRef.current = lista;

  // Saiu da tela no meio do envio: cancela (senão sobra arquivo sem dono).
  useEffect(() => () => { try { tarefaRef.current?.cancel?.(); } catch { /* já terminou */ } }, []);

  const permissao = uploadPermission({ ageYears: identity?.ageYears ?? null, limits, usedCount: contagem.data ?? 0 });

  const adicionarLink = () => {
    const r = mediaFromLink(link);
    if (r.erro) { setErroLink(r.erro); return; }
    onChange([...lista, r.media]);
    setLink('');
    setErroLink('');
  };

  const aoEscolherArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || cheio) return;
    setErroEnvio('');
    setAviso('');
    setEnvio({ progresso: 0, nome: file.name });
    onBusyChange?.(true);
    try {
      const prep = await prepareUpload(file, limits);
      if (!prep.ok) { setErroEnvio(prep.error); return; }
      if (prep.warning) setAviso(prep.warning);
      const { task, done } = uploadTrainingMedia(prep.file, {
        uid,
        type: prep.type,
        onProgress: (p) => setEnvio((s) => (s ? { ...s, progresso: p } : s)),
      });
      tarefaRef.current = task;
      const r = await done;
      const m = normalizeMedia({ type: r.type, source: 'upload', url: r.url, path: r.path, tag: 'demo' });
      if (m) {
        onUploaded?.(r.path);
        onChange([...listaRef.current, m]);
      }
      contagem.refetch();
    } catch (err) {
      if (!err?.canceled) setErroEnvio(err?.message || 'Não foi possível enviar o arquivo.');
    } finally {
      tarefaRef.current = null;
      setEnvio(null);
      onBusyChange?.(false);
    }
  };

  const cancelar = () => { try { tarefaRef.current?.cancel?.(); } catch { /* já terminou */ } };

  const mudar = (i, patch) => onChange(replaceAt(lista, i, { ...lista[i], ...patch }));

  const limitesTexto = [
    `Imagens JPG, PNG ou WebP de até ${num(limits.imageMb)} MB.`,
    limits.videoEnabled
      ? `Vídeos MP4, WebM ou MOV de até ${num(limits.videoMb)} MB e ${limits.videoSeconds} segundos.`
      : 'Vídeo, só por link.',
  ].join(' ');

  return (
    <div className="space-y-5">
      {lista.length > 0 && (
        <ul className="space-y-3">
          {lista.map((m, i) => {
            const video = m.type === 'video' ? parseVideoUrl(m.url) : null;
            const miniatura = m.type === 'image' ? m.url : video?.thumbUrl;
            return (
              <li key={`${m.url}-${i}`} className="rounded-3xl border border-gray-100 bg-paper p-3">
                <div className="flex items-start gap-3">
                  {miniatura ? (
                    <img src={miniatura} alt="" loading="lazy" className="h-16 w-24 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-bold text-gray-500">Vídeo</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink">
                      {m.type === 'video' ? 'Vídeo' : 'Imagem'} · {m.source === 'upload' ? 'arquivo enviado' : 'link'}
                    </p>
                    <p className="truncate text-xs text-gray-500">{m.url}</p>
                  </div>
                  <IconBtn label={`Remover mídia ${i + 1}`} onClick={() => onChange(removeAt(lista, i))}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </IconBtn>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <V2Field label="Legenda: o que observar" htmlFor={`midia-${i}-legenda`} className="sm:col-span-2">
                    <V2Input
                      id={`midia-${i}-legenda`}
                      maxLength={140}
                      value={m.caption || ''}
                      onChange={(e) => mudar(i, { caption: e.target.value })}
                      placeholder="Ex.: repare na raquete parada na frente do corpo"
                    />
                  </V2Field>
                  <V2Field label="Mostra" htmlFor={`midia-${i}-marca`}>
                    <V2Select
                      id={`midia-${i}-marca`}
                      value={m.tag || 'demo'}
                      onChange={(e) => mudar(i, { tag: e.target.value })}
                      options={MEDIA_TAGS.map((t) => ({ value: t, label: MEDIA_TAG_LABELS[t] }))}
                    />
                  </V2Field>
                  {m.type === 'video' && (
                    <div className="grid grid-cols-2 gap-3">
                      <TempoInput id={`midia-${i}-ini`} label="Começa em" segundos={m.start} onCommit={(s) => mudar(i, { start: s })} />
                      <TempoInput id={`midia-${i}-fim`} label="Termina em" segundos={m.end} onCommit={(s) => mudar(i, { end: s })} />
                    </div>
                  )}
                </div>
                {m.source === 'upload' && (
                  <p className="mt-2 text-xs text-gray-400">Se remover, o arquivo é apagado quando você salvar.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {cheio ? (
        <p className="text-sm text-gray-500">Chegou a {MAX_MEDIA} mídias, o máximo por item.</p>
      ) : (
        <>
          <V2Field
            label="Adicionar por link"
            htmlFor="midia-link"
            error={erroLink}
            hint="YouTube ou Vimeo (o minuto do link vira o início), ou o endereço direto de uma imagem."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <V2Input
                id="midia-link"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={link}
                onChange={(e) => { setLink(e.target.value); setErroLink(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarLink(); } }}
              />
              <V2Button type="button" variant="secondary" onClick={adicionarLink} disabled={!link.trim()}>
                <Link2 className="h-4 w-4" aria-hidden="true" /> Adicionar
              </V2Button>
            </div>
          </V2Field>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">Enviar arquivo</p>
            {menor || !limits.enabled ? (
              <p className="text-sm text-gray-500">{permissao.reason}</p>
            ) : contagem.isError ? (
              <V2ErrorState
                inline
                title="Não deu para conferir quantos arquivos você já enviou"
                description="O envio volta assim que a conferência passar. O link continua valendo."
                onRetry={contagem.refetch}
              />
            ) : (
              <>
                <p className="text-xs leading-5 text-gray-500">
                  {limitesTexto}
                  {contagem.isSuccess && ` Você já enviou ${contagem.data} de ${limits.perUser}.`}
                </p>
                {!permissao.ok && contagem.isSuccess && <p className="text-sm text-gray-500">{permissao.reason}</p>}
                <input
                  ref={arquivoRef}
                  type="file"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  accept={[...IMAGE_MIME, ...(limits.videoEnabled ? VIDEO_MIME : [])].join(',')}
                  onChange={aoEscolherArquivo}
                />
                {envio ? (
                  <div className="space-y-2" role="status">
                    <p className="text-xs text-gray-600">Enviando {envio.nome} · {envio.progresso}%</p>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
                      role="progressbar"
                      aria-label="Progresso do envio"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={envio.progresso}
                    >
                      <div className="h-full bg-acid transition-all" style={{ width: `${envio.progresso}%` }} />
                    </div>
                    <V2Button type="button" variant="ghost" size="sm" onClick={cancelar}>
                      <X className="h-4 w-4" aria-hidden="true" /> Cancelar envio
                    </V2Button>
                  </div>
                ) : (
                  <V2Button
                    type="button"
                    variant="secondary"
                    disabled={!contagem.isSuccess || !permissao.ok}
                    onClick={() => arquivoRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" /> {contagem.isSuccess ? 'Escolher arquivo' : 'Conferindo o limite…'}
                  </V2Button>
                )}
              </>
            )}
            {aviso && <p className="text-xs text-amber-700">{aviso}</p>}
            {erroEnvio && <p role="alert" className="text-xs font-medium text-red-500">{erroEnvio}</p>}
          </div>
        </>
      )}
    </div>
  );
}
