import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"

export function MapOptionsUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const flags = [
    { bit: 1, label: "Camera low" },
    { bit: 2, label: "Show heading" },
    { bit: 4, label: "Show big map" },
    { bit: 8, label: "Hide mini map" },
  ]
  const current = parseInt(ctx.args[0]?.text || "0", 10) || 0
  const toggle = (bit: number) => {
    const next = current & bit ? current & ~bit : current | bit
    onBatch([{ index: 0, newText: String(next) }])
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      <div className="grid grid-cols-1 gap-1">
        {flags.map((f) => (
          <label key={f.bit} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={(current & f.bit) !== 0} onChange={() => toggle(f.bit)} />
            <span>{f.label}</span>
          </label>
        ))}
      </div>
      <div className="text-[11px] text-muted-foreground">Value: {current}</div>
    </div>
  )
}

