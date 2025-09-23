import { useState } from "react"
import { Label } from "@/components/ui/label"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MapPicker } from "@/components/map/MapPicker"

export function SetMeshCoordsUI({
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
      {ctx.description && <Description>{ctx.description}</Description>}
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

