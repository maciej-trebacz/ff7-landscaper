import { Parser } from 'binary-parser';
import { Opcodes, Mnemonic } from './worldscript/opcodes';
import { Worldscript } from './worldscript/worldscript';

const opcodes = new Parser()
    .array('', {
        type: 'uint16le',
        readUntil: function(byte: number): boolean {
            return byte === 0x203;
        }        
    });

const fn = new Parser()
    .uint16le('header')
    .uint16le('offset')
    .pointer('opcodes', {
        type: opcodes,
        offset: function(): number {
            return 0x400 + (this.offset as number * 2);
        }
    });

const evParser = new Parser()
    .uint32le('dummyfn')
    .array('functions', {
        type: fn,
        length: 0xff
    });

interface AbstractFunction {
    header: number;
    offset: number;
    id?: number;
    opcodes?: number[];
    aliasId?: number;
    script: string;
}

export enum FunctionType {
    System = 0,
    Model = 1,
    Mesh = 2,
}

export interface SystemFunction extends AbstractFunction {
    type: FunctionType.System;
}

export interface ModelFunction extends AbstractFunction {
    type: FunctionType.Model;
    modelId: number;
}

export interface MeshFunction extends AbstractFunction {
    type: FunctionType.Mesh;
    x: number;
    y: number;
}

export type FF7Function = SystemFunction | ModelFunction | MeshFunction;

export class EvFile {
    functions: FF7Function[];

    constructor(data: Uint8Array) {
        const parsedData = evParser.parse(data);
        this.functions = [];

        const addFn = (data: Partial<FF7Function>): void => {
            const originalFn = this.functions.find(func => func.offset === data.offset);
            if (originalFn) {
                data.offset = originalFn.offset;
                data.aliasId = originalFn.id;
                delete data.opcodes;
            } else {
                // Ensure opcodes is an array, even if empty
                if (!data.opcodes) {
                    data.opcodes = [];
                }
                data.script = this.decodeOpcodes(data.opcodes);
            }
            this.functions.push(data as FF7Function);
        }

        parsedData.functions.forEach((fn: FF7Function) => {
            if (fn.header === 0xFFFF) return;

            const type: FunctionType = fn.header >> 14;
            if (type === FunctionType.System) {
                addFn({
                    type: FunctionType.System,
                    id: fn.header & 0xFF,
                    offset: fn.offset,
                    opcodes: fn.opcodes,
                });
            }
            else if (type === FunctionType.Model) {
                addFn({
                    type: FunctionType.Model,
                    id: fn.header & 0xFF,
                    modelId: (fn.header >> 8) & 0x3F,
                    offset: fn.offset,
                    opcodes: fn.opcodes,
                });
            }
            else if (type === FunctionType.Mesh) {
                const meshCoords = (fn.header >> 4) & 0x3FF;
                addFn({
                    type: FunctionType.Mesh,
                    id: fn.header & 0xF,
                    x: Math.floor(meshCoords / 36),
                    y: meshCoords % 36,
                    offset: fn.offset,
                    opcodes: fn.opcodes,
                });
            }
        });
    }

    decodeOpcodes(opcodes: number[], startingOffset?: number): string {
        const out = [];
        let currentOffset = startingOffset ?? 0;

        for (let i = 0; i < opcodes.length; i++) {
            const opcode = opcodes[i];
            const offsetPrefix = startingOffset !== undefined ? `${currentOffset.toString(16).toUpperCase().padStart(4, '0')}: ` : '';
            currentOffset++;
            
            // Special case for opcodes in range 0x204-0x22f (CALL_FN_X)
            if (opcode >= 0x204 && opcode <= 0x22F) {
                const fnNumber = opcode - 0x204;
                const mnemonic = `CALL_FN_${fnNumber}`;
                out.push(`${offsetPrefix}${mnemonic}`);
                continue;
            }
            
            if (!(opcode in Opcodes)) continue;

            const def = Opcodes[opcode];
            if (def.codeParams === 0) {
                out.push(`${offsetPrefix}${def.mnemonic}`);
            } else {
                const params = [];
                for (let j = 0; j < def.codeParams; j++) {
                    i++;
                    currentOffset++;

                    // Two or four hex digits
                    params.push(opcodes[i].toString(16).toUpperCase().padStart(opcodes[i] < 0x100 ? 2 : 4, '0'));
                }
                out.push(`${offsetPrefix}${def.mnemonic} ${params.join(' ')}`);
            }
        }
        
        return out.join("\n");
    }

