import { executeLocal, hasLocalDb } from "./localDb"
export { hasLocalDb } from "./localDb"

/**
 * Executes SQL queries directly on the local in-memory database (sql.js WASM / IndexedDB).
 */
export async function executeQuery(query: { sql: string, args?: any[] } | string, onRow?: (row: any) => void) {
  return executeLocal(query, onRow)
}
