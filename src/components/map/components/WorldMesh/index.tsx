import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
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
  const [lassoActive, setLassoActive] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number; z: number }[]>([]);
  const [lassoOperation, setLassoOperation] = useState<'replace' | 'add' | 'subtract'>('replace');
  const [pastePreviewTargets, setPastePreviewTargets] = useState<number[]>([]);

  const lassoPointsRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const lassoActiveRef = useRef(false);
  const lassoOperationRef = useRef<'replace' | 'add' | 'subtract'>('replace');

  const wireframeMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const {
    textures,
    worldmap,
    mapType,
    paintingSelectedTriangles,
    togglePaintingSelectedTriangle,
    setTriangleMap,
    paintingMode,
    setPaintingSelectedTriangles,
    lassoClipboard,
    lassoPasteActive,
    lassoPasteRotationDeg,
    applyLassoPaste,
    setLassoPasteActive,
    setLassoPasteRotation,
  } = useMaps();

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
    if (lassoPasteActive) return;
    if (paintingMode === 'lasso') {
      if (mode === 'painting') {
        setLassoActive(true);
        lassoActiveRef.current = true;

        const operation: 'replace' | 'add' | 'subtract' =
          event.altKey
            ? 'subtract'
            : paintingSelectedTriangles.size === 0
              ? 'replace'
              : 'add';

        setLassoOperation(operation);
        lassoOperationRef.current = operation;

        const point = { x: event.point.x, y: event.point.y, z: event.point.z };
        setLassoPoints([point]);
        lassoPointsRef.current = [point];
      }
      return;
    }
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
    if (lassoPasteActive && lassoClipboard && triangleMap) {
      const center = { x: event.point.x, z: event.point.z };

      const rotationRad = (lassoPasteRotationDeg * Math.PI) / 180;
      const cos = Math.cos(rotationRad);
      const sin = Math.sin(rotationRad);

      const centers = triangleMap.map((tri, index) => {
        const cx = (tri.transformedVertices.v0[0] + tri.transformedVertices.v1[0] + tri.transformedVertices.v2[0]) / 3;
        const cz = (tri.transformedVertices.v0[2] + tri.transformedVertices.v1[2] + tri.transformedVertices.v2[2]) / 3;
        return { index, cx, cz };
      });

      const used = new Set<number>();
      const targets: number[] = [];

      lassoClipboard.sourceFaceIndices.forEach(sourceIndex => {
        const sourceCenter = centers[sourceIndex];
        if (!sourceCenter) return;

        const dx = sourceCenter.cx - lassoClipboard.centerX;
        const dz = sourceCenter.cz - lassoClipboard.centerZ;

        const rx = cos * dx - sin * dz;
        const rz = sin * dx + cos * dz;

        const tx = center.x + rx;
        const tz = center.z + rz;

        let bestIndex = -1;
        let bestDistSq = Infinity;

        centers.forEach(c => {
          if (used.has(c.index)) return;
          const ddx = c.cx - tx;
          const ddz = c.cz - tz;
          const distSq = ddx * ddx + ddz * ddz;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestIndex = c.index;
          }
        });

        if (bestIndex !== -1) {
          used.add(bestIndex);
          targets.push(bestIndex);
        }
      });

      setPastePreviewTargets(targets);
      return;
    }
    if (paintingMode === 'lasso') {
      if (!lassoActive) return;
      const point = { x: event.point.x, y: event.point.y, z: event.point.z };
      setLassoPoints(prev => [...prev, point]);
      lassoPointsRef.current.push(point);
      return;
    }
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

  const handlePaintingPointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!lassoActiveRef.current || paintingMode !== 'lasso' || mode !== 'painting') return;
    if (!triangleMap) return;

    const polygon = lassoPointsRef.current;
    if (polygon.length < 3) {
      setLassoActive(false);
      lassoActiveRef.current = false;
      setLassoPoints([]);
      lassoPointsRef.current = [];
      return;
    }

    const containsPoint = (px: number, pz: number) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const zi = polygon[i].z;
        const xj = polygon[j].x;
        const zj = polygon[j].z;
        const intersect = ((zi > pz) !== (zj > pz)) && (px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const lassoSelected = new Set<number>();
    triangleMap.forEach((tri, index) => {
      const cx = (tri.transformedVertices.v0[0] + tri.transformedVertices.v1[0] + tri.transformedVertices.v2[0]) / 3;
      const cz = (tri.transformedVertices.v0[2] + tri.transformedVertices.v1[2] + tri.transformedVertices.v2[2]) / 3;
      if (containsPoint(cx, cz)) {
        lassoSelected.add(index);
      }
    });

    if (lassoSelected.size > 0) {
      if (lassoOperationRef.current === 'replace') {
        setPaintingSelectedTriangles(lassoSelected);
      } else {
        const next = new Set(paintingSelectedTriangles);
        if (lassoOperationRef.current === 'add') {
          lassoSelected.forEach(index => next.add(index));
        } else {
          lassoSelected.forEach(index => next.delete(index));
        }
        setPaintingSelectedTriangles(next);
      }
    }

    setLassoActive(false);
    lassoActiveRef.current = false;
    setLassoPoints([]);
    lassoPointsRef.current = [];
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!lassoPasteActive || mode !== 'painting') return;
      if (event.key !== 'q' && event.key !== 'Q' && event.key !== 'e' && event.key !== 'E') return;

      event.preventDefault();

      const step = 5;
      let next = lassoPasteRotationDeg;
      if (event.key === 'q' || event.key === 'Q') {
        next -= step;
      } else {
        next += step;
      }

      if (next > 180) next -= 360;
      if (next < -180) next += 360;

      setLassoPasteRotation(next);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lassoPasteActive, lassoPasteRotationDeg, mode, setLassoPasteRotation]);

  const handlePaintingClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.button !== 0 || disablePainting) return;
    if (lassoPasteActive) {
      if (pastePreviewTargets.length > 0) {
        applyLassoPaste(pastePreviewTargets);
      }
      setLassoPasteActive(false);
      setPastePreviewTargets([]);
      return;
    }
    if (paintingMode === 'lasso') {
      // Lasso is handled by global pointer up
      return;
    }
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
            onPointerUp={mode === 'painting' ? handlePaintingPointerUp : undefined}
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
          {paintingMode === 'lasso' && lassoPoints.length > 0 && (
            <Line
              points={lassoPoints.map(p => [p.x, p.y + 2, p.z] as [number, number, number])}
              color={lassoOperation === 'subtract' ? '#ff0000' : '#ffff00'}
              lineWidth={3}
              depthTest={false}
            />
          )}
          {lassoPasteActive && pastePreviewTargets.length > 0 && triangleMap && (
            Array.from(new Set(pastePreviewTargets)).map(faceIndex => {
              const tri = triangleMap[faceIndex];
              if (!tri) return null;
              const highlightPositions = new Float32Array(9);
              highlightPositions.set([
                tri.transformedVertices.v0[0], tri.transformedVertices.v0[1] + SELECTION_Y_OFFSET, tri.transformedVertices.v0[2],
                tri.transformedVertices.v1[0], tri.transformedVertices.v1[1] + SELECTION_Y_OFFSET, tri.transformedVertices.v1[2],
                tri.transformedVertices.v2[0], tri.transformedVertices.v2[1] + SELECTION_Y_OFFSET, tri.transformedVertices.v2[2]
              ], 0);
              const previewGeometry = new THREE.BufferGeometry();
              previewGeometry.setAttribute('position', new THREE.Float32BufferAttribute(highlightPositions, 3));
              previewGeometry.computeVertexNormals();
              return (
                <group key={`paste-${faceIndex}`}>
                  <mesh geometry={previewGeometry} renderOrder={8}>
                    <meshBasicMaterial
                      color="#ff8800"
                      transparent={true}
                      opacity={0.4}
                      side={THREE.DoubleSide}
                      depthTest={false}
                      depthWrite={false}
                    />
                  </mesh>
                </group>
              );
            })
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
