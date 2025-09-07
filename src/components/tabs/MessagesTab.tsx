import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { MessageRow } from "./MessageRow"
import { useMessagesState } from "@/hooks/useMessagesState"

export function MessagesTab() {
  const { messages, loaded, updateMessage, addMessage, removeMessage } = useMessagesState()

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
            onRemove={removeMessage}
          />
        ))}
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => addMessage("")}
            variant="secondary"
            size="sm"
          >
            Add Message
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}