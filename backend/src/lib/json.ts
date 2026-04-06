export function jsonSafe<T>(value: T): T {
  // Convert BigInt to string so JSON serialization doesn't throw.
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === "bigint" ? val.toString() : val
    )
  ) as T;
}
