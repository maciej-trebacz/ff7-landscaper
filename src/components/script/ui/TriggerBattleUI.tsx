import { Label } from "@/components/ui/label"
import { BattleAutocompleteModal } from "@/components/ui/battle-autocomplete"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"
import { useBattleData } from "@/hooks/useBattleData"

export function TriggerBattleUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const { battleScenes } = useBattleData()

  const currentBattleId = parseInt(ctx.args[0]?.text || "0", 10) || 0

  const handleValueChange = (battleId: number | null) => {
    const newText = battleId !== null ? String(battleId) : "0"
    onBatch([{ index: 0, newText }])
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      <div className="space-y-1">
        <Label className="text-xs">Battle ID</Label>
        <BattleAutocompleteModal
          battleScenes={battleScenes}
          value={currentBattleId}
          onSelect={handleValueChange}
          placeholder="Click to search battles..."
        />
      </div>
    </div>
  )
}
