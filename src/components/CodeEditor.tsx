import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sql } from '@codemirror/lang-sql';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import { indentWithTab } from '@codemirror/commands';
import { Wand2 } from 'lucide-react';
import type { CodeSnippet } from '@shared/types';

/** Lightweight, dependency-free formatter: normalises whitespace and
 *  brace-based indentation. Deliberately honest — it is not a full Prettier. */
export function formatCode(source: string, language: CodeSnippet['language']): string {
  const lines = source.replace(/\t/g, '  ').split('\n').map(l => l.trimEnd());
  if (language === 'text') return lines.join('\n');
  let depth = 0;
  const out = lines.map(raw => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const closesFirst = /^[}\])>]/.test(trimmed);
    const opens = (trimmed.match(/[{[(]/g) || []).length;
    const closes = (trimmed.match(/[}\])]/g) || []).length;
    if (closesFirst) depth = Math.max(0, depth - 1);
    const line = '  '.repeat(depth) + trimmed;
    depth = Math.max(0, depth + opens - closes + (closesFirst ? 0 : 0));
    return line;
  });
  return out.join('\n');
}

export function CodeEditor({ value, onChange, language = 'javascript', height = 240, readOnly = false, showFormat = true }: {
  value: string; onChange: (v: string) => void; language?: CodeSnippet['language']; height?: number; readOnly?: boolean; showFormat?: boolean;
}) {
  const extensions = useMemo(() => {
    const lang = language === 'javascript' ? javascript()
      : language === 'jsx' ? javascript({ jsx: true })
      : language === 'html' ? html()
      : language === 'css' ? css()
      : language === 'sql' ? sql()
      : [];
    return [
      lang,
      EditorView.lineWrapping,          // prevents horizontal overflow on phones
      indentUnit.of('  '),
      EditorState.tabSize.of(2),
      keymap.of([indentWithTab]),
    ].flat();
  }, [language]);

  return (
    <div className="editor-shell">
      <div className="editor-bar">
        <span>⌨ {language.toUpperCase()} · CodeMirror 6</span>
        <span className="row" style={{ gap: 6 }}>
          {showFormat && !readOnly && (
            <button className="btn sm" style={{ minHeight: 28, padding: '3px 9px', background: 'rgba(255,255,255,.12)', border: '2px solid #F1F7EF', color: '#F1F7EF', boxShadow: 'none' }}
              onClick={() => onChange(formatCode(value, language))} title="Format indentation">
              <Wand2 size={13} /> Format
            </button>
          )}
        </span>
      </div>
      <CodeMirror
        value={value}
        height={`${height}px`}
        extensions={extensions}
        theme="dark"
        editable={!readOnly}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, bracketMatching: true, autocompletion: true, indentOnInput: true, closeBrackets: true }}
        onChange={onChange}
      />
    </div>
  );
}

