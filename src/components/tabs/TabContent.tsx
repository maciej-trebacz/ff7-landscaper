import { TabsContent } from "@/components/ui/tabs"
import { MapTab } from "./MapTab"
import { MessagesTab } from "./MessagesTab"
import { EncountersTab } from "./EncountersTab"
import { ScriptsTab } from "./ScriptsTab"
import { TexturesTab } from "./TexturesTab"
import { LocationsTab } from "./LocationsTab"
import { useAppState } from "@/hooks/useAppState"

export function TabContent() {
  const { opened, loading } = useAppState()

  if (!opened) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Please open Final Fantasy VII game directory to start
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading game data...
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TabsContent value="map" className="flex-1 data-[state=active]:flex min-h-0">
        <MapTab />
      </TabsContent>
      <TabsContent value="messages" className="flex-1 data-[state=active]:flex overflow-y-auto">
        <MessagesTab />
      </TabsContent>
      <TabsContent value="encounters" className="flex-1 data-[state=active]:flex min-h-0">
        <EncountersTab />
      </TabsContent>
      <TabsContent value="scripts" className="flex-1 data-[state=active]:flex min-h-0">
        <ScriptsTab />
      </TabsContent>
      <TabsContent value="textures" className="flex-1 data-[state=active]:flex overflow-y-auto">
        <TexturesTab />
      </TabsContent>
      <TabsContent value="locations" className="flex-1 data-[state=active]:flex min-h-0">
        <LocationsTab />
      </TabsContent>
    </div>
  )
}