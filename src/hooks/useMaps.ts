import { useCallback, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { MapFile, Mesh, Coords } from '@/ff7/mapfile';
import { TexFile, WorldMapTexture } from '@/ff7/texfile';
import { WORLD_MAP_GLACIER_TEXTURES, WORLD_MAP_OVERWORLD_TEXTURES, WORLD_MAP_UNDERWATER_TEXTURES } from '@/lib/map-data';
import { MESH_SIZE, SCALE } from '@/components/map/constants';
import { TriangleWithVertices } from '@/components/map/types';
import { useAppState } from './useAppState';
import { useLgpState } from './useLgpState';

export type MapId = 'WM0' | 'WM2' | 'WM3';
export type MapType = 'overworld' | 'underwater' | 'glacier';
export type MapMode = 'selection' | 'export' | 'painting';

export type AlternativeGroup = 0 | 1 | 2 | 3;
type SupportedMapId = 0 | 2 | 3;

interface MapConfig {
  id: SupportedMapId;
  filename: MapId;
  type: MapType;
  name: string;
  sectionsX: number;
  sectionsZ: number;
  textureDefs: WorldMapTexture[];
}

export const MAP_NAMES: Record<MapId, string> = {
  WM0: 'Overworld',
  WM2: 'Underwater',
  WM3: 'Great Glacier',
};

export const MESHES_IN_ROW = 4;
export const MESHES_IN_COLUMN = 4;

export const dimensions: Record<MapType, { horizontal: number; vertical: number }> = {
  overworld: { horizontal: 9, vertical: 7 },
  underwater: { horizontal: 3, vertical: 4 },
  glacier: { horizontal: 2, vertical: 2 },
};

const MAP_CONFIGS: Record<MapType, MapConfig> = {
  overworld: {
    id: 0,
    filename: 'WM0',
    type: 'overworld',
    name: MAP_NAMES.WM0,
    sectionsX: 9,
    sectionsZ: 7,
    textureDefs: WORLD_MAP_OVERWORLD_TEXTURES,
  },
  underwater: {
    id: 2,
    filename: 'WM2',
    type: 'underwater',
    name: MAP_NAMES.WM2,
    sectionsX: 3,
    sectionsZ: 4,
    textureDefs: WORLD_MAP_UNDERWATER_TEXTURES,
  },
  glacier: {
    id: 3,
    filename: 'WM3',
    type: 'glacier',
    name: MAP_NAMES.WM3,
    sectionsX: 2,
    sectionsZ: 2,
    textureDefs: WORLD_MAP_GLACIER_TEXTURES,
  },
};

const MAP_CONFIG_BY_ID: Record<SupportedMapId, MapConfig> = {
  0: MAP_CONFIGS.overworld,
  2: MAP_CONFIGS.underwater,
  3: MAP_CONFIGS.glacier,
};

const SUPPORTED_MAP_IDS: SupportedMapId[] = [0, 2, 3];
const BASE_SECTION_COUNT = 63;

const ALTERNATIVE_SECTION_ORDER = [50, 41, 42, 60, 47, 48] as const;
const ALTERNATIVE_SECTION_GROUPS: Record<AlternativeGroup, readonly number[]> = {
  0: [50],
  1: [41, 42],
  2: [60],
  3: [47, 48],
};

const SECTION_TO_GROUP = new Map<number, AlternativeGroup>();
(Object.entries(ALTERNATIVE_SECTION_GROUPS) as [string, readonly number[]][]).forEach(([groupKey, sections]) => {
  const group = Number(groupKey) as AlternativeGroup;
  sections.forEach(sectionId => SECTION_TO_GROUP.set(sectionId, group));
});

const ALTERNATIVE_METADATA = new Map<number, { group: AlternativeGroup; altSectionIndex: number }>();
ALTERNATIVE_SECTION_ORDER.forEach((sectionId, altIndex) => {
  const group = SECTION_TO_GROUP.get(sectionId);
  if (group !== undefined) {
    ALTERNATIVE_METADATA.set(sectionId, { group, altSectionIndex: BASE_SECTION_COUNT + altIndex });
  }
});

interface SectionCache {
  base: Mesh[];
  alternatives: Map<AlternativeGroup, Mesh[]>;
}

interface TriangleCallbacks {
  updateColors?: () => void;
  updateTriangleTexture?: (triangle: TriangleWithVertices) => void;
  updateTriangleNormals?: (
    triangle: TriangleWithVertices,
    normal0?: { x: number; y: number; z: number },
    normal1?: { x: number; y: number; z: number },
    normal2?: { x: number; y: number; z: number }
  ) => void;
  updateTrianglePosition?: (
    triangle: TriangleWithVertices,
    vertex0: [number, number, number],
    vertex1: [number, number, number],
    vertex2: [number, number, number]
  ) => void;
}

interface LoadedMapState {
  id: SupportedMapId;
  type: MapType;
  filename: MapId;
  name: string;
  map: MapFile | null;
  meshCache: Map<number, SectionCache>;
  meshGrid: Mesh[][] | null;
  changedMeshes: Mesh[];
  changedMeshKeys: Set<string>;
  enabledAlternativeSections: number[];
  enabledAlternativeGroups: AlternativeGroup[];
  triangleMap: TriangleWithVertices[] | null;
  triangleCallbacks: TriangleCallbacks;
  textures: WorldMapTexture[];
  texturesLoaded: boolean;
  paintingSelectedTriangles: Set<number>;
  selectedTriangleIndex: number | null;
  loaded: boolean;
}

interface MapsState {
  activeMapId: SupportedMapId | null;
  mode: MapMode;
  maps: Record<SupportedMapId, LoadedMapState>;
}

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

const EMPTY_PAINTING_SET = new Set<number>();

function createImageFromTexture(pixels: Uint8Array, width: number, height: number): string {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    const imageData = ctx.createImageData(width, height)
    for (let i = 0; i < pixels.length; i += 4) {
        imageData.data[i] = pixels[i]     // Red (swap with Blue)
        imageData.data[i + 1] = pixels[i + 1] // Green
        imageData.data[i + 2] = pixels[i + 2]     // Blue (swap with Red)
        imageData.data[i + 3] = pixels[i + 3] // Alpha
    }
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL()
}

function cloneTextures(defs: WorldMapTexture[]): WorldMapTexture[] {
  return defs.map(texture => ({ ...texture, tex: null, imageData: undefined }));
}

function createInitialEntry(config: MapConfig): LoadedMapState {
  return {
    id: config.id,
    type: config.type,
    filename: config.filename,
    name: config.name,
    map: null,
    meshCache: new Map(),
    meshGrid: null,
    changedMeshes: [],
    changedMeshKeys: new Set(),
    enabledAlternativeSections: [],
    enabledAlternativeGroups: [],
    triangleMap: null,
    triangleCallbacks: {},
    textures: [],
    texturesLoaded: false,
    paintingSelectedTriangles: new Set(),
    selectedTriangleIndex: null,
    loaded: false,
  };
}

function meshKey(mesh: Mesh): string {
  return `${mesh.sectionIdx}:${mesh.meshIdx}`;
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a];
  const sortedB = [...b];
  sortedA.sort();
  sortedB.sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function sectionsToGroups(sectionIds: number[]): AlternativeGroup[] {
  const groups = new Set<AlternativeGroup>();
  sectionIds.forEach(id => {
    const group = SECTION_TO_GROUP.get(id);
    if (group !== undefined) {
      groups.add(group);
    }
  });
  return Array.from(groups).sort((a, b) => a - b) as AlternativeGroup[];
}

function loadSectionMeshes(mapFile: MapFile, _baseSectionIdx: number, readSectionIdx: number): Mesh[] {
  const meshes: Mesh[] = new Array(MESHES_IN_ROW * MESHES_IN_COLUMN);
  for (let meshIdx = 0; meshIdx < meshes.length; meshIdx++) {
    meshes[meshIdx] = mapFile.readMesh(readSectionIdx, meshIdx);
  }
  return meshes;
}

function placeSection(meshGrid: Mesh[][], sectionIdx: number, meshes: Mesh[], config: MapConfig): void {
  const sectionRow = Math.floor(sectionIdx / config.sectionsX);
  const sectionCol = sectionIdx % config.sectionsX;
  const startRow = sectionRow * MESHES_IN_ROW;
  const startCol = sectionCol * MESHES_IN_COLUMN;

  for (let rowOffset = 0; rowOffset < MESHES_IN_ROW; rowOffset++) {
    const rowIndex = startRow + rowOffset;
    const row = meshGrid[rowIndex] ?? [];
    for (let colOffset = 0; colOffset < MESHES_IN_COLUMN; colOffset++) {
      const colIndex = startCol + colOffset;
      const meshIdx = rowOffset * MESHES_IN_COLUMN + colOffset;
      row[colIndex] = meshes[meshIdx];
    }
    meshGrid[rowIndex] = row;
  }
}

function replaceSection(meshGrid: Mesh[][], sectionIdx: number, meshes: Mesh[], config: MapConfig): Mesh[][] {
  const sectionRow = Math.floor(sectionIdx / config.sectionsX);
  const sectionCol = sectionIdx % config.sectionsX;
  const startRow = sectionRow * MESHES_IN_ROW;
  const startCol = sectionCol * MESHES_IN_COLUMN;

  const nextGrid = meshGrid.slice();
  for (let rowOffset = 0; rowOffset < MESHES_IN_ROW; rowOffset++) {
    const rowIndex = startRow + rowOffset;
    const newRow = nextGrid[rowIndex]?.slice() ?? [];
    for (let colOffset = 0; colOffset < MESHES_IN_COLUMN; colOffset++) {
      const colIndex = startCol + colOffset;
      const meshIdx = rowOffset * MESHES_IN_COLUMN + colOffset;
      newRow[colIndex] = meshes[meshIdx];
    }
    nextGrid[rowIndex] = newRow;
  }
  return nextGrid;
}

function buildInitialMeshData(mapFile: MapFile, config: MapConfig) {
  const rows = config.sectionsZ * MESHES_IN_ROW;
  const cols = config.sectionsX * MESHES_IN_COLUMN;
  const meshGrid: Mesh[][] = Array.from({ length: rows }, () => new Array<Mesh>(cols));
  const meshCache = new Map<number, SectionCache>();
  const totalSections = config.sectionsX * config.sectionsZ;

  for (let sectionIdx = 0; sectionIdx < totalSections; sectionIdx++) {
    const meshes = loadSectionMeshes(mapFile, sectionIdx, sectionIdx);
    meshCache.set(sectionIdx, { base: meshes, alternatives: new Map() });
    placeSection(meshGrid, sectionIdx, meshes, config);
  }

  return { meshGrid, meshCache };
}

function loadSectionVariant(
  mapFile: MapFile,
  cache: Map<number, SectionCache>,
  baseSectionIdx: number,
  group: AlternativeGroup | null
) {
  const sectionCache = cache.get(baseSectionIdx);
  if (!sectionCache) return null;

  if (group === null) {
    return { meshes: sectionCache.base, meshCache: cache };
  }

  const metadata = ALTERNATIVE_METADATA.get(baseSectionIdx);
  if (!metadata || metadata.group !== group) {
    return { meshes: sectionCache.base, meshCache: cache };
  }

  let altMeshes = sectionCache.alternatives.get(group);
  if (altMeshes) {
    return { meshes: altMeshes, meshCache: cache };
  }

  altMeshes = loadSectionMeshes(mapFile, baseSectionIdx, metadata.altSectionIndex);
  const newAlternatives = new Map(sectionCache.alternatives);
  newAlternatives.set(group, altMeshes);
  const newCache = new Map(cache);
  newCache.set(baseSectionIdx, { base: sectionCache.base, alternatives: newAlternatives });

  return { meshes: altMeshes, meshCache: newCache };
}

function applyAlternativeGroups(entry: LoadedMapState, nextGroups: AlternativeGroup[]) {
  if (entry.type !== 'overworld' || !entry.map || !entry.meshGrid) {
    return { meshCache: entry.meshCache, meshGrid: entry.meshGrid };
  }

  const prevGroups = entry.enabledAlternativeGroups;
  const prevSet = new Set(prevGroups);
  const nextSet = new Set(nextGroups);

  const groupsToEnable = nextGroups.filter(group => !prevSet.has(group));
  const groupsToDisable = prevGroups.filter(group => !nextSet.has(group));

  if (!groupsToEnable.length && !groupsToDisable.length) {
    return { meshCache: entry.meshCache, meshGrid: entry.meshGrid };
  }

  const config = MAP_CONFIG_BY_ID[entry.id];
  let meshCache = entry.meshCache;
  let meshGrid = entry.meshGrid;

  for (const group of groupsToEnable) {
    const sections = ALTERNATIVE_SECTION_GROUPS[group] ?? [];
    for (const sectionIdx of sections) {
      const result = loadSectionVariant(entry.map, meshCache, sectionIdx, group);
      if (result) {
        meshCache = result.meshCache;
        meshGrid = replaceSection(meshGrid!, sectionIdx, result.meshes, config);
      }
    }
  }

  for (const group of groupsToDisable) {
    const sections = ALTERNATIVE_SECTION_GROUPS[group] ?? [];
    for (const sectionIdx of sections) {
      const result = loadSectionVariant(entry.map, meshCache, sectionIdx, null);
      if (result) {
        meshCache = result.meshCache;
        meshGrid = replaceSection(meshGrid!, sectionIdx, result.meshes, config);
      }
    }
  }

  return { meshCache, meshGrid };
}

const initialMapsRecord = SUPPORTED_MAP_IDS.reduce((acc, id) => {
  acc[id] = createInitialEntry(MAP_CONFIG_BY_ID[id]);
  return acc;
}, {} as Record<SupportedMapId, LoadedMapState>);

const mapsAtom = atom<MapsState>({
  activeMapId: 0,
  mode: 'selection',
  maps: initialMapsRecord,
});

export const localToGlobal = (row: number, column: number, coords: Coords): Coords => {
  const offsetX = column * MESH_SIZE;
  const offsetZ = row * MESH_SIZE;
  return {
    x: (coords.x + offsetX) * SCALE,
    y: coords.y * SCALE,
    z: (coords.z + offsetZ) * SCALE,
  };
};

export const globalToLocal = (row: number, column: number, coords: Coords): Coords => {
  const offsetX = column * MESH_SIZE;
  const offsetZ = row * MESH_SIZE;
  return {
    x: coords.x / SCALE - offsetX,
    y: coords.y / SCALE,
    z: coords.z / SCALE - offsetZ,
  };
};

export function getMeshCoordinates(mapId: SupportedMapId, sectionIdx: number, meshIdx: number) {
  const config = MAP_CONFIG_BY_ID[mapId];
  const sectionRow = Math.floor(sectionIdx / config.sectionsX);
  const sectionCol = sectionIdx % config.sectionsX;
  const meshRowOffset = Math.floor(meshIdx / MESHES_IN_ROW);
  const meshColOffset = meshIdx % MESHES_IN_COLUMN;

  return {
    row: sectionRow * MESHES_IN_ROW + meshRowOffset,
    column: sectionCol * MESHES_IN_COLUMN + meshColOffset,
  };
}

export function useMaps() {
  const [state, setState] = useAtom(mapsAtom);
  const { dataPath, markUnsavedChanges, clearUnsavedChanges } = useAppState();
  const { getFile } = useLgpState();

  const activeMapId = state.activeMapId;
  const currentEntry = activeMapId !== null ? state.maps[activeMapId] : null;
  const currentMapType = currentEntry?.type ?? MAP_CONFIGS.overworld.type;
  const currentMapId = currentEntry?.filename ?? MAP_CONFIGS.overworld.filename;

  const worldmap = currentEntry?.meshGrid ?? null;
  const textures = currentEntry?.textures ?? [];
  const triangleMap = currentEntry?.triangleMap ?? null;
  const paintingSelectedTriangles = currentEntry?.paintingSelectedTriangles ?? EMPTY_PAINTING_SET;
  const loaded = currentEntry?.loaded ?? false;
  const selectedTriangle = currentEntry?.selectedTriangleIndex ?? null;
  const enabledAlternatives = currentEntry?.enabledAlternativeSections ?? [];

  const loadedTextures = useMemo(() => ({
    overworld: state.maps[0].texturesLoaded,
    underwater: state.maps[2].texturesLoaded,
    glacier: state.maps[3].texturesLoaded,
  }), [state.maps]);

  const getTexturesForType = useCallback((mapType: MapType) => {
    const config = MAP_CONFIGS[mapType];
    return state.maps[config.id]?.textures ?? [];
  }, [state.maps]);

  const getMeshGrid = useCallback((mapId?: SupportedMapId) => {
    const targetId = mapId ?? state.activeMapId;
    if (targetId === null || targetId === undefined) return null;
    return state.maps[targetId]?.meshGrid ?? null;
  }, [state.activeMapId, state.maps]);

  const getMesh = useCallback((row: number, column: number, mapId?: SupportedMapId) => {
    const grid = getMeshGrid(mapId);
    if (!grid) return null;
    return grid[row]?.[column] ?? null;
  }, [getMeshGrid]);

  const loadMap = useCallback(async (mapType: MapType) => {
    const config = MAP_CONFIGS[mapType];
    const path = `${dataPath}/data/wm/${config.filename}.MAP`;
    const fileData = await readFile(path);
    if (!fileData) {
      throw new Error(`Failed to read map file at ${path}`);
    }

    const mapFile = new MapFile(fileData);
    const { meshGrid, meshCache } = buildInitialMeshData(mapFile, config);

    setState(prev => {
      const previousEntry = prev.maps[config.id];
      const nextEntry: LoadedMapState = {
        ...previousEntry,
        map: mapFile,
        meshGrid,
        meshCache,
        changedMeshes: [],
        changedMeshKeys: new Set(),
        enabledAlternativeSections: [],
        enabledAlternativeGroups: [],
        triangleMap: null,
        triangleCallbacks: {},
        paintingSelectedTriangles: new Set(),
        selectedTriangleIndex: null,
        loaded: true,
        textures: previousEntry.textures.length ? previousEntry.textures : cloneTextures(config.textureDefs),
      };

      return {
        ...prev,
        activeMapId: config.id,
        maps: {
          ...prev.maps,
          [config.id]: nextEntry,
        },
      };
    });

    return mapFile;
  }, [dataPath, setState]);

  const setMapType = useCallback((mapType: MapType) => {
    const config = MAP_CONFIGS[mapType];
    setState(prev => (prev.activeMapId === config.id ? prev : { ...prev, activeMapId: config.id }));
  }, [setState]);

  const setMode = useCallback((mode: MapMode) => {
    setState(prev => {
      if (prev.mode === mode) return prev;
      const activeId = prev.activeMapId;
      if (activeId === null) {
        return { ...prev, mode };
      }

      const entry = prev.maps[activeId];
      const nextEntry = mode === 'painting' ? entry : {
        ...entry,
        paintingSelectedTriangles: new Set(),
      };

      return {
        ...prev,
        mode,
        maps: {
          ...prev.maps,
          [activeId]: nextEntry,
        },
      };
    });
  }, [setState]);

  const addChangedMesh = useCallback((row: number, col: number) => {
    if (state.activeMapId === null) return;
    const mapId = state.activeMapId;
    let added = false;

    setState(prev => {
      const entry = prev.maps[mapId];
      if (!entry.meshGrid) return prev;
      const mesh = entry.meshGrid[row]?.[col];
      if (!mesh) return prev;

      const key = meshKey(mesh);
      if (entry.changedMeshKeys.has(key)) {
        return prev;
      }

      const nextKeys = new Set(entry.changedMeshKeys);
      nextKeys.add(key);

      const nextEntry: LoadedMapState = {
        ...entry,
        changedMeshes: [...entry.changedMeshes, mesh],
        changedMeshKeys: nextKeys,
      };

      added = true;

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [mapId]: nextEntry,
        },
      };
    });

    if (added) {
      markUnsavedChanges();
    }
  }, [markUnsavedChanges, setState, state.activeMapId]);

  const togglePaintingSelectedTriangle = useCallback((faceIndex: number, add: boolean) => {
    if (state.activeMapId === null) return;
    const mapId = state.activeMapId;

    setState(prev => {
      const entry = prev.maps[mapId];
      const nextSet = new Set(entry.paintingSelectedTriangles);
      if (add) {
        nextSet.add(faceIndex);
      } else {
        nextSet.delete(faceIndex);
      }

      const nextEntry: LoadedMapState = {
        ...entry,
        paintingSelectedTriangles: nextSet,
      };

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [mapId]: nextEntry,
        },
      };
    });
  }, [setState, state.activeMapId]);

  const setTriangleMap = useCallback((
    triangleMapData: TriangleWithVertices[] | null,
    updateColors?: () => void,
    updateTriangleTexture?: (triangle: TriangleWithVertices) => void,
    updateTriangleNormals?: (
      triangle: TriangleWithVertices,
      normal0?: { x: number; y: number; z: number },
      normal1?: { x: number; y: number; z: number },
      normal2?: { x: number; y: number; z: number }
    ) => void,
    updateTrianglePosition?: (
      triangle: TriangleWithVertices,
      vertex0: [number, number, number],
      vertex1: [number, number, number],
      vertex2: [number, number, number]
    ) => void
  ) => {
    if (state.activeMapId === null) return;
    const mapId = state.activeMapId;

    setState(prev => {
      const entry = prev.maps[mapId];
      const nextEntry: LoadedMapState = {
        ...entry,
        triangleMap: triangleMapData,
        triangleCallbacks: {
          updateColors,
          updateTriangleTexture,
          updateTriangleNormals,
          updateTrianglePosition
        },
      };

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [mapId]: nextEntry,
        },
      };
    });
  }, [setState, state.activeMapId]);

  const setSelectedTriangle = useCallback((triangleIndex: number | null) => {
    if (state.activeMapId === null) return;
    const mapId = state.activeMapId;
    setState(prev => ({
      ...prev,
      maps: {
        ...prev.maps,
        [mapId]: {
          ...prev.maps[mapId],
          selectedTriangleIndex: triangleIndex,
        },
      },
    }));
  }, [setState, state.activeMapId]);

  const updateTriangle = useCallback((triangle: TriangleWithVertices, updates: TriangleUpdates): [number, number] => {
    if (!triangle || state.activeMapId === null) return [-1, -1];
    const entry = state.maps[state.activeMapId];

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

    if (triangle.trianglePtr) {
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
    }

    if (
      updates.texture !== undefined ||
      updates.uVertex0 !== undefined || updates.vVertex0 !== undefined ||
      updates.uVertex1 !== undefined || updates.vVertex1 !== undefined ||
      updates.uVertex2 !== undefined || updates.vVertex2 !== undefined
    ) {
      entry.triangleCallbacks.updateTriangleTexture?.(triangle);
    }

    if (updates.normal0 !== undefined || updates.normal1 !== undefined || updates.normal2 !== undefined) {
      entry.triangleCallbacks.updateTriangleNormals?.(
        triangle,
        updates.normal0,
        updates.normal1,
        updates.normal2
      );
    }

    const row = Math.floor(triangle.meshOffsetZ / MESH_SIZE);
    const col = Math.floor(triangle.meshOffsetX / MESH_SIZE);
    return [row, col];
  }, [state]);

  const updateSelectedTriangles = useCallback((updates: TriangleUpdates) => {
    if (state.activeMapId === null) return;
    const mapId = state.activeMapId;
    const entry = state.maps[mapId];
    if (!entry.triangleMap || entry.paintingSelectedTriangles.size === 0) return;

    const modifiedKeys = new Set<string>();

    entry.paintingSelectedTriangles.forEach(faceIndex => {
      const triangle = entry.triangleMap?.[faceIndex];
      if (!triangle) return;
      const [row, col] = updateTriangle(triangle, updates);
      if (row >= 0 && col >= 0) {
        modifiedKeys.add(`${row}:${col}`);
      }
    });

    if (modifiedKeys.size === 0) return;

    let added = false;
    setState(prev => {
      const current = prev.maps[mapId];
      if (!current.meshGrid || !current.triangleMap) return prev;

      const nextKeys = new Set(current.changedMeshKeys);
      const nextMeshes = current.changedMeshes.slice();

      modifiedKeys.forEach(key => {
        const [rowStr, colStr] = key.split(':');
        const row = Number(rowStr);
        const col = Number(colStr);
        const mesh = current.meshGrid?.[row]?.[col];
        if (!mesh) return;
        const mKey = meshKey(mesh);
        if (nextKeys.has(mKey)) return;
        nextKeys.add(mKey);
        nextMeshes.push(mesh);
        added = true;
      });

      const nextEntry: LoadedMapState = {
        ...current,
        changedMeshes: nextMeshes,
        changedMeshKeys: nextKeys,
        triangleMap: [...current.triangleMap],
      };

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [mapId]: nextEntry,
        },
      };
    });

    if (added) {
      markUnsavedChanges();
    }

    const callbacks = state.maps[mapId].triangleCallbacks;
    callbacks.updateColors?.();
  }, [markUnsavedChanges, setState, state, updateTriangle]);

  const updateSingleTriangle = useCallback((updates: TriangleUpdates) => {
    if (state.activeMapId === null) return;
    const mapId = state.activeMapId;
    const entry = state.maps[mapId];
    if (!entry.triangleMap || entry.selectedTriangleIndex === null) return;

    const triangle = entry.triangleMap[entry.selectedTriangleIndex];
    if (!triangle) return;

    const [row, col] = updateTriangle(triangle, updates);
    if (row < 0 || col < 0) return;

    let added = false;
    setState(prev => {
      const current = prev.maps[mapId];
      if (!current.meshGrid || !current.triangleMap) return prev;
      const mesh = current.meshGrid[row]?.[col];
      if (!mesh) return prev;
      const key = meshKey(mesh);
      if (current.changedMeshKeys.has(key)) {
        const nextEntry: LoadedMapState = {
          ...current,
          triangleMap: [...current.triangleMap],
        };
        return {
          ...prev,
          maps: {
            ...prev.maps,
            [mapId]: nextEntry,
          },
        };
      }

      const nextKeys = new Set(current.changedMeshKeys);
      nextKeys.add(key);

      const nextEntry: LoadedMapState = {
        ...current,
        changedMeshes: [...current.changedMeshes, mesh],
        changedMeshKeys: nextKeys,
        triangleMap: [...current.triangleMap],
      };

      added = true;

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [mapId]: nextEntry,
        },
      };
    });

    if (added) {
      markUnsavedChanges();
    }

    const callbacks = state.maps[mapId].triangleCallbacks;
    callbacks.updateColors?.();
  }, [markUnsavedChanges, setState, state, updateTriangle]);

