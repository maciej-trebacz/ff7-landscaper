import { cn } from "@/lib/utils"
import { useEffect, useMemo, useRef, useState } from "react"
import type { CallContext } from "@/components/script/WorldscriptEditor"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadFieldOptions } from "@/lib/field-options"
import { useLocationsState } from "@/hooks/useLocationsState"
import { useMessagesState } from "@/hooks/useMessagesState"
import { useScriptsState } from "@/hooks/useScriptState"
import { modelsMapping, systemScriptNames, modelScriptNames, fieldsMapping } from "@/ff7/worldscript/constants"
import { FunctionType } from "@/ff7/evfile"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MapPicker } from "@/components/map/MapPicker"
import { useMapState } from "@/hooks/useMapState"
import { LOCATION_COLORS, MESH_SIZE } from "@/components/map/constants"

interface ScriptSidebarProps {
  className?: string
  context?: CallContext | null
  onParamChange?: (index: number, newText: string) => void
  onBatchParamsChange?: (updates: Array<{ index: number; newText: string }>) => void
  editor?: import("@/components/script/WorldscriptEditor").WorldscriptEditorHandle | null
}

type CustomRenderer = (
  ctx: CallContext,
  onBatchChange: (updates: Array<{ index: number; newText: string }>) => void
) => JSX.Element

const customUiRegistry: Record<string, CustomRenderer> = {
  // Keys are Namespace.method
  "Point.set_terrain_color": (ctx, onBatch) => colorTriple(ctx, onBatch),
  "Point.set_sky_top_color": (ctx, onBatch) => colorTriple(ctx, onBatch),
  "Point.set_sky_bottom_color": (ctx, onBatch) => colorTriple(ctx, onBatch),
  "System.set_map_options": (ctx, onBatch) => mapOptions(ctx, onBatch),
  "Sound.set_music_volume": (ctx, onBatch) => numberSlider(ctx, onBatch, 0, { label: "Music Volume" }),
  "Entity.set_walk_speed": (ctx, onBatch) => numberSlider(ctx, onBatch, 0, { label: "Walk Speed" }),
  "Entity.set_movespeed": (ctx, onBatch) => numberSlider(ctx, onBatch, 0, { label: "Move Speed" }),
  "System.fade_in": (ctx, onBatch) => numberSlider(ctx, onBatch, 0, { label: "Fade Speed" }),
  "System.fade_out": (ctx, onBatch) => numberSlider(ctx, onBatch, 0, { label: "Fade Speed" }),
  "Camera.set_rotation_speed": (ctx, onBatch) => numberSlider(ctx, onBatch, 0, { label: "Camera Rotation Speed" }),
  "Camera.set_tilt_speed": (ctx, onBatch) => numberSlider(ctx, onBatch, 0, { label: "Camera Tilt Speed" }),
  "Camera.set_zoom_speed": (ctx, onBatch) => numberSlider(ctx, onBatch, 0, { label: "Camera Zoom Speed" }),
  "System.enter_field": (ctx, onBatch) => <EnterFieldUI ctx={ctx} onBatch={onBatch} />,
  "Entity.load_model": (ctx, onBatch) => <EntityModelSelectUI ctx={ctx} onBatch={onBatch} />,
  "Window.set_message": (ctx, onBatch) => <SetMessageUI ctx={ctx} onBatch={onBatch} />,
  "Window.set_dimensions": (ctx, onBatch) => <SetDimensionsUI ctx={ctx} onBatch={onBatch} />,
  "Entity.set_direction_facing": (ctx, onBatch) => directionRadial(ctx, onBatch, 0, { label: "Direction" }),
  "Entity.set_movement_direction": (ctx, onBatch) => directionRadial(ctx, onBatch, 0, { label: "Direction" }),
  "Entity.set_mesh_coords": (ctx, onBatch) => <SetMeshCoordsUI ctx={ctx} onBatch={onBatch} scope="Entity" />,
  "Point.set_mesh_coords": (ctx, onBatch) => <SetMeshCoordsUI ctx={ctx} onBatch={onBatch} scope="Point" />,
  "Entity.set_coords_in_mesh": (ctx, onBatch) => <SetCoordsInMeshUI ctx={ctx} onBatch={onBatch} />,
  "Point.set_coords_in_mesh": (ctx, onBatch) => <SetCoordsInMeshUI ctx={ctx} onBatch={onBatch} />,
  "System.call_function": (ctx, onBatch) => <CallFunctionUI ctx={ctx} onBatch={onBatch} />,
}

