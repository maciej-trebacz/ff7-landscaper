import { useState, useEffect } from 'react'
import { useEncountersState } from '@/hooks/useEncountersState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { REGION_NAMES, TRIANGLE_TYPES } from '@/lib/map-data'
import type { EncounterPair, EncounterSet } from '@/ff7/encwfile'
import type { FF7ExeData } from '@/ff7/ff7exefile'

// Use only the first 16 regions for encounters
const ENCOUNTER_REGION_NAMES = Object.values(REGION_NAMES).slice(0, 16)

function getTerrainName(terrainType: number): string {
  const terrainInfo = TRIANGLE_TYPES[terrainType]
  return terrainInfo?.type || `Unknown (${terrainType})`
}

function EncounterEditor({
  encounter,
  onUpdate,
  label
}: {
  encounter: EncounterPair
  onUpdate: (updates: Partial<EncounterPair>) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded">
      <Label className="w-24 text-sm font-normal">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Label className="text-xs">Battle ID:</Label>
          <Input
            type="number"
            min="0"
            max="1023"
            value={encounter.encounterId}
            onChange={(e) => onUpdate({ encounterId: parseInt(e.target.value) || 0 })}
            className="w-20 h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-xs">Rate:</Label>
          <Input
            type="number"
            min="0"
            max="63"
            value={encounter.rate}
            onChange={(e) => onUpdate({ rate: parseInt(e.target.value) || 0 })}
            className="w-16 h-7 text-xs"
          />
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
  onUpdateMeta,
  onUpdatePair
}: {
  encounterSet: EncounterSet
  setIndex: number
  regionIndex: number
  exeData: FF7ExeData | null
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
          <div className="flex items-center gap-1">
            <Label className="text-sm">Rate:</Label>
            <Input
              type="number"
              min="0"
              max="255"
              value={encounterSet.encounterRate}
              onChange={(e) => onUpdateMeta({ encounterRate: parseInt(e.target.value) || 0 })}
              className="w-16 h-7 text-xs"
            />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Normal Encounters</h4>
            <div className="grid grid-cols-2 gap-2">
              {encounterSet.normalEncounters.map((encounter, index) => (
                <EncounterEditor
                  key={index}
                  encounter={encounter}
                  onUpdate={(updates) => onUpdatePair('normal', index, updates)}
                  label={`Normal ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Back Attacks</h4>
            <div className="grid grid-cols-2 gap-2">
              {encounterSet.backAttacks.map((encounter, index) => (
                <EncounterEditor
                  key={index}
                  encounter={encounter}
                  onUpdate={(updates) => onUpdatePair('back', index, updates)}
                  label={`Back ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Special Attacks</h4>
            <div className="grid grid-cols-2 gap-2">
              <EncounterEditor
                encounter={encounterSet.sideAttack}
                onUpdate={(updates) => onUpdatePair('side', null, updates)}
                label="Side Attack"
              />
              <EncounterEditor
                encounter={encounterSet.pincerAttack}
                onUpdate={(updates) => onUpdatePair('pincer', null, updates)}
                label="Both Sides"
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Chocobo Encounters</h4>
            <div className="grid grid-cols-2 gap-2">
              {encounterSet.chocoboEncounters.map((encounter, index) => (
                <EncounterEditor
                  key={index}
                  encounter={encounter}
                  onUpdate={(updates) => onUpdatePair('chocobo', index, updates)}
                  label={`Chocobo ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RandomEncounters() {
  const [selectedRegion, setSelectedRegion] = useState(0)
  const [selectedSet, setSelectedSet] = useState(0)
  const { data, exeData, updateEncounterMeta, updateEncounterPair } = useEncountersState()

  // Reset selected set to 0 when region changes
  useEffect(() => {
    setSelectedSet(0)
  }, [selectedRegion])

  if (!data) {
    return (
      <div className="flex-1 p-4">
        <div className="text-center text-muted-foreground">
          <h3 className="text-lg font-medium mb-2">Random Encounters</h3>
          <p>Loading encounter data...</p>
        </div>
      </div>
    )
  }

  const regionData = data.randomEncounters.regions[selectedRegion]

  return (
    <>
      {/* Region List Sidebar */}
      <div className="w-[240px] border-r bg-background p-2 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-muted-foreground">Regions ({ENCOUNTER_REGION_NAMES.length})</div>
        </div>
        <div className="space-y-1">
          {ENCOUNTER_REGION_NAMES.map((name, index) => (
            <Button
              key={index}
              variant={selectedRegion === index ? "secondary" : "ghost"}
              className="w-full justify-start h-7 text-xs px-2"
              onClick={() => setSelectedRegion(index)}
            >
              <div className="flex items-center justify-between w-full">
                <span>{name}</span>
                <span className="text-[10px] font-thin text-muted-foreground">({index})</span>
              </div>
            </Button>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t text-[10px] text-muted-foreground leading-relaxed text-center">
          Regions 16+ use encounter tables from region 15
        </div>
      </div>

      {/* Encounter Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Region {selectedRegion}: {ENCOUNTER_REGION_NAMES[selectedRegion]}</h3>
                <p className="text-sm text-muted-foreground">
                  Configure encounter sets for this region
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedSet.toString()} onValueChange={(value) => setSelectedSet(parseInt(value))}>
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
              onUpdateMeta={(updates) => updateEncounterMeta(selectedRegion, selectedSet, updates)}
              onUpdatePair={(group, indexInGroup, updates) => updateEncounterPair(selectedRegion, selectedSet, group, indexInGroup, updates)}
            />
          </div>
        </div>
      </div>
    </>
  )
}
