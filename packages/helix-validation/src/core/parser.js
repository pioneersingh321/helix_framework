import { _registry } from './registry.js';

const parseCache = new Map();

function parseStringToStruct(str) {
    if (parseCache.has(str)) {
        const val = parseCache.get(str);
        parseCache.delete(str);
        parseCache.set(str, val);
        return val;
    }

    const rules = [];
    let currentRule = '';
    let depth = 0; // track parenthesis (), brackets [], braces {}
    let inQuote = null; // track quotes '', ""
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '\\') {
            currentRule += str[++i] || '';
            continue;
        }
        if (inQuote) {
            if (char === inQuote) inQuote = null;
            currentRule += char;
            continue;
        }
        if (char === "'" || char === '"') {
            inQuote = char;
            currentRule += char;
            continue;
        }
        if (char === '(' || char === '[' || char === '{') depth++;
        if (char === ')' || char === ']' || char === '}') depth--;
        
        if (char === '|' && depth === 0) {
            rules.push(currentRule.trim());
            currentRule = '';
        } else {
            currentRule += char;
        }
    }
    if (currentRule) rules.push(currentRule.trim());
    
    const struct = rules.reduce((acc, ruleStr) => {
        let name = ruleStr.trim();
        if (!name) return acc;

        const parenIdx = name.indexOf('(');
        const colonIdx = name.indexOf(':');
        
        let argPart = '';
        if (parenIdx !== -1 && name.endsWith(')')) {
            argPart = name.slice(parenIdx + 1, -1);
            name = name.slice(0, parenIdx).trim();
        } else if (colonIdx !== -1) {
            argPart = name.slice(colonIdx + 1);
            name = name.slice(0, colonIdx).trim();
        } else {
            return acc.concat({ name, args: [] });
        }
        
        // Tokenize arguments by comma
        const args = [];
        let currentArg = '';
        let argDepth = 0;
        let argQuote = null;
        for (let j = 0; j < argPart.length; j++) {
            const c = argPart[j];
            if (c === '\\') {
                currentArg += argPart[++j] || '';
                continue;
            }
            if (argQuote) {
                if (c === argQuote) argQuote = null;
                currentArg += c;
                continue;
            }
            if (c === "'" || c === '"') {
                argQuote = c;
                currentArg += c;
                continue;
            }
            if (c === '(' || c === '[' || c === '{') argDepth++;
            if (c === ')' || c === ']' || c === '}') argDepth--;
            
            if (c === ',' && argDepth === 0) {
                args.push(currentArg.trim());
                currentArg = '';
            } else {
                currentArg += c;
            }
        }
        if (currentArg) args.push(currentArg.trim());
        
        const parsedArgs = args.map(a => {
            if ((a.startsWith("'") && a.endsWith("'")) || (a.startsWith('"') && a.endsWith('"'))) {
                return a.slice(1, -1);
            }
            return /^-?\d+(\.\d+)?$/.test(a) ? Number(a) : a;
        });
        
        return acc.concat({ name, args: parsedArgs });
    }, []);

    parseCache.set(str, struct);
    if (parseCache.size > 500) {
        const firstKey = parseCache.keys().next().value;
        parseCache.delete(firstKey);
    }
    return struct;
}

export function parseRuleStr(str, registry) {
    const struct = parseStringToStruct(str);
    const reg = registry || _registry;
    
    return struct.reduce((acc, item) => {
        const meta = reg.get(item.name);
        if (!meta) { console.warn(`[Helix Validation] Unknown rule: "${item.name}"`); return acc; }
        
        const isFactory = !!meta.fn._isRuleFactory;
        let fn;
        if (isFactory) {
            if (item.args.length === 0 || (item.args.length === 1 && item.args[0] === '')) {
                console.warn(`[Helix Validation] Rule "${item.name}" expects parameters, but none were provided.`);
            }
            const produced = meta.fn(...item.args);
            if (typeof produced === 'function') {
                fn = produced;
            } else {
                console.warn(`[Helix Validation] Rule "${item.name}" did not return a validator; ignoring args.`);
                fn = meta.fn;
            }
        } else {
            if (item.args.length > 0) {
                console.warn(`[Helix Validation] Rule "${item.name}" takes no arguments; ignoring them.`);
            }
            fn = meta.fn;
        }
        if (!fn.meta) fn.meta = {};
        if (fn.meta.priority === undefined) fn.meta.priority = meta.priority;
        if (!fn._priority) fn._priority = meta.priority;
        return acc.concat(fn);
    }, []);
}

function warnUnconfiguredFactory(fn) {
    const name = fn.meta?.name || fn._ruleName;
    const ruleName = name ? ` "${name}"` : '';
    console.warn(`[Helix Validation] A parameterized rule${ruleName} was passed without being called (e.g. use ${name || 'rule'}(3) instead of ${name || 'rule'}). It was skipped.`);
    return [];
}

export function normalizeRules(r, registry) {
    let resolved = [];
    if (!r) resolved = [];
    else if (typeof r === 'string')   resolved = parseRuleStr(r, registry);
    else if (typeof r === 'function') resolved = r._isRuleFactory ? warnUnconfiguredFactory(r) : [r];
    else if (Array.isArray(r)) {
        resolved = r.reduce((acc, item) => {
            if (typeof item === 'string')   return acc.concat(parseRuleStr(item, registry));
            if (typeof item === 'function') return item._isRuleFactory ? acc.concat(warnUnconfiguredFactory(item)) : acc.concat(item);
            return acc;
        }, []);
    }
    
    // Deduplicate rules by meta.name / _ruleName
    const seen = new Set();
    return resolved.filter(fn => {
        if (!fn) return false;
        const name = fn.meta?.name || fn._ruleName;
        if (name && name !== 'transform') {
            if (seen.has(name)) return false;
            seen.add(name);
        }
        return true;
    });
}
