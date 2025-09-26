import { atom, useAtom } from 'jotai'
import { readFile, writeFile } from "@tauri-apps/plugin-fs"
import { useAppState } from './useAppState'
import { MapFile, Mesh } from '@/ff7/mapfile'
import { TexFile, WorldMapTexture } from '@/ff7/texfile'
import { useLgpState } from './useLgpState'
import { WORLD_MAP_GLACIER_TEXTURES, WORLD_MAP_OVERWORLD_TEXTURES, WORLD_MAP_UNDERWATER_TEXTURES } from '@/lib/map-data'
import { useCallback } from 'react'
import { MESH_SIZE } from '@/components/map/constants'
import { TriangleWithVertices } from '@/components/map/types'

export type MapId = 'WM0' | 'WM2' | 'WM3'
export type MapType = 'overworld' | 'underwater' | 'glacier'
export type MapMode = 'selection' | 'export' | 'painting'
export type AlternativeSection = { id: number, name: string }

export const MAP_NAMES: Record<MapId, string> = {
  WM0: "Overworld",
  WM2: "Underwater",
  WM3: "Great Glacier",
}

const ALTERNATIVE_SECTIONS: AlternativeSection[] = [
  { id: 50, name: "Temple of Ancients gone" },
  { id: 41, name: "Junon Area crater (left)" },
  { id: 42, name: "Junon Area crater (right)" },
  { id: 60, name: "Mideel after Lifestream" },
  { id: 47, name: "Cosmo Canyon crater (left)" },
  { id: 48, name: "Cosmo Canyon crater (right)" },
] as const;

interface MapTypeData {
  mapId: MapId | null
  map: MapFile | null
  worldmap: Mesh[][] | null
  textures: WorldMapTexture[]
  enabledAlternatives: number[]
  changedMeshes: [number, number][]
  triangleMap: TriangleWithVertices[] | null
  loaded: boolean
  updateColors?: () => void
  updateTriangleTexture?: (triangle: TriangleWithVertices) => void
  updateTriangleNormals?: (triangle: TriangleWithVertices, normal0: { x: number; y: number; z: number }, normal1: { x: number; y: number; z: number }, normal2: { x: number; y: number; z: number }) => void
}

interface MapState {
  mapType: MapType
  mode: MapMode
  maps: Record<MapType, MapTypeData>
  loadedTextures: Record<MapType, boolean>
  paintingSelectedTriangles: Set<number>
  selectedTriangle: number | null
}

const mapStateAtom = atom<MapState>({
  mapType: 'overworld',
  mode: 'selection',
  maps: {
    overworld: {
      mapId: null,
      map: null,
      worldmap: null,
      textures: [],
      enabledAlternatives: [],
      changedMeshes: [],
      triangleMap: null,
      loaded: false,
      updateColors: undefined,
      updateTriangleTexture: undefined,
    },
    underwater: {
      mapId: null,
      map: null,
      worldmap: null,
      textures: [],
      enabledAlternatives: [],
      changedMeshes: [],
      triangleMap: null,
      loaded: false,
      updateColors: undefined,
      updateTriangleTexture: undefined,
    },
    glacier: {
      mapId: null,
      map: null,
      worldmap: null,
      textures: [],
      enabledAlternatives: [],
      changedMeshes: [],
      triangleMap: null,
      loaded: false,
      updateColors: undefined,
      updateTriangleTexture: undefined,
    },
  },
  loadedTextures: {
    overworld: false,
    underwater: false,
    glacier: false,
  },
  paintingSelectedTriangles: new Set<number>(),
  selectedTriangle: null,
})

export const MESHES_IN_ROW = 4;
export const MESHES_IN_COLUMN = 4;

// Map dimensions for different map types
export const dimensions = {
  overworld: { horizontal: 9, vertical: 7 },
  underwater: { horizontal: 3, vertical: 4 },
  glacier: { horizontal: 2, vertical: 2 }
};

