# Landscaper - FF7 Worldmap Editor

## Current features

* World map text dialogues

## TODO

* [x] in system_13 there's a wrong type coercion (2nd param is angle offset, not model id):
* [x] Entity.rotate_to_model(Entities.wild_chocobo, Entities.cloud) also this should use the direction component
* [ ] Export mode - it should always reset the camera roll/pitch and show the map grid
* [ ] Export mode - exporting underwater and glacier maps results in messed up textures (tries to use overworld textures)
* [ ] Import with normals - missing texture data
* [x] Add "Open Script" button next to Script ID in the Triangle sidebar
* [x] "Go to script" button for messages
* [ ] Text preview & autosizing for messages
* [x] Adding / removing messages

Map
* [ ] changes are lost when changing current map, switching to a different tab or changing Alternatives
* [ ] saving changes to alternative sections doesn't work
* [x] improve camera orbiting/panning
* [x] importing from .obj does not work properly - sometimes a vertex position will be set to 0, 0, 0

Scripts
* [x] Make sure scripts are properly compiled and saved into the game data files
* [x] Adding a new script (tried highwind - touched and a mesh script) crashes the game
* [x] Undo/redo support for script editing
* [ ] Reset the script to what's in the game files
* [ ] Show which scripts were modified after loading/saving
* [ ] Prompt "You will lose unsaved changes" if there are any
* [ ] Search feature in the script editor
* [ ] Search across all scripts
* [x] Custom mapping for Entities and Fields namespaces
* [x] Can't properly set script alias - the dropdown disappears when you enable an alias
* [x] System.call_function has wrong sidebar ui
* [x] System.set_field_entry_by_id(51) in chocobo_29 model script - wrong opcode?
  * Another example in system_27
* [ ] System.fade_out and fade_in has unknown 2nd parameter
* [ ] Entity.set_vertical_speed - has "unknown" parameter
* [ ] Verify Special.current_entity_model_id since code @ 0x7674e4 suggests something it's a different value