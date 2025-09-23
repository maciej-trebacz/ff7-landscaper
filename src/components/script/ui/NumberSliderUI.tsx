import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { Label } from "@/components/ui/label"

export function NumberSliderUI({
  ctx,
  onBatch,
  index = 0,
  labelOverride,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
  index?: number
  labelOverride?: string
}) {
  const p = ctx.params[index] as any
  const type = p?.type as undefined | { kind: string; min?: number; max?: number; step?: number }
  const val = parseInt(ctx.args[index]?.text || "0", 10) || 0
  const min = Math.max(0, type?.min ?? 0)
  const max = Math.max(min, type?.max ?? 255)
  const step = type?.step ?? 1
  const label = labelOverride ?? p?.name ?? `arg${index + 1}`
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      <div className="space-y-1">
        <Label className="text-xs">
          {label}: {val}
        </Label>
        <input
          type="range"
          className="w-full"
          min={min}
          max={max}
          step={step}
          value={val}
          onChange={(e) => onBatch([{ index, newText: String(e.target.value) }])}
        />
      </div>
    </div>
  )
}

