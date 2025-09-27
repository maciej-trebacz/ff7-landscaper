import { swap16 } from "./endian";

// FF Text encoder/decoder
// Partially ported by mav from Python source by Niema Moshiri
// https://github.com/niemasd/PyFF7

const CHARS = {
    'NORMAL': 
        " !\"#$%&'()*+,-./01234" +
        "56789:;<=>?@ABCDEFGHI" +
        "JKLMNOPQRSTUVWXYZ[\\]^" +
        "_`abcdefghijklmnopqrs" +
        "tuvwxyz{|}~ ÄÅÇÉÑÖÜáà" +
        "âäãåçéèêëíìîïñóòôöõúù" +
        "ûü♥°¢£↔→♪ßα  ´¨≠ÆØ∞±≤" +
        "≥¥µ∂ΣΠπ⌡ªºΩæø¿¡¬√ƒ≈∆«" +
        "»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄ ‹" +
        "›ﬁﬂ■‧‚„‰ÂÊÁËÈÍÎÏÌÓÔ Ò" +
        "ÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ       ",
    'FIELD_SPECIAL': {
        0xE0: "{CHOICE}",
        0xE1: "\t",
        0xE2: ", ",
        0xE3: '."',
        0xE4: '…"',
        0xE6: "⑬",
        0xE7: "\n",
        0xE8: "{NEWPAGE}",
        0xEA: "{CLOUD}",
        0xEB: "{BARRET}",
        0xEC: "{TIFA}",
        0xED: "{AERITH}",
        0xEE: "{RED XIII}",
        0xEF: "{YUFFIE}",
        0xF0: "{CAIT SITH}",
        0xF1: "{VINCENT}",
        0xF2: "{CID}",
        0xF3: "{PARTY #1}",
        0xF4: "{PARTY #2}",
        0xF5: "{PARTY #3}",
        0xF6: "〇", 
        0xF7: "△", 
        0xF8: "☐", 
        0xF9: "✕", 
    },
    'FIELD_CONTROL': {
        0xD2: "{GRAY}",
        0xD3: "{BLUE}",
        0xD4: "{RED}",
        0xD5: "{PURPLE}",
        0xD6: "{GREEN}",
        0xD7: "{CYAN}",
        0xD8: "{YELLOW}",
        0xD9: "{WHITE}",
        0xDA: "{FLASH}",
        0xDB: "{RAINBOW}",
        0xDC: "{PAUSE}",
        0xDE: "{NUM}",  
        0xDF: "{HEX}",  
        0xE0: "{SCROLL}",
        0xE1: "{RNUM}",  
        0xE9: "{FIXED}", 
    },
    'ESCAPE': '\\{}'
}

const fieldCommands = Object.assign({}, ...Object.entries({...CHARS.FIELD_CONTROL, ...CHARS.FIELD_SPECIAL}).map(([a,b]) => ({ [b]: a })))

export const decodeText = function(buf: Uint8Array): Uint8Array {
    let text = '';
    let i = 0;

    while (i < buf.length) {
        const c = buf[i];
        i++;

        // End of string
        if (c === 0xFF) break;
        
        // Printable character
        else if (c < 0xE0) {
            const t = CHARS.NORMAL[c];
            if (CHARS.ESCAPE.includes(t)) text += '\\';
            text += t;
        }

        // Field control code
        else if (c === 0xFE) {
            if (i > buf.length) throw Error("Spurious control code at end of string");
            const k = buf[i];
            i++;

            // WAIT <arg> command
            if (k === 0xDD) {
                const arg = new DataView(buf.buffer).getUint16(i, true);
                i += 2;
                text += `{WAIT ${arg}}`
            }

            // STR {offset} {length} command
            else if (k === 0xE2) {
                const offset = new DataView(buf.buffer).getUint16(i, true);
                i += 2;
                const length = new DataView(buf.buffer).getUint16(i, true);
                i += 2;
                text += `{STR ${offset} ${length}}`
            }

            // Other control codes
            else {
                if (!CHARS.FIELD_CONTROL[k as keyof typeof CHARS.FIELD_CONTROL]) throw Error (`Illegal control code ${k}`)
                text += CHARS.FIELD_CONTROL[k as keyof typeof CHARS.FIELD_CONTROL]
            }
        }

        // Field special character
        else {
            text += CHARS.FIELD_SPECIAL[c as keyof typeof CHARS.FIELD_SPECIAL];
            if (c === 0xE8) text += "\n";
        }
    }

    return new TextEncoder().encode(text);
}

