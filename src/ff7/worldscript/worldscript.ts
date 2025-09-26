import { OpcodeDefinition, Opcodes, Mnemonic, Namespace } from "./opcodes";
import { AssignmentStatement, BinaryExpression, BlockStatement, Expression, ExpressionStatement, FunctionCallExpression, GotoStatement, IdentifierExpression, IfStatement, IndexExpression, Instruction, LabelStatement, LiteralExpression, MemberExpression, Statement, Token, UnaryExpression } from "./types";
import { Parser } from "./parser";
import { modelsMapping, fieldsMapping, savemapMapping, modelOpcodes, enumMaps, SPECIAL_MAP } from "./constants";


export class Worldscript {
  private startingOffset: number;
  private opcodeLines: string[];
  private lineOffsets: number[];
  private jumpTargets: Set<number>;
  private stack: Expression[];
  private statements: Statement[];
  private mnemonicToOpcode: Record<string, OpcodeDefinition>;
  private debugMetadata: Map<number, string>;
  private debugMode: boolean = false;
  private stackHistory: Array<{ operation: string, stack: Expression[], line: number, offset: number }> = [];
  private processedLines: Set<number>;
  private labelCounter: number = 0; // Counter for sequential label names
  private offsetToLabelMap: Map<number, string> = new Map(); // Maps offset to sequential label name

  // Inverse mappings for compilation
  private modelsMappingInverse: Record<string, number> = Object.fromEntries(
    Object.entries(modelsMapping).map(([k, v]) => [v, parseInt(k)])
  );
  private fieldsMappingInverse: Record<string, number> = Object.fromEntries(
    Object.entries(fieldsMapping).map(([k, v]) => [v, parseInt(k)])
  );  

  // Define base addresses for namespaces
  private namespaceBases: Record<string, number> = {
    'Savemap': 0xBA4,
    'Special': 0x0,
    'Temp': 0x0
  };  

  // Mapping from value to name and type for decompilation
  private specialMap: { [key: number]: { name: string; type: 'byte' | 'word' | 'bit' } } = SPECIAL_MAP;

  // Mapping from name to value and type for compilation
  private specialVariables: Record<string, { value: number; type: 'byte' | 'word' | 'bit' }> = {};  

  constructor(startingOffset: number, debugMode: boolean = false) {
    this.startingOffset = startingOffset;
    this.mnemonicToOpcode = {};
    this.debugMetadata = new Map();
    this.debugMode = debugMode;
    this.processedLines = new Set();
    this.opcodeLines = [];
    this.lineOffsets = [];
    this.jumpTargets = new Set();
    this.stack = [];
    this.statements = [];
    for (const [_, value] of Object.entries(Opcodes)) {
      this.mnemonicToOpcode[value.mnemonic] = value;
    }
    // Initialize specialVariables from specialMap
    this.specialVariables = {};
    for (const key in this.specialMap) {
      if (this.specialMap.hasOwnProperty(key)) {
        const numKey = Number(key);
        const info = this.specialMap[numKey];
        this.specialVariables[info.name] = { value: numKey, type: info.type };
      }
    }    
  }

  public decompile(opcodeString: string, includeMetadata: boolean = false): string {
    this.stackHistory = [];
    this.processedLines = new Set();
    this.labelCounter = 0;
    this.offsetToLabelMap = new Map();
    this.opcodeLines = opcodeString.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    this.calculateOffsetsAndJumpTargets(includeMetadata);
    this.assignSequentialLabels();
    this.outputScriptWithOffsets();

    this.stack = [];
    this.statements = [];
    try {
      this.processCode(0, includeMetadata);
    } catch (error) {
      if (this.debugMode) {
        console.error("Stack history:");
        this.stackHistory.forEach((entry, index) => {
          console.error(`[${entry.offset.toString(16).padStart(4, '0')}] ${index + 1}. Line ${entry.line}: ${entry.operation}, Stack: [${entry.stack.map(e => JSON.stringify(e)).join(', ')}]`);
        });
      }
      throw error;
    }

    return this.generateCode();
  }

  private calculateOffsetsAndJumpTargets(includeMetadata: boolean) {
    this.lineOffsets = [];
    this.jumpTargets = new Set();
    let offset = this.startingOffset;

    for (let i = 0; i < this.opcodeLines.length; i++) {
      const line = this.opcodeLines[i];
      const tokens = this.parseLine(line, i + 1);
      const mnemonic = tokens[0];
      const codeParams = tokens.slice(1);
      const opcode = this.mnemonicToOpcode[mnemonic];

      if (!opcode) {
        throw new Error(`Unknown mnemonic: ${mnemonic} at line ${i + 1}`);
      }

      if (!opcode.mnemonic.startsWith('CALL_FN_') && codeParams.length !== opcode.codeParams) {
        throw new Error(
          `Invalid number of code parameters for ${mnemonic}: expected ${opcode.codeParams}, got ${codeParams.length} at line ${i + 1}`
        );
      }

      this.lineOffsets.push(offset);

      if (includeMetadata) {
        this.debugMetadata.set(offset, line);
      }

      if (opcode.mnemonic === Mnemonic.GOTO) {
        const target = parseInt(codeParams[0], 16);
        this.jumpTargets.add(target);
      }

      offset += 1;
      if (!opcode.mnemonic.startsWith('CALL_FN_')) {
        offset += codeParams.length;
      }
    }

    if (this.debugMode) {
      console.log("Line offsets:", this.lineOffsets.map(o => o.toString(16)));
      console.log("Jump targets:", Array.from(this.jumpTargets).map(t => t.toString(16)));
    }
  }

  private assignSequentialLabels() {
    // Sort jump targets by offset to ensure consistent labeling
    const sortedTargets = Array.from(this.jumpTargets).sort((a, b) => a - b);
    for (const offset of sortedTargets) {
      this.labelCounter++;
      this.offsetToLabelMap.set(offset, `label_${this.labelCounter}`);
    }
  }

  private outputScriptWithOffsets() {
    if (this.debugMode) {
      console.log("\nScript with offsets:");
      for (let i = 0; i < this.opcodeLines.length; i++) {
        const offset = this.lineOffsets[i];
        const isJumpTarget = this.jumpTargets.has(offset) ? "*" : " ";
        console.log(`[${offset.toString(16).padStart(4, '0')}]${isJumpTarget} Line ${(i + 1).toString().padStart(2, ' ')}: ${this.opcodeLines[i]}`);
      }
      console.log("\nJump targets:", Array.from(this.jumpTargets).map(t => t.toString(16)));
      console.log("");
    }
  }

