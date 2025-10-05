import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stats, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { Triangle } from '@/ff7/mapfile';
import { TriangleWithVertices } from '@/components/map/types';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PerspectiveCamera as ThreePerspectiveCamera, OrthographicCamera as ThreeOrthographicCamera, Vector3 } from 'three';
import { RenderingMode } from './types';
import { CAMERA_HEIGHT, MESH_SIZE, SCALE, SHOW_DEBUG } from './constants';
import { CameraDebugInfo, CameraDebugOverlay } from './components/DebugOverlay';
import { MapControls } from './components/MapControls';
import { WorldMesh } from './components/WorldMesh';
import { useMaps, MapType, MapMode, dimensions, MESHES_IN_ROW, MESHES_IN_COLUMN } from '@/hooks/useMaps';
import ModelOverlay from './ModelOverlay';

interface MapViewerProps { 
  renderingMode?: RenderingMode,
  onTriangleSelect?: (triangle: Triangle | null) => void,
  isLoading?: boolean,
  showGrid?: boolean,
  cameraType?: 'perspective' | 'orthographic',
  wireframe?: boolean,
  showNormals?: boolean,
  onWireframeToggle?: (checked: boolean) => void,
  onGridToggle?: (checked: boolean) => void,
  onNormalsToggle?: (checked: boolean) => void,
  onRenderingModeChange?: (mode: RenderingMode) => void,
  onMapTypeChange?: (type: MapType) => void,
  onModeChange?: (mode: MapMode) => void,
  enabledAlternatives: number[],
  onAlternativesChange: (ids: number[]) => void,
}

