import { cn } from "@/lib/utils"
import { useScriptsState } from "@/hooks/useScriptState"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FunctionType, FF7Function } from "@/ff7/evfile"
import { OpcodesEditor } from "@/components/script/OpcodesEditor"
import {
  WorldscriptEditor,
  type CallContext,
  type WorldscriptEditorHandle,
} from "@/components/script/WorldscriptEditor"
import { useEffect, useRef, useState } from "react"
import { Worldscript } from "@/ff7/worldscript/worldscript"
import { Switch } from "@/components/ui/switch"

interface ScriptEditorProps {
  className?: string
  decompiled?: boolean
  editorHandleRef?: React.Ref<WorldscriptEditorHandle>
  onWorldscriptContextChange?: (ctx: CallContext | null) => void
}

export function ScriptEditor({
  className,
  decompiled = false,
  editorHandleRef,
  onWorldscriptContextChange,
}: ScriptEditorProps) {
  const {
    functions,
    getSelectedScript,
    updateSelectedScript,
    updateScriptByReference,
    decompiled: globalDecompiled,
    setDecompiledMode,
    getDecompiledScript,
    updateDecompiledScript,
    getScriptKey,
    isAliasSelected,
    getAliasTargetScript,
    isScriptSelected,
    selectScript,
    cursorTarget,
    clearCursorTarget,
    searchQuery,
  } = useScriptsState()

  const [isDecompiling, setIsDecompiling] = useState(false)
  const effectiveDecompiled = decompiled || globalDecompiled
  const localEditorHandleRef = useRef<WorldscriptEditorHandle | null>(null)

  // (moved below once content is available)

  const scriptToEdit = getSelectedScript()
  const systemFunctions = functions.filter((f) => f.type === FunctionType.System)

  // Get the source script (the one that has the alias) when editing an alias
  const getSourceScript = () => {
    if (!scriptToEdit) return null
    const isEditingAlias = isAliasSelected()
    if (isEditingAlias) {
      // When editing an alias, the source script is the selected one, not the target
      return functions.find((f) => isScriptSelected(f)) || null
    }
    return scriptToEdit
  }

  const sourceScript = getSourceScript()

  // Update the source script's properties directly
  const updateSourceScript = (updates: Partial<FF7Function>) => {
    if (!sourceScript) return
    updateScriptByReference(sourceScript, updates)
  }

  // Get the decompiled script content if in decompiled mode
  const decompiledContent = scriptToEdit ? getDecompiledScript(scriptToEdit) : ""

  // Effect to handle decompilation when script changes or decompiled mode is enabled
  useEffect(() => {
    if (!scriptToEdit || !effectiveDecompiled || decompiledContent) return

    const decompileScript = async () => {
      try {
        setIsDecompiling(true)
        // Create a new Worldscript instance with the script's offset
        const worldscript = new Worldscript(scriptToEdit.offset, false)
        // Decompile the script
        const decompiled = worldscript.decompile(scriptToEdit.script, true)
        // Store the decompiled script (not a user change, just caching)
        updateDecompiledScript(scriptToEdit, decompiled, false)
      } catch (error) {
        console.error("Failed to decompile script:", error)
      } finally {
        setIsDecompiling(false)
      }
    }

    decompileScript()
  }, [scriptToEdit, effectiveDecompiled, decompiledContent])

  // Move cursor after content is present and editor is ready
  useEffect(() => {
    if (!cursorTarget) return
    if (!effectiveDecompiled) return
    if (!scriptToEdit) return
    // require content to exist to ensure editor has text
    const hasContent = !!decompiledContent && decompiledContent.length > 0
    if (!hasContent) return
    const handle = (editorHandleRef && (editorHandleRef as any).current) || localEditorHandleRef.current
    if (!handle || !('moveCursorTo' in handle)) return
    // Schedule on next frame to let Ace finish layout
    requestAnimationFrame(() => {
      handle.moveCursorTo(cursorTarget.row, cursorTarget.col ?? 0)
      clearCursorTarget()
    })
  }, [cursorTarget, effectiveDecompiled, decompiledContent, scriptToEdit])

  const handleAliasChange = (checked: boolean) => {
    if (!sourceScript) return

    if (!checked) {
      // Remove alias
      updateSourceScript({ aliasId: undefined })
    } else {
      // When checking the box, set it as an alias to the first available system function
      const firstSystemFunction = systemFunctions[0]
      if (firstSystemFunction) {
        updateSourceScript({ aliasId: firstSystemFunction.id })
      }
    }
  }

  const handleAliasSelect = (aliasId: string) => {
    if (!sourceScript) return

    updateSourceScript({ aliasId: parseInt(aliasId) })
  }

  const handleDecompiledChange = async (checked: boolean) => {
    if (!scriptToEdit) {
      setDecompiledMode(checked)
      return
    }

    try {
      setIsDecompiling(true)

      if (checked) {
        // Switching from raw to decompiled mode
        // Decompile the current raw script
        const worldscript = new Worldscript(scriptToEdit.offset, false)
        const decompiled = worldscript.decompile(scriptToEdit.script, true)
        updateDecompiledScript(scriptToEdit, decompiled, false)
      } else {
        // Switching from decompiled to raw mode
        // Compile the current decompiled script back to opcodes
        const currentDecompiled = getDecompiledScript(scriptToEdit)
        if (currentDecompiled) {
          const worldscript = new Worldscript(scriptToEdit.offset, false)
          const compiled = worldscript.compile(currentDecompiled)
          updateSelectedScript({ script: compiled })
        }
      }

      setDecompiledMode(checked)
    } catch (error) {
      console.error("Failed to convert script:", error)
      // Don't switch modes if conversion failed
    } finally {
      setIsDecompiling(false)
    }
  }

  const handleScriptChange = (value: string) => {
    if (!scriptToEdit) return

    if (effectiveDecompiled) {
      // Update the decompiled script (user change)
      updateDecompiledScript(scriptToEdit, value, true)
    } else {
      // Update the original script
      updateSelectedScript({ script: value })
    }
  }

  const getScriptName = () => {
    if (!scriptToEdit) return null

    switch (scriptToEdit.type) {
      case FunctionType.System:
        return `System ${scriptToEdit.id}`
      case FunctionType.Model:
        return `Model ${scriptToEdit.modelId}:${scriptToEdit.id}`
      case FunctionType.Mesh:
        return `Mesh ${scriptToEdit.x},${scriptToEdit.y}:${scriptToEdit.id}`
    }
  }

  return (
    <div className={cn("bg-background flex flex-col h-full", className)}>
      <div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">Script Editor</div>
          {scriptToEdit && <div className="text-xs text-muted-foreground">{getScriptName()}</div>}
        </div>

        {scriptToEdit && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="decompiled-mode"
                checked={effectiveDecompiled}
                onCheckedChange={handleDecompiledChange}
                disabled={isDecompiling}
              />
              <Label htmlFor="decompiled-mode" className="text-xs">
                Decompiled
              </Label>
            </div>
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-alias"
                  checked={sourceScript?.aliasId !== undefined}
                  onCheckedChange={handleAliasChange}
                  disabled={!sourceScript || systemFunctions.length === 0}
                />
                <Label htmlFor="is-alias" className="text-xs">
                  Alias to:
                </Label>
              </div>
              <Select
                value={sourceScript?.aliasId?.toString()}
                onValueChange={handleAliasSelect}
                disabled={!sourceScript || sourceScript.aliasId === undefined}
              >
                <SelectTrigger className="h-7 text-xs w-[110px]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {systemFunctions.map((fn) => (
                    <SelectItem key={fn.id} value={fn.id.toString()} className="text-xs">
                      System {fn.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAliasSelected() && (
                <button
                  onClick={() => {
                    const targetScript = getAliasTargetScript()
                    if (targetScript) {
                      selectScript(targetScript)
                    }
                  }}
                  className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
                >
                  Jump to {(() => {
                    const target = getAliasTargetScript()
                    if (!target) return ""
                    return target.type === FunctionType.System
                      ? `System ${target.id}`
                      : `Model ${(target as any).modelId}:${target.id}`
                  })()}
                </button>
              )}
            </>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {scriptToEdit ? (
          isDecompiling ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              Decompiling script...
            </div>
          ) : effectiveDecompiled ? (
            <div className="relative h-full">
              <WorldscriptEditor
                key={`decompiled-${getScriptKey(scriptToEdit)}`} // Force remount when script changes
                value={decompiledContent}
                onChange={handleScriptChange}
                onContextChange={onWorldscriptContextChange}
                showDetails={false}
                searchQuery={searchQuery}
                ref={(instance: WorldscriptEditorHandle | null) => {
                  if (!instance) return
                  // store
                  if (editorHandleRef && typeof editorHandleRef !== 'function') {
                    ;(editorHandleRef as any).current = instance
                  } else {
                    localEditorHandleRef.current = instance
                  }
                }}
                className="h-full"
              />
            </div>
          ) : (
            <div className="relative h-full">
              <OpcodesEditor
                key={getScriptKey(scriptToEdit)} // Force remount when script changes
                value={scriptToEdit.script}
                onChange={handleScriptChange}
                searchQuery={searchQuery}
                className="h-full"
              />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Select a script to edit
          </div>
        )}
      </div>
    </div>
  )
}
