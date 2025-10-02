import { cn } from "@/lib/utils"
import { useScriptsState } from "@/hooks/useScriptState"
import { Button } from "@/components/ui/button"
import { FF7Function, FunctionType } from "@/ff7/evfile"
import { modelsMapping, systemScriptNames, modelScriptNames } from "@/ff7/worldscript/constants"
import { Map } from "lucide-react"
import { useEffect, useRef, useState, useCallback } from "react"
import { MapId, MAP_NAMES } from "@/hooks/useMaps"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MapPicker } from "@/components/map/MapPicker"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { confirm } from "@tauri-apps/plugin-dialog"
import { AddScriptModal } from "@/components/modals/AddScriptModal"

interface ScriptListProps {
  className?: string
}

function getScriptLabel(script: FF7Function): string {
  switch (script.type) {
    case 0: // System
      const systemShortName = systemScriptNames[script.id]
      return systemShortName ? systemShortName : `system_${script.id}`
    case 1: // Model
      const modelShortName = modelScriptNames[script.id]
      const modelName = modelsMapping[script.modelId] ?? `model_${script.modelId}`
      return modelShortName ? `${modelName}_${modelShortName}` : `${modelName}_${script.id}`
    case 2: // Mesh
      return `row_${script.x}_col_${script.y}_fn_${script.id}`
  }
}

function getScriptKey(script: FF7Function): string {
  switch (script.type) {
    case 0: // System
      return `sys-${script.id}`
    case 1: // Model
      return `mdl-${script.modelId}-${script.id}`
    case 2: // Mesh
      return `mesh-${script.x}-${script.y}-${script.id}`
  }
}

function hasShortName(script: FF7Function): boolean {
  switch (script.type) {
    case 0: // System
      return systemScriptNames[script.id] !== undefined
    case 1: // Model
      return modelScriptNames[script.id] !== undefined
    case 2: // Mesh
      return false
  }
}

