export function serializeRows<T>(rows: T[]): unknown[] {
  return JSON.parse(JSON.stringify(rows));
}

export function serializeRow<T>(row: T): unknown {
  return JSON.parse(JSON.stringify(row));
}
