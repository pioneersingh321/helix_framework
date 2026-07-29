import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse .env from workspace root if it exists
function loadEnv() {
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eq = trimmed.indexOf('=');
            if (eq > -1) {
                const key = trimmed.slice(0, eq).trim();
                let val = trimmed.slice(eq + 1).trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                process.env[key] = val;
            }
        });
    }
}

loadEnv();

const srcDir = path.resolve(__dirname, 'dist');
const destDir = path.resolve(__dirname, process.env.CORE_DEST_DIR || '../../dist');

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = process.env.VITE_CORE_VERSION || packageJson.version;

if (process.env.VITE_CORE_VERSION && packageJson.version !== process.env.VITE_CORE_VERSION) {
    packageJson.version = process.env.VITE_CORE_VERSION;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
    console.log(`Updated package.json version to ${process.env.VITE_CORE_VERSION}`);
}

const versionStr = version.replace(/\./g, '-');

const srcFile = path.join(srcDir, 'helix.js');
const srcMinFile = path.join(srcDir, 'helix.min.js');

const destVersionFile = path.join(destDir, `helix-${versionStr}.js`);
const destVersionMinFile = path.join(destDir, `helix-${versionStr}.min.js`);
const destBaseFile = path.join(destDir, 'helix.js');
const destBaseMinFile = path.join(destDir, 'helix.min.js');

function copyFile(src, dest) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${path.basename(src)} to ${path.basename(dest)}`);
    } else {
        console.warn(`Source file not found: ${src}`);
    }
}

// --- Manual Dist Copy with Overwrite Check ---
async function handleDistCopy() {
    const fileExists = fs.existsSync(destVersionFile) || fs.existsSync(destVersionMinFile) ||
                       fs.existsSync(destBaseFile) || fs.existsSync(destBaseMinFile);

    if (fileExists) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const shouldPrompt = process.stdin.isTTY && !process.env.CI && !process.argv.includes('-y') && !process.argv.includes('--yes') && !process.env.FORCE_COPY;
    const answer = !shouldPrompt ? 'y' : await new Promise((resolve) => {
            rl.question(`Files already exist in shared dist. Overwrite? (y/n): `, (ans) => {
                resolve(ans.trim().toLowerCase());
            });
        });

        rl.close();

        if (answer === 'y' || answer === 'yes') {
            copyFile(srcFile, destVersionFile);
            copyFile(srcMinFile, destVersionMinFile);
            copyFile(srcFile, destBaseFile);
            copyFile(srcMinFile, destBaseMinFile);
        } else {
            console.log('Skipped writing to shared dist folder.');
        }
    } else {
        copyFile(srcFile, destVersionFile);
        copyFile(srcMinFile, destVersionMinFile);
        copyFile(srcFile, destBaseFile);
        copyFile(srcMinFile, destBaseMinFile);
    }
}

handleDistCopy();
