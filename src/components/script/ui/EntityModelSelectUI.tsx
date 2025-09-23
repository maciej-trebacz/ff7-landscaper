import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { modelsMapping } from "@/ff7/worldscript/constants"

export function EntityModelSelectUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const entries: Array<{ value: number; slug: string }> = useMemo(() => {
    return Object.entries(modelsMapping).map(([k, v]) => ({ value: Number(k), slug: v }))
  }, [])
  const raw = ctx.args[0]?.text?.trim() || ""
  const slugMatch = raw.match(/^Entities\.([A-Za-z0-9_]+)$/i)
  let currentValue: number | "" = ""
  if (slugMatch) {
    const slug = slugMatch[1]
    const found = entries.find((e) => e.slug === slug)
    currentValue = found ? found.value : ""
  } else {
    const n = parseInt(raw || "0", 10)
    currentValue = Number.isNaN(n) ? "" : n
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <Select
          value={currentValue === "" ? "" : String(currentValue)}
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
    </div>
  )
}

