import { useState, useEffect } from 'react'
import { useEncountersState } from '@/hooks/useEncountersState'
import { useBattleData } from '@/hooks/useBattleData'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import { REGION_NAMES } from '@/lib/map-data'
import { TerrainRegionsDialog } from "../encounters/TerrainRegionsDialog"
import { RegionEncounters } from "../encounters/RegionEncounters"
import { YuffieEncounters } from "../encounters/YuffieEncounters"
import { ChocoboEncounters } from "../encounters/ChocoboEncounters"

// Use only the first 16 regions for encounters
const ENCOUNTER_REGION_NAMES = Object.values(REGION_NAMES).slice(0, 16)


type EncounterView = 'regions' | 'yuffie' | 'chocobo'

export function EncountersTab() {
  const [selectedRegion, setSelectedRegion] = useState(0)
  const [selectedSet, setSelectedSet] = useState(0)
  const [selectedView, setSelectedView] = useState<EncounterView>('regions')
  const [isTerrainDialogOpen, setIsTerrainDialogOpen] = useState(false)
  const { data, exeData, updateEncounterMeta, updateEncounterPair, updateYuffie, updateChocobo } = useEncountersState()
  const { battleScenes } = useBattleData()

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

  return (
    <div className="flex w-full min-h-0">
      {/* Region List Sidebar */}
      <div className="w-[240px] border-r bg-background p-2 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-muted-foreground">Regions ({ENCOUNTER_REGION_NAMES.length})</div>
          <Dialog open={isTerrainDialogOpen} onOpenChange={setIsTerrainDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2"
              >
                Edit Region Sets
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Terrain Region Sets</DialogTitle>
              </DialogHeader>
              <TerrainRegionsDialog onClose={() => setIsTerrainDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-1">
          {ENCOUNTER_REGION_NAMES.map((name, index) => (
            <Button
              key={index}
              variant={selectedRegion === index && selectedView === 'regions' ? "secondary" : "ghost"}
              className="w-full justify-start h-7 text-xs px-2"
              onClick={() => {
                setSelectedRegion(index)
                setSelectedView('regions')
              }}
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

        {/* Misc Section */}
        <div className="mt-3 pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground mb-2">Misc.</div>
          <div className="space-y-1">
            <Button
              variant={selectedView === 'yuffie' ? "secondary" : "ghost"}
              className="w-full justify-start h-7 text-xs px-2"
              onClick={() => setSelectedView('yuffie')}
            >
              Yuffie
            </Button>
            <Button
              variant={selectedView === 'chocobo' ? "secondary" : "ghost"}
              className="w-full justify-start h-7 text-xs px-2"
              onClick={() => setSelectedView('chocobo')}
            >
              Chocobos
            </Button>
          </div>
        </div>
      </div>

      {/* Encounter Editor */}
      {selectedView === 'regions' && (() => {
        const regionData = data.randomEncounters.regions[selectedRegion]
        return (
          <RegionEncounters
            selectedRegion={selectedRegion}
            selectedSet={selectedSet}
            onSelectedSetChange={setSelectedSet}
            regionData={regionData}
            exeData={exeData}
            battleScenes={battleScenes}
            updateEncounterMeta={updateEncounterMeta}
            updateEncounterPair={updateEncounterPair}
          />
        )
      })()}
      {selectedView === 'yuffie' && (
        <YuffieEncounters
          yuffieEncounters={data.yuffieEncounters}
          updateYuffie={updateYuffie}
          battleScenes={battleScenes}
        />
      )}
      {selectedView === 'chocobo' && (
        <ChocoboEncounters
          chocoboRatings={data.chocoboRatings}
          updateChocobo={updateChocobo}
          battleScenes={battleScenes}
        />
      )}
    </div>
  )
}