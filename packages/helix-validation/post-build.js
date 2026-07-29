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
const destDir = path.resolve(__dirname, process.env.PLUGINS_DEST_DIR || '../../plugins');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const packageName = packageJson.name; // "helix-validation"
const folderName = packageName.replace('helix-', ''); // "validation"
const targetDir = path.resolve(destDir, folderName);

// Ensure destination directory exists
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const version = process.env.VITE_VALIDATION_VERSION || packageJson.version;
const versionStr = version.replace(/\./g, '-');

const srcFile = path.join(srcDir, `${packageName}.js`);
const srcMinFile = path.join(srcDir, `${packageName}.min.js`);

const destVersionFile = path.join(targetDir, `${packageName}-${versionStr}.js`);
const destVersionMinFile = path.join(targetDir, `${packageName}-${versionStr}.min.js`);
const destBaseFile = path.join(targetDir, `${packageName}.js`);
const destBaseMinFile = path.join(targetDir, `${packageName}.min.js`);

function processFile(src, dest) {
    if (fs.existsSync(src)) {
        let code = fs.readFileSync(src, 'utf8');

        // Remove standard global assignments
        code = code.replace(/const root\s*=\s*(typeof window !== ['"]undefined['"]\s*\?\s*window\s*:\s*globalThis);\s*root\.HelixValidationPlugin\s*=\s*HelixValidationPlugin;/g, '');
        code = code.replace(/const root\s*=\s*\(typeof window !== ['"]undefined['"]\s*\?\s*window\s*:\s*globalThis\);\s*root\.HelixValidationPlugin\s*=\s*HelixValidationPlugin;/g, '');

        // Replace IIFE wrapper footers
        const targetWrapper = '})(this.HelixValidationPlugin = this.HelixValidationPlugin || {});';
        const targetWrapperMin = '})(this.HelixValidationPlugin=this.HelixValidationPlugin||{});';

        const newWrapper = `    const root = typeof window !== 'undefined' ? window : globalThis;
    root.HelixValidationPlugin = Object.assign(HelixValidationPlugin, exports);
})(typeof window !== 'undefined' ? window.HelixValidationPlugin = window.HelixValidationPlugin || {} : globalThis.HelixValidationPlugin = globalThis.HelixValidationPlugin || {});`;

        const newWrapperMin = `var root=typeof window!=="undefined"?window:globalThis;root.HelixValidationPlugin=Object.assign(HelixValidationPlugin,exports)})(typeof window!=="undefined"?window.HelixValidationPlugin=window.HelixValidationPlugin||{}:globalThis.HelixValidationPlugin=globalThis.HelixValidationPlugin||{});`;

        if (code.includes(targetWrapper)) {
            code = code.replace(targetWrapper, newWrapper);
        } else if (code.includes(targetWrapperMin)) {
            code = code.replace(targetWrapperMin, newWrapperMin);
        }

        fs.writeFileSync(dest, code, 'utf8');
        console.log(`Processed and copied ${path.basename(src)} to ${path.relative(destDir, dest)}`);
    } else {
        console.warn(`Source file not found: ${src}`);
    }
}

async function handleValidationCopy() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const shouldPrompt = process.stdin.isTTY && !process.env.CI && !process.argv.includes('-y') && !process.argv.includes('--yes') && !process.env.FORCE_COPY;
    const answer = !shouldPrompt ? 'y' : await new Promise((resolve) => {
        rl.question(`Do you want to copy ${folderName} build files to plugins/${folderName}/ directory? (y/n): `, (ans) => {
            resolve(ans.trim().toLowerCase());
        });
    });

    rl.close();

    if (answer === 'y' || answer === 'yes') {
        processFile(srcFile, destVersionFile);
        processFile(srcMinFile, destVersionMinFile);
        processFile(srcFile, destBaseFile);
        processFile(srcMinFile, destBaseMinFile);
    } else {
        console.log(`Skipped writing to plugins/${folderName}/ folder.`);
    }
}

handleValidationCopy();
