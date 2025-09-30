import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { BattleAutocompleteModal } from '@/components/ui/battle-autocomplete'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { REGION_NAMES, TRIANGLE_TYPES } from '@/lib/map-data'
import type { EncounterPair, EncounterSet } from '@/ff7/encwfile'
import type { FF7ExeData } from '@/ff7/ff7exefile'
import type { BattleScene } from '@/hooks/types'

function getTerrainName(terrainType: number): string {
  const terrainInfo = TRIANGLE_TYPES[terrainType]
  return terrainInfo?.type || `Unknown (${terrainType})`
}

function EncounterRow({
  encounter,
  onUpdate,
  label,
  battleScenes
}: {
  encounter: EncounterPair
  onUpdate: (updates: Partial<EncounterPair>) => void
  label: string
  battleScenes: BattleScene[]
}) {
  return (
    <div className="flex items-center gap-4 p-3 border rounded">
      <Label className="w-20 text-sm font-normal flex-shrink-0">{label}</Label>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Label className="text-xs flex-shrink-0">Battle ID:</Label>
        <div className={`flex-1 min-w-0 ${encounter.rate === 0 ? 'opacity-50' : ''}`}>
          <BattleAutocompleteModal
            battleScenes={battleScenes}
            value={encounter.encounterId}
            onSelect={(id) => onUpdate({ encounterId: id ?? 0 })}
            placeholder="Click to search battles..."
          />
        </div>
      </div>
      <div className="flex items-center gap-2 w-60 flex-shrink-0">
        <Label className="text-xs">Rate:</Label>
        <div className="flex items-center gap-2 flex-1">
          <Slider
            value={encounter.rate}
            onValueChange={(v) => onUpdate({ rate: v })}
            min={0}
            max={64}
            step={1}
            className="flex-1"
          />
          <div className="w-6 text-xs text-right tabular-nums">{encounter.rate}</div>
        </div>
      </div>
    </div>
  )
}

function EncounterSetEditor({
  encounterSet,
  setIndex,
  regionIndex,
  exeData,
  battleScenes,
  onUpdateMeta,
  onUpdatePair
}: {
  encounterSet: EncounterSet
  setIndex: number
  regionIndex: number
  exeData: FF7ExeData | null
  battleScenes: BattleScene[]
  onUpdateMeta: (updates: Partial<Pick<EncounterSet, 'active' | 'encounterRate'>>) => void
  onUpdatePair: (group: 'normal' | 'back' | 'side' | 'pincer' | 'chocobo', indexInGroup: number | null, updates: Partial<EncounterPair>) => void
}) {
  const terrainType = exeData?.terrainRegions[regionIndex]?.terrainTypes[setIndex]
  const terrainName = terrainType !== undefined ? getTerrainName(terrainType) : 'Unknown'

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="text-lg font-medium">
          Set {setIndex + 1}
          {terrainType !== undefined && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({terrainName})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Active:</Label>
            <Switch
              checked={encounterSet.active}
              onCheckedChange={(checked) => onUpdateMeta({ active: checked })}
            />
          </div>
          <div className="flex items-center gap-2 w-48">
            <Label className="text-sm">Rate:</Label>
            <div className="flex items-center gap-2 w-full">
              <Slider
                value={encounterSet.encounterRate}
                onValueChange={(v) => onUpdateMeta({ encounterRate: v })}
                min={0}
                max={64}
                step={1}
              />
              <div className="w-4 text-sm text-right tabular-nums">{encounterSet.encounterRate}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Normal Encounters</h4>
            <div className="space-y-2">
              {encounterSet.normalEncounters.map((encounter, index) => (
                <EncounterRow
                  key={index}
                  encounter={encounter}
                  onUpdate={(updates) => onUpdatePair('normal', index, updates)}
                  label={`Normal ${index + 1}`}
                  battleScenes={battleScenes}
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Back Attacks</h4>
            <div className="space-y-2">
              {encounterSet.backAttacks.map((encounter, index) => (
                <EncounterRow
                  key={index}
                  encounter={encounter}
                  onUpdate={(updates) => onUpdatePair('back', index, updates)}
                  label={`Back ${index + 1}`}
                  battleScenes={battleScenes}
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Special Attacks</h4>
            <div className="space-y-2">
              <EncounterRow
                encounter={encounterSet.sideAttack}
                onUpdate={(updates) => onUpdatePair('side', null, updates)}
                label="Side Attack"
                battleScenes={battleScenes}
              />
              <EncounterRow
                encounter={encounterSet.pincerAttack}
                onUpdate={(updates) => onUpdatePair('pincer', null, updates)}
                label="Both Sides"
                battleScenes={battleScenes}
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Chocobo Encounters</h4>
            <div className="space-y-2">
              {encounterSet.chocoboEncounters.map((encounter, index) => (
                <EncounterRow
                  key={index}
                  encounter={encounter}
                  onUpdate={(updates) => onUpdatePair('chocobo', index, updates)}
                  label={`Chocobo ${index + 1}`}
                  battleScenes={battleScenes}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface RegionEncountersProps {
  selectedRegion: number
  selectedSet: number
  onSelectedSetChange: (set: number) => void
  regionData: any // Type from encwfile
  exeData: FF7ExeData | null
  battleScenes: BattleScene[]
  updateEncounterMeta: (regionIndex: number, setIndex: number, updates: Partial<Pick<EncounterSet, 'active' | 'encounterRate'>>) => void
  updateEncounterPair: (regionIndex: number, setIndex: number, group: 'normal' | 'back' | 'side' | 'pincer' | 'chocobo', indexInGroup: number | null, updates: Partial<EncounterPair>) => void
}

export function RegionEncounters({
  selectedRegion,
  selectedSet,
  onSelectedSetChange,
  regionData,
  exeData,
  battleScenes,
  updateEncounterMeta,
  updateEncounterPair
}: RegionEncountersProps) {
  // Use only the first 16 regions for encounters
  const ENCOUNTER_REGION_NAMES = Object.values(REGION_NAMES).slice(0, 16)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">{ENCOUNTER_REGION_NAMES[selectedRegion]}</h3>
              <p className="text-sm text-muted-foreground">
                Region {selectedRegion}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedSet.toString()} onValueChange={(value) => onSelectedSetChange(parseInt(value))}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((setIndex) => {
                    const terrainType = exeData?.terrainRegions[selectedRegion]?.terrainTypes[setIndex]
                    const terrainName = terrainType !== undefined ? getTerrainName(terrainType) : 'Unknown'
                    return (
                      <SelectItem key={setIndex} value={setIndex.toString()}>
                        Set {setIndex + 1} ({terrainName})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Selected Set Editor */}
        <div className="space-y-4">
          <EncounterSetEditor
            encounterSet={regionData.sets[selectedSet]}
            setIndex={selectedSet}
            regionIndex={selectedRegion}
            exeData={exeData}
            battleScenes={battleScenes}
            onUpdateMeta={(updates) => updateEncounterMeta(selectedRegion, selectedSet, updates)}
            onUpdatePair={(group, indexInGroup, updates) => updateEncounterPair(selectedRegion, selectedSet, group, indexInGroup, updates)}
          />
        </div>
      </div>
    </div>
  )
}