  private logStackState(operation: string, lineNumber: number, offset: number) {
    if (this.debugMode) {
      this.stackHistory.push({
        operation,
        stack: [...this.stack],
        line: lineNumber,
        offset
      });
    }
  }

  private parseLine(line: string, lineNumber: number): string[] {
    const tokens = line.split(' ');
    if (tokens[0].startsWith('CALL_FN_')) {
      const funcId = tokens[0].slice(8);
      if (!funcId || isNaN(parseInt(funcId, 10))) {
        throw new Error(`Invalid CALL_FN_ format at line ${lineNumber}`);
      }
      return ['CALL_FN_', funcId];
    }
    return tokens;
  }

  private processCode(startLine: number, includeMetadata: boolean) {
    let i = startLine;
    while (i < this.opcodeLines.length) {
      if (this.processedLines.has(i)) {
        i++;
        continue;
      }
      const { statement, nextLine } = this.processSingleLine(i, includeMetadata);
      if (statement) {
        this.statements.push(statement);
      }
      i = nextLine !== null ? nextLine : i + 1;
    }
  }

  private processSingleLine(lineIndex: number, includeMetadata: boolean): { statement: Statement | null; nextLine: number | null } {
    // Skip processing if the line has already been processed
    if (this.processedLines.has(lineIndex)) {
      return { statement: null, nextLine: null };
    }
  
    this.processedLines.add(lineIndex);
    const offset = this.lineOffsets[lineIndex];
    const statements: Statement[] = [];
    if (this.jumpTargets.has(offset)) {
      const labelName = this.offsetToLabelMap.get(offset);
      if (labelName) {
        statements.push({ type: 'Label', label: labelName });
      }
    }
  
    const line = this.opcodeLines[lineIndex];
    const tokens = this.parseLine(line, lineIndex + 1);
    const mnemonic = tokens[0];
    const codeParams = tokens.slice(1);
    const opcode = this.mnemonicToOpcode[mnemonic];
    const lineNumber = lineIndex + 1;
    this.logStackState(`Before ${mnemonic}`, lineNumber, offset);
  
    let nextLine: number | null = null;
    let statement: Statement | null = null;
  
    if (opcode.mnemonic === Mnemonic.RESET || opcode.mnemonic === Mnemonic.NOP) {
      // No statement generated
    } else if (opcode.mnemonic === Mnemonic.GOTO) {
      const target = parseInt(codeParams[0], 16);
      const labelName = this.offsetToLabelMap.get(target);
      if (labelName) {
        statement = { type: 'Goto', label: labelName };
      }
      nextLine = this.findLineByOffset(target);
    } else if (opcode.mnemonic === Mnemonic.GOTO_IF_FALSE) {
      const condition = this.stack.pop() as Expression;
      const targetOffset = parseInt(codeParams[0], 16);
      const targetLine = this.findLineByOffset(targetOffset);
      if (targetLine === -1) {
        throw new Error(`Target offset ${targetOffset.toString(16)} not found at line ${lineNumber}`);
      }
      const thenBranch: Statement[] = [];
      let j = lineIndex + 1;
      while (j < this.opcodeLines.length && this.lineOffsets[j] < targetOffset) {
        const result = this.processSingleLine(j, includeMetadata);
        if (result.statement) {
          thenBranch.push(result.statement);
        }
        j++;
      }
      statement = { type: 'If', condition, thenBranch };
      nextLine = targetLine;
    } else {
      this.handleOpcode(opcode, codeParams, lineNumber, offset, statements);
    }
  
    this.logStackState(`After ${mnemonic}`, lineNumber, offset);
  
    // If we have a statement from one of the special cases and statements from handleOpcode or a label
    if (statement && statements.length > 0) {
      // Add the statement to the end of the statements array
      statements.push(statement);
      statement = null;
    }
  
    // Return all statements or the single statement
    if (statements.length > 1) {
      // If we have multiple statements, return them as a block
      return { statement: { type: 'Block', body: statements }, nextLine };
    } else if (statements.length === 1) {
      return { statement: statements[0], nextLine };
    } else {
      return { statement, nextLine };
    }
  }

  private findLineByOffset(offset: number): number {
    return this.lineOffsets.indexOf(offset);
  }

