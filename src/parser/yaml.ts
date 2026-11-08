import fs from 'node:fs';
import { parseDocument } from 'yaml';

export interface ParseError {
  filePath: string;
  line?: number;
  column?: number;
  message: string;
}

export interface ParseResult<T = any> {
  data?: T;
  error?: ParseError;
}

export function parseYamlString<T = any>(content: string, filePath: string = '<string>'): ParseResult<T> {
  try {
    const doc = parseDocument(content, { prettyErrors: true });
    if (doc.errors.length > 0) {
      const first = doc.errors[0];
      const pos = first.linePos ? first.linePos[0] : undefined;
      return {
        error: {
          filePath,
          line: pos?.line,
          column: pos?.col,
          message: first.message,
        },
      };
    }
    return { data: doc.toJS() as T };
  } catch (err: any) {
    return {
      error: {
        filePath,
        message: err.message || String(err),
      },
    };
  }
}

export function parseYamlFile<T = any>(filePath: string): ParseResult<T> {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        error: {
          filePath,
          message: `File does not exist: ${filePath}`,
        },
      };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseYamlString<T>(content, filePath);
  } catch (err: any) {
    return {
      error: {
        filePath,
        message: err.message || String(err),
      },
    };
  }
}
