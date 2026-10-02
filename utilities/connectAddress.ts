// What a connect string actually dials: the Steam relay address once a server
// is on one, which its raw host and port are not.
export function connectAddress(
  connectionString: string | null | undefined,
  host: string | null | undefined,
  port: number | string | null | undefined,
): string {
  return (
    connectionString?.match(/^connect\s+([^;\s]+)/)?.[1] ?? `${host}:${port}`
  );
}