  private handleOpcode(opcode: OpcodeDefinition, codeParams: string[], lineNumber: number, _offset: number, statements: Statement[]) {
    if (opcode.mnemonic === Mnemonic.RETURN) {
      statements.push({ type: 'Return' });
    } else if (opcode.mnemonic === Mnemonic.CALL_FN_) {
      if (this.stack.length === 0) {
        throw new Error(`Stack underflow for CALL_FN_ at line ${lineNumber}`);
      }
      const entityId = this.stack.pop() as Expression;
      const funcId = codeParams[0];
      const callExpr: FunctionCallExpression = {
        type: 'FunctionCall',
        callee: { type: 'Member', object: { type: 'Identifier', name: 'System' }, property: { type: 'Identifier', name: 'call_function' } },
        arguments: [entityId, { type: 'Literal', value: funcId }]
      };
      statements.push({ type: 'ExpressionStatement', expression: callExpr });
    } else if (opcode.mnemonic === Mnemonic.WRITE) {
      if (this.stack.length < 2) {
        throw new Error(`Stack underflow for WRITE at line ${lineNumber}`);
      }
      const right = this.stack.pop() as Expression;
      const left = this.stack.pop() as Expression;
      const assignment: AssignmentStatement = {
        type: 'Assignment',
        left,
        right
      };
      statements.push(assignment);
    } else if (opcode.mnemonic.startsWith('PUSH_')) {
      const expr = this.generatePushExpression(opcode, codeParams);
      this.stack.push(expr);
    } else if (opcode.mnemonic === Mnemonic.WAIT && this.stack.length > 0 && 
               this.stack[this.stack.length - 1].type === 'FunctionCall' && 
               (this.stack[this.stack.length - 1] as FunctionCallExpression).callee.type === 'Member') {
      const topExpr = this.stack[this.stack.length - 1] as FunctionCallExpression;
      const callee = topExpr.callee as MemberExpression;
      const property = callee.property as IdentifierExpression;
      
      if (property.name === 'wait_frames' && 
          callee.object.type === 'Identifier' && 
          (callee.object as IdentifierExpression).name === 'System') {
        this.stack.pop();
        const callExpr: FunctionCallExpression = {
          type: 'FunctionCall',
          callee: { 
            type: 'Member', 
            object: { type: 'Identifier', name: 'System' }, 
            property: { type: 'Identifier', name: 'wait' } 
          },
          arguments: topExpr.arguments
        };
        statements.push({ type: 'ExpressionStatement', expression: callExpr });
      } else {
        const params: Expression[] = [];
        if (this.stack.length < opcode.stackParams) {
          throw new Error(`Stack underflow for ${opcode.mnemonic} at line ${lineNumber}`);
        }
        for (let j = 0; j < opcode.stackParams; j++) {
          params.push(this.stack.pop() as Expression);
        }
        params.reverse();
        const callExpr: FunctionCallExpression = {
          type: 'FunctionCall',
          callee: { type: 'Member', object: { type: 'Identifier', name: opcode.namespace }, property: { type: 'Identifier', name: opcode.name } },
          arguments: params
        };
        statements.push({ type: 'ExpressionStatement', expression: callExpr });
      }
    } else if (opcode.mnemonic === Mnemonic.FADE_IN || opcode.mnemonic === Mnemonic.FADE_OUT) {
      // Special-case decompile: consume both stack params but show only the speed argument
      const params: Expression[] = [];
      if (this.stack.length < opcode.stackParams) {
        throw new Error(`Stack underflow for ${opcode.mnemonic} at line ${lineNumber}`);
      }
      for (let j = 0; j < opcode.stackParams; j++) {
        params.push(this.stack.pop() as Expression);
      }
      params.reverse();
      const speedParam = params[0];
      const callExpr: FunctionCallExpression = {
        type: 'FunctionCall',
        callee: { type: 'Member', object: { type: 'Identifier', name: opcode.namespace }, property: { type: 'Identifier', name: opcode.name } },
        arguments: [speedParam]
      };
      statements.push({ type: 'ExpressionStatement', expression: callExpr });
    } else if (opcode.pushesResult) {
      const params: Expression[] = [];
      if (this.stack.length < opcode.stackParams) {
        throw new Error(`Stack underflow for ${opcode.mnemonic} at line ${lineNumber}`);
      }
      for (let j = 0; j < opcode.stackParams; j++) {
        params.push(this.stack.pop() as Expression);
      }
      params.reverse();
      let expr: Expression;
      if (opcode.namespace === Namespace.Math) {
        expr = this.generateMathExpression(opcode, params);
      } else {
        expr = {
          type: 'FunctionCall',
          callee: { type: 'Member', object: { type: 'Identifier', name: opcode.namespace }, property: { type: 'Identifier', name: opcode.name } },
          arguments: params
        };
      }
      this.stack.push(expr);
    } else {
      const params: Expression[] = [];
      if (this.stack.length < opcode.stackParams) {
        throw new Error(`Stack underflow for ${opcode.mnemonic} at line ${lineNumber}`);
      }
      for (let j = 0; j < opcode.stackParams; j++) {
        params.push(this.stack.pop() as Expression);
      }
      params.reverse();
      const callExpr: FunctionCallExpression = {
        type: 'FunctionCall',
        callee: { type: 'Member', object: { type: 'Identifier', name: opcode.namespace }, property: { type: 'Identifier', name: opcode.name } },
        arguments: params
      };
      statements.push({ type: 'ExpressionStatement', expression: callExpr });
    }
  }

  private generatePushExpression(opcode: OpcodeDefinition, codeParams: string[]): Expression {
    const param = codeParams[0];
    const value = parseInt(param, 16);
    let address: number;
    let bit: number;
    let propertyName: string;
    let namespace: string;
    let base: number;

    const numberToString = (param: number): string => {
      if (param < 10) return `${param}`
      else return `0x${param.toString(16).toUpperCase()}`
    };


    switch (opcode.mnemonic) {
      case Mnemonic.PUSH_CONSTANT:
        // Interpret PUSH_CONSTANT values as signed 16-bit integers
        const signedValue = value >= 0x8000 ? value - 0x10000 : value;
        return { type: 'Literal', value: signedValue };
  
      case Mnemonic.PUSH_SAVEMAP_WORD:
        namespace = 'Savemap';
        base = this.namespaceBases[namespace]; // 0xBA4
        address = base + value;
        const addrStrWord = `0x${address.toString(16).toUpperCase()}`;
        if (savemapMapping[addrStrWord] && savemapMapping[addrStrWord].type === 'word') {
          return {
            type: 'Member',
            object: { type: 'Identifier', name: namespace },
            property: { type: 'Identifier', name: savemapMapping[addrStrWord].name }
          };
        } else {
          const savemapIndexExpr: IndexExpression = {
            type: 'Index',
            base: { type: 'Identifier', name: namespace },
            index: { type: 'Literal', value: addrStrWord }
          };
          return {
            type: 'Member',
            object: savemapIndexExpr,
            property: { type: 'Identifier', name: 'word' }
          };
        }
  
      case Mnemonic.PUSH_SAVEMAP_BYTE:
        namespace = 'Savemap';
        base = this.namespaceBases[namespace]; // 0xBA4
        address = base + value;
        const addrByteStr = `0x${address.toString(16).toUpperCase()}`;
        if (savemapMapping[addrByteStr] && savemapMapping[addrByteStr].type === 'byte') {
          return {
            type: 'Member',
            object: { type: 'Identifier', name: namespace },
            property: { type: 'Identifier', name: savemapMapping[addrByteStr].name }
          };
        } else {
          const savemapIndexExpr: IndexExpression = {
            type: 'Index',
            base: { type: 'Identifier', name: namespace },
            index: { type: 'Literal', value: addrByteStr }
          };
          return {
            type: 'Member',
            object: savemapIndexExpr,
            property: { type: 'Identifier', name: 'byte' }
          };
        }
  
      case Mnemonic.PUSH_SAVEMAP_BIT:
        namespace = 'Savemap';
        base = this.namespaceBases[namespace]; // 0xBA4
        const byteOffset = Math.floor(value / 8);
        address = base + byteOffset;
        bit = value % 8;
        const addrStr = `0x${address.toString(16).toUpperCase()}`;
        if (savemapMapping[addrStr] && savemapMapping[addrStr].type === 'byte') {
          const byteName = savemapMapping[addrStr].name;
          const savemapMember: MemberExpression = {
            type: 'Member',
            object: { type: 'Identifier', name: namespace },
            property: { type: 'Identifier', name: byteName }
          };
          const bitMember: MemberExpression = {
            type: 'Member',
            object: savemapMember,
            property: { type: 'Identifier', name: 'bit' }
          };
          return {
            type: 'Index',
            base: bitMember,
            index: { type: 'Literal', value: bit }
          };
        } else {
          const savemapIndexExpr: IndexExpression = {
            type: 'Index',
            base: { type: 'Identifier', name: namespace },
            index: { type: 'Literal', value: addrStr }
          };
          const bitMember: MemberExpression = {
            type: 'Member',
            object: savemapIndexExpr,
            property: { type: 'Identifier', name: 'bit' }
          };
          return {
            type: 'Index',
            base: bitMember,
            index: { type: 'Literal', value: bit }
          };
        }
  
      case Mnemonic.PUSH_TEMP_WORD:
      case Mnemonic.PUSH_TEMP_BYTE:
        namespace = 'Temp';
        base = this.namespaceBases[namespace]; // 0x0
        address = base + value;
        const tempIndexExpr: IndexExpression = {
          type: 'Index',
          base: { type: 'Identifier', name: namespace },
          index: { type: 'Literal', value: numberToString(address) }
        };
        propertyName = opcode.mnemonic === Mnemonic.PUSH_TEMP_WORD ? 'word' : 'byte';
        return {
          type: 'Member',
          object: tempIndexExpr,
          property: { type: 'Identifier', name: propertyName }
        };
  
      case Mnemonic.PUSH_SPECIAL_BYTE:
      case Mnemonic.PUSH_SPECIAL_WORD:
      case Mnemonic.PUSH_SPECIAL_BIT:
        const specialInfo = this.specialMap[value];
        if (specialInfo) {
          propertyName = specialInfo.name;
        } else {
          propertyName = `unknown_${value.toString(16).padStart(2, '0')}`;
        }
        return {
          type: 'Member',
          object: { type: 'Identifier', name: 'Special' },
          property: { type: 'Identifier', name: propertyName }
        };
  
      default:
        return {
          type: 'FunctionCall',
          callee: { type: 'Member', object: { type: 'Identifier', name: opcode.namespace }, property: { type: 'Identifier', name: opcode.name } },
          arguments: [{ type: 'Literal', value: `0x${value.toString(16).toUpperCase()}` }]
        };
    }
  }