export function ScriptList({ className }: ScriptListProps) {
  const {
    functions,
    scriptType,
    selectedMap,
    selectScript,
    isScriptSelected,
    selectedScript,
    searchQuery,
    searchResults,
    isSearching,
    setSelectedMap,
    setScriptType: setScriptTypeHook,
    loadScripts,
    isScriptModified,
    addMeshScript
  } = useScriptsState()
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newMeshCoords, setNewMeshCoords] = useState<{ x: number; y: number } | null>(null)
  const selectedItemRef = useRef<HTMLButtonElement | null>(null)
  const filteredScriptsRef = useRef<FF7Function[]>([])
  const selectScriptRef = useRef(selectScript)
  const pickInProgressRef = useRef(false)

  const handleAddScript = async (params: any) => {
    try {
      if (params.type === "mesh") {
        await addMeshScript(params.x, params.y, params.functionId)
      }
    } catch (error) {
      // Error is already handled in the hook
    }
    setIsAddModalOpen(false)
    setNewMeshCoords(null)
  }

  // Filter and sort scripts
  const filteredScripts = functions
    .filter((f) => f.type === scriptType)
    .sort((a, b) => {
      // Sort by type first, then by specific criteria for each type
      if (a.type !== b.type) return a.type - b.type

      switch (a.type) {
        case FunctionType.System:
          return (a.id || 0) - (b.id || 0)
        case FunctionType.Model:
          const aModel = a as any
          const bModel = b as any
          if (aModel.modelId !== bModel.modelId) {
            return aModel.modelId - bModel.modelId
          }
          return (a.id || 0) - (b.id || 0)
        case FunctionType.Mesh:
          const aMesh = a as any
          const bMesh = b as any
          if (aMesh.x !== bMesh.x) {
            return aMesh.x - bMesh.x
          }
          if (aMesh.y !== bMesh.y) {
            return aMesh.y - bMesh.y
          }
          return (a.id || 0) - (b.id || 0)
        default:
          return 0
      }
    })

  useEffect(() => {
    const el = selectedItemRef.current
    if (el) {
      try {
        el.scrollIntoView({ block: "nearest" })
      } catch {}
    }
  }, [selectedScript, scriptType, filteredScripts.length])

  // Keep refs in sync but stable callback identity
  useEffect(() => {
    filteredScriptsRef.current = filteredScripts
  }, [filteredScripts])

  useEffect(() => {
    selectScriptRef.current = selectScript
  }, [selectScript])

  const handlePickCell = useCallback(async (mx: number, mz: number) => {
    if (pickInProgressRef.current) return
    pickInProgressRef.current = true
    try {

      const matchingScript = filteredScriptsRef.current.find(
        (script) => script.type === FunctionType.Mesh && script.x === mz && script.y === mx
      )
      if (matchingScript) {
        selectScriptRef.current(matchingScript)
        setIsMapPickerOpen(false)
        return
      }

      const confirmed = await confirm("There are no scripts for selected mesh. Do you want to create one?", {
        title: "Create New Mesh Script"
      })
      if (confirmed) {
        setIsMapPickerOpen(false)
        setNewMeshCoords({ x: mx, y: mz })
        setIsAddModalOpen(true)
      }
    } finally {
      pickInProgressRef.current = false
    }
  }, [])

  // Search functionality
  const isInSearchMode = searchQuery.length >= 3

  const handleSearchResultClick = async (result: any) => {
    const { script, mapId } = result

    // If we're not already on the correct map, switch to it
    if (mapId !== selectedMap) {
      await loadScripts(mapId)
      setSelectedMap(mapId)
    }

    // Set the script type to match the selected script
    setScriptTypeHook(script.type)

    // Select the script
    selectScript(script)
  }

  // Group search results by map and type
  const groupedSearchResults = searchResults.reduce((acc, result) => {
    const { mapId } = result
    const scriptType = result.script.type

    if (!acc[mapId]) {
      acc[mapId] = {}
    }
    if (!acc[mapId][scriptType]) {
      acc[mapId][scriptType] = []
    }
    acc[mapId][scriptType].push(result)

    return acc
  }, {} as Record<string, Record<number, any[]>>)

  return (
    <div className={cn("bg-background p-2", className)}>
      {isInSearchMode ? (
        /* Search Mode */
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Search Results ({searchResults.length})
            {isSearching && <span className="ml-2 text-blue-500">Searching...</span>}
          </div>

          {searchResults.length === 0 && !isSearching ? (
            <div className="text-xs text-muted-foreground">No scripts found matching "{searchQuery}"</div>
          ) : (
            Object.entries(groupedSearchResults).map(([mapId, typeGroups]) => (
              <div key={mapId} className="space-y-1">
                {/* Map Header */}
                <div className="text-xs font-semibold text-muted-foreground border-b border-border pb-1">
                  {MAP_NAMES[mapId as MapId] || mapId}
                </div>

                {/* Type Groups */}
                {Object.entries(typeGroups).map(([type, results]) => (
                  <div key={type} className="space-y-1">
                    {/* Type Header */}
                    <div className="text-xs font-medium text-muted-foreground ml-2">
                      {type === "0" ? "System Scripts" : type === "1" ? "Model Scripts" : "Mesh Scripts"}
                    </div>

                    {/* Scripts */}
                    <div className="ml-2 space-y-1">
                      {results
                        .filter((result) => result.script.aliasId === undefined)
                        .map((result) => (
                          <Button
                            key={`${result.mapId}-${getScriptKey(result.script)}`}
                            variant="ghost"
                            className={cn(
                              "w-full justify-start h-7 text-xs px-2",
                              isScriptModified(result.script) && "text-yellow-400"
                            )}
                            onClick={() => handleSearchResultClick(result)}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{getScriptLabel(result.script)}</span>
                              <div className="flex items-center gap-1">
                                {result.script.aliasId !== undefined && (
                                  <span className="text-[10px] font-thin text-muted-foreground">
                                    (&rArr; system {result.script.aliasId})
                                  </span>
                                )}
                              </div>
                            </div>
                          </Button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Normal Mode */
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-muted-foreground">
              Available Scripts ({filteredScripts.length})
            </div>
            {scriptType === FunctionType.Mesh && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-6" onClick={() => setIsMapPickerOpen(true)}>
                      <Map className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p>Find script on the map</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="space-y-1">
            {filteredScripts.length === 0 ? (
              <div className="text-xs text-muted-foreground">No scripts loaded</div>
            ) : (
              filteredScripts.map((script) => (
                <Button
                  key={getScriptKey(script)}
                  variant={isScriptSelected(script) ? "secondary" : "ghost"}
                  className={cn("w-full justify-start h-7 text-xs px-2", isScriptModified(script) && "text-yellow-400")}
                  ref={isScriptSelected(script) ? selectedItemRef : undefined}
                  onClick={() => selectScript(script)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{getScriptLabel(script)}</span>
                    <div className="flex items-center gap-1">
                      {hasShortName(script) && (
                        <span className="text-[10px] font-thin text-muted-foreground">(#{script.id})</span>
                      )}
                      {script.aliasId !== undefined && (
                        <span className="text-[10px] font-thin text-muted-foreground">
                          (&rArr; system {script.aliasId})
                        </span>
                      )}
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </>
      )}

      <Dialog
        open={isMapPickerOpen}
        onOpenChange={(o) => {
          setIsMapPickerOpen(o)
        }}
      >
        <DialogContent className="max-w-[900px] p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="text-base">Pick Mesh Coordinates</DialogTitle>
          </DialogHeader>
          <div className="h-[560px] w-[900px]">
            <MapPicker
              onPickCell={handlePickCell}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AddScriptModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setNewMeshCoords(null)
        }}
        scriptType={FunctionType.Mesh}
        onAddScript={handleAddScript}
        initialRow={newMeshCoords?.y}
        initialColumn={newMeshCoords?.x}
      />
    </div>
  )
}
