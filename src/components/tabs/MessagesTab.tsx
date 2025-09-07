import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageRow } from "./MessageRow"
import { useMessagesState } from "@/hooks/useMessagesState"

export function MessagesTab() {
  const { messages, loaded, updateMessage } = useMessagesState()

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading messages...
      </div>
    )
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="space-y-2 p-2">
        {messages.map((message, index) => (
          <MessageRow
            key={index}
            index={index}
            message={message}
            onChange={(value) => updateMessage(index, value)}
          />
        ))}
      </div>
    </ScrollArea>
  )
}