  private generateMathExpression(opcode: OpcodeDefinition, params: Expression[]): Expression {
    if (params.length === 2) {
      const [left, right] = params;
      const operatorMap: Record<string, string> = {
        [Mnemonic.ADD]: '+',
        [Mnemonic.SUB]: '-',
        [Mnemonic.MUL]: '*',
        [Mnemonic.LT]: '<',
        [Mnemonic.GT]: '>',
        [Mnemonic.LE]: '<=',
        [Mnemonic.GE]: '>=',
        [Mnemonic.EQ]: '==',
        [Mnemonic.AND]: '&',
        [Mnemonic.OR]: '|',
        [Mnemonic.LAND]: 'and',
        [Mnemonic.LOR]: 'or',
        [Mnemonic.SHL]: '<<',
        [Mnemonic.SHR]: '>>'
      };
      const operator = operatorMap[opcode.mnemonic];
      if (operator) {
        return { type: 'Binary', operator, left, right };
      }
    }
    if (params.length === 1) {
      const operatorMap: Record<string, string> = {
        [Mnemonic.NEG]: '-',
        [Mnemonic.NOT]: '!'
      };
      const operator = operatorMap[opcode.mnemonic];
      if (operator) {
        return { type: 'Unary', operator, operand: params[0] };
      }
    }
    throw new Error(`Unsupported math operation: ${opcode.mnemonic}`);
  }

  private numberToHexString(value: number | string): string {
    const num = typeof value === 'string' ? parseInt(value, 16) : value;

    if (num >= 0) {
      // Positive numbers: convert to hex and pad
      return num.toString(16).padStart(num < 256 ? 2 : 4, '0').toUpperCase();
    } else {
      // Negative numbers: convert to two's complement as 16-bit words
      const wordValue = num & 0xFFFF;
      return wordValue.toString(16).padStart(4, '0').toUpperCase();
    }
  }

  private generateCode(): string {
    const lines = this.statements.map(stmt => this.generateNode(stmt, 0));
    return lines.join('\n');
  }

