import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { Label } from "@/components/ui/label"

export function ColorTripleUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const [r, g, b] = ctx.args.map((a) => parseInt(a.text || "0", 10) || 0)
  const clamp = (n: number) => Math.max(0, Math.min(255, n | 0))
  const hex = `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b)
    .toString(16)
    .padStart(2, "0")}`.toUpperCase()
  const onChange = (val: string) => {
    if (!/^#?[0-9a-fA-F]{6}$/.test(val)) return
    const v = val.startsWith("#") ? val.slice(1) : val
    const nr = parseInt(v.slice(0, 2), 16)
    const ng = parseInt(v.slice(2, 4), 16)
    const nb = parseInt(v.slice(4, 6), 16)
    onBatch([
      { index: 0, newText: String(nr) },
      { index: 1, newText: String(ng) },
      { index: 2, newText: String(nb) },
    ])
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      <div className="space-y-2">
        <Label className="text-xs">
          Color <span className="text-muted-foreground text-[11px]">(click to edit)</span>
        </Label>
        <div className="flex items-center gap-2 !mt-1">
          <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 p-0 border-0 bg-transparent" />
          <div className="text-[11px] text-muted-foreground">RGB: {`${clamp(r)}, ${clamp(g)}, ${clamp(b)}`}</div>
        </div>
      </div>
    </div>
  )
}

