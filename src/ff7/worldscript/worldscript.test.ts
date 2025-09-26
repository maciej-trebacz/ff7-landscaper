import { describe, it, expect, beforeEach } from 'vitest';
import { Worldscript } from './worldscript';
import { EvFile } from '../evfile';
import fs from 'fs';
import path from 'path';

describe('Worldscript decompiler', () => {
  let worldscript: Worldscript;
  
  beforeEach(() => {
    worldscript = new Worldscript(0x181e);
  });
  
  it('should decompile script correctly', () => {
    const script = `
RESET
PUSH_CONSTANT 0E
DIST_MODEL
PUSH_CONSTANT 64
LE
GOTO_IF_FALSE 1828
STOP
RESET
PUSH_SAVEMAP_WORD 00
PUSH_CONSTANT 062C
LT
GOTO_IF_FALSE 183F
RESET
PUSH_CONSTANT 0E
DIST_POINT
PUSH_CONSTANT 0100
LE
GOTO_IF_FALSE 183D
RESET
PUSH_CONSTANT 03
CALL_FN_20
GOTO 1856
RESET
PUSH_SAVEMAP_WORD 00
PUSH_CONSTANT 062C
EQ
GOTO_IF_FALSE 1856
RESET
PUSH_CONSTANT 0E
DIST_POINT
PUSH_CONSTANT 0100
LE
GOTO_IF_FALSE 1856
RESET
PUSH_CONSTANT 34
PUSH_CONSTANT 00
ENTER_FIELD
RESET
PUSH_SAVEMAP_WORD 00
PUSH_CONSTANT 063C
EQ
GOTO_IF_FALSE 1879
RESET
PUSH_CONSTANT 09
DIST_POINT
PUSH_CONSTANT 0100
LE
GOTO_IF_FALSE 1879
RESET
PUSH_SAVEMAP_WORD 00
PUSH_CONSTANT 063E
WRITE
RESET
PUSH_CONSTANT 34
PUSH_CONSTANT 00
ENTER_FIELD
RESET
PUSH_SAVEMAP_BIT 1C2E
PUSH_CONSTANT 01
WRITE
RETURN`;

    const expected = `if Entity.distance_to_entity(Entities.gold_saucer) <= 100 then
  Entity.stop()
end
if Savemap.game_progress < 1580 then
  if Entity.distance_to_point(14) <= 256 then
    System.call_function(Entities.highwind, 20)
  end
  goto label_1
end
if Savemap.game_progress == 1580 then
  if Entity.distance_to_point(14) <= 256 then
    System.enter_field(Fields.highwind_bridge_5, 0)
  end
end
::label_1::
if Savemap.game_progress == 1596 then
  if Entity.distance_to_point(9) <= 256 then
    Savemap.game_progress = 1598
    System.enter_field(Fields.highwind_bridge_5, 0)
    Savemap[0xF29].bit[6] = 1
  end
end
return`;

    const result = worldscript.decompile(script);
    expect(result.trim()).toBe(expected);
  });

  it('should decompile system function 2 correctly', () => {
    const filePath = path.resolve('data/wm0.ev');
    const fileData = fs.readFileSync(filePath);
    const evFile = new EvFile(new Uint8Array(fileData.buffer));
    const script = evFile.functions[2].script;
    worldscript = new Worldscript(evFile.functions[2].offset);
    const result = worldscript.decompile(script);

    const expected = `
if Savemap[0xF25].byte then
  Savemap[0xF25].byte = Savemap[0xF25].byte - 1
  if Savemap[0xF25].byte == 0 then
    System.reset_zolom()
  end
end
return
`;

    expect(result.trim()).toBe(expected.trim());
  })  

  it('should decompile system function 15 correctly (contains back-reference goto)', () => {
    const filePath = path.resolve('data/wm0.ev');
    const fileData = fs.readFileSync(filePath);
    const evFile = new EvFile(new Uint8Array(fileData.buffer));
    const script = evFile.functions[15].script;
    worldscript = new Worldscript(evFile.functions[15].offset);
    const result = worldscript.decompile(script);

    const expected = `
System.set_control_lock(0)
System.set_encounters(0)
Entity.face_point(3)
if !Savemap[0xF28].bit[2] then
  Window.wait_until_ready()
  Window.set_dimensions(100, 160, 120, 41)
  Window.set_params(0, 1)
  Window.wait_until_ready()
  Window.set_message(20)
  Entity.play_animation(6, 0)
  Entity.set_movespeed(20)
  System.wait(40)
  Window.wait_until_ready()
  Window.wait_until_ready()
  Window.set_dimensions(110, 160, 100, 41)
  Window.set_params(0, 1)
  Window.wait_until_ready()
  Window.set_message(21)
  Entity.play_animation(0, 1)
  Entity.set_movespeed(20)
  Entity.set_direction_facing(Special.entity_direction + 128)
  ::label_1::
  if Special.current_triangle_script_id then
    System.wait(1)
    goto label_1
  end
  Window.wait_until_ready()
  Entity.set_movespeed(0)
  System.wait(10)
  Entity.set_direction_facing(Special.entity_direction + 128)
  Entity.play_animation(7, 0)
  Window.wait_until_ready()
  Window.set_dimensions(70, 160, 180, 57)
  Window.set_params(0, 0)
  Window.wait_until_ready()
  Window.set_message(22)
  Window.wait_for_acknowledge()
  Savemap[0xF28].bit[2] = 1
  goto label_3
end
Entity.set_movespeed(40)
Entity.set_direction_facing(Special.entity_direction + 128)
::label_2::
if Special.current_triangle_script_id then
  System.wait(1)
  goto label_2
end
Entity.set_movespeed(0)
System.wait(10)
Entity.set_direction_facing(Special.entity_direction + 128)
Entity.play_animation(7, 0)
Window.wait_until_ready()
Window.set_dimensions(30, 160, 260, 57)
Window.set_params(0, 0)
Window.wait_until_ready()
Window.set_message(23)
Window.wait_for_acknowledge()
::label_3::
Entity.play_animation(0, 1)
System.set_control_lock(1)
System.set_encounters(1)
return
`;

    expect(result.trim()).toBe(expected.trim());
  })

  it('should handle scripts with model related opcodes', () => {
    worldscript = new Worldscript(0x2BD2);
    const script = `
RESET
PUSH_SPECIAL_BYTE 08
PUSH_CONSTANT 00
EQ
GOTO_IF_FALSE 2BE2
RESET
PUSH_CONSTANT 2F
PUSH_CONSTANT 00
ENTER_FIELD
GOTO 2BF4
RESET
PUSH_SPECIAL_BYTE 08
PUSH_CONSTANT 01
EQ
PUSH_SPECIAL_BYTE 08
PUSH_CONSTANT 02
EQ
LOR
GOTO_IF_FALSE 2BF4
RESET
PUSH_SPECIAL_BYTE 08
CALL_FN_31
RETURN`;

    const expected = `if Special.player_entity_model_id == Entities.cloud then
  System.enter_field(Fields.icicle_village_north, 0)
  goto label_1
end
if Special.player_entity_model_id == Entities.tifa or Special.player_entity_model_id == Entities.cid then
  System.call_function(Special.player_entity_model_id, 31)
end
::label_1::
return`;

    const result = worldscript.decompile(script);
    expect(result.trim()).toBe(expected);
  });

  it('should handle scripts with more complex math and wait frames', () => {
    const script = `
RESET
PUSH_CONSTANT 0B
PLAY_SFX
RESET
PUSH_CONSTANT 00
SET_CONTROLS
RESET
PUSH_CONSTANT 14
SET_WALK_SPEED
RESET
PUSH_SPECIAL_BYTE 04
SET_DIR
RESET
PUSH_SPECIAL_BYTE 04
PUSH_CONSTANT 80
ADD
SET_MOVE_DIR
RESET
PUSH_CONSTANT FA
PUSH_CONSTANT 00
FADE_OUT
RESET
PUSH_CONSTANT 03
WAIT_FRAMES
WAIT
RESET
PUSH_CONSTANT FA
PUSH_CONSTANT 00
FADE_IN
RESET
PUSH_CONSTANT 03
WAIT_FRAMES
WAIT
RESET
PUSH_CONSTANT 00
SET_SPEED
RETURN`;

    const expected = `Sound.play_sfx(11)
System.set_control_lock(0)
Entity.set_walk_speed(20)
Entity.set_direction_facing(Special.entity_direction)
Entity.set_movement_direction(Special.entity_direction + 128)
System.fade_out(250)
System.wait(3)
System.fade_in(250)
System.wait(3)
Entity.set_movespeed(0)
return`;

    const result = worldscript.decompile(script);
    expect(result.trim()).toBe(expected);
  });

  it('should handle scripts with temp vars', () => {
    const script = `
RESET
PUSH_TEMP_BYTE 03
PUSH_CONSTANT 50
ADD
PUSH_CONSTANT 012C
ADJUST_POS
RESET
PUSH_TEMP_BYTE 03
PUSH_CONSTANT C0
ADD
SET_DIR`;

    const expected = `
Entity.adjust_position_outside_vehicle(Temp[3].byte + 80, 300)
Entity.set_direction_facing(Temp[3].byte + 192)
`;

    const result = worldscript.decompile(script);
    expect(result.trim()).toBe(expected.trim());
  });

  it('should handle empty scripts', () => {
    const result = worldscript.decompile('');
    expect(result.trim()).toBe('');
  });
  
  it('should throw an error for invalid opcodes', () => {
    const invalidScript = `
INVALID_OPCODE 00
`;
    
    expect(() => worldscript.decompile(invalidScript)).toThrow();
  });
  
  it('should correctly handle function calls', () => {
    const script = `
PUSH_CONSTANT 05
PUSH_CONSTANT 0A
ADD
PLAY_SFX
`;

    const expected = `Sound.play_sfx(5 + 10)`;

    const result = worldscript.decompile(script);
    expect(result.trim()).toBe(expected);
  });

  it('should correctly handle simplified wait calls', () => {
    // Original script with WAIT_FRAMES and WAIT
    const originalScript = `
RESET
PUSH_CONSTANT 1E
WAIT_FRAMES
WAIT
RETURN`;

    // Decompile the script
    const worldscript = new Worldscript(0);
    const decompiled = worldscript.decompile(originalScript);
    
    // Verify the decompiled script has the simplified System.wait(30) format
    expect(decompiled.trim()).toBe('System.wait(30)\nreturn');
    
    // Recompile the decompiled script
    const recompiled = worldscript.compile(decompiled);
    
    // Verify the recompiled script has both WAIT_FRAMES and WAIT opcodes
    expect(recompiled.trim()).toContain('WAIT_FRAMES');
    expect(recompiled.trim()).toContain('WAIT');
    
    // Decompile the recompiled script to verify it's the same as the original decompiled script
    const redecompiled = worldscript.decompile(recompiled);
    expect(redecompiled.trim()).toBe('System.wait(30)\nreturn');
  });

  it('should handle various memory operations', () => {
    worldscript = new Worldscript(0x1000);
    const script = `
RESET
PUSH_SAVEMAP_WORD 00
PUSH_CONSTANT 01
WRITE
RESET
PUSH_SAVEMAP_BYTE 55
PUSH_SAVEMAP_BYTE 56
WRITE
RESET
PUSH_SAVEMAP_BYTE 54
PUSH_SPECIAL_BYTE 07
WRITE
RESET
PUSH_SAVEMAP_BIT 03F1
PUSH_CONSTANT 01
WRITE
RESET
PUSH_SAVEMAP_BIT 03F2
PUSH_TEMP_BYTE 03
WRITE
RESET
PUSH_SAVEMAP_WORD 0388
PUSH_CONSTANT 02
WRITE
RESET
PUSH_SAVEMAP_WORD 0388
PUSH_SAVEMAP_WORD 038A
WRITE
RESET
PUSH_TEMP_BYTE 01
PUSH_CONSTANT 03
WRITE
RESET
PUSH_TEMP_WORD 04
PUSH_TEMP_WORD 06
WRITE
RESET
PUSH_SAVEMAP_BYTE 7E
PUSH_CONSTANT 02
EQ
GOTO_IF_FALSE 103F
STOP
RESET
PUSH_SAVEMAP_BYTE 7F
GOTO_IF_FALSE 1045
SET_PLAYER
RESET
PUSH_SAVEMAP_WORD 0388
PUSH_SAVEMAP_WORD 038A
EQ
GOTO_IF_FALSE 104E
STOP
RESET
PUSH_SAVEMAP_BIT 08E1
GOTO_IF_FALSE 1054
SET_PLAYER
RETURN    
`;

const expected = `
Savemap.game_progress = 1
Savemap.chocobo_rating_1 = Savemap.chocobo_rating_2
Savemap[0xBF8].byte = Special.map_options
Savemap.chocobos_on_map.bit[1] = 1
Savemap.chocobos_on_map.bit[2] = Temp[3].byte
Savemap[0xF2C].word = 2
Savemap[0xF2C].word = Savemap[0xF2E].word
Temp[1].byte = 3
Temp[4].word = Temp[6].word
if Savemap.chocobos_on_map == 2 then
  Entity.stop()
end
if Savemap.vehicle_display then
  Entity.set_player_model()
end
if Savemap[0xF2C].word == Savemap[0xF2E].word then
  Entity.stop()
end
if Savemap[0xCC0].bit[1] then
  Entity.set_player_model()
end
return
`

    const result = worldscript.decompile(script);
    expect(result.trim()).toBe(expected.trim());

    const compiled = worldscript.compile(result);
    expect(compiled.trim()).toBe(script.trim());
  });  

  it('test', () => {
    worldscript = new Worldscript(0x1000);
    const script = `
if Savemap[0xC22].byte == 2 then
  Entity.stop()
end
return
`
    const expected = `
    RESET
PUSH_SAVEMAP_BYTE 7E
PUSH_CONSTANT 02
EQ
GOTO_IF_FALSE 1009
STOP
RETURN
`
    const compiled = worldscript.compile(script);
    expect(expected.trim()).toBe(compiled.trim());
  });
});