const updateTriangleVertices = useCallback((
  triangle: TriangleWithVertices,
  vertex0: [number, number, number],
  vertex1: [number, number, number],
  vertex2: [number, number, number]
) => {
  const activeId = state.activeMapId;
  if (activeId === null) return;
  const targetId = activeId as SupportedMapId;
  const row = Math.floor(triangle.meshOffsetZ / MESH_SIZE);
  const col = Math.floor(triangle.meshOffsetX / MESH_SIZE);

  setState(prev => {
    const entry = prev.maps[targetId];
    if (!entry.triangleMap) return prev;

    const updatePosition = entry.triangleCallbacks.updateTrianglePosition;
    if (!updatePosition) return prev;

    updatePosition(triangle, vertex0, vertex1, vertex2);

    const index = entry.triangleMap.indexOf(triangle);
    const nextTriangleMap = [...entry.triangleMap];
    if (index !== -1) {
      nextTriangleMap[index] = { ...triangle };
    }

    const nextEntry: LoadedMapState = {
      ...entry,
      triangleMap: nextTriangleMap,
    };

    return {
      ...prev,
      maps: {
        ...prev.maps,
        [targetId]: nextEntry,
      },
    };
  });

  addChangedMesh(row, col);
}, [addChangedMesh, setState, state.activeMapId]);

  const updateSectionMesh = useCallback((row: number, col: number, newMesh: Mesh) => {
    if (state.activeMapId === null) return;
    const mapId = state.activeMapId;
    let added = false;

    setState(prev => {
      const entry = prev.maps[mapId];
      if (!entry.meshGrid) return prev;

      const nextGrid = entry.meshGrid.map((meshRow, idx) => (idx === row ? [...meshRow] : meshRow.slice()));
      nextGrid[row][col] = newMesh;

      const key = meshKey(newMesh);
      const nextKeys = new Set(entry.changedMeshKeys);
      const nextMeshes = entry.changedMeshes.slice();
      if (!nextKeys.has(key)) {
        nextKeys.add(key);
        nextMeshes.push(newMesh);
        added = true;
      }

      const nextEntry: LoadedMapState = {
        ...entry,
        meshGrid: nextGrid,
        changedMeshes: nextMeshes,
        changedMeshKeys: nextKeys,
      };

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [mapId]: nextEntry,
        },
      };
    });

    if (added) {
      markUnsavedChanges();
    }
  }, [markUnsavedChanges, setState, state.activeMapId]);

  const setEnabledAlternatives = useCallback((sections: number[]) => {
    if (state.activeMapId === null) return;
    const mapId = state.activeMapId;
    const sortedSections = [...sections].sort((a, b) => a - b);
    const groups = sectionsToGroups(sortedSections);

    let hasChanges = false;
    setState(prev => {
      const entry = prev.maps[mapId];
      if (!entry.map || !entry.meshGrid) return prev;

      if (
        arraysEqual(sortedSections, entry.enabledAlternativeSections) &&
        arraysEqual(groups, entry.enabledAlternativeGroups)
      ) {
        return prev;
      }

      const { meshCache, meshGrid } = applyAlternativeGroups(entry, groups);

      const nextEntry: LoadedMapState = {
        ...entry,
        meshCache,
        meshGrid,
        enabledAlternativeSections: sortedSections,
        enabledAlternativeGroups: groups,
        triangleMap: null,
        paintingSelectedTriangles: new Set(),
      };

      hasChanges = true;

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [mapId]: nextEntry,
        },
      };
    });

    if (hasChanges) {
      markUnsavedChanges();
    }
  }, [markUnsavedChanges, setState, state.activeMapId]);

  const loadTextures = useCallback(async (mapType: MapType) => {
    const config = MAP_CONFIGS[mapType];
    const textures = cloneTextures(config.textureDefs);

    await Promise.all(textures.map(async texture => {
      const filename = `${texture.name}.tex`;
      try {
        const fileData = await getFile(filename);
        if (fileData) {
          texture.tex = new TexFile(fileData);
          // Create and cache the image data URL
          texture.imageData = createImageFromTexture(
            texture.tex.getPixels(),
            texture.tex.data.width,
            texture.tex.data.height
          );
        } else {
          console.warn(`[useMaps] Failed to load texture: ${filename}`);
        }
      } catch (error) {
        console.error(`[useMaps] Error loading texture ${filename}:`, error);
      }
    }));

    setState(prev => {
      const entry = prev.maps[config.id];
      const nextEntry: LoadedMapState = {
        ...entry,
        textures,
        texturesLoaded: true,
      };

      return {
        ...prev,
        maps: {
          ...prev.maps,
          [config.id]: nextEntry,
        },
      };
    });

    return textures;
  }, [getFile, setState]);

  const saveMap = useCallback(async () => {
    if (state.activeMapId === null) return;
    const entry = state.maps[state.activeMapId];
    if (!entry.map || entry.changedMeshes.length === 0) return;

    const basePath = `${dataPath}/data/wm/${entry.filename}`;

    try {
      entry.changedMeshes.forEach(mesh => {
        entry.map!.writeMesh(mesh.sectionIdx, mesh.meshIdx, mesh);
      });

      const mapBytes = entry.map.writeMap();
      await writeFile(`${basePath}.MAP`, mapBytes);

      const botBytes = entry.map.writeBot();
      await writeFile(`${basePath}.BOT`, botBytes);

      setState(prev => {
        const current = prev.maps[state.activeMapId!];
        const nextEntry: LoadedMapState = {
          ...current,
          changedMeshes: [],
          changedMeshKeys: new Set(),
        };

        return {
          ...prev,
          maps: {
            ...prev.maps,
            [state.activeMapId!]: nextEntry,
          },
        };
      });

      clearUnsavedChanges();
    } catch (error) {
      console.error(`[useMaps] Failed to save map ${entry.filename}`, error);
      throw error;
    }
  }, [clearUnsavedChanges, dataPath, setState, state]);

  return {
    mapId: currentMapId,
    mapType: currentMapType,
    mode: state.mode,
    map: currentEntry?.map ?? null,
    worldmap,
    textures,
    loadedTextures,
    getTexturesForType,
    enabledAlternatives,
    triangleMap,
    selectedTriangle,
    loaded,
    loadMap,
    saveMap,
    loadTextures,
    setEnabledAlternatives,
    setMapType,
    addChangedMesh,
    setMode,
    togglePaintingSelectedTriangle,
    paintingSelectedTriangles,
    updateSelectedTriangles,
    updateSingleTriangle,
    updateTriangle,
    setTriangleMap,
    updateSectionMesh,
    setSelectedTriangle,
    updateTriangleVertices,
    getMesh,
    getMeshGrid,
  };
}