  private generateNode(node: Statement | Expression, indent: number, _parent: Statement | Expression | null = null, argIndex: number = 0): string {
    const indentation = '  '.repeat(indent);
    if (node.type === 'Literal') {
      if (_parent?.type === 'FunctionCall' && (_parent as FunctionCallExpression).callee.type === 'Member') {
        const callee = (_parent as FunctionCallExpression).callee as MemberExpression;
        const property = callee.property as IdentifierExpression;

        // For enter_field calls, use fieldsMapping
        if (['enter_field', 'set_field_entry_by_id'].includes(property.name) && argIndex === 0) {
          const value = (node as LiteralExpression).value;
          if (typeof value === 'number' && fieldsMapping[value]) {
            return `Fields.${fieldsMapping[value]}`;
          }
        }
  
        if (property.name === 'call_function' && argIndex === 0) {
          const value = (node as LiteralExpression).value;
          if (typeof value === 'number' && modelsMapping[value]) {
            return `Entities.${modelsMapping[value]}`;
          }
        }

        // For model related opcodes, use modelOpcodes
        const modelArgument = modelOpcodes.find(opcode => opcode.name === property.name);
        if (modelArgument && (property.name !== 'rotate_to_model' || argIndex !== 1)) {
          const value = (node as LiteralExpression).value;
          if (typeof value === 'number' && modelsMapping[value]) {
            return `Entities.${modelsMapping[value]}`;
          }
        }
      }
      return `${(node as LiteralExpression).value}`;
    } else if (node.type === 'Identifier') {
      return `${(node as IdentifierExpression).name}`;
    } else if (node.type === 'Member') {
      const memberNode = node as MemberExpression;
      return `${this.generateNode(memberNode.object, 0, node)}.${this.generateNode(memberNode.property, 0, node)}`;
    } else if (node.type === 'Index') {
      const indexNode = node as IndexExpression;
      const base = this.generateNode(indexNode.base, 0, node);
      const index = this.generateNode(indexNode.index, 0, node);
      return `${base}[${index}]`;
    } else if (node.type === 'FunctionCall') {
      const callNode = node as FunctionCallExpression;
      const callee = this.generateNode(callNode.callee, 0, node);
      const args = callNode.arguments.map((arg, index) => this.generateNode(arg, 0, node, index)).join(', ');
      return `${callee}(${args})`;
    } else if (node.type === 'Binary') {
      const binNode = node as BinaryExpression;
      const left = this.generateNode(binNode.left, 0, node);
      const rightExpr = binNode.right;
      let right = this.generateNode(rightExpr, 0, node);
      if (binNode.operator === '==' && binNode.left.type === 'Member' && binNode.left.object.type === 'Identifier' &&
          enumMaps[left] && rightExpr.type === 'Literal' && typeof rightExpr.value === 'number') {
        const enumValue = enumMaps[left].mapping[rightExpr.value];
        if (enumValue) right = enumMaps[left].namespace + '.' + enumValue;
      }
      return `${left} ${binNode.operator} ${right}`;
    } else if (node.type === 'Unary') {
      const unaryNode = node as UnaryExpression;
      const operand = this.generateNode(unaryNode.operand, 0, node);
      return `${unaryNode.operator}${operand}`;
    } else if (node.type === 'If') {
      const ifNode = node as IfStatement;
      const condition = this.generateNode(ifNode.condition, 0, node);
      const thenBranch = ifNode.thenBranch.map(stmt => this.generateNode(stmt, indent + 1, node)).join('\n');
      return `${indentation}if ${condition} then\n${thenBranch}\n${indentation}end`;
    } else if (node.type === 'Goto') {
      return `${indentation}goto ${(node as GotoStatement).label}`;
    } else if (node.type === 'Label') {
      return `${indentation}::${(node as LabelStatement).label}::`;
    } else if (node.type === 'ExpressionStatement') {
      return `${indentation}${this.generateNode((node as ExpressionStatement).expression, 0, node)}`;
    } else if (node.type === 'Assignment') {
      const assignNode = node as AssignmentStatement;
      const left = this.generateNode(assignNode.left, 0, node);
      const right = this.generateNode(assignNode.right, 0, node);
      return `${indentation}${left} = ${right}`;
    } else if (node.type === 'Return') {
      return `${indentation}return`;
    } else if (node.type === 'Block') {
      // This is a special case to handle multiple statements (when there's a label and a statement from handleOpcode)
      const blockNode = node as BlockStatement;
      const body = blockNode.body.map(stmt => this.generateNode(stmt, indent, node)).join('\n');
      return body;
    }
    return '';
  }

  public getStackState(): Expression[] {
    return [...this.stack];
  }

  public getStackHistory(): Array<{ operation: string, stack: Expression[], line: number, offset: number }> {
    return this.stackHistory;
  }
  public compile(luaCode: string): string {
    this.labelCounter = 0; // Reset label counter for each compilation
    this.offsetToLabelMap = new Map(); // Reset label map
    const codeWithoutComments = this.stripComments(luaCode);
    const tokens = this.tokenize(codeWithoutComments);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const processedAst = this.addResets(ast);
    const instructions = this.generateInstructions(processedAst);
    const resolvedInstructions = this.resolveLabels(instructions);
    return resolvedInstructions
      .map(inst => inst.mnemonic + (inst.codeParams.length > 0 ? ' ' + inst.codeParams.map(param => param.toUpperCase()).join(' ') : ''))
      .join('\n');
  }
  
  private addResets(ast: Statement[]): Statement[] {
    const processedAst: Statement[] = [];

    const addReset = (ast: Statement[]) => {
      ast.push({ type: 'ExpressionStatement', expression: { 
        type: 'FunctionCall', 
        callee: { 
          type: 'Member', 
          object: { type: 'Identifier', name: 'System' }, 
          property: { type: 'Identifier', name: 'reset_stack' } 
        }, 
        arguments: [] 
      }});
    }
    
    for (const stmt of ast) {
      // Add RESET before If statements
      if (stmt.type === 'If') {
        addReset(processedAst);
        
        // Process the condition and then branch recursively
        const ifStmt = stmt as IfStatement;
        ifStmt.thenBranch = this.addResets(ifStmt.thenBranch);
        processedAst.push(ifStmt);
      } 
      // Add RESET before function calls with stack params
      else if (stmt.type === 'ExpressionStatement' && 
               stmt.expression.type === 'FunctionCall') {
        const expr = stmt.expression as FunctionCallExpression;
        if (expr.callee.type === 'Member') {
          const callee = expr.callee as MemberExpression;
          const objectName = (callee.object as IdentifierExpression).name;
          const functionName = (callee.property as IdentifierExpression).name;
          
          // Check if this function has stack params
          const opcode = Object.values(Opcodes).find(
            op => op.namespace === objectName && op.name === functionName && op.stackParams > 0
          );
          
          if (opcode || (objectName === 'System' && functionName === 'call_function') || 
              (objectName === 'Memory' && functionName === 'write')) {
            addReset(processedAst);
          }
        }
        processedAst.push(stmt);
      } 
      else if (stmt.type === 'Assignment') {
        addReset(processedAst);
        processedAst.push(stmt);
      }
      else {
        processedAst.push(stmt);
      }
    }
    
    return processedAst;
  }

  private stripComments(code: string): string {
    const lines = code.split('\n');
    const processedLines = lines.map(line => {
      const commentIndex = line.indexOf('--');
      if (commentIndex === -1) {
        return line;
      }

      // Check if the '--' is inside a string literal
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let escaped = false;

      for (let i = 0; i < commentIndex; i++) {
        const char = line[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === "'" && !inDoubleQuote) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
        }
      }

      // If we're inside a string literal, the '--' is not a comment
      if (inSingleQuote || inDoubleQuote) {
        return line;
      }

      // Remove the comment part (everything from '--' to end of line)
      return line.substring(0, commentIndex).trimEnd();
    });