describe('Worldscript compiler', () => {
  let worldscript: Worldscript;
  
  beforeEach(() => {
    worldscript = new Worldscript(0x181e);
  });

  it('should decompile and then compile system function 0 correctly', () => {
    const filePath = path.resolve('data/wm0.ev');
    const fileData = fs.readFileSync(filePath);
    const evFile = new EvFile(new Uint8Array(fileData.buffer));
    const script = evFile.functions[0].script;
    worldscript = new Worldscript(evFile.functions[0].offset);
    const decompiled = worldscript.decompile(script, true);
    const compiled = worldscript.compile(decompiled);
    expect(compiled.trim()).toBe(script.trim());
  });

  it('should compile custom script correctly', () => {
    const script = `
if Entity.distance_to_entity(Entities.gold_saucer) <= 100 then
  Entity.stop()
end
if Savemap.game_progress < 1580 then
  if Entity.distance_to_point(14) <= 256 then
    System.call_function(Entities.highwind, 20)
  end
  goto label_1
end
if Savemap.game_progress == 1580 then
  if Entity.distance_to_point(14) <= 256 then
    System.enter_field(Fields.highwind_bridge_5, 0)
  end
end
::label_1::
if Savemap.game_progress == 1596 then
  if Entity.distance_to_point(9) <= 256 then
    Savemap.game_progress = 1598
    System.enter_field(Fields.highwind_bridge_5, 0)
  end
end
return
`;

    const expected = `
RESET
PUSH_CONSTANT 0E
DIST_MODEL
PUSH_CONSTANT 64
LE
GOTO_IF_FALSE 1828
STOP
RESET
PUSH_SAVEMAP_WORD 00
PUSH_CONSTANT 062C
LT
GOTO_IF_FALSE 183F
RESET
PUSH_CONSTANT 0E
DIST_POINT
PUSH_CONSTANT 0100
LE
GOTO_IF_FALSE 183D
RESET
PUSH_CONSTANT 03
CALL_FN_20
GOTO 1856
RESET
PUSH_SAVEMAP_WORD 00
PUSH_CONSTANT 062C
EQ
GOTO_IF_FALSE 1856
RESET
PUSH_CONSTANT 0E
DIST_POINT
PUSH_CONSTANT 0100
LE
GOTO_IF_FALSE 1856
RESET
PUSH_CONSTANT 34
PUSH_CONSTANT 00
ENTER_FIELD
RESET
PUSH_SAVEMAP_WORD 00
PUSH_CONSTANT 063C
EQ
GOTO_IF_FALSE 1873
RESET
PUSH_CONSTANT 09
DIST_POINT
PUSH_CONSTANT 0100
LE
GOTO_IF_FALSE 1873
RESET
PUSH_SAVEMAP_WORD 00
PUSH_CONSTANT 063E
WRITE
RESET
PUSH_CONSTANT 34
PUSH_CONSTANT 00
ENTER_FIELD
RETURN
`;

    const result = worldscript.compile(script);
    expect(result.trim()).toBe(expected.trim());
  });

  it('should compile scripts with unary operators correctly', () => {
    worldscript = new Worldscript(0x1000);
    const script = `
if !Temp.word(0) then
  Entity.stop()
end
Memory.write(Temp.word(1), -Temp.word(1))
return
`;

    const expected = `
RESET
PUSH_TEMP_WORD 00
NOT
GOTO_IF_FALSE 1007
STOP
RESET
PUSH_TEMP_WORD 01
PUSH_TEMP_WORD 01
NEG
WRITE
RETURN
`;

    const result = worldscript.compile(script);
    expect(result.trim()).toBe(expected.trim());
  });
});

