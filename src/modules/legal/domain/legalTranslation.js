/**
 * Tradução de CORTESIA dos documentos legais (en, es).
 *
 * O texto em português é o que vale juridicamente — e o único que entra no
 * consentimento (`key`/`version` não mudam com o idioma). As traduções moram em
 * `legal/i18n/documentos/<codigo>.js`, uma entrada por `key`, com a MESMA
 * estrutura de seções e uma impressão (`fonte`) do texto em português de onde
 * saíram. Mudou o português e a impressão não bate: a tela mostra o original
 * (nunca uma tradução velha) e `legalTranslation.test.js` reprova, dizendo qual
 * documento ficou para trás.
 */

/** Só o que é TEXTO do documento (o resto não é traduzido). */
function textoDoDocumento(doc) {
  return {
    title: doc.title,
    eyebrow: doc.eyebrow,
    description: doc.description,
    sections: doc.sections.map((s) => ({
      title: s.title,
      description: s.description || null,
      paragraphs: s.paragraphs || [],
      bullets: s.bullets || [],
    })),
  };
}

/** Impressão (FNV-1a 32 bits) do texto em português do documento. */
export function legalSourceHash(doc) {
  const s = JSON.stringify(textoDoDocumento(doc));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * O documento traduzido (mesmos `key`, `version`, ícones e metadados), ou null
 * quando não há tradução ou ela é de outra versão do texto em português.
 */
export function legalDocTranslation(doc, mapa) {
  const tr = doc && mapa?.[doc.key];
  if (!tr || tr.fonte !== legalSourceHash(doc) || tr.sections?.length !== doc.sections.length) return null;
  return {
    ...doc,
    title: tr.title,
    eyebrow: tr.eyebrow,
    description: tr.description,
    sections: doc.sections.map((s, i) => ({ ...s, ...tr.sections[i] })),
  };
}
