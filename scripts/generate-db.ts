import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import readline from 'readline';
import sqlite3 from 'sqlite3';
import { DEFAULT_DB_SCHEMA } from '../src/lib/defaultSchema';

const DB_FILENAME = 'inducks.sqlite';
const COMPRESSED_FILENAME = 'inducks.sqlite.gz';

const INDEXES_TO_CREATE: Record<string, string[]> = {
  inducks_story: ["storycode", "storyheadercode", "firstpublicationdate"],
  inducks_storyversion: ["storycode", "storyversioncode", "entirepages"],
  inducks_storyjob: ["storyversioncode", "personcode"],
  inducks_entry: ["storyversioncode", "issuecode"],
  inducks_issue: ["issuecode", "publicationcode", "oldestdate", "pages"],
  inducks_publication: ["publicationcode", "countrycode", "languagecode"],
  inducks_herocharacter: ["storycode", "charactercode"],
  inducks_character: ["charactercode"],
  inducks_person: ["personcode"],
  inducks_country: ["countrycode"],
  inducks_language: ["languagecode"],
  inducks_storyheader: ["title", "storyheadercode"],
  inducks_appearance: ["storyversioncode", "charactercode"],
  inducks_storysubseries: ["storycode", "subseriescode"],
  inducks_subseriesname: ["subseriescode"],
  inducks_entryurl: ["entrycode"],
  inducks_storydescription: ["storyversioncode"],
  inducks_charactername: ["charactercode"],
  inducks_characterurl: ["charactercode"],
  inducks_publishingjob: ["issuecode", "publisherid"],
  inducks_storycodes: ["storycode", "alternativecode"],
  inducks_issueurl: ["issuecode"],
  inducks_indexer: ["indexer"]
};

const GITHUB_RELEASE_API = 'https://api.github.com/repos/WizyxGH/InducksButBetter/releases/tags/datas';

async function fetchJson(url: string): Promise<any> {
  const headers = { 'User-Agent': 'InducksButBetter-Generator' };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch JSON from ${url} (status ${res.status})`);
  }
  return res.json();
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url} (status ${res.status})`);
  }
  const fileStream = fs.createWriteStream(outputPath);
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error(`Failed to read response body stream for ${url}`);
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
  }
  fileStream.end();
}

