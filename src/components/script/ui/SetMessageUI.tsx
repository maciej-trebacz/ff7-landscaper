import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { useMessagesState } from "@/hooks/useMessagesState"
import { Button } from "@/components/ui/button"

export function SetMessageUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const { messages, loadMessages, updateMessage } = useMessagesState()
  useEffect(() => {
    if (!messages || messages.length === 0) loadMessages()
  }, [messages?.length, loadMessages])
  const raw = ctx.args[0]?.text?.trim() || ""
  const currentIndex = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN
  const originalMessage = Number.isInteger(currentIndex) && messages[currentIndex] ? messages[currentIndex] : ""
  const [currentMessage, setCurrentMessage] = useState(originalMessage)
  const hasChanges = currentMessage !== originalMessage

  // Update current message when the selected message changes
  useEffect(() => {
    setCurrentMessage(originalMessage)
  }, [originalMessage])

  const handleUpdate = () => {
    if (Number.isInteger(currentIndex)) {
      updateMessage(currentIndex, currentMessage)
    }
  }

  const handleCancel = () => {
    setCurrentMessage(originalMessage)
  }

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
      {originalMessage && (
        <div className="space-y-2">
          <Label className="text-xs">Message Text</Label>
          <textarea
            className="w-full h-24 text-xs bg-background border rounded px-2 py-1 resize-none"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            placeholder="Enter message text..."
          />
          {hasChanges && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1 text-xs"
                onClick={handleUpdate}
              >
                Update
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

