import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { modelsMapping } from "@/ff7/worldscript/constants"
import { DirectionRadial } from "@/components/script/controls/DirectionRadial"

export function EntityRotateToModelUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const entries: Array<{ value: number; slug: string }> = useMemo(() => {
    return Object.entries(modelsMapping).map(([k, v]) => ({ value: Number(k), slug: v }))
  }, [])

  const rawModel = ctx.args[0]?.text?.trim() || ""
  const slugMatch = rawModel.match(/^Entities\.([A-Za-z0-9_]+)$/i)
  let currentModelValue: number | "" = ""
  if (slugMatch) {
    const slug = slugMatch[1]
    const found = entries.find((e) => e.slug === slug)
    currentModelValue = found ? found.value : ""
  } else {
    const n = parseInt(rawModel || "0", 10)
    currentModelValue = Number.isNaN(n) ? "" : n
  }

  const directionValue = parseInt(ctx.args[1]?.text || "0", 10) || 0

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <Select
          value={currentModelValue === "" ? "" : String(currentModelValue)}
          onValueChange={(v) => {
            const value = parseInt(v, 10)
            const found = entries.find((e) => e.value === value)
            const newText = found ? `Entities.${found.slug}` : String(value)
            onBatch([{ index: 0, newText }])
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {entries.map((e) => (
              <SelectItem key={e.value} value={String(e.value)} className="text-xs">
                {e.value} - {e.slug}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Direction</Label>
        <div className="block">
          <DirectionRadial value={directionValue} onChange={(v) => onBatch([{ index: 1, newText: String(v) }])} />
        </div>
      </div>
    </div>
  )
}

