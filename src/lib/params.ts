export function routeParam(
  value: string | string[] | undefined,
  fallback = '',
) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

export function routeId(value: string | string[] | undefined) {
  return Number(routeParam(value));
}
