const sql = require('sql.js');
const fs = require('fs');
const zlib = require('zlib');

async function main() {
  const sqlite3 = await sql();
  const dbBuf = zlib.unzipSync(fs.readFileSync('public/datas/inducks.sqlite.gz'));
  const db = new sqlite3.Database(dbBuf);
  console.log(db.exec("SELECT position, entrycode, storyversioncode, printedcode FROM inducks_entry WHERE issuecode = 'fr/PM 579'")[0].values);
}

main();
