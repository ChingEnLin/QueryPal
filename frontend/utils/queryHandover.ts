export interface FilterState {
  id: string;
  key: string;
  value: string;
  isCustom: boolean;
  operator?: string;
  type?: 'string' | 'number' | 'boolean' | 'date';
}

export interface HandoverResult {
  collection: string;
  filters: FilterState[];
}

// MongoDB operator → Explorer operator
const MONGO_OP_MAP: Record<string, string> = {
  '$eq':    'equals',
  '$ne':    'not_equals',
  '$gt':    'greater_than',
  '$gte':   'greater_than',
  '$lt':    'less_than',
  '$lte':   'less_than',
  '$regex': 'contains',
};

function inferType(v: unknown): FilterState['type'] {
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'string';
}

function makeid(): string {
  return Math.random().toString(36).substring(7);
}

export function parseQueryForHandover(code: string): HandoverResult | null {
  const collMatch =
    code.match(/db\[['"](.+?)['"]\]\.find\s*\(/) ||
    code.match(/db\.(\w+)\.find\s*\(/);
  if (!collMatch) return null;
  const collection = collMatch[1];

  const findIdx = code.indexOf('.find(');
  if (findIdx === -1) return null;

  let depth = 0;
  let start = -1;
  let end = -1;
  for (let i = findIdx + 6; i < code.length; i++) {
    if (code[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (code[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (start === -1 || end === -1) return { collection, filters: [] };

  const raw = code.slice(start, end + 1);

  // Normalize Python dict syntax → JSON
  const jsonStr = raw
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    .replace(/'/g, '"');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { collection, filters: [] };
  }

  const filters: FilterState[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith('$')) continue;

    // Primitive value → equals
    if (typeof value !== 'object' || value === null) {
      filters.push({
        id: makeid(), key,
        value: String(value),
        operator: 'equals',
        isCustom: false,
        type: inferType(value),
      });
      continue;
    }

    // Operator object: {"$ne": "x"}, {"$gt": 5}, {"$exists": true}, etc.
    // Multiple operators on the same field become multiple filter rows.
    const obj = value as Record<string, unknown>;
    let handled = false;

    for (const op of Object.keys(obj)) {
      if (op === '$exists') {
        filters.push({
          id: makeid(), key,
          value: '',
          operator: obj[op] ? 'exists' : 'not_exists',
          isCustom: false,
          type: 'string',
        });
        handled = true;
        continue;
      }

      const explorerOp = MONGO_OP_MAP[op];
      const v = obj[op];
      // Skip null values for comparison operators — they can't be represented as a string filter
      if (explorerOp && v !== null && v !== undefined && typeof v !== 'object') {
        filters.push({
          id: makeid(), key,
          value: String(v),
          operator: explorerOp,
          isCustom: false,
          type: inferType(v),
        });
        handled = true;
      }
    }

    if (handled) continue;
    // Complex operator — skip (can't represent cleanly)
  }

  return { collection, filters };
}