export function useMapState() {
  const [state, setState] = useAtom(mapStateAtom)
  const { dataPath, markUnsavedChanges, clearUnsavedChanges } = useAppState()
  const { getFile } = useLgpState()

  const getTexturesForMapType = (mapType: MapType): WorldMapTexture[] => {
    switch (mapType) {
      case 'underwater':
        return WORLD_MAP_UNDERWATER_TEXTURES;
      case 'glacier':
        return WORLD_MAP_GLACIER_TEXTURES;
      default:
        return WORLD_MAP_OVERWORLD_TEXTURES;
    }
  }

  const parseWorldmap = (rawMapData: MapFile, mapType: MapType, enabledAlternatives: number[]) => {
    if (!rawMapData) return null;

    console.time("[Map] Parsing worldmap")

    // 2D array containing rows and columns of meshes
    const data: Mesh[][] = [];

    const { horizontal: SECTIONS_HORIZONTAL, vertical: SECTIONS_VERTICAL } = dimensions[mapType as keyof typeof dimensions];

    for (let row = 0; row < SECTIONS_VERTICAL * MESHES_IN_ROW; row++) {
      const rowData: Mesh[] = [];
      for (let column = 0; column < SECTIONS_HORIZONTAL * MESHES_IN_COLUMN; column++) {
        const sectionIdx = Math.floor(row / MESHES_IN_ROW) * SECTIONS_HORIZONTAL + Math.floor(column / MESHES_IN_COLUMN);
        const meshIdx = (row % MESHES_IN_ROW) * MESHES_IN_COLUMN + (column % MESHES_IN_COLUMN);
        let trueSectionIdx = sectionIdx;
        if (ALTERNATIVE_SECTIONS.some(alt => alt.id === sectionIdx && enabledAlternatives.includes(alt.id))) {
          trueSectionIdx = 63 + ALTERNATIVE_SECTIONS.findIndex(alt => alt.id === sectionIdx);
        }
        rowData.push(rawMapData.readMesh(trueSectionIdx, meshIdx));
      }
      data.push(rowData);
    }

    console.timeEnd("[Map] Parsing worldmap")
    return data;
  }

  const loadTextures = async (mapType: MapType) => {
    console.debug("[Map] Loading textures for", mapType)
    const textures = getTexturesForMapType(mapType).map(texture => ({ ...texture, tex: null }));

    // Load textures in parallel
    const loadPromises = textures.map(async texture => {
      const filename = `${texture.name}.tex`
      try {
        const fileData = await getFile(filename)
        if (fileData) {
          texture.tex = new TexFile(fileData)
        } else {
          console.warn(`[Map] Failed to load texture: ${filename}`)
        }
      } catch (error) {
        console.error(`[Map] Error loading texture ${filename}:`, error)
      }
    });

    await Promise.all(loadPromises);
    console.log(`[Map] Loaded ${textures.filter(t => t.tex !== null).length}/${textures.length} textures`)

    setState(prev => ({
      ...prev,
      maps: {
        ...prev.maps,
        [mapType]: {
          ...prev.maps[mapType],
          textures,
        }
      },
      loadedTextures: { ...prev.loadedTextures, [mapType]: true }
    }))
    return textures
  }

  const loadMap = async (mapId: MapId, mapType: MapType) => {
    console.debug("[Map] Loading map:", mapId)
    const path = `${dataPath}/data/wm/${mapId}.MAP`
    const fileData = await readFile(path)
    if (!fileData) {
      console.error("Failed to read map file:", path)
      return
    }

    const mapData = new MapFile(fileData)
    console.debug("[Map] Map data", mapData)
    const worldmapData = parseWorldmap(mapData, mapType, []) // Start with no alternatives enabled for initial load

    console.debug("[Map] Worldmap data", worldmapData)

    setState(prev => ({
      ...prev,
      mapType,
      maps: {
        ...prev.maps,
        [mapType]: {
          ...prev.maps[mapType],
          mapId,
          map: mapData,
          worldmap: worldmapData,
          loaded: true
        }
      }
    }))
    return mapData
  }

  const setEnabledAlternatives = (alternatives: number[], _changed?: AlternativeSection) => {
    setState(prev => {
      const currentMapData = prev.maps[prev.mapType];
      const worldmapData = currentMapData.map ? parseWorldmap(currentMapData.map, prev.mapType, alternatives) : null;
      return {
        ...prev,
        maps: {
          ...prev.maps,
          [prev.mapType]: {
            ...currentMapData,
            enabledAlternatives: alternatives,
            worldmap: worldmapData
          }
        }
      };
    });
    markUnsavedChanges()
  }

  // Centralized map type setter; does not load by itself
  const setMapType = useCallback((mapType: MapType) => {
    setState(prev => ({
      ...prev,
      mapType,
    }))
  }, [setState])

  const addChangedMesh = useCallback((row: number, col: number) => {
    setState(prev => {
      const currentMapData = prev.maps[prev.mapType];
      const newMesh = [row, col] as [number, number];
      const exists = currentMapData.changedMeshes.some(([r, c]) => r === row && c === col);
      if (!exists) {
        return {
          ...prev,
          maps: {
            ...prev.maps,
            [prev.mapType]: {
              ...currentMapData,
              changedMeshes: [...currentMapData.changedMeshes, newMesh]
            }
          }
        };
      }
      return prev;
    });
    markUnsavedChanges()
  }, [setState, markUnsavedChanges]);

  const saveMap = async () => {
    const currentMapData = state.maps[state.mapType];
    if (!currentMapData.map) return;

    console.debug(`Changed ${currentMapData.changedMeshes.length} meshes`, currentMapData.changedMeshes)
    console.time("[Map] Saving map")
    currentMapData.changedMeshes.forEach(mesh => {
      const [row, col] = mesh
      const sectionIdx = Math.floor(row / MESHES_IN_ROW) * dimensions[state.mapType as keyof typeof dimensions].horizontal + Math.floor(col / MESHES_IN_COLUMN);
      const meshIdx = (row % MESHES_IN_ROW) * MESHES_IN_COLUMN + (col % MESHES_IN_COLUMN);
      currentMapData.map!.writeMesh(sectionIdx, meshIdx, currentMapData.worldmap![row][col])
    })

    // for (let row = 0; row < dimensions[state.mapType as keyof typeof dimensions].vertical * MESHES_IN_ROW; row++) {
    //   for (let col = 0; col < dimensions[state.mapType as keyof typeof dimensions].horizontal * MESHES_IN_COLUMN; col++) {
    //     const sectionIdx = Math.floor(row / MESHES_IN_ROW) * dimensions[state.mapType as keyof typeof dimensions].horizontal + Math.floor(col / MESHES_IN_COLUMN);
    //     const meshIdx = (row % MESHES_IN_ROW) * MESHES_IN_COLUMN + (col % MESHES_IN_COLUMN);
    //     currentMapData.map.writeMesh(sectionIdx, meshIdx, currentMapData.worldmap[row][col])
    //   }
    // }

    const path = `${dataPath}/data/wm/${currentMapData.mapId}`
    const mapData = currentMapData.map.writeMap()
    await writeFile(path + '.MAP', mapData)
    const botData = currentMapData.map.writeBot()
    await writeFile(path + '.BOT', botData)
    console.timeEnd("[Map] Saving map")
    clearUnsavedChanges()
  }

  const setMode = (mode: MapMode) => {
    setState(prev => ({ ...prev, mode, paintingSelectedTriangles: mode === 'painting' ? prev.paintingSelectedTriangles : new Set<number>() }));
  };

  const togglePaintingSelectedTriangle = (faceIndex: number, add: boolean) => {
    setState(prev => {
      const newSet = new Set(prev.paintingSelectedTriangles);
      if (add) {
        newSet.add(faceIndex);
      } else {
        newSet.delete(faceIndex);
      }
      return { ...prev, paintingSelectedTriangles: newSet };
    });
  };

  interface TriangleUpdates {
    type?: number;
    locationId?: number;
    script?: number;
    isChocobo?: boolean;
    texture?: number;
    uVertex0?: number;
    vVertex0?: number;
    uVertex1?: number;
    vVertex1?: number;
    uVertex2?: number;
    vVertex2?: number;
    normal0?: { x: number; y: number; z: number };
    normal1?: { x: number; y: number; z: number };
    normal2?: { x: number; y: number; z: number };
  }

  const updateTriangle = (triangle: TriangleWithVertices, updates: TriangleUpdates): [number, number] => {
    if (!triangle) return [-1, -1];

    // Update the triangle in triangleMap
    if (updates.type !== undefined) triangle.type = updates.type;
    if (updates.locationId !== undefined) triangle.locationId = updates.locationId;
    if (updates.script !== undefined) triangle.script = updates.script;
    if (updates.isChocobo !== undefined) triangle.isChocobo = updates.isChocobo;
    if (updates.texture !== undefined) triangle.texture = updates.texture;
    if (updates.uVertex0 !== undefined) triangle.uVertex0 = updates.uVertex0;
    if (updates.vVertex0 !== undefined) triangle.vVertex0 = updates.vVertex0;
    if (updates.uVertex1 !== undefined) triangle.uVertex1 = updates.uVertex1;
    if (updates.vVertex1 !== undefined) triangle.vVertex1 = updates.vVertex1;
    if (updates.uVertex2 !== undefined) triangle.uVertex2 = updates.uVertex2;
    if (updates.vVertex2 !== undefined) triangle.vVertex2 = updates.vVertex2;
    if (updates.normal0 !== undefined) triangle.normal0 = updates.normal0;
    if (updates.normal1 !== undefined) triangle.normal1 = updates.normal1;
    if (updates.normal2 !== undefined) triangle.normal2 = updates.normal2;

    // Update the underlying triangle data using trianglePtr
    if (updates.type !== undefined) triangle.trianglePtr.type = updates.type;
    if (updates.locationId !== undefined) triangle.trianglePtr.locationId = updates.locationId;
    if (updates.script !== undefined) triangle.trianglePtr.script = updates.script;
    if (updates.isChocobo !== undefined) triangle.trianglePtr.isChocobo = updates.isChocobo;
    if (updates.texture !== undefined) triangle.trianglePtr.texture = updates.texture;
    if (updates.uVertex0 !== undefined) triangle.trianglePtr.uVertex0 = updates.uVertex0;
    if (updates.vVertex0 !== undefined) triangle.trianglePtr.vVertex0 = updates.vVertex0;
    if (updates.uVertex1 !== undefined) triangle.trianglePtr.uVertex1 = updates.uVertex1;
    if (updates.vVertex1 !== undefined) triangle.trianglePtr.vVertex1 = updates.vVertex1;
    if (updates.uVertex2 !== undefined) triangle.trianglePtr.uVertex2 = updates.uVertex2;
    if (updates.vVertex2 !== undefined) triangle.trianglePtr.vVertex2 = updates.vVertex2;
    if (updates.normal0 !== undefined) triangle.trianglePtr.normal0 = updates.normal0;
    if (updates.normal1 !== undefined) triangle.trianglePtr.normal1 = updates.normal1;
    if (updates.normal2 !== undefined) triangle.trianglePtr.normal2 = updates.normal2;

    if (updates.texture !== undefined || updates.uVertex0 !== undefined || updates.vVertex0 !== undefined || updates.uVertex1 !== undefined || updates.vVertex1 !== undefined || updates.uVertex2 !== undefined || updates.vVertex2 !== undefined) {
      if (currentMapData.updateTriangleTexture) {
        currentMapData.updateTriangleTexture(triangle);
      }
    }

    if (updates.normal0 !== undefined || updates.normal1 !== undefined || updates.normal2 !== undefined) {
      if (currentMapData.updateTriangleNormals) {
        currentMapData.updateTriangleNormals(triangle, updates.normal0, updates.normal1, updates.normal2);
      }
    }

    // Return the mesh coordinates for tracking modified meshes
    const row = Math.floor(triangle.meshOffsetZ / MESH_SIZE);
    const col = Math.floor(triangle.meshOffsetX / MESH_SIZE);
    return [row, col];
  };

  const updateSelectedTriangles = (updates: TriangleUpdates) => {
    setState(prev => {
      const currentMapData = prev.maps[prev.mapType];
      if (!currentMapData.worldmap || !currentMapData.triangleMap) return prev;

      // Track which meshes were modified
      const modifiedMeshes = new Set<string>();

      console.debug("[Map] Updating", updates)

      // Update each selected triangle
      prev.paintingSelectedTriangles.forEach(faceIndex => {
        const triangle = currentMapData.triangleMap![faceIndex];
        console.debug("[Map] Updating triangle", triangle)

        const [row, col] = updateTriangle(triangle, updates);
        if (row >= 0 && col >= 0) {
          modifiedMeshes.add(`${row},${col}`);
        }
      });

      // Add all modified meshes to changedMeshes
      const newChangedMeshes = [...currentMapData.changedMeshes];
      modifiedMeshes.forEach(key => {
        const [row, col] = key.split(',').map(Number);
        if (!currentMapData.changedMeshes.some(([r, c]) => r === row && c === col)) {
          newChangedMeshes.push([row, col]);
        }
      });

      // Update the colors in the geometry
      if (currentMapData.updateColors) {
        currentMapData.updateColors();
      }

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [prev.mapType]: {
            ...currentMapData,
            changedMeshes: newChangedMeshes,
            triangleMap: [...currentMapData.triangleMap] // Create new array to trigger re-render
          }
        }
      };
    });
    markUnsavedChanges()
  };

  const updateSingleTriangle = (updates: TriangleUpdates) => {
    setState(prev => {
      const currentMapData = prev.maps[prev.mapType];
      if (!currentMapData.worldmap || !currentMapData.triangleMap || prev.selectedTriangle === null) return prev;

      const triangle = currentMapData.triangleMap[prev.selectedTriangle];
      if (!triangle) {
        console.warn(`[Map] Triangle with index ${prev.selectedTriangle} not found`);
        return prev;
      }

      console.debug("[Map] Updating single triangle", prev.selectedTriangle, updates)

      // Update the triangle and get its mesh coordinates
      const [row, col] = updateTriangle(triangle, updates);

      // Add the modified mesh to changedMeshes if it's not already there
      const newChangedMeshes = [...currentMapData.changedMeshes];
      if (row >= 0 && col >= 0 && !currentMapData.changedMeshes.some(([r, c]) => r === row && c === col)) {
        newChangedMeshes.push([row, col]);
      }

      // Update the colors in the geometry
      if (currentMapData.updateColors) {
        currentMapData.updateColors();
      }

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [prev.mapType]: {
            ...currentMapData,
            changedMeshes: newChangedMeshes,
            triangleMap: [...currentMapData.triangleMap] // Create new array to trigger re-render
          }
        }
      };
    });
    markUnsavedChanges()
  };

  const setTriangleMap = useCallback((triangleMap: TriangleWithVertices[], updateColors?: () => void, updateTriangleTexture?: (triangle: TriangleWithVertices) => void, updateTriangleNormals?: (triangle: TriangleWithVertices, normal0: { x: number; y: number; z: number }, normal1: { x: number; y: number; z: number }, normal2: { x: number; y: number; z: number }) => void) => {
    setState(prev => ({
      ...prev,
      maps: {
        ...prev.maps,
        [prev.mapType]: {
          ...prev.maps[prev.mapType],
          triangleMap,
          updateColors,
          updateTriangleTexture,
          updateTriangleNormals
        }
      }
    }));
  }, [setState]);

  // Added updateSectionMesh: updates a single mesh in the worldmap and tracks it as changed
  const updateSectionMesh = (row: number, col: number, newMesh: Mesh) => {
    console.log(`updateSectionMesh called for row=${row}, col=${col} with mesh:`, newMesh);
    setState(prev => {
      const currentMapData = prev.maps[prev.mapType];
      if (!currentMapData.worldmap) return prev;
      const newWorldmap = [...currentMapData.worldmap];
      newWorldmap[row] = [...newWorldmap[row]];
      newWorldmap[row][col] = newMesh;
      const alreadyChanged = currentMapData.changedMeshes.some(([r, c]) => r === row && c === col);
      return {
        ...prev,
        maps: {
          ...prev.maps,
          [prev.mapType]: {
            ...currentMapData,
            worldmap: newWorldmap,
            changedMeshes: alreadyChanged ? currentMapData.changedMeshes : [...currentMapData.changedMeshes, [row, col]]
          }
        }
      };
    });
    markUnsavedChanges()
  };

  const setSelectedTriangle = useCallback((triangleIndex: number | null) => {
    setState(prev => ({ ...prev, selectedTriangle: triangleIndex }));
  }, [setState]);

  const currentMapData = state.maps[state.mapType];

  return {
    mapId: currentMapData.mapId,
    mapType: state.mapType,
    mode: state.mode,
    map: currentMapData.map,
    worldmap: currentMapData.worldmap,
    textures: currentMapData.textures,
    loadedTextures: state.loadedTextures,
    enabledAlternatives: currentMapData.enabledAlternatives,
    triangleMap: currentMapData.triangleMap,
    selectedTriangle: state.selectedTriangle,
    loaded: currentMapData.loaded,
    loadMap,
    saveMap,
    loadTextures,
    setEnabledAlternatives,
    setMapType,
    addChangedMesh,
    setMode,
    togglePaintingSelectedTriangle,
    paintingSelectedTriangles: state.paintingSelectedTriangles,
    updateSelectedTriangles,
    updateSingleTriangle,
    updateTriangle,
    setTriangleMap,
    updateSectionMesh,
    setSelectedTriangle
  }
}
