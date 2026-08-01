'use client';

import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import type { editor } from 'monaco-editor';
import type { Language, SessionSignals } from '@repo/contracts';
import { useWorkspaceStore } from '@/stores/workspace.store';

const MONACO_LANGUAGE: Record<Language, string> = {
  PYTHON: 'python',
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  CPP: 'cpp',
  C: 'c',
  JAVA: 'java',
  CSHARP: 'csharp',
  GO: 'go',
  RUST: 'rust',
  PHP: 'php',
  KOTLIN: 'kotlin',
  SWIFT: 'swift',
};

const SEVERITY_TO_MARKER: Record<string, number> = { ERROR: 8, WARNING: 4, INFO: 2 };

interface Props {
  language: Language;
  value: string;
  fontSize: number;
  onChange: (value: string) => void;
  onCursorChange: (line: number, column: number) => void;
}

export function CodeEditor({ language, value, fontSize, onChange, onCursorChange }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const signals = useWorkspaceStore((s) => s.signals);

  const handleMount: OnMount = (instance, monaco) => {
    editorRef.current = instance;
    monacoRef.current = monaco;

    monaco.editor.defineTheme('mentor-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5a6273', fontStyle: 'italic' },
        { token: 'keyword', foreground: '818cf8' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'type', foreground: '7dd3fc' },
        { token: 'function', foreground: 'c4b5fd' },
      ],
      colors: {
        'editor.background': '#0b0d12',
        'editor.foreground': '#e3e7ee',
        'editorLineNumber.foreground': '#3d4553',
        'editorLineNumber.activeForeground': '#8b93a5',
        'editor.lineHighlightBackground': '#14171e',
        'editor.selectionBackground': '#6366f133',
        'editorCursor.foreground': '#818cf8',
        'editorIndentGuide.background1': '#1f242f',
        'editorGutter.background': '#0b0d12',
        'editorWidget.background': '#14171e',
        'editorWidget.border': '#2b313e',
        'editorSuggestWidget.background': '#14171e',
        'editorSuggestWidget.border': '#2b313e',
        'scrollbarSlider.background': '#2b313e88',
      },
    });
    monaco.editor.setTheme('mentor-dark');

    instance.onDidChangeCursorPosition((event) => {
      onCursorChange(event.position.lineNumber - 1, event.position.column - 1);
    });
  };

  /**
   * Stage-1 findings become Monaco markers.
   *
   * These arrive on every 2-second tick and cost nothing to produce — this is
   * the visible half of "the AI is watching" that never spends an LLM call.
   */
  useEffect(() => {
    const monaco = monacoRef.current;
    const instance = editorRef.current;
    if (!monaco || !instance) return;
    const model = instance.getModel();
    if (!model) return;

    monaco.editor.setModelMarkers(model, 'mentor', buildMarkers(signals));
  }, [signals]);

  return (
    <Editor
      height="100%"
      theme="mentor-dark"
      language={MONACO_LANGUAGE[language]}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      onMount={handleMount}
      loading={<div className="skeleton h-full w-full" />}
      options={{
        fontSize,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontLigatures: true,
        lineHeight: 1.65,
        minimap: { enabled: false },
        padding: { top: 16, bottom: 16 },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        renderLineHighlight: 'all',
        roundedSelection: true,
        automaticLayout: true,
        tabSize: 4,
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: false },
        suggestOnTriggerCharacters: true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
    />
  );
}

function buildMarkers(signals: SessionSignals | null): editor.IMarkerData[] {
  if (!signals) return [];
  return signals.findings.map((finding) => ({
    severity: SEVERITY_TO_MARKER[finding.severity] ?? 2,
    message: finding.message,
    source: 'mentor',
    startLineNumber: finding.range.startLine + 1,
    startColumn: finding.range.startColumn + 1,
    endLineNumber: finding.range.endLine + 1,
    // Monaco needs a non-empty range or the squiggle collapses to nothing.
    endColumn: Math.max(finding.range.endColumn + 1, finding.range.startColumn + 2),
  }));
}
