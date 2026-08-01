import { executeQuery } from './src/lib/db';

async function check() {
  try {
    const res1 = await executeQuery({ sql: "PRAGMA table_info(inducks_storyversion)", args: [] });
    console.log("inducks_storyversion columns:", res1.rows.map((r: any) => r.name).join(", "));
    
    const res2 = await executeQuery({ sql: "PRAGMA table_info(inducks_entry)", args: [] });
    console.log("inducks_entry columns:", res2.rows.map((r: any) => r.name).join(", "));
  } catch (err) {
    console.error(err);
  }
}
check();
