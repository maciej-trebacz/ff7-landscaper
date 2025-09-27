import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BattleAutocompleteModal } from '@/components/ui/battle-autocomplete'
import type { YuffieEncounter } from '@/ff7/encwfile'
import type { BattleScene } from '@/hooks/types'

interface YuffieEncounterRowProps {
  encounter: YuffieEncounter
  index: number
  onUpdate: (index: number, updates: Partial<YuffieEncounter>) => void
  battleScenes: BattleScene[]
}

function YuffieEncounterRow({ encounter, index, onUpdate, battleScenes }: YuffieEncounterRowProps) {
  return (
    <div className="flex items-center gap-4 p-3 border rounded">
      <Label className="w-20 text-sm font-normal flex-shrink-0">#{index + 1}</Label>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Label className="text-xs flex-shrink-0">Cloud Lvl:</Label>
        <Input
          type="number"
          min="1"
          max="99"
          value={encounter.cloudLevel}
          onChange={(e) => onUpdate(index, { cloudLevel: parseInt(e.target.value) || 1 })}
          className="w-20 h-7 text-xs flex-shrink-0"
        />
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Label className="text-xs flex-shrink-0">Battle ID:</Label>
        <div className="flex-1 min-w-0">
          <BattleAutocompleteModal
            battleScenes={battleScenes}
            value={encounter.sceneId}
            onSelect={(id) => {
              onUpdate(index, { sceneId: id ?? 0 });
            }}
            placeholder="Click to search battles..."
          />
        </div>
      </div>
    </div>
  )
}

interface YuffieEncountersProps {
  yuffieEncounters: YuffieEncounter[]
  updateYuffie: (index: number, updates: Partial<YuffieEncounter>) => void
  battleScenes: BattleScene[]
}

export function YuffieEncounters({ yuffieEncounters, updateYuffie, battleScenes }: YuffieEncountersProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-medium">Yuffie Encounters</h3>
          <p className="text-sm text-muted-foreground">
            Configure which Yuffie encounters you will get based on Cloud's level
          </p>
        </div>

        <div className="space-y-2">
          {yuffieEncounters.map((encounter, index) => (
            <YuffieEncounterRow
              key={index}
              encounter={encounter}
              index={index}
              onUpdate={updateYuffie}
              battleScenes={battleScenes}
            />
          ))}
        </div>
      </div>
    </div>
  )
}