    return processedLines.join('\n');
  }

  private tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    const regex = /\s*(::|<=|>=|==|!=|<<|>>|<|>|or|and|!|\+|\*|\/|\||\&|\[|\]|\w+|[\.\(\),=:]|-?\d+|-?0x[0-9a-fA-F]+|-)\s*/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      const value = match[1];
      if (value === '::') tokens.push({ type: 'label_delim', value });
      else if (value.match(/^-?\d+$/)) tokens.push({ type: 'number', value });
      else if (value.match(/^-?0x[0-9a-fA-F]+$/)) tokens.push({ type: 'number', value });
      else if (['<=', '>=', '==', '!=', '<', '>', 'or', 'and', '!', '-', '+', '<<', '>>', '*', '/', '|', '&'].includes(value)) tokens.push({ type: 'operator', value });
      else if (value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        if (['if', 'then', 'end', 'goto', 'return'].includes(value)) tokens.push({ type: 'keyword', value });
        else tokens.push({ type: 'identifier', value });
      }
      else if (['.', '(', ')', ',', '=', '[', ']'].includes(value)) tokens.push({ type: 'punct', value });
      else throw new Error(`Unknown token: ${value}`);
    }
    return tokens;
  }

  private generateInstructions(ast: Statement[]): Instruction[] {
    const instructions: Instruction[] = [];
    ast.forEach(stmt => instructions.push(...this.generateStatement(stmt)));
    return instructions;
  }

  private generateAssignmentStatement(stmt: AssignmentStatement): Instruction[] {
    const leftInstructions = this.generateExpression(stmt.left);
    const rightInstructions = this.generateExpression(stmt.right);
    return [...leftInstructions, ...rightInstructions, { type: 'instruction', mnemonic: 'WRITE', codeParams: [] }];
  }  

  private generateStatement(stmt: Statement): Instruction[] {
    switch (stmt.type) {
      case 'If': return this.generateIfStatement(stmt);
      case 'Goto': return [{ type: 'instruction', mnemonic: 'GOTO', codeParams: [stmt.label] }];
      case 'Label': return [{ type: 'label', label: stmt.label }];
      case 'Return': return [{ type: 'instruction', mnemonic: 'RETURN', codeParams: [] }];
      case 'ExpressionStatement': return this.generateExpressionStatement(stmt);
      case 'Assignment': return this.generateAssignmentStatement(stmt);
      case 'Block': throw new Error('Block statements are not supported in this context.');
      default: throw new Error(`Unsupported statement type: ${(stmt as any).type}`);
    }
  }

  private generateIfStatement(stmt: IfStatement): Instruction[] {
    const labelEnd = `__end_if_${this.labelCounter++}`; // Unique internal label
    const instructions: Instruction[] = [];
    instructions.push(...this.generateExpression(stmt.condition));
    instructions.push({ type: 'instruction', mnemonic: 'GOTO_IF_FALSE', codeParams: [labelEnd] });
    stmt.thenBranch.forEach(branchStmt => instructions.push(...this.generateStatement(branchStmt)));
    instructions.push({ type: 'label', label: labelEnd });
    return instructions;
  }

  private generateExpressionStatement(stmt: ExpressionStatement): Instruction[] {
    const expr = stmt.expression;
    if (expr.type !== 'FunctionCall') throw new Error(`Expression statement must be a function call, got: ${expr.type}`);
    const callee = expr.callee as MemberExpression;
    const objectName = (callee.object as IdentifierExpression).name;
    const functionName = (callee.property as IdentifierExpression).name;

    if (objectName === 'System' && functionName === 'call_function') {
      if (expr.arguments.length !== 2) throw new Error('System.call_function expects exactly two arguments.');
      const [entityIdExpr, funcIdExpr] = expr.arguments;
      if (funcIdExpr.type !== 'Literal' || typeof funcIdExpr.value !== 'number') throw new Error('Second argument to System.call_function must be a numeric literal.');
      const funcId = funcIdExpr.value;
      const instructions = this.generateExpression(entityIdExpr);
      instructions.push({ type: 'instruction', mnemonic: `CALL_FN_${funcId}`, codeParams: [] });
      return instructions;
    } else if (objectName === 'Memory' && functionName === 'write') {
      if (expr.arguments.length !== 2) throw new Error('Memory.write expects exactly two arguments.');
      const [addressExpr, valueExpr] = expr.arguments;
      const instructions: Instruction[] = [];
      instructions.push(...this.generateExpression(addressExpr));
      instructions.push(...this.generateExpression(valueExpr));
      instructions.push({ type: 'instruction', mnemonic: 'WRITE', codeParams: [] });
      return instructions;
    } else if (objectName === 'System' && functionName === 'wait') {
      // Special case for System.wait() - generate both WAIT_FRAMES and WAIT opcodes
      if (expr.arguments.length !== 1) throw new Error('System.wait expects exactly one argument.');
      const frameCountExpr = expr.arguments[0];
      const instructions: Instruction[] = [];
      
      // Generate code to push the frame count
      instructions.push(...this.generateExpression(frameCountExpr));
      
      // Generate WAIT_FRAMES followed by WAIT
      instructions.push({ type: 'instruction', mnemonic: 'WAIT_FRAMES', codeParams: [] });
      instructions.push({ type: 'instruction', mnemonic: 'WAIT', codeParams: [] });
      
      return instructions;
    } else if (objectName === 'System' && (functionName === 'fade_in' || functionName === 'fade_out')) {
      // Accept single-arg API and insert implicit 0 for the unused parameter
      if (expr.arguments.length !== 1 && expr.arguments.length !== 2) {
        throw new Error('System.fade_in/out expects one (speed) or two arguments.');
      }
      const opcode = this.getOpcodeForFunctionCall(callee);
      const instructions: Instruction[] = [];
      // Always push speed first
      instructions.push(...this.generateExpression(expr.arguments[0]));
      // Push unused arg: use provided second arg if present, otherwise implicit 0
      if (expr.arguments.length === 2) {
        instructions.push(...this.generateExpression(expr.arguments[1]));
      } else {
        instructions.push(...this.generateExpression({ type: 'Literal', value: 0 } as LiteralExpression));
      }
      instructions.push({ type: 'instruction', mnemonic: opcode.mnemonic, codeParams: [] });
      return instructions;
    } else {
      const opcode = this.getOpcodeForFunctionCall(callee);
      if (opcode.pushesResult) throw new Error(`Function ${objectName}.${functionName} pushes a result and cannot be used as a statement.`);
      const instructions: Instruction[] = [];
      expr.arguments.forEach(arg => instructions.push(...this.generateExpression(arg)));
      instructions.push({ type: 'instruction', mnemonic: opcode.mnemonic, codeParams: [] });
      return instructions;
    }
  }

  private generateExpression(expr: Expression): Instruction[] {
    switch (expr.type) {
      case 'Literal':
        const value = typeof expr.value === 'boolean' ? (expr.value ? 1 : 0) : expr.value;
        return [{ type: 'instruction', mnemonic: 'PUSH_CONSTANT', codeParams: [this.numberToHexString(value)] }];
      case 'Identifier':
        throw new Error('Bare identifiers are not supported in expressions.');
      case 'Member':
        if (expr.object.type === 'Index' && expr.object.base.type === 'Identifier' &&
            ['Savemap', 'Special', 'Temp'].includes(expr.object.base.name) &&
            expr.object.index.type === 'Literal' &&
            expr.property.type === 'Identifier' && ['byte', 'word'].includes(expr.property.name)) {
          const namespace = expr.object.base.name;
          let address = expr.object.index.value;
          if (typeof address === "string" && address.startsWith('0x')) {
            address = parseInt(address.slice(2), 16);
          }
          const base = this.namespaceBases[namespace] || 0;
          const offset = address as number - base;
          if (offset < 0 || offset > 0xFFFF) throw new Error('Invalid offset');
          const mnemonic = expr.property.name === 'byte' ? `PUSH_${namespace.toUpperCase()}_BYTE` : `PUSH_${namespace.toUpperCase()}_WORD`;
          return [{ type: 'instruction', mnemonic, codeParams: [offset.toString(16).padStart(Number(offset) < 0x100 ? 2 : 4, '0')] }];
        } else if (expr.object.type === 'Identifier' && expr.object.name === 'Savemap') {
          const propertyName = (expr.property as IdentifierExpression).name;
          const mappingEntry = Object.entries(savemapMapping).find(([_, entry]) => entry.name === propertyName);
          if (mappingEntry) {
            const address = parseInt(mappingEntry[0].slice(2), 16);
            const base = this.namespaceBases['Savemap'];
            const offset = address - base;
            const type = mappingEntry[1].type;
            let mnemonic: string;
            if (type === 'word') {
              mnemonic = 'PUSH_SAVEMAP_WORD';
            } else if (type === 'byte') {
              mnemonic = 'PUSH_SAVEMAP_BYTE';
            } else {
              throw new Error(`Unsupported type for Savemap variable ${propertyName}: ${type}`);
            }
            return [{ type: 'instruction', mnemonic, codeParams: [offset.toString(16).padStart(Number(offset) < 0x100 ? 2 : 4, '0')] }];
          }
          // If not found in savemapMapping, fall through to error
        } else if (expr.object.type === 'Identifier' && expr.object.name === 'Special') {
          const propertyName = (expr.property as IdentifierExpression).name;
          if (propertyName.startsWith('unknown_')) {
            const valueStr = propertyName.slice(8);
            const value = parseInt(valueStr, 16);
            if (isNaN(value)) throw new Error(`Invalid unknown Special variable: ${propertyName}`);
            const valueHex = value.toString(16).padStart(value < 0x100 ? 2 : 4, '0');
            return [{ type: 'instruction', mnemonic: 'PUSH_SPECIAL_BYTE', codeParams: [valueHex] }];
          } else {
            const variable = this.specialVariables[propertyName];
            if (variable) {
              const mnemonic = variable.type === 'byte' ? 'PUSH_SPECIAL_BYTE' : variable.type === 'word' ? 'PUSH_SPECIAL_WORD' : 'PUSH_SPECIAL_BIT';
              const valueHex = variable.value.toString(16).padStart(variable.value < 0x100 ? 2 : 4, '0');
              return [{ type: 'instruction', mnemonic, codeParams: [valueHex] }];
            } else {
              throw new Error(`Unknown Special variable: ${propertyName}`);
            }
          }
        } else if (expr.object.type === 'Identifier' && expr.object.name === 'Entities') {
          const id = this.modelsMappingInverse[expr.property.name];
          if (id !== undefined) return [{ type: 'instruction', mnemonic: 'PUSH_CONSTANT', codeParams: [id.toString(16).padStart(2, '0')] }];
        } else if (expr.object.type === 'Identifier' && expr.object.name === 'Fields') {
          const id = this.fieldsMappingInverse[expr.property.name];
          if (id !== undefined) return [{ type: 'instruction', mnemonic: 'PUSH_CONSTANT', codeParams: [id.toString(16).padStart(2, '0')] }];
        }
        throw new Error(`Unknown member expression: ${(expr.object as IdentifierExpression).name}.${expr.property.name}`);
      case 'Index':
        if (expr.base.type === 'Member' && expr.base.object.type === 'Member' &&
            expr.base.object.object.type === 'Identifier' && expr.base.object.object.name === 'Savemap' &&
            expr.base.property.type === 'Identifier' && expr.base.property.name === 'bit' &&
            expr.index.type === 'Literal' && typeof expr.index.value === 'number') {
          const propertyName = (expr.base.object.property as IdentifierExpression).name;
          const mappingEntry = Object.entries(savemapMapping).find(([_, entry]) => entry.name === propertyName && entry.type === 'byte');
          if (mappingEntry) {
            const address = parseInt(mappingEntry[0].slice(2), 16);
            const base = this.namespaceBases['Savemap'];
            const byteOffset = address - base;
            const bit = expr.index.value;
            if (bit < 0 || bit > 7) throw new Error('Bit index out of range');
            const value = (byteOffset * 8) + bit;
            return [{ type: 'instruction', mnemonic: 'PUSH_SAVEMAP_BIT', codeParams: [value.toString(16).padStart(4, '0')] }];
          } else {
            throw new Error(`Unknown Savemap byte property: ${propertyName}`);
          }
        } else if (expr.base.type === 'Member' && expr.base.object.type === 'Index' &&
            expr.base.object.base.type === 'Identifier' && ['Savemap', 'Special', 'Temp'].includes(expr.base.object.base.name) &&
            expr.base.object.index.type === 'Literal' &&
            expr.base.property.type === 'Identifier' && expr.base.property.name === 'bit' &&
            expr.index.type === 'Literal' && typeof expr.index.value === 'number') {
          const namespace = expr.base.object.base.name;
          let address = expr.base.object.index.value;
          if (typeof address === "string" && address.startsWith('0x')) {
            address = parseInt(address.slice(2), 16);
          }
          const bit = expr.index.value;
          const base = this.namespaceBases[namespace] || 0;
          const offset = address as number - base;
          if (offset < 0 || offset > 0xFFFF) throw new Error('Invalid offset');
          if (bit < 0 || bit > 7) throw new Error('Bit index out of range');
          const value = (offset * 8) + bit;
          return [{ type: 'instruction', mnemonic: `PUSH_${namespace.toUpperCase()}_BIT`, codeParams: [value.toString(16).padStart(4, '0')] }];
        }
        throw new Error('Unsupported index expression in this context');
      case 'FunctionCall':
        return this.generateFunctionCallExpression(expr);
      case 'Binary':
        return this.generateBinaryExpression(expr);
      case 'Unary':
        return this.generateUnaryExpression(expr);
      default:
        throw new Error(`Unsupported expression type: ${(expr as any).type}`);
    }
  }

  private generateFunctionCallExpression(expr: FunctionCallExpression): Instruction[] {
    const callee = expr.callee as MemberExpression;
    const objectName = (callee.object as IdentifierExpression).name;
    const functionName = (callee.property as IdentifierExpression).name;

    // Handle special opcodes with code parameters
    if (['Savemap', 'Special', 'Temp'].includes(objectName) && ['bit', 'byte', 'word'].includes(functionName)) {
      const base = this.namespaceBases[objectName] || 0;
      if (functionName === 'bit') {
        if (expr.arguments.length !== 2) {
          throw new Error(`${objectName}.bit expects two arguments`);
        }
        const [addressExpr, bitExpr] = expr.arguments;
        if (addressExpr.type !== 'Literal' || bitExpr.type !== 'Literal') throw new Error('Arguments to bit must be literals');
        const address = Number(addressExpr.value);
        const bit = Number(bitExpr.value);
        const value = (address - base) * 8 + bit;
        return [{ type: 'instruction', mnemonic: `PUSH_${objectName.toUpperCase()}_BIT`, codeParams: [value.toString(16).padStart(Number(value) < 0x100 ? 2 : 4, '0')] }];
      } else if (functionName === 'byte' || functionName === 'word') {
        if (expr.arguments.length !== 1) throw new Error(`${objectName}.${functionName} expects one argument`);
        const addressExpr = expr.arguments[0];
        if (addressExpr.type !== 'Literal') throw new Error('Argument to byte/word must be a literal');
        const address = Number(addressExpr.value);
        const offset = address - base;
        const mnemonic = functionName === 'byte' ? `PUSH_${objectName.toUpperCase()}_BYTE` : `PUSH_${objectName.toUpperCase()}_WORD`;
        return [{ type: 'instruction', mnemonic, codeParams: [offset.toString(16).padStart(Number(offset) < 0x100 ? 2 : 4, '0')] }];
      }
    }

    const opcode = this.getOpcodeForFunctionCall(callee);
    if (!opcode.pushesResult) throw new Error(`Function ${objectName}.${functionName} does not push a result.`);
    const instructions: Instruction[] = [];
    expr.arguments.forEach(arg => instructions.push(...this.generateExpression(arg)));
    instructions.push({ type: 'instruction', mnemonic: opcode.mnemonic, codeParams: [] });
    return instructions;
  }

  private generateBinaryExpression(expr: BinaryExpression): Instruction[] {
    const leftInstructions = this.generateExpression(expr.left);
    const rightInstructions = this.generateExpression(expr.right);
    const operatorMnemonic: Record<string, string> = {
      '+': 'ADD', '-': 'SUB', '*': 'MUL', '<': 'LT', '>': 'GT', '<=': 'LE', '>=': 'GE', '==': 'EQ',
      '&': 'AND', '|': 'OR', 'and': 'LAND', 'or': 'LOR', '<<': 'SHL', '>>': 'SHR'
    };
    const mnemonic = operatorMnemonic[expr.operator];
    if (!mnemonic) throw new Error(`Unsupported operator: ${expr.operator}`);
    return [...leftInstructions, ...rightInstructions, { type: 'instruction', mnemonic, codeParams: [] }];
  }

  private generateUnaryExpression(expr: UnaryExpression): Instruction[] {
    const operandInstructions = this.generateExpression(expr.operand);
    const operatorMnemonic: Record<string, string> = {
      '-': 'NEG', '!': 'NOT'
    };
    const mnemonic = operatorMnemonic[expr.operator];
    if (!mnemonic) throw new Error(`Unsupported operator: ${expr.operator}`);
    return [...operandInstructions, { type: 'instruction', mnemonic, codeParams: [] }];
  }

  private getOpcodeForFunctionCall(callee: MemberExpression): OpcodeDefinition {
    const namespace = (callee.object as IdentifierExpression).name;
    const functionName = (callee.property as IdentifierExpression).name;
    if (namespace === 'Savemap' && functionName === 'bit') {
      return Opcodes[0x114];
    } else if (namespace === 'Savemap' && functionName === 'byte') {
      return Opcodes[0x118];
    } else if (namespace === 'Savemap' && functionName === 'word') {
      return Opcodes[0x11b];
    }
    const opcode = Object.values(Opcodes).find(op => op.namespace === namespace && op.name === functionName);
    if (!opcode) throw new Error(`Unknown function: ${namespace}.${functionName}`);
    return opcode;
  }

  private resolveLabels(instructions: Instruction[]): { mnemonic: string; codeParams: string[] }[] {
    const labelOffsets = new Map<string, number>();
    let offset = this.startingOffset;
    for (const inst of instructions) {
      if (inst.type === 'label') labelOffsets.set(inst.label, offset);
      else offset += this.getInstructionSize(inst);
    }
    const resolved: { mnemonic: string; codeParams: string[] }[] = [];
    for (const inst of instructions) {
      if (inst.type === 'instruction') {
        const codeParams = inst.codeParams.map(param => {
          if (labelOffsets.has(param)) {
            const targetOffset = labelOffsets.get(param)!;
            return targetOffset.toString(16).padStart(targetOffset < 0x100 ? 2 : 4, '0');
          }
          return param;
        });
        resolved.push({ mnemonic: inst.mnemonic, codeParams });
      }
    }
    return resolved;
  }

  private getInstructionSize(inst: Instruction): number {
    if (inst.type === 'label') return 0;
    return inst.mnemonic.startsWith('CALL_FN_') ? 1 : 1 + inst.codeParams.length;
  }  
}
