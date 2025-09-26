import AceEditor from "react-ace"
import "ace-builds/src-noconflict/theme-tomorrow_night"
import "ace-builds/src-noconflict/ext-language_tools"
import "ace-builds/src-noconflict/ext-searchbox"
import { setCompleters } from "ace-builds/src-noconflict/ext-language_tools"
import ace from "ace-builds/src-noconflict/ace"
import "./AceWorldscript.js"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Opcodes, Namespace } from "../../ff7/worldscript/opcodes"
import { SPECIAL_MAP, modelsMapping, fieldsMapping } from "../../ff7/worldscript/constants"

interface WorldscriptEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  onContextChange?: (ctx: CallContext | null) => void
  showDetails?: boolean // show opcode description, notes and param descriptions
  searchQuery?: string
}

export type CallParamMeta = { name: string; description: string; type?: any }
export type CallArg = { text: string; startCol: number; endCol: number }
export type CallContext = {
  row: number
  namespace: string
  method: string
  description?: string
  params: CallParamMeta[]
  activeParamIndex: number
  args: CallArg[]
}

export type WorldscriptEditorHandle = {
  replaceCurrentCallArg: (index: number, newText: string) => void
  replaceCurrentCallArgs: (updates: Array<{ index: number; newText: string }>) => void
  getLine: (row: number) => string | null
  getLineCount: () => number
  moveCursorTo: (row: number, col?: number) => void
  isReady: () => boolean
  getCursorPosition: () => { row: number; column: number } | null
}