export const encodeText = function(text: string): Uint8Array {
    let data: number[] = [];
    let i = 0;

    while (i < text.length) {
        let c = text[i++];

        // escape sequence
        if (c == '\\') {
            if (i >= text.length) throw Error ('Spurious \'\\\' at the end of string: ' + text);
            c = text[i++];
            data.push(CHARS.NORMAL.indexOf(c));
        }

        // command sequence
        else if (c === '{') {
            const end = text.indexOf('}', i)
            if (end === -1) throw Error ('Mismatched {} in string: ' + text)
            const command = text.substring(i, end)
            const keyword = command.split(" ")[0]
            i = end + 1
            if (keyword === 'WAIT') {
                const m = /WAIT (\d+)/.exec(command)
                if (!m) throw Error (`Syntax error in command ${command} in string: ${text}`)
                const arg = parseInt(m[1])
                if (arg < 0 || arg > 0xFFFF) throw Error (`Invalid value for WAIT argument in command ${command}, has to be in range 0-65535 in string: ${text}`)
                data.push(0xFE, 0xDD, ...new Uint8Array(new Uint16Array([swap16(arg)]).buffer))
            }
            else if (keyword === 'STR') {
                const m = /STR ([a-fA-F0-9]{4}) ([a-fA-F0-9]{4})/.exec(command)
                if (!m) throw Error (`Syntax error in command ${command} in string: ${text}`)
                const offset = parseInt(m[1], 16)
                const length = parseInt(m[2], 16)
                data.push(0xFE, 0xE2, ...new Uint8Array(new Uint16Array([swap16(offset), swap16(length)]).buffer))
            }
            else {
                const code = fieldCommands[`{${command}}`];
                if (code) {
                    if (Object.values(CHARS.FIELD_CONTROL).includes(`{${command}}`)) data.push(0xFE);
                    data.push(code);
                    // Skip extra newline character after NEW command
                    if (command === 'NEWPAGE') {
                        if (i < text.length && text[i] === '\n') i++;
                    }
                } else throw Error (`Unknown command ${command} in string: ${text}`)
            }
        }

        else {
            if (c in fieldCommands) {
                const code = fieldCommands[c];
                data.push(code);
            } else if (CHARS.NORMAL.indexOf(c) >= 0) {
                data.push(CHARS.NORMAL.indexOf(c));
            } else throw Error (`Unencodable character '${c}' in string: ${text}`)
        }
    }

    data.push(0xFF)
    return new Uint8Array(data);
}

/**
 * FFTextAutosizer
 *
 * TypeScript port of touphScript's text autosizing logic for FF7.
 * Measures the in-game pixel width and height for a given ASCII string
 * using spacing and box metrics derived from touphScript.ini defaults.
 */

type SpacingTable = number[]; // indexes 0..255 = glyph widths, 256 = max, 257 = padding

export interface AutosizerOptions {
  spacingHexTable?: string; // 256 hex values (space-separated) like touphScript.ini font_spacing
  choice?: number; // default 10
  tab?: number; // default 4
  max?: number; // default 26
  padding?: number; // default 16 (box_width_padding)
  rowH1?: number; // default 16 (box_height_part_1)
  rowH2?: number; // default 25 (box_height_part_2)
}

