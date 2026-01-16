import { Button } from "@/components/ui/button";
import { useMaps } from "@/hooks/useMaps";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TexturePreview } from "@/components/ui/texture-preview";
import { TRIANGLE_TYPES } from "@/lib/map-data";
import { useState } from "react";
import { useMessagesState } from "@/hooks/useMessagesState";

interface LassoValues {
    type: string | null;
    region: string | null;
    scriptId: string | null;
    isChocobo: boolean | null;
    texture: string | null;
}

export function LassoSidebar() {
    const { paintingSelectedTriangles, worldmap, updateSelectedTriangles, textures, togglePaintingSelectedTriangle } = useMaps();
    const { messages } = useMessagesState();
    const [values, setValues] = useState<LassoValues>({
        type: null,
        region: null,
        scriptId: null,
        isChocobo: null,
        texture: null
    });

    const handleApply = () => {
        if (!worldmap || paintingSelectedTriangles.size === 0) return;

        const updates: any = {};
        if (values.type !== null) {
            updates.type = parseInt(values.type);
        }
        if (values.region !== null) {
            updates.locationId = parseInt(values.region);
        }
        if (values.scriptId !== null) {
            updates.script = parseInt(values.scriptId);
        }
        if (values.texture !== null) {
            updates.texture = parseInt(values.texture);
        }
        if (values.isChocobo !== null) {
            updates.isChocobo = values.isChocobo;
        }

        // Only apply if at least one field was set
        if (Object.keys(updates).length === 0) return;

        updateSelectedTriangles(updates);
    };

    const handleClearSelection = () => {
        // Remove each triangle from selection
        paintingSelectedTriangles.forEach(faceIndex => {
            togglePaintingSelectedTriangle(faceIndex, false);
        });
    };

    return (
        <>
            <h3 className="text-sm font-medium">Lasso Selection</h3>
            <p className="text-xs text-muted-foreground mt-1">
                Draw a shape on the map to select triangles
            </p>
            <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                    <Label>Triangle Type</Label>
                    <Select
                        value={values.type ?? undefined}
                        onValueChange={(value) => setValues(prev => ({ ...prev, type: value }))}
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(TRIANGLE_TYPES).map(([id, data]) => (
                                <SelectItem key={id} value={id}>
                                    {data.type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label>Texture</Label>
                    <Select
                        value={values.texture ?? undefined}
                        onValueChange={(value) => setValues(prev => ({ ...prev, texture: value }))}
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select texture" />
                        </SelectTrigger>
                        <SelectContent>
                            {textures.map((texture, index) => (
                                <SelectItem key={index} value={index.toString()}>
                                    <div className="flex items-center gap-2">
                                        <TexturePreview
                                            src={texture.imageData}
                                            alt={texture.name}
                                            size={24}
                                        />
                                        <span>{texture.name}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label>Region</Label>
                    <Select
                        value={values.region ?? undefined}
                        onValueChange={(value) => setValues(prev => ({ ...prev, region: value }))}
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent>
                            {messages.slice(0, 20).map((message, index) => (
                                <SelectItem key={index} value={index.toString()}>
                                    {message}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label>Script ID</Label>
                    <Select
                        value={values.scriptId ?? undefined}
                        onValueChange={(value) => setValues(prev => ({ ...prev, scriptId: value }))}
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select script" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">0 (no script)</SelectItem>
                            <SelectItem value="1">1 (no battles)</SelectItem>
                            <SelectItem value="3">3 (function 0)</SelectItem>
                            <SelectItem value="4">4 (function 1)</SelectItem>
                            <SelectItem value="5">5 (function 2)</SelectItem>
                            <SelectItem value="6">6 (function 3)</SelectItem>
                            <SelectItem value="7">7 (function 4)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="chocobo-lasso"
                        checked={values.isChocobo === true}
                        className={values.isChocobo === null ? 'opacity-50' : ''}
                        onCheckedChange={(checked) => setValues(prev => ({ ...prev, isChocobo: checked === true }))}
                    />
                    <Label htmlFor="chocobo-lasso" className="flex items-center gap-2">
                        Is Chocobo Area
                        {values.isChocobo === null && <span className="text-xs text-muted-foreground">(unchanged)</span>}
                    </Label>
                </div>

                <Button
                    className="w-full"
                    size="sm"
                    onClick={handleApply}
                    disabled={paintingSelectedTriangles.size === 0}
                >
                    Apply to {paintingSelectedTriangles.size} Selected
                </Button>

                <Button
                    className="w-full"
                    size="sm"
                    variant="link"
                    onClick={handleClearSelection}
                    disabled={paintingSelectedTriangles.size === 0}
                >
                    Clear Selected
                </Button>
            </div>
        </>
    );
} 
