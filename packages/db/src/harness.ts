/**
 * Starter-code generator.
 *
 * Every seeded problem declares a small I/O spec (parameter types + return
 * type). From that we generate a complete, compilable stdin/stdout harness for
 * each supported language with the solution function left as a stub.
 *
 * Doing it this way rather than hand-writing 4 snippets per problem means:
 *   • the harness is identical across problems, so a student learns it once
 *   • adding a language is one function here, not N snippets per problem
 *   • reference solutions reuse the same harness, so what we validate against
 *     is exactly the shape students are asked to fill in
 */

export type ParamType = 'int' | 'int[]' | 'str' | 'str[]' | 'grid';
export type ReturnType = 'int' | 'bool' | 'int[]' | 'str';

export interface IoSpec {
  fn: string;
  params: { name: string; type: ParamType }[];
  returns: ReturnType;
}

const indent = (code: string, spaces: number): string =>
  code
    .split('\n')
    .map((l) => (l.trim() === '' ? l : ' '.repeat(spaces) + l))
    .join('\n');

/* ── Python ───────────────────────────────────────────────────────────────*/

const PY_TYPES: Record<ParamType, string> = {
  int: 'int',
  'int[]': 'list[int]',
  str: 'str',
  'str[]': 'list[str]',
  grid: 'list[list[str]]',
};

function pyReader(name: string, type: ParamType): string {
  switch (type) {
    case 'int':
      return `    ${name} = int(_data[_i].strip())\n    _i += 1`;
    case 'int[]':
      return `    ${name} = [int(_v) for _v in _data[_i].split()]\n    _i += 1`;
    case 'str':
      return `    ${name} = _data[_i].strip()\n    _i += 1`;
    case 'str[]':
      return `    ${name} = _data[_i].split()\n    _i += 1`;
    case 'grid':
      return (
        `    _rows = int(_data[_i].split()[0])\n` +
        `    _i += 1\n` +
        `    ${name} = [list(_data[_i + _k].strip()) for _k in range(_rows)]\n` +
        `    _i += _rows`
      );
  }
}

function pyWriter(returns: ReturnType): string {
  switch (returns) {
    case 'bool':
      return `    print("true" if _res else "false")`;
    case 'int[]':
      return `    print(" ".join(str(_v) for _v in _res))`;
    default:
      return `    print(_res)`;
  }
}

export function pythonProgram(io: IoSpec, body: string): string {
  const sig = io.params.map((p) => `${p.name}: ${PY_TYPES[p.type]}`).join(', ');
  const args = io.params.map((p) => p.name).join(', ');
  return `import sys


def ${io.fn}(${sig}):
${indent(body, 4)}


def _main() -> None:
    _data = sys.stdin.read().split("\\n")
    _i = 0
${io.params.map((p) => pyReader(p.name, p.type)).join('\n')}
    _res = ${io.fn}(${args})
${pyWriter(io.returns)}


if __name__ == "__main__":
    _main()
`;
}

/* ── JavaScript ───────────────────────────────────────────────────────────*/

function jsReader(name: string, type: ParamType, idx: number): string {
  switch (type) {
    case 'int':
      return `const ${name} = Number(_lines[_i++].trim());`;
    case 'int[]':
      return `const _t${idx} = _lines[_i++].trim();\nconst ${name} = _t${idx} ? _t${idx}.split(/\\s+/).map(Number) : [];`;
    case 'str':
      return `const ${name} = _lines[_i++].trim();`;
    case 'str[]':
      return `const _t${idx} = _lines[_i++].trim();\nconst ${name} = _t${idx} ? _t${idx}.split(/\\s+/) : [];`;
    case 'grid':
      return (
        `const _rows${idx} = Number(_lines[_i++].trim().split(/\\s+/)[0]);\n` +
        `const ${name} = [];\n` +
        `for (let _k = 0; _k < _rows${idx}; _k++) ${name}.push(_lines[_i++].trim().split(''));`
      );
  }
}

function jsWriter(returns: ReturnType): string {
  switch (returns) {
    case 'bool':
      return `console.log(_res ? 'true' : 'false');`;
    case 'int[]':
      return `console.log(_res.join(' '));`;
    default:
      return `console.log(_res);`;
  }
}

export function javascriptProgram(io: IoSpec, body: string): string {
  const args = io.params.map((p) => p.name).join(', ');
  return `function ${io.fn}(${args}) {
${indent(body, 2)}
}

const _lines = require('fs').readFileSync(0, 'utf8').split('\\n');
let _i = 0;
${io.params.map((p, k) => jsReader(p.name, p.type, k)).join('\n')}
const _res = ${io.fn}(${args});
${jsWriter(io.returns)}
`;
}

/* ── C++ ──────────────────────────────────────────────────────────────────*/

const CPP_TYPES: Record<ParamType, string> = {
  int: 'int',
  'int[]': 'vector<int>',
  str: 'string',
  'str[]': 'vector<string>',
  grid: 'vector<vector<char>>',
};

const CPP_RETURNS: Record<ReturnType, string> = {
  int: 'int',
  bool: 'bool',
  'int[]': 'vector<int>',
  str: 'string',
};

function cppReader(name: string, type: ParamType, idx: number): string {
  switch (type) {
    case 'int':
      return `    int ${name} = stoi(_lines[_i++]);`;
    case 'int[]':
      return `    vector<int> ${name};\n    { stringstream _ss${idx}(_lines[_i++]); int _v; while (_ss${idx} >> _v) ${name}.push_back(_v); }`;
    case 'str':
      return `    string ${name} = _lines[_i++];`;
    case 'str[]':
      return `    vector<string> ${name};\n    { stringstream _ss${idx}(_lines[_i++]); string _v; while (_ss${idx} >> _v) ${name}.push_back(_v); }`;
    case 'grid':
      return (
        `    int _rows${idx} = 0;\n` +
        `    { stringstream _ss${idx}(_lines[_i++]); _ss${idx} >> _rows${idx}; }\n` +
        `    vector<vector<char>> ${name};\n` +
        `    for (int _k = 0; _k < _rows${idx}; _k++) { string _row = _lines[_i++]; ${name}.push_back(vector<char>(_row.begin(), _row.end())); }`
      );
  }
}