export class FFTextAutosizer {
  private spacing: SpacingTable;
  private rowH1: number;
  private rowH2: number;

  constructor(opts: AutosizerOptions = {}) {
    const {
      spacingHexTable,
      choice = 10,
      tab = 4,
      max = 26,
      padding = 16,
      rowH1 = 16,
      rowH2 = 9,
    } = opts;

    // Build spacing table (0..255): (val & 0x1F) + floor(val / 0x20)
    const baseGlyphWidths = spacingHexTable
      ? FFTextAutosizer.parseFontSpacingHex(spacingHexTable)
      : FFTextAutosizer.defaultFontSpacing();

    const spacing: SpacingTable = baseGlyphWidths.map((v) => ((v & 0x1f) + Math.floor(v / 0x20)) | 0);
    console.log("spacing", spacing);

    // Set special entries matching touphScript getSpacingTable()
    // choice (0xE0) and tab (0xE1) are counts, used with width of space or max/2 in MAX mode
    spacing[0xE0] = choice;
    spacing[0xE1] = tab;

    // Composite widths used by certain punctuation in the original
    spacing[0xE2] = (spacing[0x00] ?? 0) + (spacing[0x0C] ?? 0);
    spacing[0xE3] = (spacing[0x0E] ?? 0) + (spacing[0x02] ?? 0);
    spacing[0xE4] = (spacing[0xA9] ?? 0) + (spacing[0x02] ?? 0);

    // Reserve index 256, then set it to MAX (monospace) width
    spacing.push(0); // index 256 placeholder
    spacing[256] = max;

    // Append padding at the very end; width() starts each line with spacing.back()
    spacing.push(padding); // index 257 = padding

    this.spacing = spacing;
    this.rowH1 = rowH1;
    this.rowH2 = rowH2;
  }

  /** Measure returns {width, height} in pixels for the given ASCII text. */
  measure(text: string): { width: number; height: number } {
    const codes = this.toCodes(text);
    debugger;
    const width = this.widthFromCodes(codes);
    const height = this.heightFromCodes(codes);
    return { width, height };
  }

  // Convert FF7 text (with format codes) to FF7 char codes needed for sizing
  private toCodes(text: string): number[] {
    const out: number[] = [];
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      // Handle escape sequences
      if (ch === '\\') {
        if (i + 1 >= text.length) {
          // Spurious backslash at end, treat as literal
          out.push(CHARS.NORMAL.indexOf('\\'));
          break;
        }
        i++;
        const escaped = text[i];
        const code = CHARS.NORMAL.indexOf(escaped);
        if (code !== -1) {
          out.push(code);
        }
        // If not found in NORMAL, skip
        i++;
        continue;
      }

      // Handle command sequences
      if (ch === '{') {
        const end = text.indexOf('}', i);
        if (end === -1) {
          // Mismatched brace, treat as literal
          out.push(CHARS.NORMAL.indexOf('{'));
          i++;
          continue;
        }
        const command = text.substring(i, end + 1);
        const code = fieldCommands[command];
        if (code !== undefined) {
          out.push(parseInt(code, 16));
          // Skip extra newline after NEWPAGE
          if (command === '{NEWPAGE}' && end + 1 < text.length && text[end + 1] === '\n') {
            i = end + 2;
          } else {
            i = end + 1;
          }
          continue;
        }
        // Unknown command, treat as literal text
        out.push(CHARS.NORMAL.indexOf('{'));
        i++;
        continue;
      }

      // Handle newlines
      if (ch === '\n') {
        out.push(0xE7); // nline
        i++;
        continue;
      }

      // Handle carriage returns (normalize CRLF)
      if (ch === '\r') {
        i++;
        continue;
      }

      // Handle tabs
      if (ch === '\t') {
        out.push(0xE1); // tab
        i++;
        continue;
      }

      // Handle normal characters
      const code = CHARS.NORMAL.indexOf(ch);
      if (code !== -1) {
        out.push(code);
      } else {
        // Character not in NORMAL table, check if it's ASCII
        const asciiCode = ch.charCodeAt(0);
        if (asciiCode >= 32 && asciiCode <= 126) {
          out.push(asciiCode - 32);
        } else if (asciiCode === 160) {
          // Non-breaking space -> treat as normal space
          out.push(0);
        }
        // Unknown characters are skipped
      }

      i++;
    }

