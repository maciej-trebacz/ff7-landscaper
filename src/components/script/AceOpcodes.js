;(function () {
  ace.define(
    "ace/mode/ff7opcodes_highlight_rules",
    ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"],
    function (require, exports, module) {
      "use strict"
      var oop = require("../lib/oop")
      var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules

      var FF7OpcodesHighlightRules = function () {
        // Define all FF7 opcodes mnemonics as keywords
        var mnemonics = [
          "NOP",
          "NEG",
          "NOT",
          "DIST_POINT",
          "DIST_MODEL",
          "DIR_POINT",
          "MUL",
          "ADD",
          "SUB",
          "SHL",
          "SHR",
          "LT",
          "GT",
          "LE",
          "GE",
          "EQ",
          "AND",
          "OR",
          "LAND",
          "LOR",
          "WRITE",
          "RESET",
          "PUSH_CONSTANT",
          "PUSH_SAVEMAP_BIT",
          "PUSH_SPECIAL_BIT",
          "PUSH_SAVEMAP_BYTE",
          "PUSH_TEMP_BYTE",
          "PUSH_SPECIAL_BYTE",
          "PUSH_SAVEMAP_WORD",
          "PUSH_TEMP_WORD",
          "PUSH_SPECIAL_WORD",
          "GOTO",
          "GOTO_IF_FALSE",
          "RETURN",
          "CALL_FN_",
          "LOAD_MODEL",
          "SET_PLAYER",
          "SET_SPEED",
          "SET_DIR",
          "WAIT_FRAMES",
          "WAIT",
          "SET_CONTROLS",
          "SET_MESH_POS",
          "SET_LOCAL_POS",
          "SET_VERT_SPEED",
          "SET_Y_OFFSET",
          "ENTER_VEHICLE",
          "STOP",
          "PLAY_ANIM",
          "SET_POINT",
          "SET_POINT_MESH",
          "SET_POINT_LOCAL",
          "SET_TERRAIN_COLOR",
          "SET_RADIUS",
          "SET_SKY_TOP",
          "SET_SKY_BOTTOM",
          "BATTLE",
          "ENTER_FIELD",
          "SET_MAP_OPTIONS",
          "SET_CAM_LOCK",
          "PLAY_SFX",
          "SET_CAM_SPEED",
          "RESET_ZOLOM",
          "FACE_POINT",
          "SET_WINDOW_SIZE",
          "SET_MESSAGE",
          "SET_PROMPT",
          "WAIT_PROMPT",
          "SET_MOVE_DIR",
          "SET_CAM_TILT",
          "SET_CAM_ZOOM",
          "SET_ENCOUNTERS",
          "SET_WINDOW_STYLE",
          "WAIT_WINDOW",
          "WAIT_DISMISS",
          "SET_PLAYER_DIR",
          "SET_ENTITY",
          "EXIT_VEHICLE",
          "CHOCOBO_RUN",
          "FACE_MODEL",
          "WAIT_FUNC",
          "SET_WALK_SPEED",
          "HIDE_MODEL",
          "SET_VERT_SPEED2",
          "FADE_OUT",
          "EXIT_UNDERWATER",
          "SET_FIELD_ENTRY_ID",
          "PLAY_MUSIC",
          "MOVE_TO_MODEL",
          "FADE_IN",
          "SET_PROGRESS",
          "PLAY_LAYER_ANIM",
          "SET_CHOCOBO",
          "SET_SUBMARINE",
          "SHOW_LAYER",
          "HIDE_LAYER",
          "SET_Y_POS",
          "SHOW_METEOR",
          "SET_MUSIC_VOL",
          "SHAKE_CAM",
          "ADJUST_POS",
          "SET_VEHICLE_USABLE",
          "SET_BATTLE_TIMER",
        ].join("|")

        var keywordMapper = this.createKeywordMapper(
          {
            keyword: mnemonics,
          },
          "identifier"
        )

        this.$rules = {
          start: [
            {
              token: "comment",
              regex: "\\#.*$",
            },
            {
              token: "constant.numeric", // hex numbers with 0x prefix
              regex: "\\b0x[0-9A-Fa-f]{2,4}\\b",
            },
            {
              token: "constant.numeric", // hex numbers without 0x prefix (containing A-F)
              regex: "\\b[0-9A-Fa-f]*[A-Fa-f]+[0-9A-Fa-f]*\\b",
            },
            {
              token: "constant.numeric", // regular decimal numbers
              regex: "\\b\\d+\\b",
            },
            {
              token: "keyword", // CALL_FN_ with number
              regex: "\\bCALL_FN_\\d+\\b",
            },
            {
              token: keywordMapper,
              regex: "[A-Z_]+\\b",
            },
            {
              token: "text",
              regex: "\\s+|\\w+",
            },
          ],
        }
        this.normalizeRules()
      }
      oop.inherits(FF7OpcodesHighlightRules, TextHighlightRules)
      exports.FF7OpcodesHighlightRules = FF7OpcodesHighlightRules
    }
  )

  ace.define(
    "ace/mode/ff7opcodes",
    ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/ff7opcodes_highlight_rules"],
    function (require, exports, module) {
      "use strict"
      var oop = require("../lib/oop")
      var TextMode = require("./text").Mode
      var FF7OpcodesHighlightRules = require("./ff7opcodes_highlight_rules").FF7OpcodesHighlightRules

      var Mode = function () {
        this.HighlightRules = FF7OpcodesHighlightRules
        this.$behaviour = this.$defaultBehaviour
      }
      oop.inherits(Mode, TextMode)

      ;(function () {
        this.lineCommentStart = "#"
        this.$id = "ace/mode/ff7opcodes"
      }).call(Mode.prototype)

      exports.Mode = Mode
    }
  )
})()
