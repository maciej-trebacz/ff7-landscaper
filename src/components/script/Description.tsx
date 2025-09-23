import type { ReactNode } from "react"

export function Description({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <div className="text-[11px] text-muted-foreground whitespace-pre-wrap">{children}</div>
}