function colorTriple(ctx: CallContext, onBatch: (updates: Array<{ index: number; newText: string }>) => void) {
  const [r, g, b] = ctx.args.map((a) => parseInt(a.text || "0", 10) || 0)
  const clamp = (n: number) => Math.max(0, Math.min(255, n | 0))
  const hex = `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b)
    .toString(16)
    .padStart(2, "0")}`.toUpperCase()
  const onChange = (val: string) => {
    if (!/^#?[0-9a-fA-F]{6}$/.test(val)) return
    const v = val.startsWith("#") ? val.slice(1) : val
    const nr = parseInt(v.slice(0, 2), 16)
    const ng = parseInt(v.slice(2, 4), 16)
    const nb = parseInt(v.slice(4, 6), 16)
    onBatch([
      { index: 0, newText: String(nr) },
      { index: 1, newText: String(ng) },
      { index: 2, newText: String(nb) },
    ])
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}
      <div className="space-y-2">
        <Label className="text-xs">
          Color <span className="text-muted-foreground text-[11px]">(click to edit)</span>
        </Label>
        <div className="flex items-center gap-2 !mt-1">
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-8 p-0 border-0 bg-transparent"
          />
          <div className="text-[11px] text-muted-foreground">RGB: {`${clamp(r)}, ${clamp(g)}, ${clamp(b)}`}</div>
        </div>
      </div>
    </div>
  )
}

