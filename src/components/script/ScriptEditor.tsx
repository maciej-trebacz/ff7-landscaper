import { cn } from "@/lib/utils"
import { useScriptsState } from "@/hooks/useScriptState"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FunctionType } from "@/ff7/evfile"
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
    decompiled: globalDecompiled,
    setDecompiledMode,
    getDecompiledScript,
    updateDecompiledScript,
    getScriptKey,
    isAliasSelected,
    getAliasTargetScript,
    isScriptSelected,
  } = useScriptsState()

  const [isDecompiling, setIsDecompiling] = useState(false)
  const effectiveDecompiled = decompiled || globalDecompiled
  const localEditorHandleRef = useRef<WorldscriptEditorHandle | null>(null)

  const scriptToEdit = getSelectedScript()
  const systemFunctions = functions.filter((f) => f.type === FunctionType.System)

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
        // Store the decompiled script
        updateDecompiledScript(scriptToEdit, decompiled)
      } catch (error) {
        console.error("Failed to decompile script:", error)
      } finally {
        setIsDecompiling(false)
      }
    }

    decompileScript()
  }, [scriptToEdit, effectiveDecompiled, decompiledContent])

  const handleAliasChange = (checked: boolean) => {
    if (!scriptToEdit) return

    if (!checked) {
      // Remove alias
      updateSelectedScript({ aliasId: undefined })
    } else {
      // When checking the box, set it as an alias to the first available system function
      const firstSystemFunction = systemFunctions[0]
      if (firstSystemFunction) {
        updateSelectedScript({ aliasId: firstSystemFunction.id })
      }
    }
  }

  const handleAliasSelect = (aliasId: string) => {
    if (!scriptToEdit) return

    updateSelectedScript({ aliasId: parseInt(aliasId) })
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
        updateDecompiledScript(scriptToEdit, decompiled)
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
      // Update the decompiled script
      updateDecompiledScript(scriptToEdit, value)
    } else {
      // Update the original script
      updateSelectedScript({ script: value })
    }
  }

  const getScriptName = () => {
    if (!scriptToEdit) return null

    const isEditingAlias = isAliasSelected()
    const aliasTarget = isEditingAlias ? getAliasTargetScript() : null

    if (isEditingAlias && aliasTarget) {
      // Show both the alias source and target information
      const originalScript = functions.find((f) => isScriptSelected(f))
      let sourceName = ""
      let targetName = ""

      if (originalScript) {
        switch (originalScript.type) {
          case FunctionType.System:
            sourceName = `System ${originalScript.id}`
            break
          case FunctionType.Model:
            sourceName = `Model ${originalScript.modelId}:${originalScript.id}`
            break
          case FunctionType.Mesh:
            sourceName = `Mesh ${originalScript.x},${originalScript.y}:${originalScript.id}`
            break
        }
      }

      switch (aliasTarget.type) {
        case FunctionType.System:
          targetName = `System ${aliasTarget.id}`
          break
        case FunctionType.Model:
          targetName = `Model ${aliasTarget.modelId}:${aliasTarget.id}`
          break
      }

      return `${sourceName} → ${targetName}`
    }

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

        {scriptToEdit && !isAliasSelected() && (
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-alias"
                checked={scriptToEdit.aliasId !== undefined}
                onCheckedChange={handleAliasChange}
                disabled={!scriptToEdit || systemFunctions.length === 0}
              />
              <Label htmlFor="is-alias" className="text-xs">
                Alias to:
              </Label>
            </div>
            <Select
              value={scriptToEdit?.aliasId?.toString()}
              onValueChange={handleAliasSelect}
              disabled={!scriptToEdit || scriptToEdit.aliasId === undefined}
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
                ref={(editorHandleRef ?? localEditorHandleRef) as any}
                className="h-full"
              />
            </div>
          ) : (
            <div className="relative h-full">
              <OpcodesEditor
                key={getScriptKey(scriptToEdit)} // Force remount when script changes
                value={scriptToEdit.script}
                onChange={handleScriptChange}
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
