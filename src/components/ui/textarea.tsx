import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const handleResize = React.useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "0"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [])

  React.useEffect(() => {
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [handleResize])

  // Trigger resize when textarea becomes visible
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Use requestAnimationFrame to ensure the element is fully rendered
            requestAnimationFrame(() => {
              handleResize()
            })
          }
        })
      },
      { threshold: 0 }
    )

    observer.observe(textarea)
    return () => observer.disconnect()
  }, [handleResize])

  return (
    <textarea
      autoCorrect="off"
      autoComplete="off"
      spellCheck="false"
      className={cn(
        "flex w-full rounded-md border border-input bg-zinc-900 px-2 py-1 text-base shadow-sm placeholder:text-muted-foreground outline-none ring-0 focus-visible:border-zinc-500 focus-visible:text-white disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden resize-none",
        className
      )}
      ref={(element) => {
        textareaRef.current = element
        if (typeof ref === "function") ref(element)
        else if (ref) ref.current = element
      }}
      onInput={handleResize}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
