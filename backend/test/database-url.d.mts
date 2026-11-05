export function resolveTestDatabaseUrl(
  environment: Record<string, string | undefined>,
  local?: Record<string, string | undefined>,
): string;

export function assertTestDatabaseUrl(databaseUrl: string | undefined): string;
