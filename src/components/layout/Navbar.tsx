import { Button } from "@/components/ui/button"
import { FolderOpen, Save } from "lucide-react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useStatusBar } from "@/hooks/useStatusBar"
import { useAppState } from "@/hooks/useAppState"
import { useMessagesState } from "@/hooks/useMessagesState"
import { open } from "@tauri-apps/plugin-dialog"
import { validateFF7Directory } from "@/lib/ff7-data"
import { AlertDialog } from "@/components/ui/AlertDialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useState } from "react"
import { useLgpState } from "@/hooks/useLgpState"
import { useMapState } from "@/hooks/useMapState"

import { useScriptsState } from "@/hooks/useScriptState"
import { useLocationsState } from "@/hooks/useLocationsState"
import { useKeyboardShortcuts, getShortcutDisplay } from "@/hooks/useKeyboardShortcuts"
import { useEncountersState } from "@/hooks/useEncountersState"
import { useTextureAtlas } from "@/hooks/useTextureAtlas"
import { useEffect, useRef } from "react"

export function Navbar() {
  const { setMessage } = useStatusBar()
  const { alert, showAlert, hideAlert, setDataPath, setLoading, unsavedChanges } = useAppState()
  const { saveMessages, loadMessages } = useMessagesState()
  const { saveMap, loadMap, loadTextures, mapType, loaded, loadedTextures } = useMapState()
  const { saveScripts, loadScripts } = useScriptsState()
  const { saveLocations, loadLocations } = useLocationsState()
  const { saveEncounters, loadEncounters, loadExeFile } = useEncountersState()
  const { loadLgp, opened, openedTime } = useLgpState()
  const { resetTextureAtlas } = useTextureAtlas()
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [pendingDirectory, setPendingDirectory] = useState<string | null>(null)

  const clearFocus = () => {
    document.activeElement instanceof HTMLElement && document.activeElement.blur()
  }

  const handleOpenDirectory = async () => {
    try {
      clearFocus()

      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select FF7 Game Directory",
      })

      if (selected) {
        const validation = await validateFF7Directory(selected as string)
        console.debug("[Navbar] Validating FF7 directory:", validation)
        if (validation.valid) {
          if (unsavedChanges) {
            setPendingDirectory(selected as string)
            setConfirmDialogOpen(true)
          } else {
            await proceedWithDirectory(selected as string)
          }
        } else {
          showAlert("Invalid Directory", validation.error || "Unknown error occurred")
        }
      }
    } catch (error) {
      showAlert("Error", "Failed to open directory: " + (error as Error).message)
      console.error(error)
    }
  }

  const proceedWithDirectory = async (directory: string) => {
    setDataPath(directory)
    setLoading(true)
    resetTextureAtlas()
    setMessage("Loading world_us.lgp...")
    await loadLgp(directory)
  }

  const handleConfirmOpenDirectory = async () => {
    if (pendingDirectory) {
      await proceedWithDirectory(pendingDirectory)
      setPendingDirectory(null)
    }
    setConfirmDialogOpen(false)
  }

  const handleCancelOpenDirectory = () => {
    setPendingDirectory(null)
    setConfirmDialogOpen(false)
  }

  useEffect(() => {
    const loadData = async () => {
      if (!opened) return

      setMessage("Loading messages...")
      await loadMessages()

      setMessage("Loading encounters...")
      await loadEncounters()
      await loadExeFile()

      setMessage("Loading locations...")
      await loadLocations()

      setMessage("Loading scripts...")
      await loadScripts("WM0" as any)

      setMessage("Game data loaded successfully")
      setLoading(false)
    }

    loadData()
  }, [opened, openedTime])

  // Centralized map loading on mapType changes (and initial)
  const mapLoadingRef = useRef<"overworld" | "underwater" | "glacier" | null>(null)
  useEffect(() => {
    if (!opened) return
    const MAP_ID_BY_TYPE: Record<"overworld" | "underwater" | "glacier", "WM0" | "WM2" | "WM3"> = {
      overworld: "WM0",
      underwater: "WM2",
      glacier: "WM3",
    }
    if (mapLoadingRef.current === mapType) return
    mapLoadingRef.current = mapType
    ;(async () => {
      try {
        const needsTextures = !loadedTextures[mapType]
        const needsMap = !loaded
        if (needsTextures || needsMap) {
          setMessage(`Loading map (${mapType})...`)
          if (needsTextures) {
            await loadTextures(mapType)
          }
          if (needsMap) {
            await loadMap(MAP_ID_BY_TYPE[mapType], mapType)
          }
        }
      } catch (error) {
        console.error("[Navbar] Error loading map:", error)
      } finally {
        mapLoadingRef.current = null
      }
    })()
  }, [mapType, opened, loaded, loadedTextures])

  const handleSave = async () => {
    try {
      clearFocus()
      await saveMessages()
      await saveMap()
      await saveScripts()
      await saveLocations()
      await saveEncounters()
    } catch (error) {
      showAlert("Error", (error as Error).message)
    }
  }

  // Set up keyboard shortcuts
  const shortcuts = [
    {
      key: "o",
      ctrlOrCmd: true,
      action: handleOpenDirectory,
      description: "Open FF7 game directory",
    },
    {
      key: "s",
      ctrlOrCmd: true,
      action: handleSave,
      description: "Save changes",
    },
  ]

  useKeyboardShortcuts(shortcuts)

  return (
    <>
      <nav className="flex items-center gap-2 p-1 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2" onClick={handleOpenDirectory}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open FF7 game directory ({getShortcutDisplay({ key: "o", ctrlOrCmd: true, action: () => {} })})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={100} disableHoverableContent={true}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 disabled:opacity-50"
                  onClick={handleSave}
                  disabled={!opened}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save changes ({getShortcutDisplay({ key: "s", ctrlOrCmd: true, action: () => {} })})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="w-px h-6 bg-zinc-800" />
        <TabsList className="bg-transparent border-0">
          <TabsTrigger value="messages" disabled={!opened}>
            Messages
          </TabsTrigger>
          <TabsTrigger value="map" disabled={!opened}>
            Map
          </TabsTrigger>
          <TabsTrigger value="textures" disabled={!opened}>
            Textures
          </TabsTrigger>
          <TabsTrigger value="locations" disabled={!opened}>
            Locations
          </TabsTrigger>
          <TabsTrigger value="encounters" disabled={!opened}>
            Encounters
          </TabsTrigger>
          <TabsTrigger value="scripts" disabled={!opened}>
            Scripts
          </TabsTrigger>
        </TabsList>
      </nav>

      <AlertDialog open={alert.show} onClose={hideAlert} title={alert.title} description={alert.message} />

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You will lose unsaved changes. Do you want to continue opening a new directory?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelOpenDirectory}>
              Cancel
            </Button>
            <Button onClick={handleConfirmOpenDirectory}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
