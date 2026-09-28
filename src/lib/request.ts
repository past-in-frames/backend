import type { Request } from 'express';

/**
 * Express 5 types route params as `string | string[]` to allow wildcards.
 * None of our routes use them, so narrow to the single value.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}
