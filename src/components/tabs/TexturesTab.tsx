import { useEffect, useMemo, useState } from "react"
import { useMaps } from "@/hooks/useMaps"
import { useAppState } from "@/hooks/useAppState"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { MapType } from "@/hooks/useMaps"

export function TexturesTab() {
    const { loadedTextures, loadTextures, getTexturesForType, mapType: globalMapType } = useMaps()
    const { currentTab } = useAppState()

    const isActive = currentTab === 'textures'
    const [localMapType, setLocalMapType] = useState<MapType>(globalMapType)
    const texturesLoaded = loadedTextures[localMapType]

    useEffect(() => {
        if (!loadedTextures[localMapType]) {
            loadTextures(localMapType)
        }
    }, [loadedTextures, loadTextures, localMapType])

    const textures = useMemo(() => getTexturesForType(localMapType), [getTexturesForType, localMapType])

    // Show loading message if tab is active but textures aren't loaded yet
    if (isActive && !texturesLoaded) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Loading textures...
            </div>
        )
    }

    return (
        <ScrollArea className="h-full w-full">
            <div className="space-y-4 p-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">World Map Textures</h2>
                    <Select value={localMapType} onValueChange={(value: MapType) => setLocalMapType(value)}>
                        <SelectTrigger id="map-type" className="w-48 h-8">
                            <SelectValue placeholder="Select map type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="overworld">Overworld</SelectItem>
                            <SelectItem value="underwater">Underwater</SelectItem>
                            <SelectItem value="glacier">Great Glacier</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    {textures.map(texture => {
                        if (!texture.tex || !texture.imageData) return null
                        return (
                            <Card key={texture.id} className="p-2 space-y-2">
                                <img
                                    src={texture.imageData}
                                    alt={texture.name}
                                    className="border border-border"
                                    style={{
                                        imageRendering: 'pixelated',
                                        width: texture.tex.data.width * 2,
                                        height: texture.tex.data.height * 2
                                    }}
                                />

                                <div className="text-xs">
                                    <div className="font-medium">{texture.name} ({texture.id})</div>
                                    <div className="text-muted-foreground">
                                        {texture.tex.data.width}x{texture.tex.data.height}
                                    </div>
                                    <div className="text-muted-foreground">
                                        UV: {texture.uOffset},{texture.vOffset}
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </ScrollArea>
    )
} 
