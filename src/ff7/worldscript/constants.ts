import { Mnemonic, Opcodes } from "./opcodes";

export const savemapMapping: Record<string, { name: string; type: 'byte' | 'word' }> = {
  '0xBA4': { name: 'game_progress', type: 'word' },
  '0xBF9': { name: 'chocobo_rating_1', type: 'byte' },
  '0xBFA': { name: 'chocobo_rating_2', type: 'byte' },
  '0xBFB': { name: 'chocobo_rating_3', type: 'byte' },
  '0xBFC': { name: 'chocobo_rating_4', type: 'byte' },
  '0xC21': { name: 'own_chocobo_stable', type: 'byte' },
  '0xC22': { name: 'chocobos_on_map', type: 'byte' },
  '0xC23': { name: 'vehicle_display', type: 'byte' },
  '0xC1F': { name: 'weapons_killed', type: 'byte' },
  '0xD73': { name: 'yuffie_flags', type: 'byte' },
  '0xEF4': { name: 'submarine_color_flags', type: 'byte' },
  '0xF2A': { name: 'submarine_flags', type: 'byte' },
};

export const modelsMapping: Record<string, string> = {
  0: 'cloud',
  1: 'tifa',
  2: 'cid',
  3: 'highwind',
  4: 'wild_chocobo',
  5: 'tiny_bronco',
  6: 'buggy',
  7: 'junon_cannon',
  8: 'cargo_ship',
  9: 'highwind_propellers',
  10: 'diamond_weapon',
  11: 'ultima_weapon',
  12: 'fort_condor',
  13: 'submarine',
  14: 'gold_saucer',
  15: 'rocket_town_rocket',
  16: 'rocket_town',
  17: 'sunken_gelnika',
  18: 'underwater_reactor',
  19: 'chocobo',
  20: 'midgar_cannon',
  21: 'unknown_21',
  22: 'unknown_22',
  23: 'unknown_23',
  24: 'north_crater_barrier',
  25: 'ancient_forest',
  26: 'key_of_the_ancients',
  27: 'unused_rocks',
  28: 'red_submarine',
  29: 'ruby_weapon',
  30: 'emerald_weapon',
  65535: 'system'
};

// Variables available under the Special namespace
export const SPECIAL_MAP: { [key: number]: { name: string; type: 'byte' | 'word' | 'bit' } } = {
  0: { name: 'entity_mesh_x_coord', type: 'byte' },
  1: { name: 'entity_mesh_y_coord', type: 'byte' },
  2: { name: 'entity_coord_in_mesh_x', type: 'word' },
  3: { name: 'entity_coord_in_mesh_y', type: 'word' },
  4: { name: 'entity_direction', type: 'byte' },
  5: { name: 'unknown_5', type: 'byte' },
  6: { name: 'last_field_id', type: 'byte' },
  7: { name: 'map_options', type: 'byte' },
  8: { name: 'player_entity_model_id', type: 'byte' },
  9: { name: 'current_chocobo_rating', type: 'byte' },
  10: { name: 'check_if_riding_chocobo', type: 'byte' },
  11: { name: 'battle_result', type: 'bit' },
  12: { name: 'prompt_window_result', type: 'byte' },
  13: { name: 'current_triangle_script_id', type: 'byte' },
  14: { name: 'party_leader_model_id', type: 'byte' },
  15: { name: 'active_entity_model_id', type: 'byte' },
  16: { name: 'random_8bit_number', type: 'byte' },
};

// Opcode IDs for model-related opcodes
export const modelMnemonics = [Mnemonic.DIST_MODEL, Mnemonic.LOAD_MODEL, Mnemonic.SET_ENTITY, Mnemonic.FACE_MODEL, Mnemonic.MOVE_TO_MODEL];
export const modelOpcodes = modelMnemonics.map(mnemonic => Object.entries(Opcodes).find(([_, opcode]) => opcode.mnemonic === mnemonic)?.[1]);

// TODO: These might contain errors, need to check
export const fieldsMapping: Record<string, string> = {
  0: 'other_worldmap',
  1: 'midgar_sector_5_gate',
  2: 'kalm',
  3: 'chocobo_farm',
  4: 'mythril_mines_from_swamp',
  5: 'mythril_mines_from_condor',
  6: 'fort_condor',
  7: 'junon',
  8: 'temple_of_the_ancients',
  9: 'old_mans_house',
  10: 'weapon_seller',
  11: 'mideel',
  12: 'quadra_magic_cave',
  13: 'costa_del_sol',
  14: 'mt_corel',
  15: 'north_corel',
  16: 'corel_desert',
  17: 'gongaga',
  18: 'cosmo_canyon',
  19: 'nibelheim_south',
  20: 'rocket_town_south',
  21: 'lucrecias_cave',
  22: 'hp_mp_cave',
  23: 'plains_outside_wutai',
  24: 'mime_cave',
  25: 'bone_village',
  26: 'corral_valley_cave',
  27: 'icicle_village_south',
  28: 'chocobo_sage_house',
  29: 'knights_of_the_round_cave',
  30: 'underwater_reactor',
  31: 'sunken_gelnika',
  32: 'impaled_zolom',
  33: 'yuffie_encounter',
  34: 'plains_outside_wutai_2',
  35: 'plains_outside_wutai_3',
  36: 'cargo_ship',
  37: 'costa_del_sol_harbor',
  38: 'costa_del_sol_harbor_2',
  39: 'junon_dock',
  40: 'unused_40',
  41: 'unused_41',
  42: 'unused_42',
  43: 'nibelheim_north',
  44: 'mt_nibel_from_rocket_town',
  45: 'unused_45',
  46: 'mt_nibel_from_nibelheim',
  47: 'icicle_village_north',
  48: 'great_glacier',
  49: 'unused_49',
  50: 'highwind_bridge_3',
  51: 'highwind_bridge_4',
  52: 'highwind_bridge_5',
  53: 'diamond_weapon_encounter',
  54: 'unused_54',
  55: 'ancient_forest',
  56: 'submarine_bridge_3',
  57: 'corral_valley',
  58: 'forgotten_capital',
  59: 'highwind_deck',
  60: 'gaeas_cliff_base',
  61: 'great_glacier_2',
  62: 'great_glacier_3',
  63: 'great_glacier_4',
  64: 'great_glacier_5'
};

export const enumMaps: Record<string, { namespace: string, mapping: Record<number, string> }> = {
  'Special.player_entity_model_id': {
    namespace: 'Entities',
    mapping: modelsMapping
  },
};

// System script short names - common function IDs with readable names
export const systemScriptNames: Record<number, string> = {
  0: 'init',
  // 1: 'unload',  // this seems to be exit but testing didn't confirm that
  2: 'update',
  6: 'highwind_menu',
  7: 'zolom_touched',
  9: 'crater_landing',
};

// Model script short names - common function IDs with readable names  
export const modelScriptNames: Record<number, string> = {
  0: 'init',
  1: 'unload',
  2: 'update',
  3: 'touch',
  4: 'interact',
  5: 'disembark',
};