import { atom, useAtom } from 'jotai'
import * as THREE from 'three'
import { WorldMapTexture } from '@/ff7/texfile'
import { MapType } from '@/components/map/types'
import { createTextureAtlas } from '@/components/map/components/WorldMesh/utils'

interface TextureAtlasState {
  texture: THREE.Texture | null
  canvas: HTMLCanvasElement | null
  texturePositions: Map<number, { x: number, y: number, name: string }>
  loadedTextures: WorldMapTexture[]
  mapType: MapType | null
}

const textureAtlasStateAtom = atom<TextureAtlasState>({
  texture: null,
  canvas: null,
  texturePositions: new Map<number, { x: number, y: number, name: string }>(),
  loadedTextures: [],
  mapType: null,
})

export function useTextureAtlas() {
  const [state, setState] = useAtom(textureAtlasStateAtom)

  const loadTextureAtlas = (textures: WorldMapTexture[], mapType: MapType) => {
    // Check if all textures are loaded
    const loadedTextures = textures.filter(t => t.tex !== null)

    // Check if we already have the atlas for these exact textures and map type
    const texturesChanged = loadedTextures.length !== state.loadedTextures.length ||
      !loadedTextures.every((tex, index) => tex.id === state.loadedTextures[index]?.id) ||
      mapType !== state.mapType

    if (!texturesChanged && state.texture && state.canvas && state.texturePositions.size > 0) {
      // Return existing atlas
      return {
        texture: state.texture,
        canvas: state.canvas,
        texturePositions: state.texturePositions
      }
    }

    // Only create texture atlas when all textures are loaded
    if (loadedTextures.length === 0) {
      console.log('[MapViewer] No textures loaded yet, skipping atlas creation')
      const emptyResult = {
        texture: null,
        canvas: null,
        texturePositions: new Map<number, { x: number, y: number, name: string }>(),
        loadedTextures: [],
        mapType: null
      }
      setState(emptyResult)
      return { texture: null, canvas: null, texturePositions: emptyResult.texturePositions }
    }

    console.log(`[MapViewer] Creating texture atlas for ${mapType}...`)
    const result = createTextureAtlas(loadedTextures)

    setState({
      ...result,
      loadedTextures,
      mapType
    })

    return result
  }

  const resetTextureAtlas = () => {
    setState({
      texture: null,
      canvas: null,
      texturePositions: new Map<number, { x: number, y: number, name: string }>(),
      loadedTextures: [],
      mapType: null,
    })
  }

  return {
    texture: state.texture,
    canvas: state.canvas,
    texturePositions: state.texturePositions,
    loadTextureAtlas,
    resetTextureAtlas
  }
}