function MapViewer({ 
  renderingMode = "terrain", 
  onTriangleSelect, 
  isLoading: externalIsLoading,
  showGrid = false,
  cameraType = "perspective",
  wireframe = false,
  showNormals = false,
  onWireframeToggle,
  onGridToggle,
  onNormalsToggle,
  onRenderingModeChange,
  onMapTypeChange,
  onModeChange,
  enabledAlternatives,
  onAlternativesChange
}: MapViewerProps) {
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [rotation, setRotation] = useState(0);
  const [showModels, setShowModels] = useState(true);
  const [localRenderingMode, setLocalRenderingMode] = useState<RenderingMode>(renderingMode);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const perspectiveCameraRef = useRef<ThreePerspectiveCamera>(null);
  const orthographicCameraRef = useRef<ThreeOrthographicCamera>(null);
  const { worldmap, mapType, mapId, mode, setSelectedTriangle } = useMaps();
  const zoomRef = useRef(1);
  const currentCameraRef = useRef<ThreePerspectiveCamera | ThreeOrthographicCamera | null>(null);
  const updateWireframeOpacityRef = useRef<((cameraHeight: number) => void) | null>(null);

  // Store camera state for seamless switching between camera types
  const cameraStateRef = useRef({
    position: new Vector3(),
    target: new Vector3(),
    zoom: 1
  });
  const previousCameraTypeRef = useRef(cameraType);

  // Update local rendering mode when prop changes
  useEffect(() => {
    setLocalRenderingMode(renderingMode);
  }, [renderingMode]);

  // Handle rendering mode changes
  const handleRenderingModeChange = (mode: RenderingMode) => {
    setLocalRenderingMode(mode);
    if (onRenderingModeChange) {
      onRenderingModeChange(mode);
    }
  };

  useEffect(() => {
    if (!onTriangleSelect) {
      setSelectedFaceIndex(null);
    }
  }, [onTriangleSelect]);

  const handleTriangleSelect = useCallback((triangle: TriangleWithVertices | null, faceIndex: number | null) => {
    setSelectedFaceIndex(faceIndex);
    setSelectedTriangle(faceIndex);
    if (onTriangleSelect) {
      onTriangleSelect(triangle);
    }
  }, [onTriangleSelect, setSelectedTriangle]);

  const handleRotate = (direction: 'left' | 'right') => {
    const rotationAngle = (Math.PI / 8) * (direction === 'left' ? 1 : -1);
    setRotation(prev => prev + rotationAngle);
  };

  const handleWireframeOpacityUpdate = useCallback((updateFn: (cameraHeight: number) => void) => {
    updateWireframeOpacityRef.current = updateFn;
  }, []);

  // Calculate map dimensions based on mapType only, not worldmap data
  // This prevents unnecessary view resets when alternatives are toggled
  const mapDimensions = useMemo(() => {
    const mapInfo = dimensions[mapType];
    const sizeZ = mapInfo.vertical * MESHES_IN_ROW * MESH_SIZE * SCALE;
    const sizeX = mapInfo.horizontal * MESHES_IN_COLUMN * MESH_SIZE * SCALE;
    
    return {
      width: sizeX,
      height: sizeZ,
      center: {
        x: sizeX / 2,
        y: 0,
        z: sizeZ / 2
      }
    };
  }, [mapType]);

  // Camera configuration
  const perspectiveConfig = useMemo(() => {
    const position = [
      mapDimensions.center.x,
      CAMERA_HEIGHT[mapType],
      mapDimensions.center.z
    ] as [number, number, number];
  
    return {
      position,
      fov:    60,
      near:   0.1,
      far:    1000000
    };
  }, [mapDimensions, mapType]);

  const camera = cameraType === 'perspective' ? perspectiveCameraRef.current : orthographicCameraRef.current;
  
  // Store current camera state before switching
  const storeCameraState = () => {
    const currentCamera = previousCameraTypeRef.current === 'perspective' 
      ? perspectiveCameraRef.current 
      : orthographicCameraRef.current;
    
    if (currentCamera && controlsRef.current) {
      cameraStateRef.current.position.copy(currentCamera.position);
      cameraStateRef.current.target.copy(controlsRef.current.target);
      
      if (currentCamera instanceof ThreeOrthographicCamera) {
        cameraStateRef.current.zoom = currentCamera.zoom;
      } else if (currentCamera instanceof ThreePerspectiveCamera) {
        // For perspective camera, calculate zoom based on camera distance
        const distance = currentCamera.position.y;
        cameraStateRef.current.zoom = CAMERA_HEIGHT[mapType] / distance;
      }
    }
  };

  // Restore camera state after switching
  const restoreCameraState = () => {
    const newCamera = cameraType === 'perspective' 
      ? perspectiveCameraRef.current 
      : orthographicCameraRef.current;
    
    if (newCamera && controlsRef.current && cameraStateRef.current) {
      newCamera.position.copy(cameraStateRef.current.position);
      newCamera.up.set(0, 1, 0);
      newCamera.lookAt(cameraStateRef.current.target);
      
      if (newCamera instanceof ThreeOrthographicCamera) {
        newCamera.zoom = cameraStateRef.current.zoom;
        newCamera.updateProjectionMatrix();
      } else if (newCamera instanceof ThreePerspectiveCamera) {
        // For perspective camera, adjust position based on stored zoom
        const targetDistance = CAMERA_HEIGHT[mapType] / cameraStateRef.current.zoom;
        const direction = new Vector3().subVectors(newCamera.position, cameraStateRef.current.target).normalize();
        newCamera.position.copy(cameraStateRef.current.target).add(direction.multiplyScalar(targetDistance));
        newCamera.up.set(0, 1, 0);
        newCamera.lookAt(cameraStateRef.current.target);
      }
      
      controlsRef.current.object = newCamera;
      controlsRef.current.target.copy(cameraStateRef.current.target);
      controlsRef.current.update();
    }
  };

  // Handle camera type switching to preserve state
  useEffect(() => {
    if (previousCameraTypeRef.current !== cameraType && mapDimensions.width) {
      storeCameraState();
      
      // Small delay to allow new camera to be created
      const timer = setTimeout(() => {
        restoreCameraState();
        previousCameraTypeRef.current = cameraType;
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [cameraType, mapDimensions]);

  const resetCameraAndControls = () => {
    if (!camera || !mapDimensions.width) return;
    // Reset rotation
    setRotation(0);
    // Reset camera position and orientation
    camera.position.set(mapDimensions.center.x, CAMERA_HEIGHT[mapType], mapDimensions.center.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(mapDimensions.center.x, 0, mapDimensions.center.z);
    if (cameraType === 'orthographic' && camera instanceof ThreeOrthographicCamera) {
      const margin = 50;
      const halfWidth = mapDimensions.width / 2 + margin;
      const halfHeight = mapDimensions.height / 2 + margin;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.zoom = 1;
    }
    camera.updateProjectionMatrix();

    // Reset controls
    if (controlsRef.current) {
      controlsRef.current.object = camera;
      controlsRef.current.target.set(mapDimensions.center.x, 0, mapDimensions.center.z);
      controlsRef.current.update();
    }

    // Update stored camera state to match reset
    cameraStateRef.current.position.set(mapDimensions.center.x, CAMERA_HEIGHT[mapType], mapDimensions.center.z);
    cameraStateRef.current.target.set(mapDimensions.center.x, 0, mapDimensions.center.z);
    cameraStateRef.current.zoom = 1;
  };

  // New resetView handler that wraps the helper and sets view centered
  const resetView = () => {
    resetCameraAndControls();
  };

  // Initial camera setup to ensure correct orientation from the start
  useEffect(() => {
    if (mapDimensions.width && camera) {
      // Set initial camera orientation immediately
      camera.position.set(mapDimensions.center.x, CAMERA_HEIGHT[mapType], mapDimensions.center.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(mapDimensions.center.x, 0, mapDimensions.center.z);
      camera.updateProjectionMatrix();
      
      // Set initial controls target
      if (controlsRef.current) {
        controlsRef.current.target.set(mapDimensions.center.x, 0, mapDimensions.center.z);
        controlsRef.current.update();
      }
    }
  }, [mapDimensions, mapType, camera]);

  // Reset view only when mapType changes or new map is loaded (mapId changes)
  // Don't reset when alternatives are toggled as they don't change map dimensions
  useEffect(() => {
    if (mapDimensions.width) {
      const timer = setTimeout(() => {
        resetView();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapType, mapId]);

  // Ensure top-down, unskewed view when entering export mode with orthographic camera
  useEffect(() => {
    if (mode === 'export' && cameraType === 'orthographic' && mapDimensions.width) {
      const timer = setTimeout(() => {
        const orthoCam = orthographicCameraRef.current;
        const controls = controlsRef.current;
        if (orthoCam && controls) {
          const target = controls.target.clone();
          const preservedZoom = orthoCam.zoom;

          // Reposition camera directly above target and reset roll/pitch/yaw
          orthoCam.position.set(target.x, orthoCam.position.y, target.z);
          orthoCam.up.set(0, 1, 0);
          orthoCam.lookAt(target);
          orthoCam.zoom = preservedZoom;
          orthoCam.updateProjectionMatrix();

          controls.object = orthoCam;
          controls.target.copy(target);
          controls.update();

          cameraStateRef.current.position.copy(orthoCam.position);
          cameraStateRef.current.target.copy(target);
          cameraStateRef.current.zoom = preservedZoom;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [mode, cameraType, mapDimensions.width]);

  const orthoBase = useMemo(() => ({
    position: [
      mapDimensions.center.x,
      CAMERA_HEIGHT[mapType],
      mapDimensions.center.z
    ] as [number, number, number],
    near: -1000,
    far: 100000,
    zoom: 1
  }), [mapDimensions, mapType]);

  function AutoOrtho({ mapDimensions, margin = 50 }: { mapDimensions: any; margin?: number }) {
    const { camera, viewport } = useThree();
    useEffect(() => {
      if (!(camera instanceof ThreeOrthographicCamera)) return;
      const halfH = mapDimensions.height / 2 + margin;
      const halfW = halfH * viewport.aspect;
      camera.top    =  halfH;
      camera.bottom = -halfH;
      camera.left   = -halfW;
      camera.right  =  halfW;
      camera.updateProjectionMatrix();
    }, [viewport.aspect, mapDimensions, margin, camera]);
    return null;
  }

  const isLoading = externalIsLoading;

  // Grid should be visible in export mode regardless of toggle state
  const shouldShowGrid = showGrid || mode === 'export';

  return (
    <div className="relative flex flex-col w-full h-full">
      <MapControls 
        onRotate={handleRotate} 
        onReset={resetView}
        wireframe={wireframe}
        onWireframeToggle={onWireframeToggle}
        showGrid={showGrid}
        onGridToggle={onGridToggle}
        showModels={showModels}
        onModelsToggle={() => setShowModels(prev => !prev)}
        showNormals={showNormals}
        onNormalsToggle={onNormalsToggle}
        renderingMode={localRenderingMode}
        onRenderingModeChange={handleRenderingModeChange}
        mapType={mapType}
        onMapTypeChange={onMapTypeChange}
        mode={mode}
        onModeChange={onModeChange}
        enabledAlternatives={enabledAlternatives}
        onAlternativesChange={onAlternativesChange}
      />

      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-lg text-muted-foreground">Loading map...</div>
          </div>
        )}

        <Canvas style={{ width: '100%', height: '100%' }}>
          {cameraType === 'perspective' ? (
            <PerspectiveCamera
              makeDefault
              {...perspectiveConfig}
              ref={perspectiveCameraRef}
              onUpdate={(self) => {
                self.up.set(0, 1, 0);
                self.lookAt(mapDimensions.center.x, 0, mapDimensions.center.z);
                currentCameraRef.current = self;
              }}
            />
          ) : (
            <>
              <OrthographicCamera
                makeDefault
                {...orthoBase}
                ref={orthographicCameraRef}
                onUpdate={(self) => {
                  self.up.set(0, 1, 0);
                  self.lookAt(mapDimensions.center.x, 0, mapDimensions.center.z);
                  currentCameraRef.current = self;
                }}
              />
              <AutoOrtho mapDimensions={mapDimensions} margin={50} />
            </>
          )}
          {SHOW_DEBUG && <Stats />}
          {SHOW_DEBUG && <CameraDebugInfo onDebugInfo={setDebugInfo} />}
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[20000, 40000, 20000]}
            intensity={1.0}
            castShadow
          />
          <OrbitControls
            ref={controlsRef}
            target={[mapDimensions.center.x, 0, mapDimensions.center.z]}
            enableDamping={false}
            makeDefault
            enableRotate={!['export', 'painting'].includes(mode)}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2}
            onChange={() => {
              if (camera) {
                if (cameraType === 'orthographic' && camera instanceof ThreeOrthographicCamera) {
                  zoomRef.current = camera.zoom;
                } else if (camera instanceof ThreePerspectiveCamera) {
                  // For perspective camera, calculate zoom based on camera distance
                  const distance = camera.position.y;
                  zoomRef.current = CAMERA_HEIGHT[mapType] / distance;
                }
                // Update wireframe opacity based on camera height
                if (updateWireframeOpacityRef.current) {
                  updateWireframeOpacityRef.current(camera.position.y);
                }
              }
            }}
          />
          {worldmap && !isLoading && (
            <WorldMesh
              renderingMode={localRenderingMode}
              onTriangleSelect={handleTriangleSelect}
              selectedFaceIndex={selectedFaceIndex}
              debugCanvasRef={debugCanvasRef}
              mapCenter={mapDimensions.center}
              rotation={rotation}
              showGrid={shouldShowGrid}
              wireframe={wireframe}
              showNormals={showNormals}
              mode={mode}
              onWireframeOpacityUpdate={handleWireframeOpacityUpdate}
            />
          )}
          {showModels && <ModelOverlay zoomRef={zoomRef} />}
        </Canvas>
        {SHOW_DEBUG && <CameraDebugOverlay debugInfo={debugInfo} />}
      </div>
    </div>
  );
}

export default MapViewer; 
