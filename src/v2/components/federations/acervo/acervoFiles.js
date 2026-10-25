/**
 * Arquivos do acervo oficial no navegador: abrir, baixar e conferir o
 * SHA-256. O arquivo de documento PÚBLICO tem link direto (com token); o de
 * documento restrito (só filiados, só equipe) ou de rascunho vem do servidor
 * (`federationAcervo`, ação `file`, até 9 MB) — a regra do Storage não
 * consulta o banco e a pasta oficial é fechada a ela.
 */
import { fetchAcervoFile } from '@/modules/federations/services/federationService';
import { fetchClubDocFile } from '@/modules/clubs/services/clubDocsService';

/** O conteúdo de um arquivo sem link público, como Blob. Com `clubId` é o acervo do clube; senão, o da federação. */
export async function fetchAcervoBlob({ federationId, clubId, docId, file }) {
  const r = clubId ? await fetchClubDocFile({ clubId, docId, path: file.path }) : await fetchAcervoFile({ federationId, docId, path: file.path });
  const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
  return { blob: new Blob([bytes], { type: r.contentType }), name: r.name || file.name || 'arquivo' };
}

/** Baixa um Blob com o nome dado (âncora com `download`). */
export function baixarBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'arquivo';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Abre o arquivo: o link público direto; sem link, o servidor entrega o
 * conteúdo e ele é BAIXADO — abrir aba depois de uma espera o navegador
 * bloqueia como janela não pedida.
 */
export async function abrirArquivoDoAcervo({ federationId, clubId, doc, file }) {
  if (file.url) { window.open(file.url, '_blank', 'noopener,noreferrer'); return; }
  const { blob, name } = await fetchAcervoBlob({ federationId, clubId, docId: doc.id, file });
  baixarBlob(blob, name);
}

/** O SHA-256 (hex) de um arquivo que a pessoa escolheu no aparelho. */
export async function sha256DoArquivo(arquivo) {
  const buf = await arquivo.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
