import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera as DreiOrthographicCamera } from '@react-three/drei'
import { OrthographicCamera as ThreeOrthographicCamera } from 'three'
import { WorldMesh } from './components/WorldMesh'
import { CAMERA_HEIGHT, MESH_SIZE, SCALE } from './constants'
import { GridSelectionProvider, useGridSelection } from '@/contexts/GridSelectionContext'
import { MapMode, MapType, dimensions, useMaps, MESHES_IN_COLUMN, MESHES_IN_ROW } from '@/hooks/useMaps'

type MapPickerProps = {
  onPickCell: (meshX: number, meshZ: number) => void
  mapType?: MapType
  preselect?: { x: number; z: number } | null
}

export function MapPicker({ onPickCell, mapType: preferredMapType, preselect }: MapPickerProps) {
  const { mapType, worldmap } = useMaps()

  const effectiveType = preferredMapType ?? mapType

  const mapDimensions = useMemo(() => {
    const info = dimensions[effectiveType]
    const sizeZ = info.vertical * MESHES_IN_ROW * MESH_SIZE * SCALE
    const sizeX = info.horizontal * MESHES_IN_COLUMN * MESH_SIZE * SCALE
    return {
      width: sizeX,
      height: sizeZ,
      center: { x: sizeX / 2, y: 0, z: sizeZ / 2 },
    }
  }, [effectiveType])

  function AutoOrtho({ margin = 50 }: { margin?: number }) {
    const { camera, viewport } = useThree()
    useEffect(() => {
      if (!(camera instanceof ThreeOrthographicCamera)) return
      const halfH = mapDimensions.height / 2 + margin
      const halfW = halfH * viewport.aspect
      camera.top = halfH
      camera.bottom = -halfH
      camera.left = -halfW
      camera.right = halfW
      camera.updateProjectionMatrix()
      // Center camera
      camera.position.set(mapDimensions.center.x, CAMERA_HEIGHT[effectiveType], mapDimensions.center.z)
      camera.lookAt(mapDimensions.center.x, 0, mapDimensions.center.z)
    }, [viewport.aspect])
    return null
  }

  function SelectionWatcher({ onPick }: { onPick: (x: number, z: number) => void }) {
    const { selectedCell, resetSelection } = useGridSelection()
    useEffect(() => {
      if (selectedCell) onPick(selectedCell.column, selectedCell.row)
      return () => resetSelection()
    }, [selectedCell, onPick])
    return null
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null)

  return (
    <GridSelectionProvider>
      <Canvas style={{ width: '100%', height: '100%' }}>
        <DreiOrthographicCamera makeDefault near={-1000} far={100000} position={[mapDimensions.center.x, CAMERA_HEIGHT[effectiveType], mapDimensions.center.z]} />
        <AutoOrtho margin={50} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[20000, 40000, 20000]} intensity={1.0} />
        {worldmap && (
          <WorldMesh
            renderingMode={"terrain" as any}
            onTriangleSelect={() => {}}
            selectedFaceIndex={null}
            debugCanvasRef={debugCanvasRef}
            mapCenter={mapDimensions.center}
            rotation={0}
            showGrid={true}
            wireframe={false}
            showNormals={false}
            mode={'export' as MapMode}
            gridActiveOverride={true}
            preselectedCell={preselect ?? null}
          />
        )}
        <SelectionWatcher onPick={onPickCell} />
      </Canvas>
    </GridSelectionProvider>
  )
}
