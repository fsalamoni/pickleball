import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/core/lib/utils';
import { ZoomableImage } from '@/components/ui/photo-lightbox';

/**
 * Renderizador seguro de Markdown (GitHub Flavored Markdown).
 *
 * Segurança: o react-markdown NÃO interpreta HTML embutido por padrão (não
 * usamos rehype-raw), portanto o conteúdo é imune a injeção de HTML/scripts.
 * Suporta títulos, listas, tabelas, citações, código, links e ênfase.
 *
 * Estilização manual via overrides de componentes (o projeto não usa o plugin
 * de typography do Tailwind).
 */

const COMPONENTS = {
  h1: ({ _node, ...props }) => <h1 className="mt-4 mb-2 text-xl font-bold text-slate-900 first:mt-0" {...props} />,
  h2: ({ _node, ...props }) => <h2 className="mt-4 mb-2 text-lg font-bold text-slate-900 first:mt-0" {...props} />,
  h3: ({ _node, ...props }) => <h3 className="mt-3 mb-1.5 text-base font-semibold text-slate-900 first:mt-0" {...props} />,
  h4: ({ _node, ...props }) => <h4 className="mt-3 mb-1.5 text-sm font-semibold text-slate-900 first:mt-0" {...props} />,
  h5: ({ _node, ...props }) => <h5 className="mt-2 mb-1 text-sm font-semibold text-slate-800 first:mt-0" {...props} />,
  h6: ({ _node, ...props }) => <h6 className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 first:mt-0" {...props} />,
  p: ({ _node, ...props }) => <p className="my-2 leading-7 first:mt-0 last:mb-0" {...props} />,
  a: ({ _node, ...props }) => (
    <a
      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
      target="_blank"
      rel="noopener noreferrer nofollow"
      {...props}
    />
  ),
  ul: ({ _node, ...props }) => <ul className="my-2 ml-5 list-disc space-y-1 marker:text-emerald-600" {...props} />,
  ol: ({ _node, ...props }) => <ol className="my-2 ml-5 list-decimal space-y-1 marker:text-emerald-600" {...props} />,
  li: ({ _node, ...props }) => <li className="leading-7" {...props} />,
  blockquote: ({ _node, ...props }) => (
    <blockquote className="my-3 border-l-4 border-emerald-300 bg-emerald-50/60 py-1 pl-4 pr-2 italic text-slate-700" {...props} />
  ),
  hr: () => <hr className="my-4 border-emerald-950/10" />,
  strong: ({ _node, ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
  em: ({ _node, ...props }) => <em className="italic" {...props} />,
  // react-markdown v9 não fornece mais a prop `inline`; detectamos código de
  // bloco pela presença de quebra de linha no conteúdo.
  code: ({ _node, className, children, ...props }) => {
    const text = String(children ?? '');
    const isBlock = text.includes('\n');
    if (isBlock) {
      return (
        <code className={cn('font-mono text-[0.85em]', className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-emerald-950/8 px-1.5 py-0.5 font-mono text-[0.85em] text-emerald-900" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ _node, ...props }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-slate-100" {...props} />
  ),
  table: ({ _node, ...props }) => (
    <div className="my-3 w-full overflow-x-auto rounded-lg border border-emerald-950/10">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: ({ _node, ...props }) => <thead className="bg-secondary/50" {...props} />,
  th: ({ _node, ...props }) => <th className="border border-emerald-950/10 px-3 py-2 text-left font-semibold text-slate-800" {...props} />,
  td: ({ _node, ...props }) => <td className="border border-emerald-950/10 px-3 py-2 align-top text-slate-700" {...props} />,
  img: ({ _node, src, alt, ...props }) => (
    <ZoomableImage
      src={src}
      alt={alt || ''}
      className="my-2"
      imgClassName="max-h-80 rounded-lg border border-emerald-950/10"
      title={alt || 'Imagem'}
      {...props}
    />
  ),
};

export function MarkdownContent({ children, className }) {
  const content = String(children ?? '');
  if (!content.trim()) return null;
  return (
    <div className={cn('text-sm text-slate-700 break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownContent;
