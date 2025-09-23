import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { useFieldSelection } from "@/components/script/hooks/useFieldSelection"

export function SetFieldEntryByIdUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const { options, getCurrentId, handleValueChange } = useFieldSelection()
  const currentId = getCurrentId(ctx.args[0]?.text?.trim() || "")

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      <div className="space-y-1">
        <Label className="text-xs">Location</Label>
        <Select
          value={currentId ? String(currentId) : ""}
          onValueChange={(v) => handleValueChange(v, onBatch, 0)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select field" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={String(opt.id)} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-[11px] text-muted-foreground">You can edit this list in the Locations tab.</div>
      </div>
    </div>
  )
}

