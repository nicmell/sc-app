// Minimal arithmetic expression parser and evaluator.
// Supports: +, -, *, /, unary -, parentheses, numbers, and variable references.
// Variables are dot-separated paths (e.g., "vars.freq") extracted during parsing.

import type {Expr} from '@/types/parsers';

export interface ParsedBind {
    paths: string[];
    expression?: Expr;
}

export function parseBind(input: string): ParsedBind {
    const trimmed = input.trim();

    // Fast path: plain variable reference (no expression)
    if (/^[a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*$/.test(trimmed)) {
        return {paths: [trimmed]};
    }

    let pos = 0;
    const varPaths = new Set<string>();

    function peek(): string { return trimmed[pos] ?? ''; }
    function advance(): string { return trimmed[pos++]; }
    function skipWhitespace() { while (pos < trimmed.length && trimmed[pos] === ' ') pos++; }

    function parseExpr(): Expr {
        let left = parseTerm();
        skipWhitespace();
        while (peek() === '+' || peek() === '-') {
            const op = advance() as '+' | '-';
            skipWhitespace();
            left = {type: 'binary', op, left, right: parseTerm()};
            skipWhitespace();
        }
        return left;
    }

    function parseTerm(): Expr {
        let left = parseFactor();
        skipWhitespace();
        while (peek() === '*' || peek() === '/') {
            const op = advance() as '*' | '/';
            skipWhitespace();
            left = {type: 'binary', op, left, right: parseFactor()};
            skipWhitespace();
        }
        return left;
    }

    function parseFactor(): Expr {
        skipWhitespace();
        const c = peek();

        if (c === '-') {
            advance();
            skipWhitespace();
            return {type: 'unary', op: '-', expr: parseFactor()};
        }

        if (c === '(') {
            advance();
            const expr = parseExpr();
            skipWhitespace();
            if (advance() !== ')') throw new Error(`Expected ')' in bind expression: "${input}"`);
            return expr;
        }

        if (c >= '0' && c <= '9' || c === '.') {
            const start = pos;
            while (pos < trimmed.length && (trimmed[pos] >= '0' && trimmed[pos] <= '9' || trimmed[pos] === '.')) pos++;
            return {type: 'number', value: parseFloat(trimmed.slice(start, pos))};
        }

        if (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c === '_') {
            const start = pos;
            while (pos < trimmed.length && /[\w.]/.test(trimmed[pos])) pos++;
            const name = trimmed.slice(start, pos);
            varPaths.add(name);
            return {type: 'var', name};
        }

        throw new Error(`Unexpected character '${c}' in bind expression: "${input}"`);
    }

    const expr = parseExpr();
    skipWhitespace();
    if (pos < trimmed.length) {
        throw new Error(`Unexpected character '${peek()}' at position ${pos} in bind expression: "${input}"`);
    }
    if (varPaths.size === 0) {
        throw new Error(`Bind expression must reference at least one variable: "${input}"`);
    }

    return {paths: [...varPaths], expression: expr};
}

export function evalExpr(expr: Expr, values: Record<string, number>): number {
    switch (expr.type) {
        case 'number': return expr.value;
        case 'var': return values[expr.name] ?? 0;
        case 'unary': return -evalExpr(expr.expr, values);
        case 'binary': {
            const l = evalExpr(expr.left, values);
            const r = evalExpr(expr.right, values);
            switch (expr.op) {
                case '+': return l + r;
                case '-': return l - r;
                case '*': return l * r;
                case '/': return r !== 0 ? l / r : 0;
            }
        }
    }
}
