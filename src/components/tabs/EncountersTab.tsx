import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { RandomEncounters } from "@/components/encounters/RandomEncounters"
import { YuffieEncounters } from "@/components/encounters/YuffieEncounters"
import { ChocoboEncounters } from "@/components/encounters/ChocoboEncounters"
import { useEncountersState } from '@/hooks/useEncountersState'
import { TerrainRegionsDialog } from "../encounters/TerrainRegionsDialog"

type EncounterType = 'random' | 'yuffie' | 'chocobo'

export function EncountersTab() {
  const { loaded } = useEncountersState()
  const [selectedType, setSelectedType] = useState<EncounterType>('random')
  const [isTerrainDialogOpen, setIsTerrainDialogOpen] = useState(false)

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading encounters...
      </div>
    )
  }

  const renderContent = () => {
    switch (selectedType) {
      case 'random':
        return <RandomEncounters />
      case 'yuffie':
        return <YuffieEncounters />
      case 'chocobo':
        return <ChocoboEncounters />
      default:
        return <RandomEncounters />
    }
  }

  return (
    <div className="flex flex-col w-full min-h-0">
      {/* Top Controls Bar */}
      <div className="w-full bg-sidebar border-b border-slate-800/40 flex items-center justify-between gap-2 px-2 py-1">
        <div className="flex items-center gap-1.5">
          <Button
            variant={selectedType === 'random' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs px-3"
            onClick={() => setSelectedType('random')}
          >
            Random
          </Button>
          <Button
            variant={selectedType === 'yuffie' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs px-3"
            onClick={() => setSelectedType('yuffie')}
          >
            Yuffie
          </Button>
          <Button
            variant={selectedType === 'chocobo' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs px-3"
            onClick={() => setSelectedType('chocobo')}
          >
            Chocobo
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Dialog open={isTerrainDialogOpen} onOpenChange={setIsTerrainDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs px-3"
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
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {renderContent()}
      </div>
    </div>
  )
}