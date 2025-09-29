import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { useGeometry } from './hooks';
import { useSelectedTriangleGeometry } from './hooks';
import { RenderingMode } from '../../types';
import { TriangleWithVertices } from '@/components/map/types';
import { MapMode, useMaps } from '@/hooks/useMaps';
import { GridOverlay } from '../GridOverlay';
import { SELECTION_Y_OFFSET } from '../../constants';
import { useTextureAtlas } from '@/hooks/useTextureAtlas';

interface WorldMeshProps {
  renderingMode: RenderingMode;
  onTriangleSelect: (triangle: TriangleWithVertices | null, faceIndex: number | null) => void;
  selectedFaceIndex: number | null;
  debugCanvasRef: React.RefObject<HTMLCanvasElement>;
  mapCenter: { x: number; y: number; z: number };
  rotation: number;
  showGrid?: boolean;
  disablePainting?: boolean;
  wireframe?: boolean;
  showNormals?: boolean;
  mode?: MapMode;
  gridActiveOverride?: boolean;
  preselectedCell?: { x: number; z: number } | null;
  onWireframeOpacityUpdate?: (updateFn: (cameraHeight: number) => void) => void;
}

export function WorldMesh({
  renderingMode,
  onTriangleSelect,
  selectedFaceIndex,
  debugCanvasRef,
  mapCenter,
  rotation,
  showGrid = false,
  disablePainting,
  wireframe,
  showNormals = false,
  mode,
  gridActiveOverride,
  preselectedCell,
  onWireframeOpacityUpdate,
}: WorldMeshProps) {
  // useTraceUpdate({ renderingMode, onTriangleSelect, selectedFaceIndex, debugCanvasRef, mapCenter, rotation, showGrid, disablePainting, wireframe, showNormals, mode, gridActiveOverride, preselectedCell });

  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [paintingMouseDownPos, setPaintingMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [paintingDragActive, setPaintingDragActive] = useState(false);
  const [paintingDragStartMode, setPaintingDragStartMode] = useState<boolean | null>(null);
  const [paintingHasToggled, setPaintingHasToggled] = useState(false);
  const wireframeMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const { textures, worldmap, mapType, paintingSelectedTriangles, togglePaintingSelectedTriangle, setTriangleMap } = useMaps();

  const { loadTextureAtlas } = useTextureAtlas();
  const { texture, canvas, texturePositions } = loadTextureAtlas(textures, mapType);

  const { geometry, normalLinesGeometry, triangleMap, updateTrianglePosition, updateColors, updateTriangleTexture, updateTriangleNormals } = useGeometry(worldmap, mapType, renderingMode, textures, texturePositions);
  const selectedTriangleGeometry = useSelectedTriangleGeometry(triangleMap, selectedFaceIndex);


  // Callback to update wireframe opacity based on camera height
  const updateWireframeOpacity = useCallback((cameraHeight: number) => {
    if (wireframeMaterialRef.current) {
      const opacity = cameraHeight
        ? Math.max(0, 0.3 * (1 - Math.max(0, (cameraHeight - 1000) / 5000)))
        : 0.2;
      wireframeMaterialRef.current.opacity = opacity;
    }
  }, []);

  // Provide the update function to parent component
  useEffect(() => {
    if (onWireframeOpacityUpdate) {
      onWireframeOpacityUpdate(updateWireframeOpacity);
    }
  }, [onWireframeOpacityUpdate, updateWireframeOpacity]);

  // Update triangleMap in global state whenever it changes
  useEffect(() => {
    if (triangleMap) {
      setTriangleMap(
        triangleMap,
        updateColors,
        updateTriangleTexture,
        updateTriangleNormals,
        updateTrianglePosition
      );
    }
  }, [triangleMap, setTriangleMap, updateColors, updateTriangleTexture, updateTriangleNormals, updateTrianglePosition]);

  // Copy the texture atlas to the debug canvas
  useEffect(() => {
    if (debugCanvasRef.current && canvas) {
      const ctx = debugCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 512, 512);
        ctx.drawImage(canvas, 0, 0, 512, 512);
      }
    }
  }, [canvas, debugCanvasRef]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    setMouseDownPos({ x: event.clientX, y: event.clientY });
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (mode === 'export' || !mouseDownPos || !onTriangleSelect) return;

    // Check if mouse moved more than 5 pixels in any direction
    const dx = Math.abs(event.clientX - mouseDownPos.x);
    const dy = Math.abs(event.clientY - mouseDownPos.y);
    const isDrag = dx > 5 || dy > 5;

    setMouseDownPos(null);

    if (!isDrag && triangleMap && event.faceIndex !== undefined) {
      const selectedTriangle = triangleMap[event.faceIndex];
      (window as any).selectedTriangle = selectedTriangle;
      onTriangleSelect(selectedTriangle, event.faceIndex);
    }
  };

  const handlePaintingPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || disablePainting) return;
    setPaintingMouseDownPos({ x: event.clientX, y: event.clientY });
    if (mode === 'painting' && typeof event.faceIndex === 'number') {
      const alreadySelected = paintingSelectedTriangles.has(event.faceIndex);
      setPaintingDragStartMode(alreadySelected);
      togglePaintingSelectedTriangle(event.faceIndex, !alreadySelected);
      setPaintingHasToggled(true);
    }
  };

  const handlePaintingPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (disablePainting) return;
    if (!paintingMouseDownPos) return;
    const dx = Math.abs(event.clientX - paintingMouseDownPos.x);
    const dy = Math.abs(event.clientY - paintingMouseDownPos.y);
    if (dx > 5 || dy > 5) {
      setPaintingDragActive(true);
      if (mode === 'painting' && typeof event.faceIndex === 'number' && paintingDragStartMode !== null) {
        const shouldAdd = !paintingDragStartMode;
        togglePaintingSelectedTriangle(event.faceIndex, shouldAdd);
      }
    }
  };

  const handlePaintingClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.button !== 0 || disablePainting) return;
    if (mode === 'painting' && typeof event.faceIndex === 'number') {
      if (!paintingDragActive && !paintingHasToggled) {
        const isSelected = paintingSelectedTriangles.has(event.faceIndex);
        togglePaintingSelectedTriangle(event.faceIndex, !isSelected);
      }
    }
    setPaintingDragActive(false);
    setPaintingDragStartMode(null);
    setPaintingMouseDownPos(null);
    setPaintingHasToggled(false);
  };

  if (!geometry || !triangleMap) {
    // Show loading indicator when worldmap exists but geometry is still being computed
    if (worldmap && worldmap.length > 0) {
      return (
        <group>
          <mesh>
            <boxGeometry args={[100, 100, 100]} />
            <meshBasicMaterial color="#666" transparent opacity={0.3} />
          </mesh>
        </group>
      );
    }
    return null;
  }

  return (
    <group>
      <group 
        position={[mapCenter.x, 0, mapCenter.z]}
        rotation={[0, rotation, 0]}
      >
        <group position={[-mapCenter.x, 0, -mapCenter.z]}>
          <mesh 
            geometry={geometry}
            onPointerDown={mode === 'painting' ? handlePaintingPointerDown : handlePointerDown}
            onPointerMove={mode === 'painting' ? handlePaintingPointerMove : undefined}
            onClick={mode === 'painting' ? handlePaintingClick : handleClick}
            renderOrder={0}
          >
            {renderingMode === "textured" && texture ? (
              <meshBasicMaterial 
                map={texture} 
                side={THREE.DoubleSide}
                transparent={true}
                alphaTest={0.5}
                toneMapped={false}
              />
            ) : (
              <meshPhongMaterial vertexColors side={THREE.DoubleSide} />
            )}
          </mesh>
          {wireframe && (
            <mesh geometry={geometry} renderOrder={10}>
              <meshBasicMaterial
                ref={wireframeMaterialRef}
                color="#000000"
                wireframe={true}
                transparent={true}
                opacity={0.2}
                depthTest={true}
                depthWrite={true}
              />
            </mesh>
          )}
          {showNormals && normalLinesGeometry && (
            <lineSegments geometry={normalLinesGeometry} renderOrder={11}>
              <lineBasicMaterial 
                color="#00ff00" 
                linewidth={1}
                transparent={true}
                opacity={0.5}
                depthTest={true}
                depthWrite={true}
              />
            </lineSegments>
          )}
          {onTriangleSelect && selectedTriangleGeometry && (
            <lineSegments renderOrder={10}>
              <edgesGeometry attach="geometry" args={[selectedTriangleGeometry]} />
              <lineBasicMaterial 
                color="#ff00ff" 
                linewidth={2} 
                depthTest={false} 
                depthWrite={false}
                transparent
              />
            </lineSegments>
          )}
          {showGrid && (
            <GridOverlay 
              worldmapLength={worldmap.length} 
              worldmapWidth={worldmap[0].length} 
              active={typeof gridActiveOverride === 'boolean' ? gridActiveOverride : (mode === 'export')}
              preselectedCell={preselectedCell}
            />
          )}
          {mode === 'painting' && paintingSelectedTriangles.size > 0 && triangleMap && (
            Array.from(paintingSelectedTriangles).map(faceIndex => {
              const tri = triangleMap[faceIndex];
              if (!tri) return null;
              const highlightPositions = new Float32Array(9);
              highlightPositions.set([
                tri.transformedVertices.v0[0], tri.transformedVertices.v0[1] + SELECTION_Y_OFFSET, tri.transformedVertices.v0[2],
                tri.transformedVertices.v1[0], tri.transformedVertices.v1[1] + SELECTION_Y_OFFSET, tri.transformedVertices.v1[2],
                tri.transformedVertices.v2[0], tri.transformedVertices.v2[1] + SELECTION_Y_OFFSET, tri.transformedVertices.v2[2]
              ], 0);
              const selectedGeometry = new THREE.BufferGeometry();
              selectedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(highlightPositions, 3));
              selectedGeometry.computeVertexNormals();
              return (
                <group key={faceIndex}>
                  {/* White semi-transparent fill */}
                  <mesh geometry={selectedGeometry} renderOrder={9}>
                    <meshBasicMaterial 
                      color="#ffffff" 
                      transparent={true}
                      opacity={0.33}
                      side={THREE.DoubleSide}
                      depthTest={false}
                      depthWrite={false}
                    />
                  </mesh>
                  {/* Magenta outline */}
                  <lineSegments renderOrder={10}>
                    <edgesGeometry attach="geometry" args={[selectedGeometry]} />
                    <lineBasicMaterial 
                      color="#000" 
                      opacity={0.33}
                      depthTest={false} 
                      depthWrite={false}
                      transparent
                    />
                  </lineSegments>
                </group>
              );
            })
          )}
        </group>
      </group>
    </group>
  );
} 
