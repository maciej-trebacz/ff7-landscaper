import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function HelpSectionContainer({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{description}</p>}
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </section>
  )
}

export function HelpParagraph({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-zinc-200">{children}</p>
}

export function HelpCallout({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warning" | "success"
  title: string
  children: ReactNode
}) {
  const palettes: Record<typeof type, string> = {
    info: "border-sky-500/40 bg-sky-950/40 text-sky-100",
    warning: "border-amber-500/40 bg-amber-950/40 text-amber-100",
    success: "border-emerald-500/40 bg-emerald-950/40 text-emerald-100",
  }

  return (
    <Card className={cn("border px-3 py-2 space-y-1 text-sm", palettes[type])}>
      <div className="text-xs uppercase tracking-wide font-semibold opacity-80">{title}</div>
      <div className="leading-relaxed">{children}</div>
    </Card>
  )
}

export function HelpDefinitionList({
  items,
}: {
  items: Array<{ label: string; detail: ReactNode }>
}) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Card key={item.label} className="border border-zinc-800/60 bg-zinc-900/40">
          <div className="px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</div>
            <div className="text-sm text-zinc-200 leading-relaxed">{item.detail}</div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function HelpMediaCard({
  image,
  label,
  description,
}: {
  image: string
  label: string
  description: string
}) {
  return (
    <Card className="overflow-hidden border-zinc-800/60 bg-zinc-900/40">
      <div className="aspect-video overflow-hidden bg-zinc-950/40">
        <img src={image} alt={label} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="text-sm font-medium text-zinc-100">{label}</div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </Card>
  )
}

export function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200 shadow-sm">
      {children}
    </kbd>
  )
}

export function Pill({ children }: { children: ReactNode }) {
  return <Badge variant="secondary" className="rounded-full px-2 py-1 text-[10px] tracking-wide uppercase">{children}</Badge>
}
