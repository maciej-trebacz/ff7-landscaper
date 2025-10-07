import type { CallContext } from "@/components/script/types"
import { NumberSliderUI } from "@/components/script/ui/NumberSliderUI"
import { MapOptionsUI } from "@/components/script/ui/MapOptionsUI"
import { ColorTripleUI } from "@/components/script/ui/ColorTripleUI"
import { EnterFieldUI } from "@/components/script/ui/EnterFieldUI"
import { SetFieldEntryByIdUI } from "@/components/script/ui/SetFieldEntryByIdUI"
import { EntityModelSelectUI } from "@/components/script/ui/EntityModelSelectUI"
import { EntityRotateToModelUI } from "@/components/script/ui/EntityRotateToModelUI"
import { SetMessageUI } from "@/components/script/ui/SetMessageUI"
import { SetDimensionsUI } from "@/components/script/ui/SetDimensionsUI"
import { SetPromptUI } from "@/components/script/ui/SetPromptUI"
import { SetMeshCoordsUI } from "@/components/script/ui/SetMeshCoordsUI"
import { SetCoordsInMeshUI } from "@/components/script/ui/SetCoordsInMeshUI"
import { CallFunctionUI } from "@/components/script/ui/CallFunctionUI"
import { DirectionRadialUI } from "@/components/script/ui/DirectionRadialUI"
import { TriggerBattleUI } from "@/components/script/ui/TriggerBattleUI"
import { PointSetRadiusUI } from "@/components/script/ui/PointSetRadiusUI"

type Renderer = (ctx: CallContext, onBatch: (updates: Array<{ index: number; newText: string }>) => void) => JSX.Element

const registry: Record<string, Renderer> = {
  "Point.set_terrain_color": (ctx, onBatch) => <ColorTripleUI ctx={ctx} onBatch={onBatch} />,
  "Point.set_sky_top_color": (ctx, onBatch) => <ColorTripleUI ctx={ctx} onBatch={onBatch} />,
  "Point.set_sky_bottom_color": (ctx, onBatch) => <ColorTripleUI ctx={ctx} onBatch={onBatch} />,
  "System.set_map_options": (ctx, onBatch) => <MapOptionsUI ctx={ctx} onBatch={onBatch} />,
  "Sound.set_music_volume": (ctx, onBatch) => (
    <NumberSliderUI ctx={ctx} onBatch={onBatch} index={0} labelOverride="Music Volume" />
  ),
  "Entity.set_walk_speed": (ctx, onBatch) => (
    <NumberSliderUI ctx={ctx} onBatch={onBatch} index={0} labelOverride="Walk Speed" />
  ),
  "Entity.set_movespeed": (ctx, onBatch) => (
    <NumberSliderUI ctx={ctx} onBatch={onBatch} index={0} labelOverride="Move Speed" />
  ),
  "System.fade_in": (ctx, onBatch) => (
    <NumberSliderUI ctx={ctx} onBatch={onBatch} index={0} labelOverride="Fade Speed" />
  ),
  "System.fade_out": (ctx, onBatch) => (
    <NumberSliderUI ctx={ctx} onBatch={onBatch} index={0} labelOverride="Fade Speed" />
  ),
  "Camera.set_rotation_speed": (ctx, onBatch) => (
    <NumberSliderUI ctx={ctx} onBatch={onBatch} index={0} labelOverride="Camera Rotation Speed" />
  ),
  "Camera.set_tilt_speed": (ctx, onBatch) => (
    <NumberSliderUI ctx={ctx} onBatch={onBatch} index={0} labelOverride="Camera Tilt Speed" />
  ),
  "Camera.set_zoom_speed": (ctx, onBatch) => (
    <NumberSliderUI ctx={ctx} onBatch={onBatch} index={0} labelOverride="Camera Zoom Speed" />
  ),
  "System.enter_field": (ctx, onBatch) => <EnterFieldUI ctx={ctx} onBatch={onBatch} />,
  "Entity.load_model": (ctx, onBatch) => <EntityModelSelectUI ctx={ctx} onBatch={onBatch} />,
  "Entity.rotate_to_model": (ctx, onBatch) => <EntityRotateToModelUI ctx={ctx} onBatch={onBatch} />,
  "Window.set_message": (ctx, onBatch) => <SetMessageUI ctx={ctx} onBatch={onBatch} />,
  "Window.set_dimensions": (ctx, onBatch) => <SetDimensionsUI ctx={ctx} onBatch={onBatch} />,
  "Window.set_prompt": (ctx, onBatch) => <SetPromptUI ctx={ctx} onBatch={onBatch} />,
  "Entity.set_direction_facing": (ctx, onBatch) => <DirectionRadialUI ctx={ctx} onBatch={onBatch} index={0} />,
  "Entity.set_movement_direction": (ctx, onBatch) => <DirectionRadialUI ctx={ctx} onBatch={onBatch} index={0} />,
  "Entity.set_mesh_coords": (ctx, onBatch) => <SetMeshCoordsUI ctx={ctx} onBatch={onBatch} scope="Entity" />,
  "Point.set_mesh_coords": (ctx, onBatch) => <SetMeshCoordsUI ctx={ctx} onBatch={onBatch} scope="Point" />,
  "Entity.set_coords_in_mesh": (ctx, onBatch) => <SetCoordsInMeshUI ctx={ctx} onBatch={onBatch} />,
  "Point.set_coords_in_mesh": (ctx, onBatch) => <SetCoordsInMeshUI ctx={ctx} onBatch={onBatch} />,
  "System.call_function": (ctx, onBatch) => <CallFunctionUI ctx={ctx} onBatch={onBatch} />,
  "System.set_field_entry_by_id": (ctx, onBatch) => <SetFieldEntryByIdUI ctx={ctx} onBatch={onBatch} />,
  "System.trigger_battle": (ctx, onBatch) => <TriggerBattleUI ctx={ctx} onBatch={onBatch} />,
  "Point.set_radius": (ctx, onBatch) => <PointSetRadiusUI ctx={ctx} onBatch={onBatch} />,
}

export function getCustomRenderer(key: string): Renderer | null {
  return registry[key] ?? null
}