export function ScriptSidebar({ className, context, onParamChange, onBatchParamsChange, editor }: ScriptSidebarProps) {
  const customRenderer = useMemo(() => {
    if (!context) return null
    const key = `${context.namespace}.${context.method}`
    // Inject editor handle into context so custom UIs can scan script if needed
    const renderer = customUiRegistry[key] ?? null
    return renderer ? (ctx, onBatch) => renderer({ ...ctx, editor } as any, onBatch) : null
  }, [context, editor])

  return (
    <div className={cn("bg-background p-2", className)}>
      {!context ? (
        <div className="text-xs text-muted-foreground">No opcode selected</div>
      ) : customRenderer ? (
        customRenderer(context, (updates) => onBatchParamsChange?.(updates))
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-medium">
            {context.namespace}.{context.method}
          </div>
          {context.description && <div className="text-[11px] text-muted-foreground">{context.description}</div>}
          <div className="space-y-2">
            {context.params.map((p, i) => {
              const arg = context.args[i]
              const type = (p as any).type as undefined | { kind: string; [k: string]: any }
              if (!arg) return null
              const label = p.name || `arg${i + 1}`
              if (type?.kind === "boolean") {
                const checked = arg.text === "1" || arg.text.toLowerCase?.() === "true"
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox checked={checked} onCheckedChange={(v) => onParamChange?.(i, v ? "1" : "0")} />
                    <Label className="text-xs">{label}</Label>
                  </div>
                )
              }
              if (type?.kind === "enum") {
                const options = type.options || []
                const current = arg.text
                return (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Select value={current} onValueChange={(v) => onParamChange?.(i, String(v))}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((opt, idx) => (
                          <SelectItem key={idx} value={String(opt.value)} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }
              // Direction radial control for better UX (0 down, 64 right, 128 up, 192 left)
              if (
                type?.kind === "number" &&
                p.name?.toLowerCase?.() === "direction" &&
                (type.min ?? 0) === 0 &&
                (type.max ?? 255) === 255
              ) {
                const n = parseInt(arg.text || "0", 10) || 0
                return (
                  <div key={i} className="space-y-1">
                    <DirectionRadial value={n} onChange={(v) => onParamChange?.(i, String(v))} />
                  </div>
                )
              }
              if (type?.kind === "number") {
                const n = parseInt(arg.text || "0", 10)
                return (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <input
                      type="number"
                      className="h-7 text-xs w-full bg-background border rounded px-2"
                      value={Number.isNaN(n) ? "" : n}
                      min={type.min}
                      max={type.max}
                      step={type.step}
                      onChange={(e) => onParamChange?.(i, e.target.value)}
                    />
                  </div>
                )
              }
              return (
                <div key={i} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <input
                    className="h-7 text-xs w-full bg-background border rounded px-2"
                    value={arg.text}
                    onChange={(e) => onParamChange?.(i, e.target.value)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function numberSlider(
  ctx: CallContext,
  onBatch: (updates: Array<{ index: number; newText: string }>) => void,
  index: number,
  opts?: { label?: string }
) {
  const p = ctx.params[index] as any
  const type = p?.type as undefined | { kind: string; min?: number; max?: number; step?: number }
  const val = parseInt(ctx.args[index]?.text || "0", 10) || 0
  const min = Math.max(0, type?.min ?? 0)
  const max = Math.max(min, type?.max ?? 255)
  const step = type?.step ?? 1
  const label = opts?.label ?? p?.name ?? `arg${index + 1}`
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}
      <div className="space-y-1">
        <Label className="text-xs">
          {label}: {val}
        </Label>
        <input
          type="range"
          className="w-full"
          min={min}
          max={max}
          step={step}
          value={val}
          onChange={(e) => onBatch([{ index, newText: String(e.target.value) }])}
        />
      </div>
    </div>
  )
}

function mapOptions(ctx: CallContext, onBatch: (updates: Array<{ index: number; newText: string }>) => void) {
  const flags = [
    { bit: 1, label: "Camera low" },
    { bit: 2, label: "Show heading" },
    { bit: 4, label: "Show big map" },
    { bit: 8, label: "Hide mini map" },
  ]
  const current = parseInt(ctx.args[0]?.text || "0", 10) || 0
  const toggle = (bit: number) => {
    const next = current & bit ? current & ~bit : current | bit
    onBatch([{ index: 0, newText: String(next) }])
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}
      <div className="grid grid-cols-1 gap-1">
        {flags.map((f) => (
          <label key={f.bit} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={(current & f.bit) !== 0} onChange={() => toggle(f.bit)} />
            <span>{f.label}</span>
          </label>
        ))}
      </div>
      <div className="text-[11px] text-muted-foreground">Value: {current}</div>
    </div>
  )
}

function EnterFieldUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const [options, setOptions] = useState<Array<{ id: number; fieldId: number; label: string }>>([])
  const [nameByFieldId, setNameByFieldId] = useState<Record<number, string>>({})
  const { entries, loadLocations } = useLocationsState()

  // Ensure we have scene labels and locations loaded
  useEffect(() => {
    let mounted = true
    loadFieldOptions().then(({ byId }) => {
      if (mounted) setNameByFieldId(byId)
    })
    if (!entries || entries.length === 0) {
      loadLocations()
    }
    return () => {
      mounted = false
    }
  }, [entries?.length, loadLocations])

  // Recompute dropdown options when entries or scenario changes
  useEffect(() => {
    const scenario = parseInt(ctx.args[1]?.text || "0", 10) || 0
    if (!entries || entries.length === 0) {
      setOptions([])
      return
    }
    const opts: Array<{ id: number; fieldId: number; label: string }> = entries.map((entry, idx) => {
      const fieldId = scenario === 1 ? entry.alternative.fieldId : entry.default.fieldId
      const sceneLabel = nameByFieldId[fieldId] ?? String(fieldId)
      return { id: idx + 1, fieldId, label: `${idx + 1} - ${sceneLabel}` }
    })
    setOptions(opts)
  }, [entries, ctx.args[1]?.text, nameByFieldId])
  // Determine current selection: support Fields.slug or numeric index
  // scenario is included in deps above; compute but don't store local var to avoid stale usage warnings
  const raw = ctx.args[0]?.text?.trim() || ""
  let currentId = 0
  const fieldsSlugMatch = raw.match(/^Fields\.([A-Za-z0-9_]+)$/i)
  if (fieldsSlugMatch && entries && entries.length > 0) {
    const slug = fieldsSlugMatch[1]
    // Build reverse map slug -> location index (as defined in fieldsMapping)
    const slugToLocIndex: Record<string, number> = {}
    Object.entries(fieldsMapping).forEach(([locIndex, s]) => {
      slugToLocIndex[s] = Number(locIndex)
    })
    const wantedIndex = slugToLocIndex[slug]
    currentId = wantedIndex && wantedIndex >= 1 && wantedIndex <= (entries?.length ?? 0) ? wantedIndex : 0
  } else {
    currentId = parseInt(raw || "0", 10) || 0
  }
  const currentScenario = parseInt(ctx.args[1]?.text || "0", 10) || 0
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}
      <div className="space-y-1">
        <Label className="text-xs">Location</Label>
        <Select
          value={currentId ? String(currentId) : ""}
          onValueChange={(v) => {
            const idx = parseInt(v, 10)
            const slug = (fieldsMapping as any)[idx]
            const newText = slug ? `Fields.${slug}` : String(idx)
            onBatch([{ index: 0, newText }])
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select field" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={String(opt.id)} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-[11px] text-muted-foreground">You can edit this list in the Locations tab.</div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Scenario</Label>
        <Select value={String(currentScenario)} onValueChange={(v) => onBatch([{ index: 1, newText: String(v) }])}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select scenario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0" className="text-xs">
              Default
            </SelectItem>
            <SelectItem value="1" className="text-xs">
              Alternate
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function EntityModelSelectUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const entries: Array<{ value: number; slug: string }> = useMemo(() => {
    return Object.entries(modelsMapping).map(([k, v]) => ({ value: Number(k), slug: v }))
  }, [])
  const raw = ctx.args[0]?.text?.trim() || ""
  const slugMatch = raw.match(/^Entities\.([A-Za-z0-9_]+)$/i)
  let currentValue: number | "" = ""
  if (slugMatch) {
    const slug = slugMatch[1]
    const found = entries.find((e) => e.slug === slug)
    currentValue = found ? found.value : ""
  } else {
    const n = parseInt(raw || "0", 10)
    currentValue = Number.isNaN(n) ? "" : n
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}
      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <Select
          value={currentValue === "" ? "" : String(currentValue)}
          onValueChange={(v) => {
            const value = parseInt(v, 10)
            const found = entries.find((e) => e.value === value)
            const newText = found ? `Entities.${found.slug}` : String(value)
            onBatch([{ index: 0, newText }])
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {entries.map((e) => (
              <SelectItem key={e.value} value={String(e.value)} className="text-xs">
                {e.value} - {e.slug}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function SetMessageUI({
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
  const raw = ctx.args[0]?.text?.trim() || ""
  const currentIndex = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN
  const preview = Number.isInteger(currentIndex) && messages[currentIndex] ? messages[currentIndex] : ""
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
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}
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
      {preview && (
        <div className="text-[11px] text-muted-foreground border rounded p-2 max-h-36 overflow-auto whitespace-pre-wrap">
          {preview}
        </div>
      )}
    </div>
  )
}

function SetDimensionsUI({
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

  // Compute scale to fit width
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
        <div className="text-[11px] text-muted-foreground">
          {ctx.description} Screen: {SCREEN_W}x{SCREEN_H}
        </div>
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
          {/* spacer to give container proper height according to scale */}
          {/* <div style={{ height: SCREEN_H * scale }} /> */}
        </div>
      </div>
    </div>
  )
}

function directionRadial(
  ctx: CallContext,
  onBatch: (updates: Array<{ index: number; newText: string }>) => void,
  index: number,
  _opts?: { label?: string }
) {
  const val = parseInt(ctx.args[index]?.text || "0", 10) || 0
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}
      <DirectionRadial value={val} onChange={(v) => onBatch([{ index, newText: String(v) }])} />
    </div>
  )
}

function SetMeshCoordsUI({
  ctx,
  onBatch,
  scope,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
  scope: "Entity" | "Point"
}) {
  const [open, setOpen] = useState(false)
  const x = Math.max(0, Math.min(35, parseInt(ctx.args[0]?.text || "0", 10) || 0))
  const z = Math.max(0, Math.min(27, parseInt(ctx.args[1]?.text || "0", 10) || 0))

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">X</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            min={0}
            max={35}
            value={x}
            onChange={(e) =>
              onBatch([
                { index: 0, newText: String(Math.max(0, Math.min(35, parseInt(e.target.value || "0", 10) || 0))) },
              ])
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Z</Label>
          <input
            type="number"
            className="h-7 text-xs w-full bg-background border rounded px-2"
            min={0}
            max={27}
            value={z}
            onChange={(e) =>
              onBatch([
                { index: 1, newText: String(Math.max(0, Math.min(27, parseInt(e.target.value || "0", 10) || 0))) },
              ])
            }
          />
        </div>
      </div>
      <div>
        <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setOpen(true)}>
          Pick from Map
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
        }}
      >
        <DialogContent className="max-w-[900px] p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="text-base">Pick Mesh Coordinates ({scope})</DialogTitle>
          </DialogHeader>
          <div className="h-[560px] w-[900px]">
            <MapPicker
              preselect={{ x, z }}
              onPickCell={(mx, mz) => {
                onBatch([
                  { index: 0, newText: String(mx) },
                  { index: 1, newText: String(mz) },
                ])
                setOpen(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SetCoordsInMeshUI({
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
  const draggingRef = useRef(false)

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
    draggingRef.current = true
    updateFromEvent(e.clientX, e.clientY)
    const move = (ev: MouseEvent) => updateFromEvent(ev.clientX, ev.clientY)
    const up = () => {
      draggingRef.current = false
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
    // Scan upward from current row for a set_mesh_coords call and extract X,Z
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

  // Draw terrain preview for the selected mesh using simple colors
  const { worldmap, mapType } = useMapState()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !worldmap) return
    // Need last mesh coords to know which mesh fragment to draw
    const mx = lastMesh?.x ?? null
    const mz = lastMesh?.z ?? null
    if (mx === null || mz === null) return
    // Worldmap is [rows][cols]; these are mesh indices already
    const mesh = worldmap[mz]?.[mx]
    if (!mesh) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const W = SIZE
    const H = SIZE
    ctx.clearRect(0, 0, W, H)
    const colors = LOCATION_COLORS[mapType]
    // Render filled triangles colored by terrain type/location
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
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    }
    // Optional outline
    ctx.strokeStyle = "rgba(0,0,0,0.15)"
    ctx.lineWidth = 1
    for (const t of mesh.triangles) {
      const vs = [t.vertex0, t.vertex1, t.vertex2]
      const toScreen = (v: { x: number; z: number }) => ({
        x: (v.x / MESH_SIZE) * (W - 1),
        y: (v.z / MESH_SIZE) * (H - 1),
      })
      const p0 = toScreen(vs[0])
      const p1 = toScreen(vs[1])
      const p2 = toScreen(vs[2])
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.closePath()
      ctx.stroke()
    }
  }, [canvasRef.current, worldmap, lastMesh?.x, lastMesh?.z, mapType])

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}
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
            {/* crosshair / grid optional */}
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

// removed legacy MeshPicker in favor of MapPicker

function CallFunctionUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const { functions, selectScript, setScriptType } = useScriptsState()

  // Parse current values with new order: entityId, functionId
  const rawEntityText = ctx.args[0]?.text?.trim() || ""
  const slugMatch = rawEntityText.match(/^Entities\.([A-Za-z0-9_]+)$/i)
  let entityId: number | "" = ""
  if (slugMatch) {
    const slug = slugMatch[1]
    const found = Object.entries(modelsMapping).find(([_, name]) => name === slug)
    entityId = found ? parseInt(found[0], 10) : ""
  } else {
    const n = parseInt(rawEntityText || "0", 10)
    entityId = Number.isNaN(n) ? "" : n
  }

  const functionId = parseInt(ctx.args[1]?.text || "0", 10) || 0

  // Create entity options from modelsMapping
  const entityOptions = useMemo(() => {
    return Object.entries(modelsMapping).map(([id, name]) => ({
      value: parseInt(id, 10),
      label: `${name} (${id})`,
      slug: name
    })).sort((a, b) => a.value - b.value)
  }, [])

  // Get available functions for selected entity
  const functionOptions = useMemo(() => {
    if (entityId === 65535) {
      // System entity
      return functions
        .filter(f => f.type === FunctionType.System)
        .map(f => ({
          value: f.id,
          label: systemScriptNames[f.id] ? `${systemScriptNames[f.id]} (${f.id})` : `system_${f.id} (${f.id})`
        }))
        .sort((a, b) => a.value - b.value)
    } else {
      // Model entity
      return functions
        .filter(f => f.type === FunctionType.Model && f.modelId === entityId)
        .map(f => ({
          value: f.id,
          label: modelScriptNames[f.id] ? `${modelScriptNames[f.id]} (${f.id})` : `model_${f.id} (${f.id})`
        }))
        .sort((a, b) => a.value - b.value)
    }
  }, [functions, entityId])

  const handleEntityChange = (value: string) => {
    const newEntityId = parseInt(value, 10)
    const found = entityOptions.find(option => option.value === newEntityId)
    const newText = found ? `Entities.${found.slug}` : String(newEntityId)
    onBatch([{ index: 0, newText }])
  }

  const handleFunctionChange = (value: string) => {
    const newFunctionId = parseInt(value, 10)
    onBatch([{ index: 1, newText: String(newFunctionId) }])
  }

  const handleJumpToFunction = () => {
    if (entityId === "" || functionId === 0) return

    // Find the target script based on entity and function ID
    let targetScript = null

    if (entityId === 65535) {
      // System entity
      targetScript = functions.find(f => f.type === FunctionType.System && f.id === functionId)
    } else {
      // Model entity
      targetScript = functions.find(f => f.type === FunctionType.Model && f.modelId === entityId && f.id === functionId)
    }

    if (targetScript) {
      // Set the script type to match the target script's type
      setScriptType(targetScript.type)
      selectScript(targetScript)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <div className="text-[11px] text-muted-foreground">{ctx.description}</div>}

      <div className="space-y-1">
        <Label className="text-xs">Entity</Label>
        <Select
          value={entityId === "" ? "" : String(entityId)}
          onValueChange={handleEntityChange}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select entity" />
          </SelectTrigger>
          <SelectContent>
            {entityOptions.map((option) => (
              <SelectItem key={option.value} value={String(option.value)} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Function ID</Label>
        <Select
          value={String(functionId)}
          onValueChange={handleFunctionChange}
          disabled={functionOptions.length === 0}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder={functionOptions.length === 0 ? "No functions available" : "Select function"} />
          </SelectTrigger>
          <SelectContent>
            {functionOptions.map((option) => (
              <SelectItem key={option.value} value={String(option.value)} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {functionOptions.length === 0 && (
          <div className="text-[11px] text-muted-foreground">
            No functions found for selected entity
          </div>
        )}
      </div>

      <div>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs w-full"
          onClick={handleJumpToFunction}
          disabled={entityId === "" || functionId === 0}
        >
          Jump to Function
        </Button>
      </div>
    </div>
  )
}

function DirectionRadial({ value, onChange }: { value: number; onChange: (val: number) => void }) {
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
    // atan2 returns angle from +X (right). Map so 0 is down and increases clockwise.
    const angle = Math.atan2(dy, dx) // -PI..PI (screen coords)
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
          {/* tick marks */}
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
          {/* knob */}
          <circle cx={knobX} cy={knobY} r={5} fill="hsl(var(--primary))" stroke="hsl(var(--primary))" />
          {/* center */}
          <circle cx={center.x} cy={center.y} r={2} fill="hsl(var(--muted-foreground))" />
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] text-foreground/80 bg-background/70 rounded px-1">
          {value}
        </div>
      </div>
    </div>
  )
}
