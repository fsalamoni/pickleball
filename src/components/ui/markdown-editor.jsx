import React, { useRef, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  Code2,
  Table as TableIcon,
  Eye,
  Pencil,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { MarkdownContent } from '@/components/ui/markdown-content';

/**
 * Editor de texto rico baseado em Markdown com barra de ferramentas e
 * pré-visualização. Gera Markdown padrão (GFM), renderizado com segurança por
 * `MarkdownContent`. Suporta títulos, ênfase, listas, citações, links, código
 * e tabelas — cobrindo a necessidade de "edição de texto, títulos e tabelas".
 */

const TABLE_SNIPPET = '\n| Coluna A | Coluna B |\n| --- | --- |\n| Valor 1 | Valor 2 |\n| Valor 3 | Valor 4 |\n';

function ToolbarButton({ title, onClick, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Escreva aqui. Use a barra para formatar (negrito, títulos, tabelas…).',
  rows = 5,
  maxLength = 20000,
  disabled = false,
  className,
  id,
}) {
  const textareaRef = useRef(null);
  const [mode, setMode] = useState('write'); // 'write' | 'preview'

  const applyWrap = useCallback(
    (before, after = before, placeholderText = '') => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const selected = value.slice(start, end) || placeholderText;
      const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
      onChange(next.slice(0, maxLength));
      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + before.length;
        el.setSelectionRange(cursor, cursor + selected.length);
      });
    },
    [value, onChange, maxLength],
  );

  const applyLinePrefix = useCallback(
    (prefix) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? value.length;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
      onChange(next.slice(0, maxLength));
      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + prefix.length;
        el.setSelectionRange(cursor, cursor);
      });
    },
    [value, onChange, maxLength],
  );

  const insertText = useCallback(
    (text) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? value.length;
      const next = `${value.slice(0, start)}${text}${value.slice(start)}`;
      onChange(next.slice(0, maxLength));
      requestAnimationFrame(() => {
        el?.focus();
        const cursor = start + text.length;
        el?.setSelectionRange(cursor, cursor);
      });
    },
    [value, onChange, maxLength],
  );

  const insertLink = useCallback(() => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || 'texto do link';
    applyWrap('[', '](https://)', selected);
  }, [value, applyWrap]);

  return (
    <div className={cn('rounded-lg border border-input bg-background', disabled && 'opacity-70', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-emerald-950/10 px-1.5 py-1">
        <ToolbarButton title="Negrito" onClick={() => applyWrap('**', '**', 'negrito')} disabled={disabled || mode === 'preview'}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Itálico" onClick={() => applyWrap('_', '_', 'itálico')} disabled={disabled || mode === 'preview'}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Título" onClick={() => applyLinePrefix('## ')} disabled={disabled || mode === 'preview'}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-emerald-950/10" />
        <ToolbarButton title="Lista" onClick={() => applyLinePrefix('- ')} disabled={disabled || mode === 'preview'}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" onClick={() => applyLinePrefix('1. ')} disabled={disabled || mode === 'preview'}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Citação" onClick={() => applyLinePrefix('> ')} disabled={disabled || mode === 'preview'}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-emerald-950/10" />
        <ToolbarButton title="Link" onClick={insertLink} disabled={disabled || mode === 'preview'}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Código" onClick={() => applyWrap('`', '`', 'código')} disabled={disabled || mode === 'preview'}>
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Tabela" onClick={() => insertText(TABLE_SNIPPET)} disabled={disabled || mode === 'preview'}>
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'write' ? 'preview' : 'write'))}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
          >
            {mode === 'write' ? <><Eye className="h-3.5 w-3.5" /> Prévia</> : <><Pencil className="h-3.5 w-3.5" /> Editar</>}
          </button>
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className="block w-full resize-y border-0 bg-transparent px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-[6rem] px-3 py-2.5">
          {value.trim() ? (
            <MarkdownContent>{value}</MarkdownContent>
          ) : (
            <p className="text-sm text-slate-400">Nada para pré-visualizar ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default MarkdownEditor;
