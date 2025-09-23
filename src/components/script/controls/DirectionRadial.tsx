import { useRef } from "react"

export function DirectionRadial({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  const size = 112
  const radius = 48
  const center = { x: size / 2, y: size / 2 }
  const isDraggingRef = useRef(false)

  const updateFromEvent = (clientX: number, clientY: number, rect: DOMRect) => {
    const x = clientX - rect.left
    const y = clientY - rect.top
    const dx = x - center.x
    const dy = y - center.y
    if (dx === 0 && dy === 0) return
    const angle = Math.atan2(dy, dx)
    let normalized = (Math.PI / 2 - angle) / (Math.PI * 2)
    normalized = ((normalized % 1) + 1) % 1
    const val = Math.max(0, Math.min(255, Math.round(normalized * 256) % 256))
    onChange(val)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDraggingRef.current = true
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    updateFromEvent(e.clientX, e.clientY, rect)
    const move = (ev: MouseEvent) => updateFromEvent(ev.clientX, ev.clientY, rect)
    const up = () => {
      isDraggingRef.current = false
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", up)
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
  }

  const normalized = (((value % 256) + 256) % 256) / 256
  const angle = Math.PI / 2 - normalized * Math.PI * 2
  const knobX = center.x + Math.cos(angle) * radius
  const knobY = center.y + Math.sin(angle) * radius

  return (
    <div className="inline-block">
      <div className="relative select-none" style={{ width: size, height: size }} onMouseDown={handleMouseDown}>
        <svg width={size} height={size}>
          <circle cx={center.x} cy={center.y} r={radius} fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
          {[0, 64, 128, 192].map((v) => {
            const n = v / 256
            const a = Math.PI / 2 - n * Math.PI * 2
            const ix = center.x + Math.cos(a) * (radius - 8)
            const iy = center.y + Math.sin(a) * (radius - 8)
            const ox = center.x + Math.cos(a) * (radius + 8)
            const oy = center.y + Math.sin(a) * (radius + 8)
            return (
              <line key={v} x1={ix} y1={iy} x2={ox} y2={oy} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
            )
          })}
          <circle cx={knobX} cy={knobY} r={5} fill="hsl(var(--primary))" stroke="hsl(var(--primary))" />
          <circle cx={center.x} cy={center.y} r={2} fill="hsl(var(--muted-foreground))" />
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] text-foreground/80 bg-background/70 rounded px-1">
          {value}
        </div>
      </div>
    </div>
  )
}

