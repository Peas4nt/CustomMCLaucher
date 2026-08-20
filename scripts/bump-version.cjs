const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: node scripts/bump-version.cjs <new-version> (e.g. 1.1.0)');
  process.exit(1);
}

const semverClean = newVersion.replace(/^v/, '');
const parts = semverClean.split('.');
const displayVersion = `v${parts[0]}.${parts[1] || '0'}`;

console.log(`\n🚀 Bumping project to version ${semverClean} (${displayVersion})...\n`);

// 1. Update version.json
const versionJsonPath = path.join(rootDir, 'version.json');
fs.writeFileSync(versionJsonPath, JSON.stringify({ version: semverClean, displayVersion }, null, 2) + '\n');
console.log('✔ Updated version.json');

// 2. Helper to replace json version
function updateJsonVersion(filePath) {
  if (fs.existsSync(filePath)) {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    json.version = semverClean;
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
    console.log(`✔ Updated ${path.relative(rootDir, filePath)}`);
  }
}

updateJsonVersion(path.join(rootDir, 'server/package.json'));
updateJsonVersion(path.join(rootDir, 'admin-web/package.json'));
updateJsonVersion(path.join(rootDir, 'client/package.json'));
updateJsonVersion(path.join(rootDir, 'client/src-tauri/tauri.conf.json'));

// 3. Update Cargo.toml
const cargoPath = path.join(rootDir, 'client/src-tauri/Cargo.toml');
if (fs.existsSync(cargoPath)) {
  let content = fs.readFileSync(cargoPath, 'utf8');
  content = content.replace(/^version = ".*"/m, `version = "${semverClean}"`);
  fs.writeFileSync(cargoPath, content);
  console.log('✔ Updated client/src-tauri/Cargo.toml');
}

// 4. Update loader.rs
const loaderPath = path.join(rootDir, 'client/src-tauri/src/downloader/loader.rs');
if (fs.existsSync(loaderPath)) {
  let content = fs.readFileSync(loaderPath, 'utf8');
  content = content.replace(/\.replace\("\$\{launcher_version\}", ".*?"\)/g, `.replace("\${launcher_version}", "${semverClean}")`);
  fs.writeFileSync(loaderPath, content);
  console.log('✔ Updated client/src-tauri/src/downloader/loader.rs');
}

// 5. Update UI Badges in Dashboard.tsx
const dashboardPath = path.join(rootDir, 'client/src/components/Dashboard.tsx');
if (fs.existsSync(dashboardPath)) {
  let content = fs.readFileSync(dashboardPath, 'utf8');
  content = content.replace(/<span className="text-\[10px\] text-slate-400 font-mono">v.*?<\/span>/g, `<span className="text-[10px] text-slate-400 font-mono">${displayVersion}</span>`);
  fs.writeFileSync(dashboardPath, content);
  console.log('✔ Updated client/src/components/Dashboard.tsx UI badge');
}

// 6. Update UI Badges in AdminLayout.tsx
const adminLayoutPath = path.join(rootDir, 'admin-web/src/layouts/AdminLayout.tsx');
if (fs.existsSync(adminLayoutPath)) {
  let content = fs.readFileSync(adminLayoutPath, 'utf8');
  content = content.replace(/v\d+\.\d+ ADMIN/g, `${displayVersion} ADMIN`);
  content = content.replace(/Management Portal • v\d+\.\d+/g, `Management Portal • ${displayVersion}`);
  fs.writeFileSync(adminLayoutPath, content);
  console.log('✔ Updated admin-web/src/layouts/AdminLayout.tsx UI badges');
}

// 7. Update Server index.ts Health API
const serverIndexPath = path.join(rootDir, 'server/src/index.ts');
if (fs.existsSync(serverIndexPath)) {
  let content = fs.readFileSync(serverIndexPath, 'utf8');
  content = content.replace(/version: '.*?'/g, `version: '${semverClean}'`);
  fs.writeFileSync(serverIndexPath, content);
  console.log('✔ Updated server/src/index.ts health version');
}

// 8. Update GitHub Actions release.yml
const workflowPath = path.join(rootDir, '.github/workflows/release.yml');
if (fs.existsSync(workflowPath)) {
  let content = fs.readFileSync(workflowPath, 'utf8');
  content = content.replace(/default:\s*"v.*?"/g, `default: "${displayVersion}.0"`);
  content = content.replace(/description:\s*"Release tag \(e\.g\. v.*?\)"/g, `description: "Release tag (e.g. ${displayVersion}.0)"`);
  fs.writeFileSync(workflowPath, content);
  console.log('✔ Updated .github/workflows/release.yml');
}

console.log(`\n🎉 Project successfully bumped to ${semverClean}!\n`);
