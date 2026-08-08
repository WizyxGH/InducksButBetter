<div align="center">
  <h1>InducksButBetter</h1>
  <p><strong>A lightning-fast, modern, and serverless frontend for exploring the Disney Comics Database (I.N.D.U.C.K.S.)</strong></p>

  [![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite_8.x-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript_5.x-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![SQLite](https://img.shields.io/badge/SQLite_WASM-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
  [![Crowdin](https://badges.crowdin.net/inducksbutbetter/localized.svg)](https://crowdin.com/project/inducksbutbetter)
</div>

<br />

**InducksButBetter** is a complete reimagining of the classic Inducks search experience. Built with modern web technologies and a local client-side Web Worker database architecture, it offers instant searches, an elegant themeable UI, and powerful SQL exploration tools.

---

## Features

- **Instant search experience:** Autocomplete for stories, characters, authors, publishers, and more, with fast local query execution.
- **"My collection" filter:** Paste your raw Inducks collection export and instantly filter stories to only show issues you actually own.
- **Smart SQL editor:** A built-in code editor with syntax highlighting, schema-aware autocomplete, and query helpers for power users.
- **AI-powered SQL assistant:** Ask the AI in plain English/French and it will help translate your request into an Inducks query.
- **Rich detail pages:** Stories, issues, publications, publishers, indexers, countries — and subseries pages listing every story of a subseries with localized names.
- **Built-in feedback:** A suggestions page that pre-fills a GitHub issue with your report, straight from the app.
- **Fully internationalized:** Seamless switching between multiple languages via the built-in translation system.
- **Offline-first & private:** Runs primarily inside your browser via WebAssembly (SQLite WASM) and OPFS. No remote server required for search and browsing.

## Quick start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+

### 1. Install & Run
```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```
The application will be available at `http://localhost:5173`.

### 2. Validate the project
```bash
# Run the unit tests
pnpm test

# Build for production
pnpm build
```

### 3. Loading the Database

The app runs on a pre-compiled SQLite copy of the Inducks database, stored persistently in your browser (OPFS):
1. On first launch, click **Download from cloud**: the app fetches the pre-built `inducks.sqlite.gz` (from the site itself or the GitHub release), with automatic resume if the download is interrupted.
2. Alternatively, drop a local `inducks.sqlite` or `inducks.sqlite.gz` file into the importer.
3. The database is decompressed and saved to the **Origin Private File System (OPFS)** with persistent-storage permission, so it survives restarts and works offline.
4. All queries then run inside a **SharedWorker** (SQLite WASM), keeping the UI responsive and sharing one database instance across all open tabs.

## Architecture and optimizations

- **Modular React architecture**: Search logic is split into reusable hooks and focused UI components for maintainability.
- **Shared web worker database engine (`sql.js` WASM)**: Queries run in a dedicated `SharedWorker` so the UI stays responsive while large searches execute. Using a SharedWorker means the memory footprint remains minimal (e.g., 150MB total) regardless of how many tabs you open!
- **Vite bundle optimization**: The app uses Vite with code-splitting and PWA support to keep the experience fast and cache-friendly.
- **Local-first data handling**: The pre-compiled SQLite database is downloaded once (or supplied locally) and persisted in OPFS for repeated searches and offline browsing.

## Credits

- **Luis Bärenfaller**: German, Italian, Portuguese and Spanish translation contributions.

## Localization (Crowdin)

Help us translate InducksButBetter into your language! You can easily contribute to the translations via our [Crowdin project](https://crowdin.com/project/inducksbutbetter).

---

<div align="center">
  <h3>🌟 Support the project</h3>
  <p>If you find this project useful or simply love Disney comics, please consider <strong>giving it a star</strong>! It helps the project grow and motivates me to add more features. ⭐</p>
  
  <a href="https://www.star-history.com/?repos=InducksButBetter/InducksButBetter&type=Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=InducksButBetter/InducksButBetter&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=InducksButBetter/InducksButBetter&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=InducksButBetter/InducksButBetter&type=Date" />
    </picture>
  </a>
</div>
