/**
 * Optimized JSON serialization/deserialization
 * Uses faster alternatives for large payloads
 */

// Fast JSON stringify with circular reference handling
export function fastStringify(obj: unknown, space?: string | number): string {
  if (obj === null || obj === undefined) {
    return "null";
  }

  // For simple objects, use native JSON.stringify
  if (space === undefined && !hasCircularRefs(obj)) {
    try {
      return JSON.stringify(obj);
    } catch {
      // Fall through to safe stringify
    }
  }

  // Safe stringify with circular reference detection
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      return value;
    },
    space,
  );
}

// Fast JSON parse with error handling
export function fastParse<T>(json: string, defaultValue?: T): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw error;
  }
}

// Check if object has circular references
function hasCircularRefs(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const seen = new WeakSet();
  const stack: unknown[] = [obj];

  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current !== "object" || current === null) {
      continue;
    }

    if (seen.has(current)) {
      return true;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        if (typeof item === "object" && item !== null) {
          stack.push(item);
        }
      }
    } else {
      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          const value = (current as Record<string, unknown>)[key];
          if (typeof value === "object" && value !== null) {
            stack.push(value);
          }
        }
      }
    }
  }

  return false;
}

// Stream JSON parser for large payloads
export class StreamingJSONParser {
  private buffer = "";
  private depth = 0;
  private inString = false;
  private escapeNext = false;

  push(chunk: string): unknown[] {
    const results: unknown[] = [];
    this.buffer += chunk;

    let i = 0;
    while (i < this.buffer.length) {
      const char = this.buffer[i];

      if (this.inString) {
        if (this.escapeNext) {
          this.escapeNext = false;
        } else if (char === "\\") {
          this.escapeNext = true;
        } else if (char === '"') {
          this.inString = false;
        }
      } else {
        switch (char) {
          case '"':
            this.inString = true;
            break;
          case "{":
          case "[":
            if (this.depth === 0) {
              // Start of new object/array
            }
            this.depth++;
            break;
          case "}":
          case "]":
            this.depth--;
            if (this.depth === 0) {
              // Complete object/array found
              const jsonStr = this.buffer.slice(0, i + 1);
              try {
                const parsed = JSON.parse(jsonStr);
                results.push(parsed);
                this.buffer = this.buffer.slice(i + 1);
                i = -1; // Reset index after modifying buffer
              } catch {
                // Incomplete or invalid JSON, continue buffering
              }
            }
            break;
        }
      }
      i++;
    }

    return results;
  }

  reset(): void {
    this.buffer = "";
    this.depth = 0;
    this.inString = false;
    this.escapeNext = false;
  }

  get remaining(): string {
    return this.buffer;
  }
}

// Optimized JSON stringify for common patterns
export function optimizedStringify(obj: unknown): string {
  // Fast path for common types
  if (obj === null) return "null";
  if (obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj !== "object") return "null";

  // Fast path for arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    const items = obj.map(optimizedStringify);
    return "[" + items.join(",") + "]";
  }

  // Fast path for plain objects
  const pairs: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = (obj as Record<string, unknown>)[key];
      if (value !== undefined) {
        pairs.push(JSON.stringify(key) + ":" + optimizedStringify(value));
      }
    }
  }
  return "{" + pairs.join(",") + "}";
}
