/**
 * useDocumentMeta — aplica título + meta description + Open Graph no <head>
 * (flag public_seo). Restaura o título anterior ao desmontar. As tags meta que
 * este hook cria são marcadas com data-managed para poder removê-las na saída.
 */

import { useEffect } from 'react';
import { buildMeta } from './meta.js';

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs.key).forEach(([k, v]) => el.setAttribute(k, v));
    el.setAttribute('data-managed-seo', 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('content', attrs.content || '');
  return el;
}

export function useDocumentMeta(input, enabled = true) {
  const title = input?.title;
  const description = input?.description;
  const image = input?.image;
  const url = input?.url;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;
    const meta = buildMeta({ title, description, image, url });
    const prevTitle = document.title;
    document.title = meta.title;

    upsertMeta('meta[name="description"][data-managed-seo]', { key: { name: 'description' }, content: meta.description });
    upsertMeta('meta[property="og:title"][data-managed-seo]', { key: { property: 'og:title' }, content: meta.ogTitle });
    upsertMeta('meta[property="og:description"][data-managed-seo]', { key: { property: 'og:description' }, content: meta.ogDescription });
    if (meta.url) upsertMeta('meta[property="og:url"][data-managed-seo]', { key: { property: 'og:url' }, content: meta.url });
    if (meta.image) upsertMeta('meta[property="og:image"][data-managed-seo]', { key: { property: 'og:image' }, content: meta.image });

    return () => {
      document.title = prevTitle;
      document.head.querySelectorAll('meta[data-managed-seo]').forEach((el) => el.remove());
    };
  }, [enabled, title, description, image, url]);
}
