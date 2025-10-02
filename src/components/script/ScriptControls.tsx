import { Button } from "@/components/ui/button"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Plus, Trash2, Search, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapId, MAP_NAMES } from "@/hooks/useMaps"
import { useScriptsState } from "@/hooks/useScriptState"
import { FunctionType } from "@/ff7/evfile"
import { useState, useRef, useCallback, useEffect } from "react"
import { AddScriptModal } from "@/components/modals/AddScriptModal"
import { useKeyboardShortcuts, getShortcutDisplay } from "@/hooks/useKeyboardShortcuts"
import { confirm } from "@tauri-apps/plugin-dialog";

export function ScriptControls() {
  const {
    selectedMap,
    scriptType,
    setSelectedMap,
    setScriptType,
    loadScripts,
    addModelScript,
    addMeshScript,
    addSystemScript,
    deleteScript,
    getSelectedScript,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    // Search functionality
    searchQuery,
    setSearchQuery,
    searchScripts,
    clearSearch,
  } = useScriptsState()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [localSearchQuery, setLocalSearchQuery] = useState("")
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Set up keyboard shortcuts for script navigation
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const shortcuts = [
    {
      key: isMac ? '[' : 'ArrowLeft',
      ctrlOrCmd: isMac,
      alt: !isMac,
      action: () => {
        if (canGoBack()) {
          goBack()
        }
      },
      description: 'Go back to previous script'
    },
    {
      key: isMac ? ']' : 'ArrowRight',
      ctrlOrCmd: isMac,
      alt: !isMac,
      action: () => {
        if (canGoForward()) {
          goForward()
        }
      },
      description: 'Go forward to next script'
    }
  ]

  useKeyboardShortcuts(shortcuts)

  const handleMapChange = (value: MapId) => {
    setSelectedMap(value)
    loadScripts(value)
  }

  const handleScriptTypeChange = (value: string) => {
    setScriptType(Number(value) as FunctionType)
  }

  const handleAddScript = async (params: any) => {
    try {
      if (params.type === "model") {
        await addModelScript(params.modelId, params.functionId)
      } else if (params.type === "mesh") {
        await addMeshScript(params.x, params.y, params.functionId)
      } else if (params.type === "system") {
        await addSystemScript(params.functionId)
      }
    } catch (error) {
      // Error is already handled in the hook
    }
  }

  const canAddScripts = true

  const handleDeleteScript = async () => {
    const selectedScript = getSelectedScript()
    if (!selectedScript) return

    const confirmed = await confirm("Do you really want to delete this script?", {
      title: `Delete script ${selectedScript.id}`,
    })
    if (!confirmed) return

    try {
      await deleteScript(selectedScript)
    } catch (error) {
      // Error is already handled in the hook
    }
  }

  // Search functionality
  const handleSearchInput = useCallback((value: string) => {
    setLocalSearchQuery(value)

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // If search query is less than 3 characters, clear search
    if (value.length < 3) {
      setSearchQuery("")
      clearSearch()
      return
    }

    // Debounce search with 200ms delay
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchQuery(value)
      await searchScripts(value)
    }, 200)
  }, [setSearchQuery, searchScripts, clearSearch])

  const handleClearSearch = () => {
    setLocalSearchQuery("")
    setSearchQuery("")
    clearSearch()
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      <div className="w-full bg-sidebar border-b border-slate-800/40 flex items-center justify-between gap-2 px-2 py-1">
        {/* Left side - Script actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsAddModalOpen(true)}
                    disabled={!canAddScripts}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p>Add new script</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleDeleteScript}
                    disabled={!getSelectedScript()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p>Delete selected script</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="h-3.5 w-[1px] bg-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium">Map:</span>
            <Select value={selectedMap} onValueChange={handleMapChange}>
              <SelectTrigger className="w-[110px] px-2 h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MAP_NAMES).map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-3.5 w-[1px] bg-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium">Type:</span>
            <Select value={scriptType.toString()} onValueChange={handleScriptTypeChange}>
              <SelectTrigger className="w-[90px] px-2 h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FunctionType.System.toString()}>System</SelectItem>
                <SelectItem value={FunctionType.Model.toString()}>Models</SelectItem>
                <SelectItem value={FunctionType.Mesh.toString()}>Mesh</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="h-3.5 w-[1px] bg-border" />

          <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={goBack}
                    disabled={!canGoBack()}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p>Go back to previous script ({getShortcutDisplay({ key: isMac ? '[' : 'ArrowLeft', ctrlOrCmd: isMac, alt: !isMac, action: () => {} })})</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={goForward}
                    disabled={!canGoForward()}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p>Go forward to next script ({getShortcutDisplay({ key: isMac ? ']' : 'ArrowRight', ctrlOrCmd: isMac, alt: !isMac, action: () => {} })})</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Right side - Search */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search scripts..."
              value={localSearchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="h-6 w-[200px] pl-8 pr-8 text-xs"
            />
            {(localSearchQuery || searchQuery) && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-4 w-4"
                onClick={handleClearSearch}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <AddScriptModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        scriptType={scriptType}
        onAddScript={handleAddScript}
      />
    </>
  )
}