    encodeOpcodes(script: string): number[] {
        const lines = script.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Create a reverse lookup from mnemonic to opcode
        const mnemonicToOpcode = new Map<Mnemonic, number>();
        for (const [code, def] of Object.entries(Opcodes)) {
            mnemonicToOpcode.set(def.mnemonic, parseInt(code));
        }

        // Pre-calculate total size: each opcode and parameter is 2 bytes
        let totalSize = 0;
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const [mnemonic] = lines[lineNum].split(' ');
            
            // Special case for CALL_FN_X mnemonics
            if (mnemonic.startsWith('CALL_FN_')) {
                totalSize += 2; // opcode only, no parameters
                continue;
            }
            
            const opcode = mnemonicToOpcode.get(mnemonic as Mnemonic);
            if (opcode === undefined) {
                throw new Error(`Line ${lineNum + 1}: Unknown mnemonic "${mnemonic}"`);
            }
            const def = Opcodes[opcode];
            totalSize += 2; // opcode
            totalSize += def.codeParams * 2; // parameters
        }

        // Initialize result array
        const result: number[] = [];

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            const [mnemonic, ...params] = line.split(' ');

            // Special case for CALL_FN_X mnemonics
            if (mnemonic.startsWith('CALL_FN_')) {
                // Extract the function number from the mnemonic
                const fnNumberMatch = mnemonic.match(/CALL_FN_(\d+)/);
                if (!fnNumberMatch) {
                    throw new Error(`Line ${lineNum + 1}: Invalid CALL_FN mnemonic format "${mnemonic}"`);
                }
                
                const fnNumber = parseInt(fnNumberMatch[1], 10);
                // Calculate the opcode: 0x204 + function number
                const opcode = 0x204 + fnNumber;
                
                // Validate opcode range
                if (opcode < 0x204 || opcode > 0x22F) {
                    throw new Error(
                        `Line ${lineNum + 1}: Function number ${fnNumber} out of valid range (0-43)`
                    );
                }
                
                // Add opcode to the array
                result.push(opcode);
                
                // CALL_FN_X takes parameters from the stack, not from code
                if (params.length > 0) {
                    throw new Error(
                        `Line ${lineNum + 1}: ${mnemonic} takes parameters from the stack, not from code`
                    );
                }
                
                continue;
            }
            
            // Find the opcode for this mnemonic
            const opcode = mnemonicToOpcode.get(mnemonic as Mnemonic);
            if (opcode === undefined) {
                throw new Error(`Line ${lineNum + 1}: Unknown mnemonic "${mnemonic}"`);
            }

            const def = Opcodes[opcode];
            
            // Add opcode to the array
            result.push(opcode);

