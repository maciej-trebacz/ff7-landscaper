import { useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { useMessagesState } from "@/hooks/useMessagesState"

export function SetMessageUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const { messages, loadMessages } = useMessagesState()
  useEffect(() => {
    if (!messages || messages.length === 0) loadMessages()
  }, [messages?.length, loadMessages])
  const raw = ctx.args[0]?.text?.trim() || ""
  const currentIndex = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN
  const preview = Number.isInteger(currentIndex) && messages[currentIndex] ? messages[currentIndex] : ""
  const labelFor = (i: number) => {
    const t = messages[i] ?? ""
    const truncated = t.length > 60 ? t.slice(0, 57) + "…" : t
    return `${i} - ${truncated || "(empty)"}`
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      <div className="space-y-1">
        <Label className="text-xs">Message</Label>
        <Select
          value={Number.isInteger(currentIndex) ? String(currentIndex) : ""}
          onValueChange={(v) => onBatch([{ index: 0, newText: String(v) }])}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select message" />
          </SelectTrigger>
          <SelectContent>
            {messages.map((_m, i) => (
              <SelectItem key={i} value={String(i)} className="text-xs">
                {labelFor(i)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {preview && (
        <div className="text-[11px] text-muted-foreground border rounded p-2 max-h-36 overflow-auto whitespace-pre-wrap">
          {preview}
        </div>
      )}
    </div>
  )
}

