import { useRef, useState } from "react"
import { ScriptControls } from "@/components/script/ScriptControls"
import { ScriptList } from "@/components/script/ScriptList"
import { ScriptEditor } from "@/components/script/ScriptEditor"
import { ScriptSidebar } from "@/components/script/ScriptSidebar"
import type { CallContext, WorldscriptEditorHandle } from "@/components/script/WorldscriptEditor"
import { useScriptsState } from "@/hooks/useScriptState"

export function ScriptsTab() {
  const { loaded } = useScriptsState()

  const [context, setContext] = useState<CallContext | null>(null)
  const editorRef = useRef<WorldscriptEditorHandle | null>(null)

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading scripts...
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full min-h-0">
      <ScriptControls />
      <div className="flex-1 flex min-h-0">
        <ScriptList className="w-[240px] border-r overflow-y-auto" />
        <div className="flex-1 overflow-y-auto">
          <ScriptEditor className="h-full" editorHandleRef={editorRef as any} onWorldscriptContextChange={setContext} />
        </div>
        <ScriptSidebar
          className="w-[320px] box-content border-l overflow-y-auto"
          context={context}
          editor={editorRef.current}
          onParamChange={(index, newText) => editorRef.current?.replaceCurrentCallArg(index, newText)}
          onBatchParamsChange={(updates) => editorRef.current?.replaceCurrentCallArgs(updates)}
        />
      </div>
    </div>
  )
}