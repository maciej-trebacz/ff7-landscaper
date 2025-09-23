import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { DirectionRadial } from "@/components/script/controls/DirectionRadial"

export function DefaultParamControls({
  context,
  onParamChange,
}: {
  context: CallContext
  onParamChange?: (index: number, newText: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium">
        {context.namespace}.{context.method}
      </div>
      {context.description && <Description>{context.description}</Description>}
      <div className="space-y-2">
        {context.params.map((p, i) => {
          const arg = context.args[i]
          const type = (p as any).type as undefined | { kind: string; [k: string]: any }
          if (!arg) return null
          const label = p.name || `arg${i + 1}`
          if (type?.kind === "boolean") {
            const checked = arg.text === "1" || arg.text.toLowerCase?.() === "true"
            return (
              <div key={i} className="flex items-center gap-2">
                <Checkbox checked={checked} onCheckedChange={(v) => onParamChange?.(i, v ? "1" : "0")} />
                <Label className="text-xs">{label}</Label>
              </div>
            )
          }
          if (type?.kind === "enum") {
            const options = type.options || []
            const current = arg.text
            return (
              <div key={i} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Select value={current} onValueChange={(v) => onParamChange?.(i, String(v))}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt: any, idx: number) => (
                      <SelectItem key={idx} value={String(opt.value)} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }
          if (
            type?.kind === "number" &&
            p.name?.toLowerCase?.() === "direction" &&
            (type.min ?? 0) === 0 &&
            (type.max ?? 255) === 255
          ) {
            const n = parseInt(arg.text || "0", 10) || 0
            return (
              <div key={i} className="space-y-1">
                <DirectionRadial value={n} onChange={(v) => onParamChange?.(i, String(v))} />
              </div>
            )
          }
          if (type?.kind === "number") {
            const n = parseInt(arg.text || "0", 10)
            return (
              <div key={i} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <input
                  type="number"
                  className="h-7 text-xs w-full bg-background border rounded px-2"
                  value={Number.isNaN(n) ? "" : n}
                  min={type.min}
                  max={type.max}
                  step={type.step}
                  onChange={(e) => onParamChange?.(i, e.target.value)}
                />
              </div>
            )
          }
          return (
            <div key={i} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <input
                className="h-7 text-xs w-full bg-background border rounded px-2"
                value={arg.text}
                onChange={(e) => onParamChange?.(i, e.target.value)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

