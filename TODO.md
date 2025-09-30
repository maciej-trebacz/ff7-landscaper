## General

* [ ] Scrolling past the list on any tab makes the whole tab scroll too much
* [x] When switching maps the text "Loading map..." text persists in the status bar
* [x] in system_13 there's a wrong type coercion (2nd param is angle offset, not model id):
* [x] Entity.rotate_to_model(Entities.wild_chocobo, Entities.cloud) also this should use the direction component
* [x] Export mode - it should always reset the camera roll/pitch and show the map grid
* [x] Export mode - exporting underwater and glacier maps results in messed up textures (tries to use overworld textures) 
* [x] Import with normals - missing texture data
* [x] Add "Open Script" button next to Script ID in the Triangle sidebar
* [x] "Go to script" button for messages
* [x] Text preview & autosizing for messages
* [x] Autosizing does not work correctly when custom codes are used (e.g. colors)
* [x] Adding / removing messages
* [x] Battle ID picker (from Ultima)

## Map

* [x] when importing a map we should check the number of vertices and warn user if it's bigger than 122.
* [x] changes are lost when changing current map, switching to a different tab or changing Alternatives
* [x] saving changes to alternative sections doesn't work
* [x] improve camera orbiting/panning
* [x] importing from .obj does not work properly - sometimes a vertex position will be set to 0, 0, 0

## Scripts

* [ ] When adding a new function before typing in the params the dropdowns in the sidebar do not work properly. Eg. System.call_function() and try setting the model or function id.
* [x] Make sure scripts are properly compiled and saved into the game data files
* [x] Adding a new script (tried highwind - touched and a mesh script) crashes the game
* [x] Undo/redo support for script editing
* [x] Show which scripts were modified after loading/saving
* [x] Prompt "You will lose unsaved changes" if there are any
* [x] Search feature in the script editor
* [x] Search across all scripts
* [x] Custom mapping for Entities and Fields namespaces
* [x] Can't properly set script alias - the dropdown disappears when you enable an alias
* [x] System.call_function has wrong sidebar ui
* [x] System.set_field_entry_by_id(51) in chocobo_29 model script - wrong opcode?
  * Another example in system_27
* [x] System.fade_out and fade_in has unknown 2nd parameter
* [x] Entity.set_vertical_speed - has "unknown" parameter
* [x] Verify Special.current_entity_model_id since code @ 0x7674e4 suggests something it's a different value
* [x] Player.set_submarine_color - Black & Gold options don't work