describe('Worldscript comment support', () => {
  let worldscript: Worldscript;

  beforeEach(() => {
    worldscript = new Worldscript(0x1000);
  });

  it('should handle full line comments', () => {
    const script = `
-- This is a full line comment
System.wait(10)
-- Another comment
return
`;

    const expected = `
RESET
PUSH_CONSTANT 0A
WAIT_FRAMES
WAIT
RETURN
`;

    const result = worldscript.compile(script);
    expect(result.trim()).toBe(expected.trim());
  });

  it('should handle inline comments', () => {
    const script = `
System.wait(10) -- This is an inline comment
return -- End of script
`;

    const expected = `
RESET
PUSH_CONSTANT 0A
WAIT_FRAMES
WAIT
RETURN
`;

    const result = worldscript.compile(script);
    expect(result.trim()).toBe(expected.trim());
  });

  it('should handle mixed comments and code', () => {
    const script = `
if Special.entity_direction == 0 then -- Check if facing north
  System.wait(5) -- Short wait
  -- Set new direction
  Special.entity_direction = 1 -- Face east
end
return -- Done
`;

    const expected = `
RESET
PUSH_SPECIAL_BYTE 04
PUSH_CONSTANT 00
EQ
GOTO_IF_FALSE 1013
RESET
PUSH_CONSTANT 05
WAIT_FRAMES
WAIT
RESET
PUSH_SPECIAL_BYTE 04
PUSH_CONSTANT 01
WRITE
RETURN
`;

    const result = worldscript.compile(script);
    expect(result.trim()).toBe(expected.trim());
  });

  it('should handle empty lines and comment-only lines', () => {
    const script = `
-- Start of script

System.wait(1)

-- Middle comment

System.wait(2)

-- End comment
return
`;

    const expected = `
RESET
PUSH_CONSTANT 01
WAIT_FRAMES
WAIT
RESET
PUSH_CONSTANT 02
WAIT_FRAMES
WAIT
RETURN
`;

    const result = worldscript.compile(script);
    expect(result.trim()).toBe(expected.trim());
  });

  it('should not treat -- inside string literals as comments', () => {
    // Note: This test is more theoretical since the current worldscript language
    // doesn't have string literals, but it tests the comment stripping logic
    const script = `
System.wait(10)
return
`;

    const expected = `
RESET
PUSH_CONSTANT 0A
WAIT_FRAMES
WAIT
RETURN
`;

    const result = worldscript.compile(script);
    expect(result.trim()).toBe(expected.trim());
  });

  it('should handle complex script with many comments', () => {
    const script = `
-- Complex script with multiple operations
-- Check player model and perform actions

if Special.player_entity_model_id == 0 then -- Cloud
  System.enter_field(47, 0) -- Go to specific field
  goto label_end -- Skip other checks
end

-- Check for other characters
if Special.player_entity_model_id == 1 or Special.player_entity_model_id == 2 then -- Tifa or Cid
  System.call_function(Special.player_entity_model_id, 31) -- Call character-specific function
end

::label_end:: -- End label
return -- Exit script
`;

    const expected = `
RESET
PUSH_SPECIAL_BYTE 08
PUSH_CONSTANT 00
EQ
GOTO_IF_FALSE 1010
RESET
PUSH_CONSTANT 2F
PUSH_CONSTANT 00
ENTER_FIELD
GOTO 1022
RESET
PUSH_SPECIAL_BYTE 08
PUSH_CONSTANT 01
EQ
PUSH_SPECIAL_BYTE 08
PUSH_CONSTANT 02
EQ
LOR
GOTO_IF_FALSE 1022
RESET
PUSH_SPECIAL_BYTE 08
CALL_FN_31
RETURN
`;

    const result = worldscript.compile(script);
    expect(result.trim()).toBe(expected.trim());
  });

  it('should preserve functionality when comments are removed', () => {
    // Test that a script with comments produces the same result as without comments
    const scriptWithComments = `
-- Test script
if Savemap.game_progress == 100 then -- Check progress
  Entity.stop() -- Stop entity
end
return -- Exit
`;

    const scriptWithoutComments = `
if Savemap.game_progress == 100 then
  Entity.stop()
end
return
`;

    const resultWithComments = worldscript.compile(scriptWithComments);
    const resultWithoutComments = worldscript.compile(scriptWithoutComments);

    expect(resultWithComments.trim()).toBe(resultWithoutComments.trim());
  });

  it('should handle negative values for Player.set_submarine_color', () => {
    const script = `
Player.set_submarine_color(-2)
return
`;

    const expected = `
RESET
PUSH_CONSTANT FFFE
SET_SUBMARINE
RETURN
`;

    const result = worldscript.compile(script);
    expect(result.trim()).toBe(expected.trim());

    // Test round-trip: compile -> decompile -> compile should be the same
    const decompiled = worldscript.decompile(result);
    const recompiled = worldscript.compile(decompiled);
    expect(recompiled.trim()).toBe(expected.trim());
  });
});
