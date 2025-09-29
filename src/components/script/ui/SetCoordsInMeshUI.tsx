import { useEffect, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { useMaps } from "@/hooks/useMaps"
import { LOCATION_COLORS, MESH_SIZE } from "@/components/map/constants"

export function SetCoordsInMeshUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const SIZE = 320
  const MAX = 8191
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
  const x = clamp(parseInt(ctx.args[0]?.text || "0", 10) || 0, 0, MAX)
  const z = clamp(parseInt(ctx.args[1]?.text || "0", 10) || 0, 0, MAX)
  const editorHandle = (ctx as any)?.editor as
    | import("@/components/script/WorldscriptEditor").WorldscriptEditorHandle
    | null
    | undefined
  const [lastMesh, setLastMesh] = useState<{ x: number; z: number } | null>(null)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const toPx = (v: number) => Math.round((v * (SIZE - 1)) / MAX)
  const toVal = (p: number) => clamp(Math.round((p * MAX) / (SIZE - 1)), 0, MAX)

  const commit = (nx: number, nz: number) => {
    const cx = clamp(Math.round(nx), 0, MAX)
    const cz = clamp(Math.round(nz), 0, MAX)
    onBatch([
      { index: 0, newText: String(cx) },
      { index: 1, newText: String(cz) },
    ])
  }

  const updateFromEvent = (clientX: number, clientY: number) => {
    const el = stageRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = clamp(clientX - rect.left, 0, SIZE - 1)
    const pz = clamp(clientY - rect.top, 0, SIZE - 1)
    commit(toVal(px), toVal(pz))
  }

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    updateFromEvent(e.clientX, e.clientY)
    const move = (ev: MouseEvent) => updateFromEvent(ev.clientX, ev.clientY)
    const up = () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", up)
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
  }

  const pxX = toPx(x)
  const pxZ = toPx(z)

  useEffect(() => {
    if (!editorHandle || typeof ctx.row !== "number") return
    const lineCount = editorHandle.getLineCount?.() ?? 0
    const start = Math.min(ctx.row, lineCount - 1)
    for (let r = start; r >= 0; r--) {
      const line = editorHandle.getLine?.(r) ?? ""
      const m = line.match(/\b(?:Entity|Point)\.set_mesh_coords\s*\(([^)]*)\)/)
      if (m) {
        const args = m[1].split(",")
        const mx = parseInt((args[0] ?? "").trim() || "0", 10)
        const mz = parseInt((args[1] ?? "").trim() || "0", 10)
        if (Number.isFinite(mx) && Number.isFinite(mz)) {
          const clampedX = Math.max(0, Math.min(35, mx))
          const clampedZ = Math.max(0, Math.min(27, mz))
          setLastMesh({ x: clampedX, z: clampedZ })
          break
        }
      }
    }
  }, [editorHandle, ctx.row])

  const { worldmap, mapType } = useMaps()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !worldmap) return
    const mx = lastMesh?.x ?? null
    const mz = lastMesh?.z ?? null
    if (mx === null || mz === null) return
    const mesh = worldmap[mz]?.[mx]
    if (!mesh) return
    const ctx2d = canvas.getContext("2d")
    if (!ctx2d) return
    const W = SIZE
    const H = SIZE
    ctx2d.clearRect(0, 0, W, H)
    const colors = LOCATION_COLORS[mapType]
    for (const t of mesh.triangles) {
      const vs = [t.vertex0, t.vertex1, t.vertex2]
      const toScreen = (v: { x: number; z: number }) => ({
        x: (v.x / MESH_SIZE) * (W - 1),
        y: (v.z / MESH_SIZE) * (H - 1),
      })
      const p0 = toScreen(vs[0])
      const p1 = toScreen(vs[1])
      const p2 = toScreen(vs[2])
      const color = colors?.[t.type] ?? "#888"
      ctx2d.beginPath()
      ctx2d.moveTo(p0.x, p0.y)
      ctx2d.lineTo(p1.x, p1.y)
      ctx2d.lineTo(p2.x, p2.y)
      ctx2d.closePath()
      ctx2d.fillStyle = color
      ctx2d.fill()
    }
    ctx2d.strokeStyle = "rgba(0,0,0,0.15)"
    ctx2d.lineWidth = 1
    for (const t of mesh.triangles) {
      const vs = [t.vertex0, t.vertex1, t.vertex2]
      const toScreen = (v: { x: number; z: number }) => ({
        x: (v.x / MESH_SIZE) * (W - 1),
        y: (v.z / MESH_SIZE) * (H - 1),
      })
      const p0 = toScreen(vs[0])
      const p1 = toScreen(vs[1])
      const p2 = toScreen(vs[2])
      ctx2d.beginPath()
      ctx2d.moveTo(p0.x, p0.y)
      ctx2d.lineTo(p1.x, p1.y)
      ctx2d.lineTo(p2.x, p2.y)
      ctx2d.closePath()
      ctx2d.stroke()
    }
  }, [canvasRef.current, worldmap, lastMesh?.x, lastMesh?.z, mapType])

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      {lastMesh ? (
        <div className="text-[11px] text-muted-foreground">
          Mesh X/Z: {lastMesh.x},{lastMesh.z}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">Mesh X/Z: (not found above)</div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">X</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            min={0}
            max={MAX}
            value={x}
            onChange={(e) => {
              const v = clamp(parseInt(e.target.value || "0", 10) || 0, 0, MAX)
              onBatch([{ index: 0, newText: String(v) }])
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Z</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            min={0}
            max={MAX}
            value={z}
            onChange={(e) => {
              const v = clamp(parseInt(e.target.value || "0", 10) || 0, 0, MAX)
              onBatch([{ index: 1, newText: String(v) }])
            }}
          />
        </div>
      </div>

      {lastMesh && (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">
            Pick within mesh {lastMesh.x}x{lastMesh.z}
          </div>
          <div
            ref={stageRef}
            className="relative select-none border rounded bg-muted"
            style={{ width: SIZE, height: SIZE }}
            onMouseDown={onMouseDown}
          >
            <canvas ref={canvasRef} width={SIZE} height={SIZE} className="absolute inset-0 w-full h-full" />
            <div
              className="absolute w-3 h-3 rounded-full bg-pink-600 border-2 border-white"
              style={{ left: pxX - 2, top: pxZ - 2 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