            // Validate and parse parameters
            if (def.codeParams > 0) {
                if (params.length !== def.codeParams) {
                    throw new Error(
                        `Line ${lineNum + 1}: ${mnemonic} requires ${def.codeParams} parameter(s), but got ${params.length}`
                    );
                }

                for (const param of params) {
                    // Validate hex format - must be exactly 2 or 4 digits since all values are 16-bit
                    if (!/^[0-9A-Fa-f]{2}([0-9A-Fa-f]{2})?$/.test(param)) {
                        throw new Error(
                            `Line ${lineNum + 1}: Invalid parameter format "${param}". Expected exactly 2 or 4 hex digits`
                        );
                    }

                    const value = parseInt(param, 16);
                    // Add parameter to the array
                    result.push(value);
                }
            } else if (params.length > 0) {
                throw new Error(
                    `Line ${lineNum + 1}: ${mnemonic} doesn't accept parameters, but got ${params.length}`
                );
            }
        }

        return result;
    }

    getSystemFunctions(): SystemFunction[] {
        return this.functions.filter((fn): fn is SystemFunction => fn.type === FunctionType.System);
    }

    getModelFunctions(): ModelFunction[] {
        return this.functions.filter((fn): fn is ModelFunction => fn.type === FunctionType.Model);
    }

    getMeshFunctions(): MeshFunction[] {
        return this.functions.filter((fn): fn is MeshFunction => fn.type === FunctionType.Mesh);
    }

    calculateHeader(fn: FF7Function): number {
        if (fn.type === FunctionType.System) {
            return fn.id;
        } else if (fn.type === FunctionType.Model) {
            return (1 << 14) | (fn.modelId << 8) | fn.id;
        } else { // mesh
            const meshCoords = Math.floor(fn.x) * 36 + Math.floor(fn.y);
            return (2 << 14) | (meshCoords << 4) | fn.id;
        }
    }

    setFunctionScript(index: number, script: string) {
        this.functions[index].script = script;
    }

    addModelFunction(modelId: number, functionId: number): FF7Function {
        // Check if function already exists
        const existingFunction = this.functions.find(fn =>
            fn.type === FunctionType.Model &&
            (fn as ModelFunction).modelId === modelId &&
            fn.id === functionId
        );

        if (existingFunction) {
            throw new Error(`Model function ${modelId}:${functionId} already exists`);
        }

        // Create new model function with just a RETURN opcode
        const newFunction: ModelFunction = {
            type: FunctionType.Model,
            id: functionId,
            modelId: modelId,
            header: this.calculateHeader({ type: FunctionType.Model, id: functionId, modelId } as ModelFunction),
            offset: 0, // Will be calculated during writeFile
            script: "RETURN"
        };

        this.functions.push(newFunction);
        return newFunction;
    }

    addMeshFunction(x: number, y: number, functionId: number): FF7Function {
        // Check if function already exists
        const existingFunction = this.functions.find(fn =>
            fn.type === FunctionType.Mesh &&
            (fn as MeshFunction).x === x &&
            (fn as MeshFunction).y === y &&
            fn.id === functionId
        );

        if (existingFunction) {
            throw new Error(`Mesh function ${x},${y}:${functionId} already exists`);
        }

        // Create new mesh function with just a RETURN opcode
        const newFunction: MeshFunction = {
            type: FunctionType.Mesh,
            id: functionId,
            x: x,
            y: y,
            header: this.calculateHeader({ type: FunctionType.Mesh, id: functionId, x, y } as MeshFunction),
            offset: 0, // Will be calculated during writeFile
            script: "RETURN"
        };

        this.functions.push(newFunction);
        return newFunction;
    }

    addSystemFunction(functionId: number): FF7Function {
        // Check if function already exists
        const existingFunction = this.functions.find(fn =>
            fn.type === FunctionType.System &&
            fn.id === functionId
        );

        if (existingFunction) {
            throw new Error(`System function ${functionId} already exists`);
        }

        // Create new system function with just a RETURN opcode
        const newFunction: SystemFunction = {
            type: FunctionType.System,
            id: functionId,
            header: this.calculateHeader({ type: FunctionType.System, id: functionId } as SystemFunction),
            offset: 0, // Will be calculated during writeFile
            script: "RETURN"
        };

        this.functions.push(newFunction);
        return newFunction;
    }

    deleteFunction(index: number) {
        if (index < 0 || index >= this.functions.length) {
            throw new Error(`Function index ${index} is out of bounds`);
        }
        this.functions.splice(index, 1);
    }

    writeFile() {
        const out = new Uint8Array(0x7000);
        const view = new DataView(out.buffer);
        let worldscript: Worldscript;

        // Write initial return instruction at offset 0x400
        view.setUint16(0x400, 0x203, true);
        let codeOffset = 0x402; // Start after initial return

        // Sort functions by their header value
        const sortedFunctions = [...this.functions].sort((a, b) => {
            return this.calculateHeader(a) - this.calculateHeader(b);
        });

        // Create a map to track function offsets for aliases
        const functionOffsets = new Map<number, number>();

        // Write call table (0x400 bytes = 256 entries of 4 bytes each)
        let tableOffset = 0;
        
        // First entry is 0 (matching original FF7 data)
        view.setUint16(tableOffset, 0, true);
        view.setUint16(tableOffset + 2, 0, true); // Points to first instruction after initial return
        tableOffset += 4;

        // Write actual function entries
        sortedFunctions.forEach(fn => {
            const header = this.calculateHeader(fn);

            // Write function header and instruction pointer
            view.setUint16(tableOffset, header, true);
            
            // If this is an alias, point to the original function's offset
            if (fn.aliasId !== undefined) {
                const originalOffset = functionOffsets.get(fn.aliasId);
                if (originalOffset !== undefined) {
                    view.setUint16(tableOffset + 2, originalOffset, true);
                } else {
                    // If original function not found, just use current offset
                    view.setUint16(tableOffset + 2, (codeOffset - 0x400) / 2, true);
                }
            } else {
                // Store this function's offset for potential aliases
                const newFnOffset = (codeOffset - 0x400) / 2;
                if (fn.id !== undefined) {
                    functionOffsets.set(fn.id, newFnOffset);
                }

                view.setUint16(tableOffset + 2, newFnOffset, true);
                
                // Write function opcodes if they exist
                if (fn.script) {
                    // Recompile the script to ensure correct jump offsets
                    worldscript = new Worldscript(fn.offset);
                    const decompiled = worldscript.decompile(fn.script);
                    worldscript = new Worldscript(newFnOffset);
                    const compiled = worldscript.compile(decompiled);
                    const opcodes = this.encodeOpcodes(compiled);
                    opcodes.forEach(opcode => {
                        view.setUint16(codeOffset, opcode, true);
                        codeOffset += 2;
                    });
                } else {
                    // For functions without opcodes, write a return instruction (0x203)
                    view.setUint16(codeOffset, 0x203, true);
                    codeOffset += 2;
                }
            }
            
            tableOffset += 4;
        });

        // Fill remaining call table entries with 0xFFFF/0
        while (tableOffset < 0x400) {
            view.setUint16(tableOffset, 0xFFFF, true);
            view.setUint16(tableOffset + 2, 0, true);
            tableOffset += 4;
        }

        return out;
    }
}