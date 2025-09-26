import { useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { useMessagesState } from "@/hooks/useMessagesState"

export function SetPromptUI({
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

  const messageRaw = ctx.args[0]?.text?.trim() || ""
  const firstRaw = ctx.args[1]?.text?.trim() || ""
  const lastRaw = ctx.args[2]?.text?.trim() || ""

  const currentMessageIndex = /^\d+$/.test(messageRaw) ? parseInt(messageRaw, 10) : NaN
  const currentFirst = /^\d+$/.test(firstRaw) ? parseInt(firstRaw, 10) : 0
  const currentLast = /^\d+$/.test(lastRaw) ? parseInt(lastRaw, 10) : 0

  const preview = Number.isInteger(currentMessageIndex) && messages[currentMessageIndex] ? messages[currentMessageIndex] : ""

  const labelFor = (i: number) => {
    const t = messages[i] ?? ""
    const truncated = t.length > 60 ? t.slice(0, 57) + "…" : t
    return `${i} - ${truncated || "(empty)"}`
  }

  const handleMessageChange = (value: string) => {
    onBatch([{ index: 0, newText: value }])
  }

  const handleFirstChange = (value: string) => {
    onBatch([{ index: 1, newText: value }])
  }

  const handleLastChange = (value: string) => {
    onBatch([{ index: 2, newText: value }])
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
          value={Number.isInteger(currentMessageIndex) ? String(currentMessageIndex) : ""}
          onValueChange={handleMessageChange}
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

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">First Option</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            value={currentFirst}
            min={0}
            onChange={(e) => handleFirstChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Last Option</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            value={currentLast}
            min={0}
            onChange={(e) => handleLastChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