function runQuery(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function importIsvFile(db: sqlite3.Database, tableName: string, columns: string[], filePath: string) {
  await runQuery(db, `CREATE TABLE "${tableName}" (${columns.map(c => `"${c}" TEXT`).join(", ")});`);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const colCount = columns.length;
  // SQLite maximum parameters per query is 999. Limit batch size to fit within this.
  const BATCH_SIZE = Math.floor(999 / colCount);
  let batchValues: any[] = [];
  let count = 0;

  await runQuery(db, "BEGIN TRANSACTION;");

  let isFirstLine = true;
  for await (const line of rl) {
    if (!line) continue;
    
    if (isFirstLine) {
      isFirstLine = false;
      if (line.includes('^')) {
        continue;
      }
    }

    const values = line.split('^');
    const boundValues = new Array(colCount);
    for (let i = 0; i < colCount; i++) {
      boundValues[i] = values[i] !== undefined ? values[i] : null;
    }

    batchValues.push(...boundValues);
    count++;

    if (count % BATCH_SIZE === 0) {
      const placeholders = new Array(BATCH_SIZE).fill(`(${columns.map(() => "?").join(",")})`).join(",");
      const insertQuery = `INSERT INTO "${tableName}" VALUES ${placeholders}`;
      
      await new Promise<void>((resolve, reject) => {
        db.run(insertQuery, batchValues, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      batchValues = [];
    }

    if (count % 50000 === 0) {
      await new Promise<void>((resolve, reject) => {
        db.run("COMMIT;", (err) => {
          if (err) return reject(err);
          db.run("BEGIN TRANSACTION;", (e) => {
            if (e) reject(e);
            else resolve();
          });
        });
      });
    }
  }

  // Insert remaining rows
  const remainingCount = count % BATCH_SIZE;
  if (remainingCount > 0 && batchValues.length > 0) {
    const placeholders = new Array(remainingCount).fill(`(${columns.map(() => "?").join(",")})`).join(",");
    const insertQuery = `INSERT INTO "${tableName}" VALUES ${placeholders}`;
    await new Promise<void>((resolve, reject) => {
      db.run(insertQuery, batchValues, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  await runQuery(db, "COMMIT;");
  console.log(`  Imported ${count} rows into ${tableName}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dirArgIndex = args.indexOf('--dir');
  let isvDir = dirArgIndex !== -1 ? args[dirArgIndex + 1] : null;

  const tempDir = path.join(process.cwd(), 'temp_isv');
  let tempCreated = false;

  try {
    if (!isvDir) {
      if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).filter(f => f.endsWith('.isv')).length > 0) {
        console.log('Using existing cached ISV files in temp_isv...');
        isvDir = tempDir;
      } else {
        console.log('No local ISV directory provided via --dir. Downloading from GitHub Release tag: datas...');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir);
          tempCreated = true;
        }

        const releaseData = await fetchJson(GITHUB_RELEASE_API);
        const assets = releaseData.assets || [];
        const isvAssets = assets.filter((a: any) => a.name.endsWith('.isv'));

        if (isvAssets.length === 0) {
          throw new Error('No .isv files found in GitHub release!');
        }

        console.log(`Found ${isvAssets.length} ISV files. Downloading...`);
        for (const asset of isvAssets) {
          const destPath = path.join(tempDir, asset.name);
          console.log(`  Downloading ${asset.name} (${Math.round(asset.size / 1024 / 1024 * 10) / 10} MB)...`);
          await downloadFile(asset.browser_download_url, destPath);
        }
        isvDir = tempDir;
      }
    }

    const dbPath = path.join(process.cwd(), DB_FILENAME);
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    console.log(`Creating database at: ${dbPath}...`);
    const db = new sqlite3.Database(dbPath);

    // SQLite speed configurations for creation
    await runQuery(db, "PRAGMA journal_mode = OFF;");
    await runQuery(db, "PRAGMA synchronous = OFF;");
    await runQuery(db, "PRAGMA temp_store = MEMORY;");

    const files = fs.readdirSync(isvDir).filter(f => f.endsWith('.isv'));
    console.log(`Importing ${files.length} ISV files into database...`);

    for (const file of files) {
      const tableName = file.replace(/\.isv$/i, '').toLowerCase();
      const columns = DEFAULT_DB_SCHEMA[tableName];
      if (!columns) {
        console.warn(`  Skipping ${file}: no schema mapping found.`);
        continue;
      }
      const filePath = path.join(isvDir, file);
      console.log(`  Processing ${file}...`);
      await importIsvFile(db, tableName, columns, filePath);
    }

    // Build indexes
    console.log('Building indexes...');
    await runQuery(db, "BEGIN TRANSACTION;");
    for (const [table, columns] of Object.entries(INDEXES_TO_CREATE)) {
      for (const col of columns) {
        try {
          await runQuery(db, `CREATE INDEX "idx_${table}_${col}" ON "${table}"("${col}");`);
        } catch (err: any) {
          console.warn(`  Could not create index for ${table}(${col}): ${err.message}`);
        }
      }
    }
    try {
      await runQuery(db, `CREATE INDEX "idx_inducks_person_numissues" ON "inducks_person"(CAST(numberofindexedissues AS INTEGER));`);
    } catch (err) {}
    await runQuery(db, "COMMIT;");

    // Perform database optimization
    console.log('Optimizing SQLite database (VACUUM, ANALYZE)...');
    await runQuery(db, "PRAGMA journal_mode = DELETE;");
    await runQuery(db, "VACUUM;");
    await runQuery(db, "ANALYZE;");
    
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('Database compilation completed successfully.');

    // Compress database file
    console.log('Compressing database to gzip format...');
    const compressedPath = path.join(process.cwd(), COMPRESSED_FILENAME);
    if (fs.existsSync(compressedPath)) {
      fs.unlinkSync(compressedPath);
    }

    await new Promise<void>((resolve, reject) => {
      const rawStream = fs.createReadStream(dbPath);
      const zipStream = zlib.createGzip({ level: 9 });
      const outStream = fs.createWriteStream(compressedPath);

      rawStream
        .pipe(zipStream)
        .pipe(outStream)
        .on('finish', () => resolve())
        .on('error', err => reject(err));
    });

    const origSize = fs.statSync(dbPath).size;
    const compSize = fs.statSync(compressedPath).size;
    console.log(`Compression ratio: ${Math.round(compSize / origSize * 100)}% (${Math.round(origSize / 1024 / 1024 * 10) / 10} MB -> ${Math.round(compSize / 1024 / 1024 * 10) / 10} MB)`);
    console.log(`Success! Compressed file saved at: ${compressedPath}`);

  } catch (error: any) {
    console.error('Error during database generation:', error.message);
    process.exit(1);
  } finally {
    if (tempCreated && fs.existsSync(tempDir)) {
      console.log('Cleaning up temporary downloaded files...');
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

main();
