/*
  This component orchestrates the sidebar UI for a selected worldscript call.
  It chooses either a custom, domain‑specific renderer or a generic fallback
  that renders parameters by type.

  Key pieces
  - DefaultParamControls: generic param UI (boolean/enum/number/text) with a
    nicer radial control for 0..255 "direction" params.
  - ui/registry.tsx: maps "Namespace.method" to a custom renderer component.
  - ui/*: domain UIs (EnterFieldUI, SetMessageUI, SetMeshCoordsUI, etc.). Each
    exports a component with the signature ({ ctx, onBatch }).
  - controls/*: small reusable UI controls (e.g., DirectionRadial).
  - hooks/*: shared hooks for domain UIs (e.g., useFieldSelection).
  - types.ts: re‑exports editor types to decouple UIs from the editor file path.

  How custom renderers work
  - ScriptSidebar derives a key `${context.namespace}.${context.method}`.
  - getCustomRenderer(key) returns a function that renders the custom UI.
  - ScriptSidebar wraps that renderer to also inject an optional `editor` handle
    into ctx (ctx.editor) so advanced UIs can read the script around the current
    call when needed (e.g., SetCoordsInMeshUI back‑tracks for mesh coords).
  - If no custom renderer exists, DefaultParamControls is shown.

  Adding a new custom UI
  1) Create a component under ui/ with signature:
     export function MyOpcodeUI({ ctx, onBatch }: { ctx: CallContext; onBatch: (updates: { index: number; newText: string }[]) => void }) { ... }
     - Read current values from ctx.args[N].text.
     - Emit updates via onBatch([{ index, newText }]).
  2) Register it in ui/registry.tsx by adding a "Namespace.method": (ctx, onBatch) => <MyOpcodeUI ctx={ctx} onBatch={onBatch} /> entry.
  3) Reuse controls/*, hooks/* and Description where possible to stay consistent.
*/

import { cn } from "@/lib/utils"
import { useMemo } from "react"
import type { CallContext, WorldscriptEditorHandle } from "@/components/script/types"
import { DefaultParamControls } from "@/components/script/DefaultParamControls"
import { getCustomRenderer } from "@/components/script/ui/registry"

interface ScriptSidebarProps {
  className?: string
  context?: CallContext | null
  onParamChange?: (index: number, newText: string) => void
  onBatchParamsChange?: (updates: Array<{ index: number; newText: string }>) => void
  editor?: WorldscriptEditorHandle | null
}

export function ScriptSidebar({ className, context, onParamChange, onBatchParamsChange, editor }: ScriptSidebarProps) {
  const customRenderer = useMemo(() => {
    if (!context) return null
    const key = `${context.namespace}.${context.method}`
    const renderer = getCustomRenderer(key)
    return renderer
      ? (ctx: CallContext, onBatch: (u: Array<{ index: number; newText: string }>) => void) =>
          renderer({ ...ctx, editor } as any, onBatch)
      : null
  }, [context, editor])

  return (
    <div className={cn("bg-background p-2", className)}>
      {!context ? (
        <div className="text-xs text-muted-foreground">No opcode selected</div>
      ) : customRenderer ? (
        customRenderer(context, (updates) => onBatchParamsChange?.(updates))
      ) : (
        <DefaultParamControls context={context} onParamChange={onParamChange} />
      )}
    </div>
  )
}