export const WorldscriptEditor = forwardRef<WorldscriptEditorHandle, WorldscriptEditorProps>(function WorldscriptEditor(
  { value, onChange, className, onContextChange, showDetails = false, searchQuery },
  ref
) {
  const editorRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const searchMarkerIdsRef = useRef<number[]>([])
  const namespacesRef = useRef<string[]>([])
  const methodsByNamespaceRef = useRef<
    Record<
      string,
      {
        name: string
        description: string
        stackParams: number
        stackParamsDef?: Array<{ name: string; description: string }>
        notes?: string
      }[]
    >
  >({})
  const lastCallRef = useRef<CallContext | null>(null)
  // Toggle to enable/disable the inline signature popover UI without removing logic
  const ENABLE_SIGNATURE_POPOVER = true
  const [popoverHovered, setPopoverHovered] = useState(false)
  const [signatureHelp, setSignatureHelp] = useState<{
    type: 'function' | 'goto'
    // Function call properties
    namespace?: string
    method?: string
    paramNames?: string[]
    paramDescriptions?: string[]
    description?: string
    activeParamIndex?: number
    totalParams?: number
    // Goto label properties
    label?: string
    labelLine?: number
    top: number
    left: number
  } | null>(null)
  useEffect(() => {
    const namespaceNames = Object.values(Namespace) as string[]
    // For autocomplete, also expose pseudo-namespaces that provide constant-based members
    const autocompleteNamespaces = Array.from(new Set([...namespaceNames, "Entities", "Fields"]))
    const methodsByNamespace: Record<
      string,
      {
        name: string
        description: string
        stackParams: number
        stackParamsDef?: Array<{ name: string; description: string }>
      }[]
    > = {}
    for (const def of Object.values(Opcodes)) {
      const list = methodsByNamespace[def.namespace] ?? []
      const mergedDescription = def.notes ? `${def.description} ${def.notes}` : def.description
      list.push({
        name: def.name,
        description: mergedDescription,
        stackParams: def.stackParams,
        stackParamsDef: def.stackParamsDef,
      })
      methodsByNamespace[def.namespace] = list
    }

    // Special namespace: provide fields instead of methods
    const specialFields = Object.values(SPECIAL_MAP).map((v) => v.name)
    // Entities namespace: provide model slugs instead of methods
    const entitySlugs = Object.values(modelsMapping)
    // Fields namespace: provide field slugs instead of methods
    const fieldSlugs = Object.values(fieldsMapping)

    // Save for handlers
    namespacesRef.current = namespaceNames
    methodsByNamespaceRef.current = methodsByNamespace

    setCompleters([
      {
        getCompletions: (_editor, session, pos, prefix, callback) => {
          const line = session.getLine(pos.row) as string
          const tokenStartColumn = Math.max(0, pos.column - (prefix?.length ?? 0))

          const beforeToken = line.slice(0, tokenStartColumn)
          const isTokenAtLineStart = /^\s*$/.test(beforeToken)

          const indexBeforePrefix = tokenStartColumn - 1
          const charBeforePrefix = indexBeforePrefix >= 0 ? line[indexBeforePrefix] : ""
          const isAfterSpaceOrParen = charBeforePrefix === " " || charBeforePrefix === "("

          // Check for Namespace.method context like "System." or "System.di"
          const lastDotIndex = beforeToken.lastIndexOf(".")
          if (lastDotIndex !== -1) {
            const beforeDot = beforeToken.slice(0, lastDotIndex)
            // Support both "Namespace.method" and special array syntax like "Savemap[0xF29].method"
            const nsMatch = beforeDot.match(/([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[[^\]]*\])?\s*$/)
            const typedNamespace = nsMatch?.[1]
            if (typedNamespace && autocompleteNamespaces.includes(typedNamespace)) {
              if (typedNamespace === "Special") {
                const candidates = prefix ? specialFields.filter((n) => n.startsWith(prefix)) : specialFields
                callback(
                  null,
                  candidates.map((n) => ({
                    name: n,
                    value: n,
                    caption: n,
                    // Suggest property-like items without parentheses
                    meta: "Special",
                    score: 1000,
                  }))
                )
                return
              }
              if (typedNamespace === "Entities") {
                const candidates = prefix ? entitySlugs.filter((n) => n.startsWith(prefix)) : entitySlugs
                callback(
                  null,
                  candidates.map((n) => ({
                    name: n,
                    value: n,
                    caption: n,
                    meta: "Entities",
                    score: 1000,
                  }))
                )
                return
              }
              if (typedNamespace === "Fields") {
                const candidates = prefix ? fieldSlugs.filter((n) => n.startsWith(prefix)) : fieldSlugs
                callback(
                  null,
                  candidates.map((n) => ({
                    name: n,
                    value: n,
                    caption: n,
                    meta: "Fields",
                    score: 1000,
                  }))
                )
                return
              }

              const methods = methodsByNamespace[typedNamespace] ?? []
              const filtered = prefix ? methods.filter((m) => m.name.startsWith(prefix)) : methods
              callback(
                null,
                filtered.map((m) => ({
                  name: m.name,
                  value: m.name,
                  caption: m.name,
                  // Insert parentheses and place caret inside
                  snippet: `${m.name}($0)`,
                  meta: typedNamespace,
                  score: 1000,
                }))
              )
              return
            }
          }

          // Otherwise suggest Namespaces only in the allowed positions
          if (isTokenAtLineStart || isAfterSpaceOrParen) {
            const filteredNamespaces = prefix
              ? autocompleteNamespaces.filter((n) => n.startsWith(prefix))
              : autocompleteNamespaces
            callback(
              null,
              filteredNamespaces.map((n) => ({
                name: n,
                value: n,
                caption: n,
                meta: "namespace",
                score: 1000,
              }))
            )
            return
          }

          callback(null, [])
        },
      },
    ])
  }, [])

  const suppressNextSignatureRef = useRef<boolean>(false)
  const popoverMouseDownRef = useRef<boolean>(false)

  const clearSignatureHelp = (options?: { preserveContext?: boolean }) => {
    setSignatureHelp(null)
    setPopoverHovered(false)
    if (!options?.preserveContext) {
      lastCallRef.current = null
      onContextChange?.(null)
    }
    popoverMouseDownRef.current = false
  }

  const hideSignatureHelp = () => {
    if (!popoverHovered) {
      clearSignatureHelp({ preserveContext: true })
    }
  }

  const updateSignatureHelp = (editor: any, options?: { silent?: boolean }) => {
    const session = editor.getSession()
    const pos = editor.getCursorPosition()
    const line: string = session.getLine(pos.row)

    // Check for goto statements first
    const gotoMatch = line.match(/^\s*goto\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/)
    if (gotoMatch) {
      const labelName = gotoMatch[1]

      // Find the label definition line
      let labelLine = -1
      const totalLines = session.getLength()
      for (let i = 0; i < totalLines; i++) {
        const lineContent = session.getLine(i)
        if (lineContent.trim() === `::${labelName}::`) {
          labelLine = i
          break
        }
      }

      if (labelLine !== -1) {
        setPopoverHovered(false)
        // Position near cursor
        const coords = editor.renderer.textToScreenCoordinates(pos.row, pos.column)
        const container = containerRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()
        const top = coords.pageY - rect.top + editor.renderer.lineHeight
        const left = coords.pageX - rect.left

        if (!options?.silent) {
          setSignatureHelp({
            type: 'goto',
            label: labelName,
            labelLine: labelLine,
            top,
            left,
          })
        }
        lastCallRef.current = null
        onContextChange?.(null)
        return
      }
      clearSignatureHelp()
      return
    }

    type ParsedCall = {
      ns: string
      method: string
      nsStart: number
      openIndex: number
      closeIndex: number
    }

    // Find all Namespace.method(...) calls on this line (supports optional [..] after namespace)
    const calls: ParsedCall[] = []
    const regex = /([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[[^\]]*\])?\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(line)) !== null) {
      const nsStart = m.index
      const ns = m[1]
      const method = m[2]
      const openIndex = nsStart + m[0].length - 1 // last char is '('
      // Scan forward to find matching close paren for this call
      let depth = 0
      let closeIndex = line.length
      for (let i = openIndex + 1; i < line.length; i++) {
        const ch = line[i]
        if (ch === "(") depth++
        else if (ch === ")") {
          if (depth === 0) {
            closeIndex = i
            break
          }
          depth--
        }
      }
      calls.push({ ns, method, nsStart, openIndex, closeIndex })
    }

    // Choose the innermost call that contains the cursor position
    const col = pos.column
    const containing = calls
      .filter((c) => col >= c.nsStart && col <= c.closeIndex + 1)
      .sort((a, b) => a.closeIndex - a.nsStart - (b.closeIndex - b.nsStart))
    const selected = containing[0]

    if (!selected) {
      clearSignatureHelp()
      return
    }

    const typedNamespace = selected.ns
    const methodName = selected.method
    if (!namespacesRef.current.includes(typedNamespace) || typedNamespace === "Special") {
      clearSignatureHelp()
      return
    }

    const methods = methodsByNamespaceRef.current[typedNamespace] ?? []
    const def = methods.find((m) => m.name === methodName)
    if (!def) {
      clearSignatureHelp()
      return
    }

    const paramNames =
      def.stackParamsDef && def.stackParamsDef.length === def.stackParams
        ? def.stackParamsDef.map((p) => p.name)
        : Array.from({ length: def.stackParams }, (_, i) => `arg${i + 1}`)
    const paramDescriptions = def.stackParamsDef?.map((p) => p.description)

    // Compute argument slices between the '(' and its matching ')'
    const openIndex = selected.openIndex
    const closeIndex = selected.closeIndex
    const argsSlice = line.slice(openIndex + 1, closeIndex)
    const args: CallArg[] = []
    {
      let start = 0
      let nested = 0
      for (let i = 0; i <= argsSlice.length; i++) {
        const ch = argsSlice[i] ?? "," // sentinel comma at end
        if (ch === "(") nested++
        else if (ch === ")") {
          if (nested > 0) nested--
        } else if ((ch === "," && nested === 0) || i === argsSlice.length) {
          const raw = argsSlice.slice(start, i)
          const startCol = openIndex + 1 + start
          const endCol = openIndex + 1 + i
          args.push({ text: raw.trim(), startCol, endCol })
          start = i + 1
        }
      }
    }
    while (args.length < def.stackParams) {
      args.push({ text: "", startCol: closeIndex, endCol: closeIndex })
    }

    // Active param index: if cursor is inside parens, count commas up to cursor; otherwise default to 0
    let activeIndex = 0
    if (col > openIndex && col <= closeIndex) {
      const beforeCursor = line.slice(openIndex + 1, col)
      let commas = 0
      let nested = 0
      for (let i = 0; i < beforeCursor.length; i++) {
        const ch = beforeCursor[i]
        if (ch === "(") nested++
        else if (ch === ")") {
          if (nested > 0) nested--
        } else if (ch === "," && nested === 0) commas++
      }
      activeIndex = Math.min(commas, Math.max(0, def.stackParams - 1))
    } else {
      // Cursor outside but touching the call (e.g., just after ')'): focus last parameter
      const totalCommas = (() => {
        let c = 0,
          n = 0
        for (let i = 0; i < argsSlice.length; i++) {
          const ch = argsSlice[i]
          if (ch === "(") n++
          else if (ch === ")") {
            if (n > 0) n--
          } else if (ch === "," && n === 0) c++
        }
        return c
      })()
      activeIndex = Math.min(Math.max(0, totalCommas), Math.max(0, def.stackParams - 1))
    }

    const paramsMeta: CallParamMeta[] = (def.stackParamsDef ?? []).map((p) => ({
      name: p.name,
      description: p.description, // @ts-ignore
      type: (p as any).type,
    }))

    // Position near cursor
    const coords = editor.renderer.textToScreenCoordinates(pos.row, pos.column)
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const top = coords.pageY - rect.top + editor.renderer.lineHeight
    const left = coords.pageX - rect.left

    if (!options?.silent) {
      setPopoverHovered(false)
      setSignatureHelp({
        type: 'function',
        namespace: typedNamespace,
        method: def.name,
        paramNames,
        paramDescriptions,
        description: def.description,
        activeParamIndex: activeIndex,
        totalParams: def.stackParams,
        top,
        left,
      })
    }

    const ctx: CallContext = {
      row: pos.row,
      namespace: typedNamespace,
      method: def.name,
      description: def.description,
      params:
        paramsMeta.length === def.stackParams
          ? paramsMeta
          : paramNames.map((n, i) => ({ name: n, description: paramDescriptions?.[i] ?? "" })),
      activeParamIndex: activeIndex,
      args,
    }
    lastCallRef.current = ctx
    onContextChange?.(ctx)
  }

  const handleLoad = (editor: any) => {
    editorRef.current = editor
    // avoid built-in selected word highlight conflicting with our markers
    try {
      editor.setOption("highlightSelectedWord", false)
    } catch {}
    editor.commands.on("afterExec", (e: any) => {
      if (e.command && e.command.name === "insertstring") {
        if (e.args === ".") {
          editor.execCommand("startAutocomplete")
        }
        if (e.args === "(" || e.args === ",") {
          updateSignatureHelp(editor)
        }
        if (e.args === ")") {
          clearSignatureHelp({ preserveContext: true })
        }
      }
    })
    // Update on cursor move
    editor.getSession().selection.on("changeCursor", () => {
      const silent = suppressNextSignatureRef.current
      updateSignatureHelp(editor, { silent })
      suppressNextSignatureRef.current = false
    })
    // Hide popover on blur/unfocus
    editor.on("blur", () => {
      setTimeout(() => {
        if (!popoverMouseDownRef.current) {
          hideSignatureHelp()
        }
      }, 0)
    })
    // Hide popover on scroll events
    editor.getSession().on("changeScrollTop", () => clearSignatureHelp({ preserveContext: true }))
    editor.getSession().on("changeScrollLeft", () => clearSignatureHelp({ preserveContext: true }))
    editor.renderer.on("scroll", () => clearSignatureHelp({ preserveContext: true }))
  }

  // Manage search highlights
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const session = editor.getSession()

    // Clear existing markers
    for (const id of searchMarkerIdsRef.current) {
      session.removeMarker(id)
    }
    searchMarkerIdsRef.current = []

    const query = (searchQuery ?? "").trim()
    if (query.length < 3) return

    const Search = (ace as any).require("ace/search").Search
    const search = new Search()
    search.set({ needle: query, caseSensitive: false, regExp: false, wholeWord: false, wrap: false })
    const ranges = search.findAll(session) as any[]
    for (const range of ranges) {
      const id = session.addMarker(range, "ff7-search-highlight", "text", true)
      searchMarkerIdsRef.current.push(id)
    }

    // Cleanup on unmount or deps change
    return () => {
      for (const id of searchMarkerIdsRef.current) {
        session.removeMarker(id)
      }
      searchMarkerIdsRef.current = []
    }
  }, [searchQuery, value])

  useImperativeHandle(
    ref,
    () => ({
      replaceCurrentCallArg: (index: number, newText: string) => {
        const editor = editorRef.current
        const ctx = lastCallRef.current
        if (!editor || !ctx) return
        const session = editor.getSession()
        const line: string = session.getLine(ctx.row)
        const args = [...ctx.args]
        if (index < 0 || index >= args.length) return
        // Normalize spacing by rebuilding the whole args slice
        const openCol = Math.min(...args.map((a) => a.startCol))
        const closeCol = Math.max(...args.map((a) => a.endCol))
        let pieces = args.map((a, i) => (i === index ? newText : a.text))
        // Trim trailing empty arguments to avoid dangling commas
        while (pieces.length > 0 && (pieces[pieces.length - 1] ?? "").trim() === "") {
          pieces.pop()
        }
        const rebuiltArgs = pieces.join(", ")
        const newLine = line.slice(0, openCol) + rebuiltArgs + line.slice(closeCol)
        session.replace({ start: { row: ctx.row, column: 0 }, end: { row: ctx.row, column: line.length } }, newLine)
        // Move cursor to the end of the updated argument to preserve context
        let caretCol = openCol
        if (pieces.length > 0) {
          let caretOffset = 0
          const safeIndex = Math.min(index, Math.max(0, pieces.length - 1))
          for (let i = 0; i < safeIndex; i++) caretOffset += pieces[i].length + 2 // include ", "
          caretOffset += pieces[safeIndex].length
          caretCol = openCol + caretOffset
        }
        suppressNextSignatureRef.current = true
        editor.moveCursorTo(ctx.row, caretCol)
        updateSignatureHelp(editor, { silent: true })
      },
      replaceCurrentCallArgs: (updates: Array<{ index: number; newText: string }>) => {
        const editor = editorRef.current
        const ctx = lastCallRef.current
        if (!editor || !ctx || updates.length === 0) return
        const session = editor.getSession()
        const line: string = session.getLine(ctx.row)
        const args = [...ctx.args]
        const byIndex = new Map(updates.map((u) => [u.index, u.newText]))
        // Rebuild arguments slice region with normalized spacing
        const openCol = Math.min(...args.map((a) => a.startCol))
        const closeCol = Math.max(...args.map((a) => a.endCol))
        let pieces: string[] = []
        for (let i = 0; i < args.length; i++) {
          const text = byIndex.has(i) ? byIndex.get(i)! : args[i].text
          pieces.push(text)
        }
        // Trim trailing empty arguments to avoid dangling commas
        while (pieces.length > 0 && (pieces[pieces.length - 1] ?? "").trim() === "") {
          pieces.pop()
        }
        const rebuiltArgs = pieces.join(", ")
        const newLine = line.slice(0, openCol) + rebuiltArgs + line.slice(closeCol)
        session.replace({ start: { row: ctx.row, column: 0 }, end: { row: ctx.row, column: line.length } }, newLine)
        // Focus on the last updated argument
        const rawFocusIndex = Math.max(...updates.map((u) => u.index))
        let caretCol = openCol
        if (pieces.length > 0) {
          const focusIndex = Math.min(rawFocusIndex, Math.max(0, pieces.length - 1))
          let caretOffset = 0
          for (let i = 0; i < focusIndex; i++) caretOffset += pieces[i].length + 2
          caretOffset += pieces[focusIndex].length
          caretCol = openCol + caretOffset
        }
        suppressNextSignatureRef.current = true
        editor.moveCursorTo(ctx.row, caretCol)
        updateSignatureHelp(editor, { silent: true })
      },
      getLine: (row: number) => {
        const editor = editorRef.current
        if (!editor) return null
        const session = editor.getSession()
        const lineCount = session.getLength()
        if (row < 0 || row >= lineCount) return null
        return session.getLine(row) as string
      },
      getLineCount: () => {
        const editor = editorRef.current
        if (!editor) return 0
        return editor.getSession().getLength()
      },
      moveCursorTo: (row: number, col: number = 0) => {
        const editor = editorRef.current
        if (!editor) return
        const session = editor.getSession()
        const lineCount = session.getLength()
        const safeRow = Math.max(0, Math.min(row, lineCount - 1))
        const line = session.getLine(safeRow) as string
        const safeCol = Math.max(0, Math.min(col, line?.length ?? 0))
        // Avoid triggering signature popover on programmatic move
        suppressNextSignatureRef.current = true
        editor.moveCursorTo(safeRow, safeCol)
        editor.centerSelection()
      },
      isReady: () => !!editorRef.current,
      getCursorPosition: () => {
        const editor = editorRef.current
        if (!editor) return null
        const pos = editor.getCursorPosition()
        return { row: pos.row, column: pos.column }
      },
    }),
    []
  )
  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <AceEditor
        mode="worldscript"
        theme="tomorrow_night"
        onLoad={handleLoad}
        onChange={onChange}
        value={value}
        name="worldscript-editor"
        editorProps={{ $blockScrolling: true }}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: false,
          showLineNumbers: true,
          tabSize: 2,
          useSoftTabs: true,
          showPrintMargin: false,
          fontSize: 14,
          highlightActiveLine: true,
          highlightGutterLine: true,
        }}
        className={className}
        style={{ width: "100%", height: "100%" }}
      />
      {ENABLE_SIGNATURE_POPOVER && signatureHelp && signatureHelp.type === 'goto' && (
        <div
          style={{
            position: "absolute",
            top: signatureHelp.top,
            left: signatureHelp.left,
            background: "rgba(30,30,30,0.95)",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: 4,
            padding: "6px 8px",
            fontSize: 12,
            maxWidth: 420,
            pointerEvents: signatureHelp.type === 'goto' ? "auto" : "none",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
          onMouseEnter={() => setPopoverHovered(true)}
          onMouseLeave={() => setPopoverHovered(false)}
          onMouseDownCapture={() => {
            popoverMouseDownRef.current = true
          }}
          onMouseUpCapture={() => {
            popoverMouseDownRef.current = false
          }}
        >
          {signatureHelp.type === 'goto' ? (
            <div>
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  popoverMouseDownRef.current = true
                }}
                onMouseUp={(e) => {
                  e.preventDefault()
                  popoverMouseDownRef.current = false
                }}
                onClick={() => {
                  if (signatureHelp.labelLine !== undefined) {
                    const editor = editorRef.current
                    if (editor) {
                      const session = editor.getSession()
                      const totalLines = session.getLength()
                      const targetRow = Math.max(0, Math.min(signatureHelp.labelLine, totalLines - 1))
                      session.selection.clearSelection()
                      editor.gotoLine(targetRow + 1, 0, true)
                      editor.centerSelection()
                    }
                  }
                  clearSignatureHelp()
                }}
                style={{
                  background: "#007acc",
                  color: "white",
                  border: "none",
                  borderRadius: 3,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#005aa3"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#007acc"
                }}
              >
                Jump to {signatureHelp.label}
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "monospace" }}>
                {signatureHelp.namespace}.{signatureHelp.method}(
                {signatureHelp.paramNames?.map((p, i) => {
                  const isActive = i === signatureHelp.activeParamIndex
                  return (
                    <span
                      key={i}
                      style={{
                        fontWeight: isActive ? ("bold" as const) : "normal",
                        color: isActive ? "#FFD54A" : "inherit",
                      }}
                    >
                      {p}
                      {i < (signatureHelp.paramNames?.length ?? 0) - 1 ? ", " : ""}
                    </span>
                  )
                })}
                )
              </div>
              {showDetails && signatureHelp.description && (
                <div style={{ marginTop: 4, opacity: 0.9 }}>{signatureHelp.description}</div>
              )}
              {showDetails &&
                signatureHelp.paramDescriptions &&
                signatureHelp.paramDescriptions[signatureHelp.activeParamIndex ?? 0] && (
                  <div
                    style={{
                      marginTop: 8,
                      marginBottom: 8,
                      borderTop: "1px solid #555",
                      width: "100%",
                    }}
                  />
                )}
              {showDetails &&
                signatureHelp.paramDescriptions &&
                signatureHelp.paramDescriptions[signatureHelp.activeParamIndex ?? 0] && (
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    <span style={{ fontWeight: "bold" }}>Param:</span>{" "}
                    {signatureHelp.paramDescriptions[signatureHelp.activeParamIndex ?? 0]}
                  </div>
                )}
            </>
          )}
        </div>
      )}
    </div>
  )
})
