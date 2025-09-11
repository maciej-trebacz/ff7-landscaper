import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/theme-tomorrow_night';
import 'ace-builds/src-noconflict/ext-language_tools';
import { setCompleters } from 'ace-builds/src-noconflict/ext-language_tools';
import ace from 'ace-builds/src-noconflict/ace';
import './AceOpcodes.js';
import { useEffect, useRef } from 'react';
import { Mnemonic } from '@/ff7/worldscript/opcodes';

interface OpcodesEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  searchQuery?: string;
}

export function OpcodesEditor({ value, onChange, className, searchQuery }: OpcodesEditorProps) {
  const mnemonicValues = Object.values(Mnemonic);
  const editorRef = useRef<any>(null);
  const markerIdsRef = useRef<number[]>([]);
  
  useEffect(() => {
    setCompleters([
      {
        getCompletions: (_editor, _session, _pos, _prefix, callback) => {
          callback(null, mnemonicValues.map(completion => ({
            name: completion,
            value: completion,
            caption: completion,
            meta: 'keyword',
            score: 1000,
          })));
        }
      }
    ]);
  }, []);

  const handleLoad = (editor: any) => {
    editorRef.current = editor;
  };

  // manage markers when search query or value changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const session = editor.getSession();
    for (const id of markerIdsRef.current) {
      session.removeMarker(id);
    }
    markerIdsRef.current = [];
    const query = (searchQuery ?? '').trim();
    if (query.length < 3) return;
    const Search = (ace as any).require('ace/search').Search;
    const search = new Search();
    search.set({ needle: query, caseSensitive: false, regExp: false, wholeWord: false, wrap: false });
    const ranges = search.findAll(session) as any[];
    for (const range of ranges) {
      const id = session.addMarker(range, 'ff7-search-highlight', 'text', true);
      markerIdsRef.current.push(id);
    }
    return () => {
      for (const id of markerIdsRef.current) {
        session.removeMarker(id);
      }
      markerIdsRef.current = [];
    };
  }, [searchQuery, value]);

  return (
    <AceEditor
      mode="ff7opcodes"
      theme="tomorrow_night"
      onLoad={handleLoad}
      onChange={onChange}
      value={value}
      name="ff7opcodes-editor"
      editorProps={{ $blockScrolling: true }}
      setOptions={{
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: false,
        enableSnippets: false,
        showLineNumbers: true,
        tabSize: 2,
        useSoftTabs: true,
        showPrintMargin: false,
        fontSize: 12,
        highlightActiveLine: true,
        highlightGutterLine: true,
      }}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
} 