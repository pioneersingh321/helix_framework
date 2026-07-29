/**
 * Helix.js Behavior Plugin v1.3.1
 * Production-hardened pipe-delimited DOM behavior scripting
 * NEW: Self-cycle detection (Phase 1) + Cross-cycle detection (Phase 2)
 *
 * Requires: Helix.js >= v11.1.5-STABLE
 */
(function (global) {
  'use strict';

  const PLUGIN_NAME = 'behavior';
  const VERSION = '1.3.1';
  const ATTR_SUFFIX = 'pipe';

  /* ============================================================
     CROSS-CYCLE DETECTION — GLOBAL GRAPH
     ============================================================ */

  const refReaders = new Map();   // refName -> Set<entry>
  const refWriters = new Map();   // refName -> Set<entry>

  function clearEntryFromGraph(entry) {
    for (const set of refReaders.values()) set.delete(entry);
    for (const set of refWriters.values()) set.delete(entry);
    entry.lastReads = null;
    entry.lastWrites = null;
  }

  function updateGraph(entry, reads, writes) {
    clearEntryFromGraph(entry);
    entry.lastReads = reads;
    entry.lastWrites = writes;
    for (const ref of reads) {
      if (!refReaders.has(ref)) refReaders.set(ref, new Set());
      refReaders.get(ref).add(entry);
    }
    for (const ref of writes) {
      if (!refWriters.has(ref)) refWriters.set(ref, new Set());
      refWriters.get(ref).add(entry);
    }
  }

  function detectCrossCycle(startEntry, startRef) {
    const visited = new Set();
    const path = [];
    const stack = [{ entry: startEntry, via: startRef, depth: 0 }];

    while (stack.length > 0) {
      const { entry, via, depth } = stack.pop();

      // Prevent infinite traversal
      if (depth > 50) continue;

      if (visited.has(entry)) {
        // Found a cycle — collect all entries in the cycle
        const cycleEntries = new Set();
        let collecting = false;
        for (const node of path) {
          if (node.entry === entry) collecting = true;
          if (collecting) cycleEntries.add(node.entry);
        }
        cycleEntries.add(entry);

        console.error(
          `[behavior] CROSS-CYCLE DETECTED: reactive loop between ${cycleEntries.size} live behaviors.`,
          `
Triggered by "$${via}".`,
          `
All involved pipelines are permanently frozen. Fix the logic to break the cycle.`
        );

        for (const e of cycleEntries) {
          e.cycled = true;
        }
        return true;
      }

      visited.add(entry);
      path.push({ entry, via });

      // This entry writes to refs. Which other entries read those refs?
      const writes = entry.lastWrites || new Set();
      for (const writtenRef of writes) {
        const readers = refReaders.get(writtenRef);
        if (readers) {
          for (const reader of readers) {
            if (reader !== entry && !reader.cycled && !reader.disposed) {
              stack.push({ entry: reader, via: writtenRef, depth: depth + 1 });
            }
          }
        }
      }
    }
    return false;
  }

  /* ============================================================
     CONFIG
     ============================================================ */

  const DEFAULT_CONFIG = {
    allowWindow: false,
    allowDocument: false,
    allowedGlobals: [
      'Math', 'JSON', 'Date', 'console',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite',
      'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent',
      'String', 'Number', 'Boolean', 'Array', 'Object', 'RegExp', 'Error',
      'Promise', 'Set', 'Map', 'WeakSet', 'WeakMap', 'Symbol', 'BigInt',
      'undefined', 'NaN', 'Infinity'
    ],
    blockedProps: ['__proto__', 'constructor', 'prototype'],
    maxQueueSize: 10,
    domBatch: true,
    liveDedupe: true,
    autoBatchDOM: true
  };

  /* ============================================================
     1. TOKENIZER
     ============================================================ */

  const TT = {
    WORD: 'WORD', STRING: 'STRING', NUMBER: 'NUMBER',
    PIPE: 'PIPE', ARROW: 'ARROW',
    LBRACKET: 'LBRACKET', RBRACKET: 'RBRACKET',
    LPAREN: 'LPAREN', RPAREN: 'RPAREN',
    COMMA: 'COMMA', COLON: 'COLON', DOT: 'DOT',
    PLUS: 'PLUS', MINUS: 'MINUS', STAR: 'STAR', SLASH: 'SLASH', PERCENT: 'PERCENT',
    EQ: 'EQ', NEQ: 'NEQ', LT: 'LT', GT: 'GT', LTE: 'LTE', GTE: 'GTE',
    AND: 'AND', OR: 'OR', NOT: 'NOT',
    QMARK: 'QMARK',
    EOF: 'EOF'
  };

  function tokenize(source) {
    const tokens = [];
    let i = 0;

    while (i < source.length) {
      const ch = source[i];

      if (/\s/.test(ch)) { i++; continue; }

      if (ch === "'" || ch === '"') {
        const quote = ch;
        let str = '';
        i++;
        while (i < source.length && source[i] !== quote) {
          if (source[i] === '\\' && i + 1 < source.length) {
            str += source[i + 1];
            i += 2;
          } else {
            str += source[i];
            i++;
          }
        }
        i++;
        tokens.push({ type: TT.STRING, value: str });
        continue;
      }

      if (ch === '|' && source[i + 1] === '>') { tokens.push({ type: TT.PIPE }); i += 2; continue; }
      if (ch === '=' && source[i + 1] === '>') { tokens.push({ type: TT.ARROW }); i += 2; continue; }
      if (ch === '=' && source[i + 1] === '=' && source[i + 2] === '=') { tokens.push({ type: TT.EQ, strict: true }); i += 3; continue; }
      if (ch === '=' && source[i + 1] === '=') { tokens.push({ type: TT.EQ, strict: false }); i += 2; continue; }
      if (ch === '!' && source[i + 1] === '=' && source[i + 2] === '=') { tokens.push({ type: TT.NEQ, strict: true }); i += 3; continue; }
      if (ch === '!' && source[i + 1] === '=') { tokens.push({ type: TT.NEQ, strict: false }); i += 2; continue; }
      if (ch === '<' && source[i + 1] === '=') { tokens.push({ type: TT.LTE }); i += 2; continue; }
      if (ch === '>' && source[i + 1] === '=') { tokens.push({ type: TT.GTE }); i += 2; continue; }
      if (ch === '&' && source[i + 1] === '&') { tokens.push({ type: TT.AND }); i += 2; continue; }
      if (ch === '|' && source[i + 1] === '|') { tokens.push({ type: TT.OR }); i += 2; continue; }

      if (ch === '[') { tokens.push({ type: TT.LBRACKET }); i++; continue; }
      if (ch === ']') { tokens.push({ type: TT.RBRACKET }); i++; continue; }
      if (ch === '(') { tokens.push({ type: TT.LPAREN }); i++; continue; }
      if (ch === ')') { tokens.push({ type: TT.RPAREN }); i++; continue; }
      if (ch === ',') { tokens.push({ type: TT.COMMA }); i++; continue; }
      if (ch === ':') { tokens.push({ type: TT.COLON }); i++; continue; }
      if (ch === '.') { tokens.push({ type: TT.DOT }); i++; continue; }
      if (ch === '+') { tokens.push({ type: TT.PLUS }); i++; continue; }
      if (ch === '-') { tokens.push({ type: TT.MINUS }); i++; continue; }
      if (ch === '*') { tokens.push({ type: TT.STAR }); i++; continue; }
      if (ch === '/') { tokens.push({ type: TT.SLASH }); i++; continue; }
      if (ch === '%') { tokens.push({ type: TT.PERCENT }); i++; continue; }
      if (ch === '<') { tokens.push({ type: TT.LT }); i++; continue; }
      if (ch === '>') { tokens.push({ type: TT.GT }); i++; continue; }
      if (ch === '?') { tokens.push({ type: TT.QMARK }); i++; continue; }
      if (ch === '!') { tokens.push({ type: TT.NOT }); i++; continue; }

      if (/\d/.test(ch) || (ch === '-' && /\d/.test(source[i + 1]))) {
        let num = '';
        if (ch === '-') { num += ch; i++; }
        while (i < source.length && /[\d.]/.test(source[i])) {
          num += source[i];
          i++;
        }
        tokens.push({ type: TT.NUMBER, value: parseFloat(num) });
        continue;
      }

      if (/[a-zA-Z_$#@]/.test(ch)) {
        let word = ch;
        i++;
        while (i < source.length && /[a-zA-Z0-9_$#@\-]/.test(source[i])) {
          word += source[i];
          i++;
        }
        while (i < source.length && source[i] === '[') {
          let depth = 1;
          word += '[';
          i++;
          while (i < source.length && depth > 0) {
            if (source[i] === '[') depth++;
            if (source[i] === ']') depth--;
            word += source[i];
            i++;
          }
        }
        if (word === 'mod') { tokens.push({ type: TT.PERCENT }); continue; }
        if (word === 'and') { tokens.push({ type: TT.AND }); continue; }
        if (word === 'or') { tokens.push({ type: TT.OR }); continue; }
        if (word === 'not') { tokens.push({ type: TT.NOT }); continue; }
        tokens.push({ type: TT.WORD, value: word });
        continue;
      }

      i++;
    }

    tokens.push({ type: TT.EOF });
    return tokens;
  }

  /* ============================================================
     2. EXPRESSION PARSER (AST with precedence)
     ============================================================ */

  const EXPR_OPS = {
    [TT.OR]: { prec: 1, assoc: 'left', fn: (a, b) => a || b },
    [TT.AND]: { prec: 2, assoc: 'left', fn: (a, b) => a && b },
    [TT.EQ]: { prec: 3, assoc: 'left', fn: (a, b, strict) => strict ? a === b : a == b },
    [TT.NEQ]: { prec: 3, assoc: 'left', fn: (a, b, strict) => strict ? a !== b : a != b },
    [TT.LT]: { prec: 4, assoc: 'left', fn: (a, b) => a < b },
    [TT.GT]: { prec: 4, assoc: 'left', fn: (a, b) => a > b },
    [TT.LTE]: { prec: 4, assoc: 'left', fn: (a, b) => a <= b },
    [TT.GTE]: { prec: 4, assoc: 'left', fn: (a, b) => a >= b },
    [TT.PLUS]: { prec: 5, assoc: 'left', fn: (a, b) => a + b },
    [TT.MINUS]: { prec: 5, assoc: 'left', fn: (a, b) => a - b },
    [TT.STAR]: { prec: 6, assoc: 'left', fn: (a, b) => a * b },
    [TT.SLASH]: { prec: 6, assoc: 'left', fn: (a, b) => a / b },
    [TT.PERCENT]: { prec: 6, assoc: 'left', fn: (a, b) => a % b },
  };

  class ExprParser {
    constructor(tokens, stopTypes = []) {
      this.tokens = tokens;
      this.pos = 0;
      this.stopTypes = stopTypes;
    }
    peek() { return this.tokens[this.pos]; }
    advance() { return this.tokens[this.pos++]; }
    match(...types) {
      if (types.includes(this.peek().type)) return this.advance();
      return null;
    }
    isStop() {
      return this.stopTypes.includes(this.peek().type);
    }

    parse() { return this.parseOr(); }
    parseOr() { return this.parseBinary(this.parseAnd, [TT.OR]); }
    parseAnd() { return this.parseBinary(this.parseEquality, [TT.AND]); }
    parseEquality() { return this.parseBinary(this.parseComparison, [TT.EQ, TT.NEQ]); }
    parseComparison() { return this.parseBinary(this.parseAdditive, [TT.LT, TT.GT, TT.LTE, TT.GTE]); }
    parseAdditive() { return this.parseBinary(this.parseMultiplicative, [TT.PLUS, TT.MINUS]); }
    parseMultiplicative() { return this.parseBinary(this.parseUnary, [TT.STAR, TT.SLASH, TT.PERCENT]); }

    parseBinary(nextFn, ops) {
      let left = nextFn.call(this);
      while (!this.isStop() && ops.includes(this.peek().type)) {
        const op = this.advance();
        const right = nextFn.call(this);
        left = { type: 'binary', op: op.type, strict: op.strict, left, right };
      }
      return left;
    }

    parseUnary() {
      if (!this.isStop() && (this.peek().type === TT.NOT || this.peek().type === TT.MINUS || this.peek().type === TT.PLUS)) {
        const op = this.advance();
        const arg = this.parseUnary();
        return { type: 'unary', op: op.type, arg };
      }
      return this.parsePostfix();
    }

    parsePostfix() {
      let node = this.parsePrimary();
      while (!this.isStop()) {
        if (this.peek().type === TT.DOT) {
          this.advance();
          const prop = this.expect(TT.WORD).value;
          node = { type: 'prop', object: node, prop };
        } else if (this.peek().type === TT.LBRACKET) {
          this.advance();
          const index = this.parse();
          this.expect(TT.RBRACKET);
          node = { type: 'index', object: node, index };
        } else {
          break;
        }
      }
      return node;
    }

    parsePrimary() {
      if (this.isStop()) throw new Error('Unexpected end of expression');
      const tok = this.peek();
      if (tok.type === TT.NUMBER) { this.advance(); return { type: 'literal', value: tok.value }; }
      if (tok.type === TT.STRING) { this.advance(); return { type: 'literal', value: tok.value }; }
      if (tok.type === TT.WORD) { this.advance(); return { type: 'ident', name: tok.value }; }
      if (tok.type === TT.LPAREN) {
        this.advance();
        const expr = this.parse();
        this.expect(TT.RPAREN);
        return expr;
      }
      throw new Error(`Unexpected token in expression: ${tok.type}`);
    }

    expect(type) {
      const tok = this.peek();
      if (tok.type !== type) throw new Error(`Expected ${type}, got ${tok.type}`);
      return this.advance();
    }
  }

  /* ============================================================
     3. RECURSIVE DESCENT PARSER
     ============================================================ */

  class Parser {
    constructor(tokens) {
      this.tokens = tokens;
      this.pos = 0;
    }
    peek() { return this.tokens[this.pos]; }
    advance() { return this.tokens[this.pos++]; }
    expect(type) {
      const tok = this.peek();
      if (tok.type !== type) throw new Error(`Expected ${type}, got ${tok?.type} (${tok?.value})`);
      return this.advance();
    }

    parse() {
      const events = this.parseEventList();
      this.expect(TT.ARROW);
      const pipeline = this.parsePipeline();
      this.expect(TT.EOF);
      return { events, pipeline };
    }

    parseEventList() {
      const events = [this.parseEventSpec()];
      while (this.peek().type === TT.COMMA) {
        this.advance();
        events.push(this.parseEventSpec());
      }
      return events;
    }

    parseEventSpec() {
      const name = this.expect(TT.WORD).value;
      const mods = [];
      while (this.peek().type === TT.DOT) {
        this.advance();
        const modName = this.expect(TT.WORD).value;
        let param = null;
        if (this.peek().type === TT.COLON) {
          this.advance();
          const val = this.peek();
          if (val.type === TT.NUMBER || val.type === TT.WORD || val.type === TT.STRING) {
            param = this.advance().value;
          }
        }
        mods.push({ name: modName, param });
      }
      return { name, mods };
    }

    parsePipeline() {
      if (this.peek().type === TT.LBRACKET) {
        return this.parseArrayBody();
      }
      const steps = [this.parseStep()];
      while (this.peek().type === TT.PIPE) {
        this.advance();
        steps.push(this.parseStep());
      }
      return steps;
    }

    parseArrayBody() {
      this.expect(TT.LBRACKET);
      const steps = [];
      while (this.peek().type !== TT.RBRACKET && this.peek().type !== TT.EOF) {
        steps.push(this.parseStep());
        if (this.peek().type === TT.COMMA) {
          this.advance();
        }
      }
      this.expect(TT.RBRACKET);
      return steps;
    }

    parseStep() {
      const tok = this.peek();
      if (tok.type !== TT.WORD) {
        throw new Error(`Expected command, got ${tok.type}`);
      }
      const cmd = tok.value;
      this.advance();

      if (cmd === 'if') return this.parseIf();
      if (cmd === 'try') return this.parseTry();
      if (cmd === 'repeat') return this.parseRepeat();

      return { type: 'command', cmd, args: this.parseArgs() };
    }

    parseIf() {
      const condition = this.parseExpression(['then']);
      if (this.peek().type === TT.WORD && this.peek().value === 'then') {
        this.advance();
      } else {
        throw new Error('if: expected "then"');
      }
      const thenBranch = this.parseBlock();
      let elseBranch = [];
      if (this.peek().type === TT.WORD && this.peek().value === 'else') {
        this.advance();
        elseBranch = this.parseBlock();
      }
      return { type: 'if', condition, thenBranch, elseBranch };
    }

    parseTry() {
      const tryBranch = this.parseBlock();
      let catchBranch = [];
      let finallyBranch = [];
      if (this.peek().type === TT.WORD && this.peek().value === 'catch') {
        this.advance();
        catchBranch = this.parseBlock();
      }
      if (this.peek().type === TT.WORD && this.peek().value === 'finally') {
        this.advance();
        finallyBranch = this.parseBlock();
      }
      return { type: 'try', tryBranch, catchBranch, finallyBranch };
    }

    parseRepeat() {
      let count = null;
      let varName = null;
      let iterable = null;

      if (this.peek().type === TT.NUMBER) {
        count = this.advance().value;
      } else if (this.peek().type === TT.WORD) {
        varName = this.advance().value;
        if (this.peek().type === TT.WORD && this.peek().value === 'in') {
          this.advance();
          iterable = this.parseExpression(['times', 'do']);
        }
      }

      if (this.peek().type === TT.WORD && this.peek().value === 'times') {
        this.advance();
      } else if (this.peek().type === TT.WORD && this.peek().value === 'do') {
        this.advance();
      }

      const body = this.parseBlock();
      return { type: 'repeat', count, varName, iterable, body };
    }

    parseBlock() {
      if (this.peek().type === TT.LBRACKET) {
        return this.parseArrayBody();
      }
      return [this.parseStep()];
    }

    parseArgs() {
      const args = [];
      while (
        this.peek().type === TT.WORD ||
        this.peek().type === TT.STRING ||
        this.peek().type === TT.NUMBER
      ) {
        args.push(this.advance().value);
      }
      return args;
    }

    parseExpression(stopWords) {
      const start = this.pos;
      while (
        this.pos < this.tokens.length &&
        this.tokens[this.pos].type !== TT.EOF &&
        this.tokens[this.pos].type !== TT.PIPE &&
        this.tokens[this.pos].type !== TT.RBRACKET &&
        this.tokens[this.pos].type !== TT.COMMA &&
        this.tokens[this.pos].type !== TT.LBRACKET &&
        !(this.tokens[this.pos].type === TT.WORD && stopWords.includes(this.tokens[this.pos].value))
      ) {
        this.pos++;
      }
      const exprTokens = this.tokens.slice(start, this.pos);
      if (exprTokens.length === 0) return { type: 'literal', value: true };
      const parser = new ExprParser(exprTokens, [TT.EOF]);
      return parser.parse();
    }
  }

  function parseScript(source) {
    const trimmed = String(source || '').trim();
    if (!trimmed) return null;
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens);
    return parser.parse();
  }

  /* ============================================================
     4. SANDBOXED RESOLVER + EXPRESSION EVALUATOR
     ============================================================ */

  class Sandbox {
    constructor(config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.allowedSet = new Set(this.config.allowedGlobals);
      this.blockedSet = new Set(this.config.blockedProps);
    }

    evaluate(ast, ctx) {
      switch (ast.type) {
        case 'literal': return ast.value;
        case 'ident': return this.resolveIdent(ast.name, ctx);
        case 'binary': return this.evalBinary(ast, ctx);
        case 'unary': return this.evalUnary(ast, ctx);
        case 'prop': return this.evalProp(ast, ctx);
        case 'index': return this.evalIndex(ast, ctx);
        default: return undefined;
      }
    }

    evalBinary(ast, ctx) {
      const left = this.evaluate(ast.left, ctx);
      const right = this.evaluate(ast.right, ctx);
      const op = EXPR_OPS[ast.op];
      if (!op) throw new Error(`Unknown operator: ${ast.op}`);
      return op.fn(left, right, ast.strict);
    }

    evalUnary(ast, ctx) {
      const arg = this.evaluate(ast.arg, ctx);
      switch (ast.op) {
        case TT.NOT: return !arg;
        case TT.MINUS: return -arg;
        case TT.PLUS: return +arg;
        default: return arg;
      }
    }

    evalProp(ast, ctx) {
      const obj = this.evaluate(ast.object, ctx);
      if (obj == null) return undefined;
      if (this.blockedSet.has(ast.prop)) return undefined;
      const val = obj[ast.prop];
      // Block callable access for security
      if (typeof val === 'function') {
        const safe = this.config.allowedGlobals.some(g => global[g] === val);
        if (!safe) return undefined;
      }
      return val;
    }

    evalIndex(ast, ctx) {
      const obj = this.evaluate(ast.object, ctx);
      const idx = this.evaluate(ast.index, ctx);
      if (this.blockedSet.has(String(idx))) return undefined;
      const val = obj != null ? obj[idx] : undefined;
      if (typeof val === 'function') return undefined;
      return val;
    }

    resolveIdent(name, ctx) {
      if ((name[0] === "'" && name[name.length - 1] === "'") ||
          (name[0] === '"' && name[name.length - 1] === '"')) {
        return name.slice(1, -1).replace(/\\(['"])/g, '$1');
      }
      if (/^-?\d+(\.\d+)?$/.test(name)) return parseFloat(name);
      if (name === 'true') return true;
      if (name === 'false') return false;
      if (name === 'null') return null;
      if (name === 'undefined') return undefined;

      const propMatch = name.match(/^([a-zA-Z_$#][\w$]*)(\..+)$/);
      if (propMatch) {
        const rootName = propMatch[1];
        const root = this.resolveRoot(rootName, ctx);
        if (root == null) return undefined;
        const path = propMatch[2].slice(1).split('.');
        let val = root;
        for (const key of path) {
          if (this.blockedSet.has(key)) return undefined;
          val = val != null ? val[key] : undefined;
          if (val === undefined) break;
        }
        return val;
      }

      switch (name) {
        case 'me': case 'I': case 'my': return ctx.el;
        case 'it': case 'result': return ctx.it;
        case 'event': return ctx.event;
        case 'target': return ctx.event?.target;
        case 'body': return document.body;
      }

      if (name[0] === '$') {
        const refName = name.slice(1);
        // CYCLE DETECTION: track reads
        if (ctx._trackReads) ctx.reads.add(refName);
        for (let i = ctx.scopes.length - 1; i >= 0; i--) {
          if (ctx.scopes[i].hasOwnProperty(refName)) {
            return ctx.scopes[i][refName];
          }
        }
        const ref = ctx.helix?.$?.[refName] ?? ctx.helix?.refs?.[refName];
        return ref && 'value' in ref ? ref.value : undefined;
      }

      if (name[0] === '#' || name[0] === '.') {
        if (name.endsWith('...')) return Array.from(document.querySelectorAll(name.slice(0, -3)));
        return document.querySelector(name);
      }

      const bracket = name.match(/^(.+)\[(\d+|'.+'|".+")\]$/);
      if (bracket) {
        const arr = this.resolve(bracket[1], ctx);
        let idx = bracket[2];
        if ((idx[0] === "'" || idx[0] === '"')) idx = this.resolve(idx, ctx);
        else idx = parseInt(idx, 10);
        if (this.blockedSet.has(String(idx))) return undefined;
        return Array.isArray(arr) || typeof arr === 'string' ? arr[idx] : undefined;
      }

      return this.resolveRoot(name, ctx);
    }

    resolveRoot(name, ctx) {
      switch (name) {
        case 'window': return this.config.allowWindow ? window : undefined;
        case 'document': return this.config.allowDocument ? document : undefined;
      }
      if (this.allowedSet.has(name)) {
        try { return global[name]; } catch (e) { return undefined; }
      }
      return name;
    }

    resolve(token, ctx) {
      if (typeof token !== 'string') return token;
      return this.resolveIdent(token, ctx);
    }
  }

  /* ============================================================
     5. COMMAND METADATA REGISTRY
     ============================================================ */

  const registry = new Map();

  function register(name, meta, fn) {
    if (typeof meta === 'function') { fn = meta; meta = {}; }
    registry.set(name, {
      fn,
      meta: {
        async: false,
        mutatesDOM: false,
        mutatesState: false,
        pure: false,
        cancelable: false,
        blocking: false,
        ...meta
      }
    });
  }

  function getCommand(name) { return registry.get(name); }

  /* ============================================================
     6. TRANSACTION / DOM BATCHING
     ============================================================ */

  class DOMTransaction {
    constructor() {
      this.ops = [];
      this.flushing = false;
    }
    queue(fn) {
      this.ops.push(fn);
      if (!this.flushing) {
        this.flushing = true;
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => this.flush());
        } else {
          setTimeout(() => this.flush(), 0);
        }
      }
    }
    flush() {
      this.flushing = false;
      for (const fn of this.ops) {
        try { fn(); } catch (e) { console.error('[behavior] DOM batch error:', e); }
      }
      this.ops = [];
    }
    clear() {
      this.ops = [];
      this.flushing = false;
    }
  }

  /* ============================================================
     7. LIVE SCHEDULER (deduplication)
     ============================================================ */

  class LiveScheduler {
    constructor() {
      this.pending = new Map();
      this.flushing = false;
    }
    schedule(entry, runFn) {
      if (entry.disposed || entry.cycled) return;
      this.pending.set(entry, runFn);
      if (!this.flushing) {
        this.flushing = true;
        queueMicrotask(() => this.flush());
      }
    }
    flush() {
      this.flushing = false;
      const batch = new Map(this.pending);
      this.pending.clear();
      for (const [entry, runFn] of batch) {
        if (!entry.disposed && !entry.cycled) {
          try { runFn(); } catch (e) { console.error('[behavior] Live flush error:', e); }
        }
      }
    }
  }

  const liveScheduler = new LiveScheduler();

  /* ============================================================
     8. BUILT-IN COMMANDS
     ============================================================ */

  const mounted = new WeakMap();
  let pluginAttrName = '';

  function recursivelyUnmount(el) {
    if (!el || el.nodeType !== 1) return;
    el.querySelectorAll?.(`[${pluginAttrName}]`).forEach(child => {
      if (mounted.has(child)) unmount(child);
    });
    if (mounted.has(el)) unmount(el);
  }

  function toArray(v) { return Array.isArray(v) ? v : v == null ? [] : [v]; }
  function parseDuration(str) {
    if (typeof str === 'number') return str;
    const m = String(str).match(/^(\d+(?:\.\d+)?)\s*(ms|s|m)?$/);
    if (!m) return 0;
    const v = parseFloat(m[1]);
    const u = m[2] || 'ms';
    return u === 's' ? v * 1000 : u === 'm' ? v * 60000 : v;
  }

  /* ---- DOM Commands ---- */

  register('put', { mutatesDOM: true }, (ctx, value, ...rest) => {
    let selector = null;
    const intoIdx = rest.indexOf('into');
    if (intoIdx >= 0) {
      selector = rest.slice(intoIdx + 1).join(' ');
      rest = rest.slice(0, intoIdx);
    }
    const target = selector ? ctx.resolve(selector) : ctx.el;
    if (!target) return value;
    const v = ctx.resolve(value);
    const action = () => {
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        target.value = v ?? '';
      } else {
        target.textContent = v ?? '';
      }
    };
    if (ctx.tx) ctx.tx.queue(action); else action();
    return v;
  });

  register('html', { mutatesDOM: true }, (ctx, value, selector) => {
    const target = selector ? ctx.resolve(selector) : ctx.el;
    if (!target) return;
    recursivelyUnmount(target);
    const v = ctx.resolve(value);
    const action = () => { target.innerHTML = v ?? ''; };
    if (ctx.tx) ctx.tx.queue(action); else action();
    return v;
  });

  register('swap', { mutatesDOM: true }, (ctx, value, selector) => {
    const target = selector ? ctx.resolve(selector) : ctx.el;
    if (!target) return;
    const v = ctx.resolve(value);
    recursivelyUnmount(target);
    const action = () => {
      if (v instanceof HTMLElement) { target.replaceWith(v); }
      else { target.innerHTML = v ?? ''; }
    };
    if (ctx.tx) ctx.tx.queue(action); else action();
    return v;
  });

  register('toggle', { mutatesDOM: true }, (ctx, className, ...rest) => {
    let selector = null;
    const onIdx = rest.indexOf('on');
    if (onIdx >= 0) { selector = rest.slice(onIdx + 1).join(' '); rest = rest.slice(0, onIdx); }
    const targets = selector ? toArray(ctx.resolve(selector)) : [ctx.el];
    const cn = ctx.resolve(className);
    const action = () => targets.forEach(el => el?.classList.toggle(cn));
    if (ctx.tx) ctx.tx.queue(action); else action();
    return cn;
  });

  register('add', { mutatesDOM: true }, (ctx, className, ...rest) => {
    let selector = null;
    const toIdx = rest.indexOf('to');
    if (toIdx >= 0) { selector = rest.slice(toIdx + 1).join(' '); rest = rest.slice(0, toIdx); }
    const targets = selector ? toArray(ctx.resolve(selector)) : [ctx.el];
    const cn = ctx.resolve(className);
    const action = () => targets.forEach(el => el?.classList.add(cn));
    if (ctx.tx) ctx.tx.queue(action); else action();
    return cn;
  });

  register('remove', { mutatesDOM: true }, (ctx, className, ...rest) => {
    let selector = null;
    const fromIdx = rest.indexOf('from');
    if (fromIdx >= 0) { selector = rest.slice(fromIdx + 1).join(' '); rest = rest.slice(0, fromIdx); }
    const targets = selector ? toArray(ctx.resolve(selector)) : [ctx.el];
    const cn = ctx.resolve(className);
    const action = () => targets.forEach(el => el?.classList.remove(cn));
    if (ctx.tx) ctx.tx.queue(action); else action();
    return cn;
  });

  register('take', { mutatesDOM: true }, (ctx, className, ...rest) => {
    let selector = null;
    const fromIdx = rest.indexOf('from');
    if (fromIdx >= 0) { selector = rest.slice(fromIdx + 1).join(' '); }
    const target = selector ? ctx.resolve(selector) : ctx.el;
    const cn = ctx.resolve(className);
    if (!target || !cn) return;
    const action = () => {
      const parent = target.parentElement;
      if (parent) parent.querySelectorAll('.' + cn).forEach(el => el.classList.remove(cn));
      target.classList.add(cn);
    };
    if (ctx.tx) ctx.tx.queue(action); else action();
    return target;
  });

  register('show', { mutatesDOM: true }, (ctx, ...rest) => {
    let selector = null;
    const onIdx = rest.indexOf('on');
    if (onIdx >= 0) { selector = rest.slice(onIdx + 1).join(' '); }
    const targets = selector ? toArray(ctx.resolve(selector)) : [ctx.el];
    const action = () => targets.forEach(el => { if (el) el.hidden = false; });
    if (ctx.tx) ctx.tx.queue(action); else action();
    return true;
  });

  register('hide', { mutatesDOM: true }, (ctx, ...rest) => {
    let selector = null;
    const onIdx = rest.indexOf('on');
    if (onIdx >= 0) { selector = rest.slice(onIdx + 1).join(' '); }
    const targets = selector ? toArray(ctx.resolve(selector)) : [ctx.el];
    const action = () => targets.forEach(el => { if (el) el.hidden = true; });
    if (ctx.tx) ctx.tx.queue(action); else action();
    return false;
  });

  register('empty', { mutatesDOM: true }, (ctx, selector) => {
    const target = selector ? ctx.resolve(selector) : ctx.el;
    if (!target) return;
    recursivelyUnmount(target);
    const action = () => { target.innerHTML = ''; };
    if (ctx.tx) ctx.tx.queue(action); else action();
    return target;
  });

  register('removeEl', { mutatesDOM: true }, (ctx, selector) => {
    const targets = selector ? toArray(ctx.resolve(selector)) : [ctx.el];
    targets.forEach(el => {
      if (el) { recursivelyUnmount(el); el.remove(); }
    });
    return null;
  });

  register('focus', { mutatesDOM: true }, (ctx, selector) => {
    const target = selector ? ctx.resolve(selector) : ctx.el;
    target?.focus();
    return target;
  });

  register('blur', { mutatesDOM: true }, (ctx, selector) => {
    const target = selector ? ctx.resolve(selector) : ctx.el;
    target?.blur();
    return target;
  });

  register('scroll', { mutatesDOM: true }, (ctx, ...rest) => {
    let selector = null, smooth = false;
    const toIdx = rest.indexOf('to');
    if (toIdx >= 0) {
      const after = rest.slice(toIdx + 1);
      const smoothIdx = after.indexOf('smoothly');
      if (smoothIdx >= 0) { smooth = true; after.splice(smoothIdx, 1); }
      selector = after.join(' ');
    }
    const target = selector ? ctx.resolve(selector) : ctx.el;
    target?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    return target;
  });

  /* ---- Async / Network ---- */

  register('fetch', { async: true, cancelable: true }, async (ctx, url, ...rest) => {
    const resolvedUrl = ctx.resolve(url);
    const formatIdx = rest.indexOf('as');
    const format = formatIdx >= 0 ? ctx.resolve(rest[formatIdx + 1]) : null;

    const ctrl = new AbortController();
    ctx.entry.abortControllers.push(ctrl);

    if (ctx.runId !== ctx.entry.currentRunId) {
      ctrl.abort();
      throw new Error('Pipeline superseded');
    }

    try {
      const response = await fetch(resolvedUrl, { signal: ctrl.signal });
      ctx.response = response;
      if (ctx.runId !== ctx.entry.currentRunId) throw new Error('Pipeline superseded');
      if (format === 'json') return await response.json();
      if (format === 'text') return await response.text();
      if (format === 'blob') return await response.blob();
      return response;
    } finally {
      const idx = ctx.entry.abortControllers.indexOf(ctrl);
      if (idx > -1) ctx.entry.abortControllers.splice(idx, 1);
    }
  });

  register('wait', { async: true, cancelable: true }, (ctx, duration) => {
    const ms = parseDuration(ctx.resolve(duration));
    return new Promise((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      ctx.entry.abortControllers.push({
        abort: () => { clearTimeout(t); reject(new Error('Pipeline superseded')); }
      });
    });
  });

  /* ---- Events ---- */

  register('send', { mutatesDOM: false }, (ctx, eventName, ...rest) => {
    let selector = null;
    const toIdx = rest.indexOf('to');
    if (toIdx >= 0) { selector = rest.slice(toIdx + 1).join(' '); }
    const target = selector ? ctx.resolve(selector) : ctx.el;
    if (!target) return;
    const detail = { sender: ctx.el, result: ctx.it };
    const evt = new CustomEvent(ctx.resolve(eventName), { bubbles: true, cancelable: true, detail });
    target.dispatchEvent(evt);
    return evt;
  });

  register('trigger', { mutatesDOM: false }, (ctx, eventName, selector) => {
    const target = selector ? ctx.resolve(selector) : ctx.el;
    if (!target) return;
    const evt = new Event(ctx.resolve(eventName), { bubbles: true, cancelable: true });
    target.dispatchEvent(evt);
    return evt;
  });

  register('prevent', { pure: true }, (ctx) => { ctx.event?.preventDefault(); return ctx.event; });
  register('stop', { pure: true }, (ctx) => { ctx.event?.stopPropagation(); return ctx.event; });

  /* ---- Logic / Flow ---- */

  register('log', { pure: true }, (ctx, ...args) => {
    const resolved = args.map(a => ctx.resolve(a));
    console.log('[behavior]', ...resolved);
    return resolved[0];
  });

  register('set', { mutatesState: true }, (ctx, ...resolvedArgs) => {
    const rawArgs = ctx.stepArgs;
    const rawRef = rawArgs[0];
    const toIdx = rawArgs.indexOf('to');
    const rawValue = toIdx >= 0 ? rawArgs.slice(toIdx + 1).join(' ') : rawArgs[rawArgs.length - 1];
    const resolvedValue = ctx.resolve(rawValue);

    if (typeof rawRef === 'string' && rawRef[0] === '$') {
      const refName = rawRef.slice(1);
      // CYCLE DETECTION: track writes
      if (ctx._trackWrites) ctx.writes.add(refName);
      for (let i = ctx.scopes.length - 1; i >= 0; i--) {
        if (ctx.scopes[i].hasOwnProperty(refName)) {
          ctx.scopes[i][refName] = resolvedValue;
          return resolvedValue;
        }
      }
      const ref = ctx.helix?.$?.[refName] ?? ctx.helix?.refs?.[refName];
      if (ref && 'value' in ref) {
        ref.value = resolvedValue;
        return resolvedValue;
      }
      if (ctx.scopes.length > 0) {
        ctx.scopes[ctx.scopes.length - 1][refName] = resolvedValue;
        return resolvedValue;
      }
      console.warn(`[behavior] Ref not found: ${rawRef}`);
      return resolvedValue;
    }

    if (rawRef === 'me' || rawRef === 'I' || rawRef === 'my') {
      const attr = toIdx >= 0 ? rawArgs.slice(1, toIdx).join(' ') : rawArgs[1];
      ctx.el.setAttribute(attr, resolvedValue);
      return resolvedValue;
    }

    return resolvedValue;
  });

  register('return', { pure: true }, (ctx, value) => {
    ctx._return = true;
    return ctx.resolve(value);
  });

  register('fallback', { pure: true }, (ctx, value) => {
    return ctx.it != null ? ctx.it : ctx.resolve(value);
  });

  /* ============================================================
     9. RUNTIME EXECUTOR
     ============================================================ */

  async function executePipeline(ctx, steps) {
    let i = 0;
    while (i < steps.length) {
      if (ctx._aborted) throw new Error('Pipeline aborted');
      if (ctx.runId !== ctx.entry.currentRunId && !ctx._parallel) {
        throw new Error('Pipeline superseded');
      }

      const step = steps[i];

      if (step.type === 'if') {
        const ok = ctx.evaluate(step.condition);
        const branch = ok ? step.thenBranch : step.elseBranch;
        if (branch && branch.length) {
          const result = await executePipeline(ctx, branch);
          ctx.it = result;
        }
        i++;
        continue;
      }

      if (step.type === 'try') {
        let result;
        try {
          result = await executePipeline(ctx, step.tryBranch);
          ctx.it = result;
        } catch (err) {
          ctx.it = err;
          if (step.catchBranch.length) {
            result = await executePipeline(ctx, step.catchBranch);
            ctx.it = result;
          } else {
            throw err;
          }
        } finally {
          if (step.finallyBranch.length) {
            await executePipeline(ctx, step.finallyBranch);
          }
        }
        i++;
        continue;
      }

      if (step.type === 'repeat') {
        let result;
        ctx.scopes.push({});
        try {
          if (step.count != null) {
            for (let r = 0; r < step.count; r++) {
              result = await executePipeline(ctx, step.body);
              ctx.it = result;
              if (ctx._aborted || ctx._return) break;
            }
          } else if (step.varName && step.iterable) {
            const items = toArray(ctx.evaluate(step.iterable));
            for (const item of items) {
              ctx.scopes[ctx.scopes.length - 1][step.varName] = item;
              result = await executePipeline(ctx, step.body);
              ctx.it = result;
              if (ctx._aborted || ctx._return) break;
            }
          } else {
            result = await executePipeline(ctx, step.body);
            ctx.it = result;
          }
        } finally {
          ctx.scopes.pop();
        }
        i++;
        continue;
      }

      const cmdDef = getCommand(step.cmd);
      if (!cmdDef) throw new Error(`Unknown command: "${step.cmd}"`);

      const resolvedArgs = step.args.map(arg => ctx.resolve(arg));
      ctx.stepArgs = step.args;

      if (ctx.entry.config.autoBatchDOM && cmdDef.meta.mutatesDOM && ctx.tx) {
        let batchEnd = i;
        while (batchEnd + 1 < steps.length) {
          const next = steps[batchEnd + 1];
          if (next.type !== 'command') break;
          const nextDef = getCommand(next.cmd);
          if (!nextDef || !nextDef.meta.mutatesDOM) break;
          batchEnd++;
        }
        for (let b = i; b <= batchEnd; b++) {
          const bStep = steps[b];
          const bDef = getCommand(bStep.cmd);
          const bArgs = bStep.args.map(arg => ctx.resolve(arg));
          ctx.stepArgs = bStep.args;
          let result = bDef.fn(ctx, ...bArgs);
          if (result && typeof result.then === 'function') {
            result = await result;
          }
          ctx.it = result;
          ctx.result = result;
          if (ctx._return) break;
        }
        i = batchEnd + 1;
        continue;
      }

      let result;
      try {
        result = cmdDef.fn(ctx, ...resolvedArgs);
      } catch (err) {
        console.error(`[behavior] Error in "${step.cmd}":`, err);
        throw err;
      }

      if (result && typeof result.then === 'function') {
        result = await result;
      }

      if (ctx.runId !== ctx.entry.currentRunId && !ctx._parallel) {
        throw new Error('Pipeline superseded');
      }

      ctx.it = result;
      ctx.result = result;

      if (ctx._return) break;
      i++;
    }
    return ctx.it;
  }

  /* ============================================================
     10. QUEUE STRATEGIES
     ============================================================ */

  const strategies = {
    'cancel-previous': (entry, execute) => {
      entry.currentRunId = ++entry.runCounter;
      entry.abortControllers.forEach(c => {
        try { c.abort(); } catch (e) {}
      });
      entry.abortControllers = [];
      if (entry.tx) entry.tx.clear();
      execute();
    },

    'cancel': (entry, execute) => strategies['cancel-previous'](entry, execute),

    'mutex': (entry, execute) => {
      if (entry.executing) return;
      entry.executing = true;
      entry.currentRunId = ++entry.runCounter;
      execute().finally(() => { entry.executing = false; });
    },

    'queue': (entry, execute) => {
      entry.executionQueue = entry.executionQueue || [];
      if (entry.executionQueue.length >= (entry.config?.maxQueueSize || DEFAULT_CONFIG.maxQueueSize)) {
        entry.executionQueue.shift();
      }
      entry.executionQueue.push(execute);
      if (entry.executionQueue.length === 1) {
        const process = async () => {
          while (entry.executionQueue.length > 0) {
            entry.currentRunId = ++entry.runCounter;
            const fn = entry.executionQueue[0];
            try { await fn(); } catch (e) {}
            entry.executionQueue.shift();
          }
        };
        process();
      }
    },

    'parallel': (entry, execute) => {
      entry.currentRunId = ++entry.runCounter;
      execute();
    },

    'latest-wins': (entry, execute) => {
      entry.currentRunId = ++entry.runCounter;
      if (entry.latestTimer) clearTimeout(entry.latestTimer);
      entry.latestTimer = setTimeout(() => {
        entry.latestTimer = null;
        execute();
      }, 0);
    }
  };

  function getStrategy(mods) {
    for (const mod of mods) {
      if (strategies[mod.name]) return mod.name;
    }
    return 'cancel-previous';
  }

  /* ============================================================
     11. EVENT BINDING
     ============================================================ */

  function createEventListener(el, eventSpec, handler, entry) {
    const { name, mods } = eventSpec;
    let fn = handler;

    if (mods.find(m => m.name === 'prevent')) {
      const prev = fn;
      fn = (e) => { e.preventDefault(); prev(e); };
    }
    if (mods.find(m => m.name === 'stop')) {
      const prev = fn;
      fn = (e) => { e.stopPropagation(); prev(e); };
    }
    if (mods.find(m => m.name === 'once')) {
      const prev = fn;
      fn = function onceWrap(e) {
        el.removeEventListener(name, onceWrap, mods.find(m => m.name === 'capture'));
        prev(e);
      };
    }

    const debounceMod = mods.find(m => m.name === 'debounce');
    if (debounceMod) {
      const ms = parseDuration(debounceMod.param || '300ms');
      let timer;
      const prev = fn;
      fn = (e) => { clearTimeout(timer); timer = setTimeout(() => prev(e), ms); };
    }

    const throttleMod = mods.find(m => m.name === 'throttle');
    if (throttleMod) {
      const ms = parseDuration(throttleMod.param || '300ms');
      let last = 0;
      const prev = fn;
      fn = (e) => {
        const now = Date.now();
        if (now - last >= ms) { last = now; prev(e); }
      };
    }

    const delayMod = mods.find(m => m.name === 'delay');
    if (delayMod) {
      const ms = parseDuration(delayMod.param || '0ms');
      const prev = fn;
      fn = (e) => setTimeout(() => prev(e), ms);
    }

    const useCapture = mods.find(m => m.name === 'capture');
    el.addEventListener(name, fn, !!useCapture);
    entry.listeners.push({ name, fn, capture: !!useCapture });
  }

  /* ============================================================
     12. MOUNT / UNMOUNT / CLEANUP
     ============================================================ */

  function createContext(el, helix, event, entry, tx) {
    const sandbox = new Sandbox(entry.config);
    const ctx = {
      el,
      helix,
      it: undefined,
      result: undefined,
      event: event || null,
      abortControllers: entry.abortControllers,
      entry,
      runId: entry.currentRunId,
      _aborted: false,
      _return: false,
      _parallel: false,
      stepArgs: [],
      scopes: [],
      tx,
      // CYCLE DETECTION — Phase 1
      reads: new Set(),
      writes: new Set(),
      _trackReads: false,
      _trackWrites: false,
      resolve: (token) => sandbox.resolve(token, ctx),
      evaluate: (ast) => sandbox.evaluate(ast, ctx)
    };
    return ctx;
  }

  function mount(el, script, helix, attrName, config) {
    if (mounted.has(el)) return;

    const ast = parseScript(script);
    if (!ast) return;

    let scope = null;
    if (helix?.effectScope) {
      scope = helix.effectScope(true);
    }

    const entry = {
      scope,
      listeners: [],
      abortControllers: [],
      helix,
      currentRunId: 0,
      runCounter: 0,
      executing: false,
      executionQueue: [],
      latestTimer: null,
      disposed: false,
      cycled: false,
      config: { ...DEFAULT_CONFIG, ...config },
      pluginAttr: attrName,
      tx: config?.domBatch !== false ? new DOMTransaction() : null,
      // CYCLE DETECTION — Phase 2
      lastReads: null,
      lastWrites: null
    };
    mounted.set(el, entry);

    for (const eventSpec of ast.events) {
      if (eventSpec.name === 'live') {
        if (scope) {
          scope.run(() => {
            const runLive = () => {
              if (entry.disposed || entry.cycled) return;
              liveScheduler.schedule(entry, () => {
                entry.currentRunId = ++entry.runCounter;
                const tx = entry.config.domBatch ? new DOMTransaction() : null;
                const ctx = createContext(el, helix, null, entry, tx);
                // Enable cycle tracking
                ctx._trackReads = true;
                ctx._trackWrites = true;

                executePipeline(ctx, ast.pipeline)
                  .then(() => {
                    // === PHASE 1: Self-cycle detection ===
                    for (const ref of ctx.writes) {
                      if (ctx.reads.has(ref)) {
                        console.error(
                          `[behavior] SELF-CYCLE DETECTED in live pipeline on element:`,
                          el,
                          `\nReads and writes "$${ref}". This creates an infinite reactive loop.`,
                          `\nPipeline permanently frozen. Fix the logic to break the cycle.`
                        );
                        entry.cycled = true;
                        clearEntryFromGraph(entry);
                        return;
                      }
                    }

                    // === PHASE 2: Cross-cycle detection ===
                    if (!entry.cycled && (ctx.reads.size > 0 || ctx.writes.size > 0)) {
                      updateGraph(entry, ctx.reads, ctx.writes);
                      for (const writtenRef of ctx.writes) {
                        if (detectCrossCycle(entry, writtenRef)) {
                          return; // detectCrossCycle marks entries as cycled
                        }
                      }
                    }

                    if (tx) tx.flush();
                  })
                  .catch(err => {
                    if (err.message !== 'Pipeline superseded') {
                      console.error('[behavior] Live error:', err);
                    }
                  });
              });
            };

            if (helix?.watchEffect) {
              helix.watchEffect(runLive);
            } else if (helix?.effect) {
              helix.effect(runLive);
            } else {
              runLive();
            }
          });
        }
        continue;
      }

      if (eventSpec.name === 'init') {
        entry.currentRunId = ++entry.runCounter;
        const tx = entry.config.domBatch ? new DOMTransaction() : null;
        const ctx = createContext(el, helix, null, entry, tx);
        executePipeline(ctx, ast.pipeline)
          .then(() => { if (tx) tx.flush(); })
          .catch(err => { console.error('[behavior] Init error:', err); });
        continue;
      }

      const strategyName = getStrategy(eventSpec.mods);
      const strategy = strategies[strategyName] || strategies['cancel-previous'];

      const listener = (event) => {
        const execute = async () => {
          entry.currentRunId = ++entry.runCounter;
          const tx = entry.config.domBatch ? new DOMTransaction() : null;
          const ctx = createContext(el, helix, event, entry, tx);

          try {
            await executePipeline(ctx, ast.pipeline);
            if (tx) tx.flush();
          } catch (err) {
            if (err.message !== 'Pipeline superseded') {
              console.error(`[behavior] Event error (${eventSpec.name}):`, err);
            }
          }
        };

        strategy(entry, execute);
      };

      createEventListener(el, eventSpec, listener, entry);
    }
  }

  function unmount(el) {
    const entry = mounted.get(el);
    if (!entry) return;

    entry.disposed = true;

    // Clean up from global cycle graph
    clearEntryFromGraph(entry);

    entry.abortControllers.forEach(c => {
      try { c.abort(); } catch (e) {}
    });
    entry.abortControllers = [];

    if (entry.latestTimer) {
      clearTimeout(entry.latestTimer);
      entry.latestTimer = null;
    }

    entry.listeners.forEach(({ name, fn, capture }) => {
      el.removeEventListener(name, fn, capture);
    });
    entry.listeners = [];

    if (entry.scope && typeof entry.scope.stop === 'function') {
      entry.scope.stop();
    }

    mounted.delete(el);
  }

  /* ============================================================
     13. PLUGIN INSTALLER
     ============================================================ */

  function BehaviorPlugin(H, options = {}) {
    const prefix = H.config?.prefix || 'h';
    const attrName = `${prefix}-${ATTR_SUFFIX}`;
    pluginAttrName = attrName;

    const config = { ...DEFAULT_CONFIG, ...options };

    function scan(root = document) {
      root.querySelectorAll?.(`[${attrName}]`).forEach(el => {
        if (mounted.has(el)) return;
        mount(el, el.getAttribute(attrName), H, attrName, config);
      });
    }

    let observer = null;
    if (options.observe !== false) {
      observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            if (node.hasAttribute?.(attrName) && !mounted.has(node)) {
              mount(node, node.getAttribute(attrName), H, attrName, config);
            }
            node.querySelectorAll?.(`[${attrName}]`).forEach(child => {
              if (!mounted.has(child)) mount(child, child.getAttribute(attrName), H, attrName, config);
            });
          });
          mutation.removedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            if (mounted.has(node)) unmount(node);
            node.querySelectorAll?.(`[${attrName}]`).forEach(child => {
              if (mounted.has(child)) unmount(child);
            });
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => scan());
    } else {
      scan();
    }

    H.behavior = {
      register,
      get: getCommand,
      mount: (el, script) => mount(el, script, H, attrName, config),
      unmount,
      scan,
      parse: parseScript,
      version: VERSION,
      config
    };

    return () => {
      if (observer) observer.disconnect();
      document.querySelectorAll?.(`[${attrName}]`).forEach(el => unmount(el));
    };
  }

  if (typeof Helix !== 'undefined' && Helix.plugin) {
    Helix.plugin(PLUGIN_NAME, BehaviorPlugin);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = BehaviorPlugin;
  } else {
    global.HelixBehaviorPlugin = BehaviorPlugin;
  }

})(typeof globalThis !== 'undefined' ? globalThis : window);