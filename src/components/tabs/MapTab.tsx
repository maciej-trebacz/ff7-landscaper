import { TriangleWithVertices } from "@/components/map/types";
import { MapType, MapMode, useMaps } from "@/hooks/useMaps";
import { useState, useCallback } from "react";
import MapViewer from "../map/MapViewer";
import { SelectionSidebar } from "@/components/map/components/SelectionSidebar";
import { ExportImportSidebar } from "@/components/map/components/ExportImportSidebar";
import { PaintingSidebar } from "@/components/map/components/PaintingSidebar";
import { GridSelectionProvider } from '@/contexts/GridSelectionContext';

type RenderingMode = "terrain" | "textured" | "region" | "scripts";

export function MapTab() {
  const {
    textures,
    mode,
    setMode,
    enabledAlternatives,
    setEnabledAlternatives,
    loaded,
    setMapType,
    updateTriangleVertices,
  } = useMaps();

  const [selectedTriangle, setSelectedTriangle] = useState<TriangleWithVertices | null>(null);
  const [renderingMode, setRenderingMode] = useState<RenderingMode>("terrain");
  const [showWireframe, setShowWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showNormals, setShowNormals] = useState(false);

  // Memoize the triangle select callback to prevent rerenders
  const handleTriangleSelect = useCallback((triangle: TriangleWithVertices | null) => {
    if (mode === 'selection') {
      setSelectedTriangle(triangle);
    }
  }, [mode]);

  const handleVertexChange = useCallback((vertexIndex: number, axis: 'x' | 'y' | 'z', value: string) => {
    const newValue = parseInt(value, 10);
    if (Number.isNaN(newValue)) return;

    setSelectedTriangle(prev => {
      if (!prev) return prev;

      const vertexKeys = ['vertex0', 'vertex1', 'vertex2'] as const;
      const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

      const updatedVertices = vertexKeys.map((key, idx) => {
        const vertex = prev[key];
        const coords: [number, number, number] = [vertex.x, vertex.y, vertex.z];
        if (idx === vertexIndex) {
          coords[axisIndex] = newValue;
        }
        return coords;
      }) as [
        [number, number, number],
        [number, number, number],
        [number, number, number]
      ];

      updateTriangleVertices(prev, updatedVertices[0], updatedVertices[1], updatedVertices[2]);

      return {
        ...prev,
        [vertexKeys[vertexIndex]]: {
          ...prev[vertexKeys[vertexIndex]],
          [axis]: newValue,
        },
      } as TriangleWithVertices;
    });
  }, [updateTriangleVertices]);

  const handleModeChange = (newMode: MapMode) => {
    setMode(newMode);
    if (newMode !== 'selection') {
      setSelectedTriangle(null);
    }
  };

  // If not loaded by the centralized loader yet, show a lightweight message
  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading map...
      </div>
    )
  }

  return (
    <GridSelectionProvider>
      <div className="flex h-full w-full">
        <div className="flex-1">
          <MapViewer
            renderingMode={renderingMode}
            showGrid={showGrid}
            onTriangleSelect={handleTriangleSelect}
            cameraType={mode === 'export' ? 'orthographic' : 'perspective'}
            wireframe={showWireframe}
            onWireframeToggle={setShowWireframe}
            onGridToggle={setShowGrid}
            onRenderingModeChange={setRenderingMode}
            onMapTypeChange={(type: MapType) => setMapType(type)}
            onModeChange={handleModeChange}
            enabledAlternatives={enabledAlternatives}
            onAlternativesChange={setEnabledAlternatives}
            showNormals={showNormals}
            onNormalsToggle={setShowNormals}
          />
        </div>
        <div className="w-[300px] border-l bg-background pl-3 pr-2 pt-2">
          {mode === 'export' ? (
            <ExportImportSidebar />
          ) : mode === 'painting' ? (
            <PaintingSidebar />
          ) : (
            <SelectionSidebar
              selectedTriangle={selectedTriangle}
              textures={textures}
              onVertexChange={handleVertexChange}
            />
          )}
        </div>
      </div>
    </GridSelectionProvider>
  );
}
