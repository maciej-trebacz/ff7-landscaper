import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { useScriptsState } from "@/hooks/useScriptState"
import { modelsMapping, systemScriptNames, modelScriptNames } from "@/ff7/worldscript/constants"
import { FunctionType } from "@/ff7/evfile"

export function CallFunctionUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const { functions, selectScript, setScriptType } = useScriptsState()

  const rawEntityText = ctx.args[0]?.text?.trim() || ""
  const slugMatch = rawEntityText.match(/^Entities\.([A-Za-z0-9_]+)$/i)
  let entityId: number | "" = ""
  if (slugMatch) {
    const slug = slugMatch[1]
    const found = Object.entries(modelsMapping).find(([_, name]) => name === slug)
    entityId = found ? parseInt(found[0], 10) : ""
  } else {
    const n = parseInt(rawEntityText || "0", 10)
    entityId = Number.isNaN(n) ? "" : n
  }

  const functionId = parseInt(ctx.args[1]?.text || "0", 10) || 0

  const entityOptions = useMemo(() => {
    return Object.entries(modelsMapping)
      .map(([id, name]) => ({ value: parseInt(id, 10), label: `${name} (${id})`, slug: name }))
      .sort((a, b) => a.value - b.value)
  }, [])

  const functionOptions = useMemo(() => {
    if (entityId === 65535) {
      return functions
        .filter((f) => f.type === FunctionType.System)
        .map((f) => ({
          value: f.id,
          label: systemScriptNames[f.id] ? `${systemScriptNames[f.id]} (${f.id})` : `system_${f.id} (${f.id})`,
        }))
        .sort((a, b) => a.value - b.value)
    } else {
      return functions
        .filter((f) => f.type === FunctionType.Model && f.modelId === entityId)
        .map((f) => ({
          value: f.id,
          label: modelScriptNames[f.id] ? `${modelScriptNames[f.id]} (${f.id})` : `model_${f.id} (${f.id})`,
        }))
        .sort((a, b) => a.value - b.value)
    }
  }, [functions, entityId])

  const handleEntityChange = (value: string) => {
    const newEntityId = parseInt(value, 10)
    const found = entityOptions.find((option) => option.value === newEntityId)
    const newText = found ? `Entities.${found.slug}` : String(newEntityId)
    onBatch([{ index: 0, newText }])
  }

  const handleFunctionChange = (value: string) => {
    const newFunctionId = parseInt(value, 10)
    onBatch([{ index: 1, newText: String(newFunctionId) }])
  }

  const handleJumpToFunction = () => {
    if (entityId === "" || functionId === 0) return
    let targetScript = null as any
    if (entityId === 65535) {
      targetScript = functions.find((f) => f.type === FunctionType.System && f.id === functionId)
    } else {
      targetScript = functions.find((f) => f.type === FunctionType.Model && f.modelId === entityId && f.id === functionId)
    }
    if (targetScript) {
      setScriptType(targetScript.type)
      selectScript(targetScript)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}

      <div className="space-y-1">
        <Label className="text-xs">Entity</Label>
        <Select value={entityId === "" ? "" : String(entityId)} onValueChange={handleEntityChange}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select entity" />
          </SelectTrigger>
          <SelectContent>
            {entityOptions.map((option) => (
              <SelectItem key={option.value} value={String(option.value)} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Function ID</Label>
        <Select value={String(functionId)} onValueChange={handleFunctionChange} disabled={functionOptions.length === 0}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder={functionOptions.length === 0 ? "No functions available" : "Select function"} />
          </SelectTrigger>
          <SelectContent>
            {functionOptions.map((option) => (
              <SelectItem key={option.value} value={String(option.value)} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {functionOptions.length === 0 && (
          <div className="text-[11px] text-muted-foreground">No functions found for selected entity</div>
        )}
      </div>

      <div>
        <Button size="sm" variant="secondary" className="h-7 text-xs w-full" onClick={handleJumpToFunction} disabled={entityId === "" || functionId === 0}>
          Jump to Function
        </Button>
      </div>
    </div>
  )
}