function cppWriter(returns: ReturnType): string {
  switch (returns) {
    case 'bool':
      return `    cout << (_res ? "true" : "false") << "\\n";`;
    case 'int[]':
      return `    for (size_t _k = 0; _k < _res.size(); _k++) cout << _res[_k] << (_k + 1 < _res.size() ? ' ' : '\\n');\n    if (_res.empty()) cout << "\\n";`;
    default:
      return `    cout << _res << "\\n";`;
  }
}

export function cppProgram(io: IoSpec, body: string): string {
  const sig = io.params.map((p) => `${CPP_TYPES[p.type]} ${p.name}`).join(', ');
  const args = io.params.map((p) => p.name).join(', ');
  return `#include <bits/stdc++.h>
using namespace std;

${CPP_RETURNS[io.returns]} ${io.fn}(${sig}) {
${indent(body, 4)}
}

int main() {
    ios::sync_with_stdio(false);
    vector<string> _lines;
    string _line;
    while (getline(cin, _line)) {
        while (!_line.empty() && (_line.back() == '\\r' || _line.back() == '\\n')) _line.pop_back();
        _lines.push_back(_line);
    }
    _lines.push_back("");
    size_t _i = 0;
${io.params.map((p, k) => cppReader(p.name, p.type, k)).join('\n')}
    auto _res = ${io.fn}(${args});
${cppWriter(io.returns)}
    return 0;
}
`;
}

/* ── Java ─────────────────────────────────────────────────────────────────*/

const JAVA_TYPES: Record<ParamType, string> = {
  int: 'int',
  'int[]': 'int[]',
  str: 'String',
  'str[]': 'String[]',
  grid: 'char[][]',
};

const JAVA_RETURNS: Record<ReturnType, string> = {
  int: 'int',
  bool: 'boolean',
  'int[]': 'int[]',
  str: 'String',
};

const JAVA_DEFAULT: Record<ReturnType, string> = {
  int: '0',
  bool: 'false',
  'int[]': 'new int[0]',
  str: '""',
};

function javaReader(name: string, type: ParamType, idx: number): string {
  switch (type) {
    case 'int':
      return `        int ${name} = Integer.parseInt(_lines.get(_i++).trim());`;
    case 'int[]':
      return (
        `        String _t${idx} = _lines.get(_i++).trim();\n` +
        `        int[] ${name} = _t${idx}.isEmpty() ? new int[0] : Arrays.stream(_t${idx}.split("\\\\s+")).mapToInt(Integer::parseInt).toArray();`
      );
    case 'str':
      return `        String ${name} = _lines.get(_i++).trim();`;
    case 'str[]':
      return (
        `        String _t${idx} = _lines.get(_i++).trim();\n` +
        `        String[] ${name} = _t${idx}.isEmpty() ? new String[0] : _t${idx}.split("\\\\s+");`
      );
    case 'grid':
      return (
        `        int _rows${idx} = Integer.parseInt(_lines.get(_i++).trim().split("\\\\s+")[0]);\n` +
        `        char[][] ${name} = new char[_rows${idx}][];\n` +
        `        for (int _k = 0; _k < _rows${idx}; _k++) ${name}[_k] = _lines.get(_i++).trim().toCharArray();`
      );
  }
}

function javaWriter(returns: ReturnType): string {
  switch (returns) {
    case 'bool':
      return `        System.out.println(_res ? "true" : "false");`;
    case 'int[]':
      return (
        `        StringBuilder _sb = new StringBuilder();\n` +
        `        for (int _k = 0; _k < _res.length; _k++) { if (_k > 0) _sb.append(' '); _sb.append(_res[_k]); }\n` +
        `        System.out.println(_sb.toString());`
      );
    default:
      return `        System.out.println(_res);`;
  }
}

export function javaProgram(io: IoSpec, body: string): string {
  const sig = io.params.map((p) => `${JAVA_TYPES[p.type]} ${p.name}`).join(', ');
  const args = io.params.map((p) => p.name).join(', ');
  return `import java.io.*;
import java.util.*;

public class Main {

    static ${JAVA_RETURNS[io.returns]} ${io.fn}(${sig}) {
${indent(body, 8)}
    }

    public static void main(String[] args) throws IOException {
        BufferedReader _br = new BufferedReader(new InputStreamReader(System.in));
        List<String> _lines = new ArrayList<>();
        String _line;
        while ((_line = _br.readLine()) != null) _lines.add(_line);
        _lines.add("");
        int _i = 0;
${io.params.map((p, k) => javaReader(p.name, p.type, k)).join('\n')}
        ${JAVA_RETURNS[io.returns]} _res = ${io.fn}(${args});
${javaWriter(io.returns)}
    }
}
`;
}

export const JAVA_STUB_BODY = (returns: ReturnType): string =>
  `// Write your code here\nreturn ${JAVA_DEFAULT[returns]};`;

export const CPP_STUB_BODY = (returns: ReturnType): string => {
  const dflt: Record<ReturnType, string> = {
    int: '0',
    bool: 'false',
    'int[]': '{}',
    str: '""',
  };
  return `// Write your code here\nreturn ${dflt[returns]};`;
};

export const PY_STUB_BODY = `# Write your code here\npass`;
export const JS_STUB_BODY = `// Write your code here`;
