import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { YuffieEncounter } from '@/ff7/encwfile'

interface YuffieEncounterEditorProps {
  encounter: YuffieEncounter
  index: number
  onUpdate: (index: number, updates: Partial<YuffieEncounter>) => void
}

function YuffieEncounterEditor({ encounter, index, onUpdate }: YuffieEncounterEditorProps) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded">
      <Label className="w-16 text-sm font-normal">#{index + 1}</Label>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Label className="text-xs">Cloud Lvl:</Label>
          <Input
            type="number"
            min="1"
            max="99"
            value={encounter.cloudLevel}
            onChange={(e) => onUpdate(index, { cloudLevel: parseInt(e.target.value) || 1 })}
            className="w-16 h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-xs">Battle ID:</Label>
          <Input
            type="number"
            min="0"
            max="1023"
            value={encounter.sceneId}
            onChange={(e) => onUpdate(index, { sceneId: parseInt(e.target.value) || 0 })}
            className="w-20 h-7 text-xs"
          />
        </div>
      </div>
    </div>
  )
}

interface YuffieEncountersProps {
  yuffieEncounters: YuffieEncounter[]
  updateYuffie: (index: number, updates: Partial<YuffieEncounter>) => void
}

export function YuffieEncounters({ yuffieEncounters, updateYuffie }: YuffieEncountersProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-medium">Yuffie Encounters</h3>
          <p className="text-sm text-muted-foreground">
            Configure which Yuffie encounters you will get based on Cloud's level
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {yuffieEncounters.map((encounter, index) => (
            <YuffieEncounterEditor
              key={index}
              encounter={encounter}
              index={index}
              onUpdate={updateYuffie}
            />
          ))}
        </div>
      </div>
    </div>
  )
}