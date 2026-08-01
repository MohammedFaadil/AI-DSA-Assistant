/**
 * Solution fingerprinting — TypeScript side.
 *
 * Produces an identifier-insensitive token stream from source code. The
 * Response Guard in the AI service compares a model's proposed code against
 * this fingerprint to detect that it is about to hand over the official
 * solution (docs 07 §5).
 *
 * IMPORTANT: `apps/ai/app/agents/fingerprint.py` implements the byte-identical
 * algorithm. The two are covered by a shared fixture test — if you change one,
 * change both, or the Guard silently stops catching leaks.
 */

const KEYWORDS = new Set([
  // control flow (shared across our 12 languages)
  'if', 'else', 'elif', 'for', 'while', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'yield', 'goto',
  // declarations
  'def', 'function', 'fn', 'func', 'lambda', 'class', 'struct', 'interface',
  'enum', 'const', 'let', 'var', 'val', 'static', 'public', 'private',
  'protected', 'void', 'new', 'delete', 'this', 'self', 'super', 'extends',
  'implements', 'import', 'from', 'include', 'using', 'namespace', 'package',
  // types
  'int', 'long', 'short', 'char', 'float', 'double', 'bool', 'boolean',
  'string', 'str', 'list', 'dict', 'set', 'map', 'vector', 'array', 'auto',
  'unsigned', 'signed', 'size_t',
  // values / operators as words
  'true', 'false', 'null', 'none', 'nil', 'nullptr', 'undefined',
  'and', 'or', 'not', 'in', 'is', 'try', 'catch', 'except', 'finally',
  'throw', 'raise', 'with', 'as', 'pass', 'global', 'nonlocal',
  // very common library calls whose presence is structural, not cosmetic
  'range', 'len', 'enumerate', 'sorted', 'sort', 'append', 'push', 'pop',
  'min', 'max', 'sum', 'abs', 'print', 'push_back', 'insert', 'get',
]);

/** Strip comments and string literals without a real parser. */
function stripLiteralsAndComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i]!;
    const next = i + 1 < n ? src[i + 1]! : '';

    // line comments: // and #
    if ((c === '/' && next === '/') || c === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // block comment: /* ... */
    if (c === '/' && next === '*') {
      i += 2;
      while (i + 1 < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // triple-quoted python strings
    if ((c === '"' || c === "'") && src.slice(i, i + 3) === c.repeat(3)) {
      const q = c.repeat(3);
      i += 3;
      const end = src.indexOf(q, i);
      i = end === -1 ? n : end + 3;
      out += ' ';
      continue;
    }
    // ordinary string / char literals
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      out += ' ';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;
const WHITESPACE = /\s/;

/**
 * Identifiers collapse to `v`, numeric literals to `n`, keywords survive
 * verbatim, and punctuation survives as single tokens. Renaming variables or
 * reformatting therefore does not change the fingerprint; changing the
 * algorithm does.
 */
export function fingerprint(source: string): string {
  const src = stripLiteralsAndComments(source);
  const tokens: string[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i]!;

    if (WHITESPACE.test(c)) {
      i++;
      continue;
    }

    if (IDENT_START.test(c)) {
      let word = '';
      while (i < src.length && IDENT_PART.test(src[i]!)) {
        word += src[i]!;
        i++;
      }
      const lowered = word.toLowerCase();
      tokens.push(KEYWORDS.has(lowered) ? lowered : 'v');
      continue;
    }

    if (DIGIT.test(c)) {
      while (i < src.length && /[0-9.eExXaAbBcCdDfF]/.test(src[i]!)) i++;
      tokens.push('n');
      continue;
    }

    tokens.push(c);
    i++;
  }

  return tokens.join(' ');
}

/**
 * Dice coefficient over token bigrams. Symmetric, length-tolerant, and cheap —
 * appropriate for "is this suspiciously close to the official answer?" rather
 * than exact plagiarism detection.
 */
export function similarity(a: string, b: string): number {
  const bigrams = (s: string): Map<string, number> => {
    const parts = s.split(' ').filter(Boolean);
    const m = new Map<string, number>();
    for (let i = 0; i + 1 < parts.length; i++) {
      const key = `${parts[i]} ${parts[i + 1]}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  };

  const ma = bigrams(a);
  const mb = bigrams(b);
  const totalA = [...ma.values()].reduce((x, y) => x + y, 0);
  const totalB = [...mb.values()].reduce((x, y) => x + y, 0);
  if (totalA === 0 || totalB === 0) return 0;

  let overlap = 0;
  for (const [k, v] of ma) overlap += Math.min(v, mb.get(k) ?? 0);
  return (2 * overlap) / (totalA + totalB);
}
