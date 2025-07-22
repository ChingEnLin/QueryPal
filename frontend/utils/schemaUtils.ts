export interface SchemaKeyNode {
  key: string;
  path: string;
  children?: SchemaKeyNode[];
}

/**
 * Recursively traverses a JSON-like object to build a tree of its keys.
 * This function is used to create a hierarchical structure for dropdowns.
 *
 * @param obj The object to extract keys from.
 * @param prefix The current prefix for nested keys (used internally for recursion).
 * @returns An array of SchemaKeyNode objects representing the root of the schema tree.
 *
 * @example
 * const data = { user: { name: 'John', address: { city: 'New York' } }, status: 'active' };
 * extractSchemaTree(data);
 * // Returns:
 * // [
 * //   { key: 'user', path: 'user', children: [
 * //     { key: 'name', path: 'user.name' },
 * //     { key: 'address', path: 'user.address', children: [
 * //       { key: 'city', path: 'user.address.city' }
 * //     ] }
 * //   ] },
 * //   { key: 'status', path: 'status' }
 * // ]
 */
export const extractSchemaTree = (obj: Record<string, any>, prefix = ''): SchemaKeyNode[] => {
  const nodes: SchemaKeyNode[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      const node: SchemaKeyNode = { key, path };

      // Recurse only if it's a plain object or an array of plain objects.
      if (value && typeof value === 'object') {
        let sample: Record<string, any> | null = null;
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          sample = value[0];
        } else if (!Array.isArray(value)) {
          sample = value;
        }
        
        // We check for `sample.constructor === Object` to exclude special BSON types like ObjectId.
        if (sample && Object.keys(sample).length > 0 && sample.constructor === Object) {
          const children = extractSchemaTree(sample, path);
          if (children.length > 0) {
            node.children = children;
          }
        }
      }
      
      nodes.push(node);
    }
  }
  return nodes;
};
