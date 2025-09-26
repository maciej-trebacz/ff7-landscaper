import { useEffect, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { Button } from "@/components/ui/button"
import { useMessagesState } from "@/hooks/useMessagesState"
import { FFTextAutosizer } from "@/ff7/fftext"

export function SetDimensionsUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const SCREEN_W = 320
  const SCREEN_H = 240
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

  const x = clamp(parseInt(ctx.args[0]?.text || "0", 10) || 0, 0, SCREEN_W)
  const y = clamp(parseInt(ctx.args[1]?.text || "0", 10) || 0, 0, SCREEN_H)
  const wRaw = parseInt(ctx.args[2]?.text || "0", 10) || 0
  const hRaw = parseInt(ctx.args[3]?.text || "0", 10) || 0
  const w = clamp(wRaw, 1, SCREEN_W - x)
  const h = clamp(hRaw, 1, SCREEN_H - y)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const scaleRef = useRef<number>(1)
  const dragStateRef = useRef<null | {
    kind: "move" | "resize-right" | "resize-bottom"
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
  }>(null)

  const [containerWidth, setContainerWidth] = useState<number>(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const resizeObserver = new ResizeObserver(() => {
      setContainerWidth(el.clientWidth)
    })
    resizeObserver.observe(el)
    setContainerWidth(el.clientWidth)
    return () => resizeObserver.disconnect()
  }, [])
  const scale = Math.max(0.1, Math.min(2, containerWidth > 0 ? containerWidth / SCREEN_W : 1))
  scaleRef.current = scale

  const { messages } = useMessagesState()

  const autosize = () => {
    const editorHandle = (ctx as any)?.editor as
      | import("@/components/script/WorldscriptEditor").WorldscriptEditorHandle
      | null
      | undefined

    if (!editorHandle || typeof ctx.row !== "number") return

    // Find next Window.set_message or Window.set_prompt line
    const lineCount = editorHandle.getLineCount?.() ?? 0
    let messageId: number | null = null

    for (let r = ctx.row + 1; r < lineCount; r++) {
      const line = editorHandle.getLine?.(r) ?? ""
      const messageMatch = line.match(/\bWindow\.set_message\s*\(\s*(\d+)/)
      const promptMatch = line.match(/\bWindow\.set_prompt\s*\(\s*(\d+)/)

      if (messageMatch) {
        messageId = parseInt(messageMatch[1], 10)
        break
      } else if (promptMatch) {
        messageId = parseInt(promptMatch[1], 10)
        break
      }
    }

    if (messageId === null || !Number.isFinite(messageId)) return

    // Get message text
    const messageText = messages[messageId]
    if (!messageText) return

    // Measure text dimensions
    const autosizer = new FFTextAutosizer()
    const { width, height } = autosizer.measure(messageText)

    // Calculate new dimensions (ensure they fit within screen bounds)
    let newX = x
    let newY = y
    let newW = Math.max(1, width)
    let newH = Math.max(1, height)

    // Adjust position if needed to fit within 320x240 screen
    if (newX + newW > SCREEN_W) {
      newX = SCREEN_W - newW
    }
    if (newY + newH > SCREEN_H) {
      newY = SCREEN_H - newH
    }

    // Ensure X and Y are within bounds
    newX = clamp(newX, 0, SCREEN_W - newW)
    newY = clamp(newY, 0, SCREEN_H - newH)

    commit(newX, newY, newW, newH)
  }

  const commit = (nx: number, ny: number, nw: number, nh: number) => {
    const clampedX = clamp(Math.round(nx), 0, SCREEN_W - 1)
    const clampedY = clamp(Math.round(ny), 0, SCREEN_H - 1)
    const maxW = SCREEN_W - clampedX
    const maxH = SCREEN_H - clampedY
    const clampedW = clamp(Math.round(nw), 1, maxW)
    const clampedH = clamp(Math.round(nh), 1, maxH)
    onBatch([
      { index: 0, newText: String(clampedX) },
      { index: 1, newText: String(clampedY) },
      { index: 2, newText: String(clampedW) },
      { index: 3, newText: String(clampedH) },
    ])
  }

  const onMouseMove = (e: MouseEvent) => {
    const st = dragStateRef.current
    if (!st) return
    const s = scaleRef.current || 1
    const dx = (e.clientX - st.startX) / s
    const dy = (e.clientY - st.startY) / s
    if (st.kind === "move") {
      const nx = clamp(st.origX + dx, 0, SCREEN_W - st.origW)
      const ny = clamp(st.origY + dy, 0, SCREEN_H - st.origH)
      commit(nx, ny, st.origW, st.origH)
    } else if (st.kind === "resize-right") {
      const nw = clamp(st.origW + dx, 1, SCREEN_W - st.origX)
      commit(st.origX, st.origY, nw, st.origH)
    } else if (st.kind === "resize-bottom") {
      const nh = clamp(st.origH + dy, 1, SCREEN_H - st.origY)
      commit(st.origX, st.origY, st.origW, nh)
    }
  }

  const endDrag = () => {
    dragStateRef.current = null
    window.removeEventListener("mousemove", onMouseMove)
    window.removeEventListener("mouseup", endDrag)
  }

  const beginDrag = (kind: "move" | "resize-right" | "resize-bottom") => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragStateRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      origX: x,
      origY: y,
      origW: w,
      origH: h,
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", endDrag)
  }

  const handleInput = (index: 0 | 1 | 2 | 3, rawValue: string) => {
    let nx = x,
      ny = y,
      nw = w,
      nh = h
    const parsed = parseInt(rawValue || "0", 10)
    const val = Number.isNaN(parsed) ? 0 : parsed
    if (index === 0) {
      nx = clamp(val, 0, SCREEN_W - nw)
    } else if (index === 1) {
      ny = clamp(val, 0, SCREEN_H - nh)
    } else if (index === 2) {
      nw = clamp(val, 1, SCREEN_W - nx)
    } else if (index === 3) {
      nh = clamp(val, 1, SCREEN_H - ny)
    }
    commit(nx, ny, nw, nh)
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && (
        <Description>
          {ctx.description} Screen: {SCREEN_W}x{SCREEN_H}
        </Description>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">X</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            value={x}
            min={0}
            max={SCREEN_W - 1}
            onChange={(e) => handleInput(0, e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Y</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            value={y}
            min={0}
            max={SCREEN_H - 1}
            onChange={(e) => handleInput(1, e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Width</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            value={w}
            min={1}
            max={SCREEN_W - x}
            onChange={(e) => handleInput(2, e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Height</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            value={h}
            min={1}
            max={SCREEN_H - y}
            onChange={(e) => handleInput(3, e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] text-muted-foreground">Preview</div>
        <div ref={containerRef} className="w-full border rounded bg-muted/30">
          <div
            ref={stageRef}
            className="relative select-none"
            style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
          >
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]" />
            <div
              className="absolute border border-blue-500/70 bg-blue-500/10"
              style={{ left: x, top: y, width: w, height: h, cursor: "move" }}
              onMouseDown={beginDrag("move")}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-[10px] text-foreground/80 bg-background/70 px-1 rounded">Message</div>
              </div>
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-6 bg-blue-500/50 cursor-ew-resize"
                onMouseDown={beginDrag("resize-right")}
              />
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-2 bg-blue-500/50 cursor-ns-resize"
                onMouseDown={beginDrag("resize-bottom")}
              />
            </div>
            <div className="absolute bottom-1 left-1 text-[10px] text-muted-foreground/70 bg-background/70 px-1 rounded">
              {x},{y} {w}x{h}
            </div>
          </div>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full text-xs"
        onClick={autosize}
      >
        Autosize to Message
      </Button>
    </div>
  )
}

