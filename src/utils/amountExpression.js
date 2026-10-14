/** Safely evaluates basic arithmetic, without eval or Function. */
export function evaluateAmount(expression) {
  const source = String(expression ?? '').replace(/\s+/g, '');
  if (!source || !/^[\d.+\-*/()]+$/.test(source)) return null;
  let position = 0;
  const parseNumber = () => {
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(position));
    if (!match) throw new Error('Expected number');
    position += match[0].length;
    return Number(match[0]);
  };
  const parsePrimary = () => {
    if (source[position] === '+') { position++; return parsePrimary(); }
    if (source[position] === '-') { position++; return -parsePrimary(); }
    if (source[position] === '(') {
      position++;
      const value = parseAdditive();
      if (source[position] !== ')') throw new Error('Missing closing parenthesis');
      position++;
      return value;
    }
    return parseNumber();
  };
  const parseMultiply = () => {
    let value = parsePrimary();
    while (source[position] === '*' || source[position] === '/') {
      const operator = source[position++];
      const right = parsePrimary();
      if (operator === '/' && right === 0) throw new Error('Division by zero');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  const parseAdditive = () => {
    let value = parseMultiply();
    while (source[position] === '+' || source[position] === '-') {
      const operator = source[position++];
      const right = parseMultiply();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };
  try {
    const result = parseAdditive();
    if (position !== source.length || !Number.isFinite(result) || Math.abs(result) > 1e12) return null;
    return Math.round((result + Number.EPSILON) * 100) / 100;
  } catch {
    return null;
  }
}
