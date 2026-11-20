import fs from 'fs';
import path from 'path';
import os from 'os';

const downloadsDir = path.join(os.homedir(), 'Downloads');
const downloadPath = path.join(downloadsDir, 'ratings.json');
const targetDir = path.resolve(import.meta.dirname, '..', 'public', 'datas');
const targetPath = path.join(targetDir, 'ratings.json');

if (!fs.existsSync(downloadPath)) {
  console.log(`Le fichier ${downloadPath} n'a pas encore été trouvé dans les Téléchargements.`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(downloadPath, targetPath);
const stats = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
console.log(`✅ Fichier importé avec succès dans ${targetPath} !`);
console.log(`📊 Nombre d'histoires classées : ${stats.length}`);
