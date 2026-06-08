import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rawTag = process.env.GITHUB_REF_NAME || process.env.RELEASE_VERSION;

if (!rawTag) {
  console.log('No GITHUB_REF_NAME or RELEASE_VERSION found. Skipping version sync for local build.');
  process.exit(0);
}

// Support v0.1.2 or 0.1.2
const version = rawTag.startsWith('v') ? rawTag.slice(1) : rawTag;

// Validate semver-looking version (e.g., 0.1.2 or 1.0.0-beta.1)
const semverRegex = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+)?$/;
if (!semverRegex.test(version)) {
  console.error(`Error: Tag "${rawTag}" does not resolve to a valid semver version ("${version}").`);
  process.exit(1);
}

console.log(`GitHub tag name: ${rawTag}`);
console.log(`Resolved app version: ${version}`);

// 1. Update package.json
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = version;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log(`Updated package.json version to: ${version}`);

// 2. Update src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
  console.log(`Updated tauri.conf.json version to: ${version}`);
}

// 3. Update src-tauri/Cargo.toml
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(/^(version\s*=\s*")[^"]+(")$/m, `$1${version}$2`);
  fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');
  console.log(`Updated Cargo.toml package version to: ${version}`);
}

// 4. Verification
const verifiedVersion = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
if (rawTag !== 'v0.1.0' && verifiedVersion === '0.1.0') {
  console.error('Error: Version failed to sync, package.json is still 0.1.0');
  process.exit(1);
}

console.log('Version sync and verification successful.');