    return out;
  }

  private widthFromCodes(codes: number[]): number {
    const sp = this.spacing;
    let lineWidth = sp[sp.length - 1] ?? 0; // padding
    let maxWidth = lineWidth;
    let maxMode = false; // toggled by {MAX}; not used for plain ASCII

    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      switch (c) {
        case 0xE7: // nline
        case 0xE8: // newW
          if (lineWidth > maxWidth) maxWidth = lineWidth;
          lineWidth = sp[sp.length - 1] ?? 0; // reset to padding
          break;
        case 0xE0: // choice indent
          lineWidth += maxMode ? (sp[0xE0] * (sp[0x100] ?? 0)) / 2.0 : sp[0xE0] * (sp[0x00] ?? 0);
          break;
        case 0xE1: // tab
          lineWidth += maxMode ? (sp[0xE1] * (sp[0x100] ?? 0)) / 2.0 : sp[0xE1] * (sp[0x00] ?? 0);
          break;
        default:
          lineWidth += maxMode ? (sp[0x100] ?? 0) / 2.0 : sp[c] ?? 0;
          break;
      }
    }
    return Math.ceil(lineWidth > maxWidth ? lineWidth : maxWidth);
  }

  private heightFromCodes(codes: number[]): number {
    if (codes.length === 0) return 0;

    let h = 1;
    let nh = 1;
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      switch (c) {
        case 0xE7: // nline
          h += 1;
          break;
        case 0xE8: // newW (new window segment)
          if (h > nh) nh = h;
          h = 1;
          break;
        default:
          break;
      }
    }
    if (h > nh) nh = h;
    if (nh > 13) nh = 13; // Max rows
    return nh * this.rowH1 + this.rowH2;
  }

  // Default font spacing (256 hex values) copied from the game
  private static defaultFontSpacing(): number[] {
    return FFTextAutosizer.parseFontSpacingHex(
      '03 45 48 0A 07 0A 09 03 48 48 07 07 27 05 26 06 08 47 08 08 08 08 08 08 08 08 45 04 07 08 07 27 0A 09 07 08 08 07 07 08 08 03 06 07 07 0B 08 09 07 09 07 07 07 08 09 0B 08 09 07 04 06 04 07 08 04 07 07 06 07 07 06 07 07 03 04 06 03 0B 07 07 07 07 05 06 06 07 07 0B 07 07 06 05 03 05 08 44 4B 4C 4B 49 4B 09 08 07 49 07 07 07 07 07 07 07 07 07 04 03 04 04 07 07 07 07 07 07 07 07 07 07 0B 06 07 08 0B 06 07 07 09 2A 4D 04 05 08 0C 09 0B 07 07 07 09 07 07 07 09 08 04 06 06 09 0B 07 06 03 08 07 08 08 09 07 07 09 01 09 09 09 0C 0B 08 0C 06 06 04 04 07 07 07 09 07 09 05 05 07 07 08 03 04 06 0D 09 07 09 07 07 03 03 03 03 09 09 08 09 08 08 08 03 06 07 05 06 03 06 05 06 05 05 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01 01'
    );
  }

  private static parseFontSpacingHex(hexRow: string): number[] {
    const parts = hexRow.trim().split(/\s+/);
    if (parts.length !== 256) {
      throw new Error(`Expected 256 hex values for font spacing, got ${parts.length}`);
    }
    return parts.map((h) => parseInt(h, 16));
  }
}

export default FFTextAutosizer;

