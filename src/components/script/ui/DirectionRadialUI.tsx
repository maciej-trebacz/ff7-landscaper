import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { DirectionRadial } from "@/components/script/controls/DirectionRadial"

export function DirectionRadialUI({
  ctx,
  onBatch,
  index = 0,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
  index?: number
}) {
  const val = parseInt(ctx.args[index]?.text || "0", 10) || 0
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      <DirectionRadial value={val} onChange={(v) => onBatch([{ index, newText: String(v) }])} />
    </div>
  )
}

