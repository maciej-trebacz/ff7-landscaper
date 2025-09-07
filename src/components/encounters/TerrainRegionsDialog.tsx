import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEncountersState } from '@/hooks/useEncountersState'
import { useAppState } from '@/hooks/useAppState'
import { TRIANGLE_TYPES, REGION_NAMES } from '@/lib/map-data'

interface TerrainRegionsDialogProps {
  onClose: () => void
}

export function TerrainRegionsDialog({ onClose }: TerrainRegionsDialogProps) {
  const { exeData, loadExeFile, updateTerrainRegion } = useEncountersState()
  const { dataPath } = useAppState()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load the executable file when dialog opens
    if (!exeData && dataPath) {
      loadExecutable()
    }
  }, [dataPath])

  const loadExecutable = async () => {
    setLoading(true)
    try {
      await loadExeFile()
    } catch (error) {
      console.error('Failed to load executable:', error)
    } finally {
      setLoading(false)
    }
  }



  const handleTerrainChange = (regionIndex: number, terrainIndex: number, newValue: number) => {
    updateTerrainRegion(regionIndex, terrainIndex, newValue)
  }

  const getTerrainInfo = (terrainType: number) => {
    const terrainInfo = TRIANGLE_TYPES[terrainType]
    return {
      name: terrainInfo?.type || `Unknown (${terrainType})`,
      description: terrainInfo?.description || ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-xs text-muted-foreground">Loading FF7 executable...</div>
      </div>
    )
  }

  if (!exeData) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-3">
        <div className="text-xs text-muted-foreground text-center">
          FF7 executable not loaded. Make sure ff7_en.exe is in your game directory.
        </div>
        <Button onClick={loadExecutable} size="sm" className="h-7 text-xs px-3">
          Load Executable
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Edit terrain types for each region. Changes are saved to ff7_en.exe.
        </div>
        <Button
          onClick={onClose}
          size="sm"
          variant="outline"
          className="h-7 text-xs px-3"
        >
          Close
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="h-8">
              <TableHead className="h-8 w-40 px-2 py-1 font-medium">Region</TableHead>
              <TableHead className="h-8 w-24 px-2 py-1 text-center font-medium">Set 1</TableHead>
              <TableHead className="h-8 w-24 px-2 py-1 text-center font-medium">Set 2</TableHead>
              <TableHead className="h-8 w-24 px-2 py-1 text-center font-medium">Set 3</TableHead>
              <TableHead className="h-8 w-24 px-2 py-1 text-center font-medium">Set 4</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exeData.terrainRegions.map((region, regionIndex) => (
              <TableRow key={regionIndex} className="h-8">
                <TableCell className="px-2 py-1 font-medium">
                  {REGION_NAMES[regionIndex] || `Region ${regionIndex}`}
                </TableCell>
                {region.terrainTypes.map((terrainType, terrainIndex) => (
                  <TableCell key={terrainIndex} className="px-2 py-1 text-center">
                    <select
                      value={terrainType}
                      onChange={(e) => handleTerrainChange(regionIndex, terrainIndex, parseInt(e.target.value))}
                      className="w-full px-1 py-0.5 text-xs bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent"
                      title={getTerrainInfo(region.terrainTypes[terrainIndex]).description}
                    >
                      {Array.from({ length: 32 }, (_, i) => {
                        const info = getTerrainInfo(i)
                        return (
                          <option key={i} value={i} title={info.description}>
                            {info.name}
                          </option>
                        )
                      })}
                    </select>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground leading-tight">
        Duplicate terrain types will result in only the first one being used. So if Set 1 and 2 both use Grass, only Set 1 will ever be used.
      </div>
    </div>
  )
}
