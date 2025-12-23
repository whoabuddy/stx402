// helper to replace bigint values with strings for JSON serialization
export function replaceBigintWithString(key: string, value: any) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}
