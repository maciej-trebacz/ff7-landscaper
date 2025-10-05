import { Button } from "@/components/ui/button"
import { CircleHelp, FolderOpen, Save } from "lucide-react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useStatusBar } from "@/hooks/useStatusBar"
import { useAppState } from "@/hooks/useAppState"
import { useMessagesState } from "@/hooks/useMessagesState"
import { open } from "@tauri-apps/plugin-dialog"
import { validateFF7Directory } from "@/lib/ff7-data"
import { AlertDialog } from "@/components/ui/AlertDialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useEffect, useRef, useState } from "react"
import { useLgpState } from "@/hooks/useLgpState"
import { useMaps } from "@/hooks/useMaps"

import { useScriptsState } from "@/hooks/useScriptState"
import { useLocationsState } from "@/hooks/useLocationsState"
import { useKeyboardShortcuts, getShortcutDisplay } from "@/hooks/useKeyboardShortcuts"
import { useEncountersState } from "@/hooks/useEncountersState"
import { useTextureAtlas } from "@/hooks/useTextureAtlas"
import { Window } from "@tauri-apps/api/window"
import { Webview } from "@tauri-apps/api/webview"


export function Navbar() {
  const { setMessage } = useStatusBar()
  const { alert, showAlert, hideAlert, setDataPath, setLoading, unsavedChanges, currentTab, loading } = useAppState()
  const { saveMessages, loadMessages } = useMessagesState()
  const { saveMap, loadMap, mapType } = useMaps()
  const { saveScripts, loadScripts } = useScriptsState()
  const { saveLocations, loadLocations } = useLocationsState()
  const { saveEncounters, loadEncounters, loadExeFile } = useEncountersState()
  const { loadLgp, opened, openedTime } = useLgpState()
  const { resetTextureAtlas } = useTextureAtlas()
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [pendingDirectory, setPendingDirectory] = useState<string | null>(null)

  const helpWindowRef = useRef<Window | null>(null)
  const helpWebviewRef = useRef<Webview | null>(null)
  const helpResizeUnlisten = useRef<(() => void) | null>(null)

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

      setMessage("Loading map...")
      await loadMap(mapType)

      setMessage("Loading scripts...")
      await loadScripts("WM0" as any)

      setMessage("Game data loaded successfully!")
      setLoading(false)
    }

    loadData()
  }, [opened, openedTime])

  const cleanupHelpWindow = () => {
    helpResizeUnlisten.current?.()
    helpResizeUnlisten.current = null
    helpWebviewRef.current = null
    helpWindowRef.current = null
  }

  const handleOpenHelp = async () => {
    try {
      clearFocus()

      if (helpWindowRef.current) {
        try {
          await helpWindowRef.current.setFocus()
        } catch (error) {
          console.warn("[Navbar] Failed to focus help window", error)
        }
        await syncHelpTab(currentTab)
        return
      }

      console.log("[Navbar] Opening help window")

      const helpWindow = new Window("landscaper-help", {
        parent: Window.getCurrent(),
        title: "Landscaper Help",
        theme: "dark",
        resizable: true,
        visible: false,
        center: true,
        width: 1100,
        height: 850,
        backgroundColor: "#0d0f12",
      })

      helpWindowRef.current = helpWindow

      helpWindow.once("tauri://created", async () => {
        console.log("[help] window created")
        try {
          const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:1420"
          const helpUrl = `${origin}/help.html`
          console.log("[help] computed URL:", helpUrl)

          const webview = new Webview(helpWindow, "landscaper-help", {
            url: helpUrl,
            x: 0,
            y: 0,
            width: 1100,
            height: 850,
            focus: true,
            backgroundColor: "#0d0f12",
          })

          console.log("[help] webview created")
          helpWebviewRef.current = webview

          const resize = async () => {
            try {
              const size = await helpWindow.innerSize()
              await webview.setSize(size)
            } catch (sizeError) {
              console.error("[Navbar] Failed to resize help window", sizeError)
            }
          }

          webview.once("tauri://created", async () => {
            console.log("[help] webview ready")
            await resize()
            try {
              const anyWebview = webview as unknown as { openDevtools?: () => Promise<void> }
              if (anyWebview.openDevtools) {
                await anyWebview.openDevtools()
              } else {
                console.warn("[help] devtools not available on this platform/version")
              }
            } catch (devtoolsError) {
              console.warn("[help] devtools failed to open (permission?)", devtoolsError)
            }
            await helpWindow.show()
            await helpWindow.setFocus()
            await syncHelpTab(currentTab)
            setTimeout(() => {
              // Retry once after the help webview has likely mounted its listener
              syncHelpTab(currentTab)
            }, 150)
            helpResizeUnlisten.current = await helpWindow.listen("tauri://resize", resize)
          })

          webview.once("tauri://error", (e: any) => {
            console.error("[help] webview error", e)
          })

          await helpWindow.onCloseRequested(() => {
            cleanupHelpWindow()
          })
        } catch (initError) {
          console.error("[Navbar] Failed to initialize help webview", initError)
          cleanupHelpWindow()
        }
      })
    } catch (error) {
      console.error("[Navbar] Failed to open help", error)
      cleanupHelpWindow()
    }
  }


  const syncHelpTab = async (tab: string) => {
    if (!helpWebviewRef.current) return
    try {
      await helpWebviewRef.current.emit("landscaper-help:set-tab", { tab })
    } catch (error) {
      console.error("[Navbar] Failed to sync help tab", error)
    }
  }

  useEffect(() => {
    if (!helpWebviewRef.current) return
    syncHelpTab(currentTab)
  }, [currentTab])

  // Centralized map loading on mapType changes (and initial)
  const handleSave = async () => {
    try {
      clearFocus()
      await saveMessages()
      await saveMap()
      await saveScripts()
      await saveLocations()
      await saveEncounters()
      setMessage("Game data saved successfully!")
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
  useEffect(() => {
    return () => {
      if (helpWindowRef.current) {
        helpWindowRef.current.close()
      }
      cleanupHelpWindow()
    }
  }, [])


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
                  disabled={!opened || loading}
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
          <TabsTrigger value="messages" disabled={!opened || loading}>
            Messages
          </TabsTrigger>
          <TabsTrigger value="map" disabled={!opened || loading}>
            Map
          </TabsTrigger>
          <TabsTrigger value="textures" disabled={!opened || loading}>
            Textures
          </TabsTrigger>
          <TabsTrigger value="locations" disabled={!opened || loading}>
            Locations
          </TabsTrigger>
          <TabsTrigger value="encounters" disabled={!opened || loading}>
            Encounters
          </TabsTrigger>
          <TabsTrigger value="scripts" disabled={!opened || loading}>
            Scripts
          </TabsTrigger>
        </TabsList>
        <div className="ml-auto flex items-center">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  onClick={handleOpenHelp}>
                  <CircleHelp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open Help window</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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


