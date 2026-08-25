#!/usr/bin/env node

/**
 * Helix Framework Unified Bundle Builder
 * Bundles Helix Core together with any chosen combination of official plugins.
 * 
 * Usage:
 *   node scripts/bundle.js --all
 *   node scripts/bundle.js --preset=essentials
 *   node scripts/bundle.js --plugins=directives,helpers,fetch,store
 *   node scripts/bundle.js --plugins=helpers,validation --out=helix.forms.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { PLUGINS, PRESETS } from './bundle-meta.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// Locate esbuild from packages/core
let esbuild;
try {
    esbuild = require(require.resolve('esbuild', { paths: [path.join(rootDir, 'packages/core')] }));
} catch (e) {
    try {
        esbuild = await import('esbuild');
    } catch (err) {
        console.error('❌ Could not locate esbuild. Please run npm install in packages/core.');
        process.exit(1);
    }
}

/**
 * Generates entry point JavaScript code for Core + selected plugins
 */
export function generateEntryCode(selectedPluginIds = []) {
    const validIds = selectedPluginIds.filter(id => PLUGINS[id]);
    
    let imports = `import Helix, * as CoreExports from '../packages/core/src/index.js';\n`;
    let pluginRegistrations = '';
    
    validIds.forEach((id, idx) => {
        const meta = PLUGINS[id];
        const importName = `__HelixPlugin_${idx}`;
        imports += `import ${importName} from '../${meta.path.replace(/^\.\//, '')}';\n`;
        
        pluginRegistrations += `
    // Register ${meta.name}
    if (typeof ${importName} !== 'undefined') {
        try {
            const plug = ${importName}.default || ${importName};
            if (typeof plug.install === 'function' || typeof plug === 'function') {
                Helix.use(plug);
            }
            installed.push('${id}');
        } catch (e) {
            console.warn('[Helix Bundle] Error registering plugin "${id}":', e);
        }
    }
`;
    });

    return `// ========================================================
// AUTO-GENERATED HELIX UNIFIED BUNDLE ENTRY
// Plugins included: ${validIds.join(', ') || 'None (Core Only)'}
// ========================================================

${imports}

const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
if (!root.Helix) {
    root.Helix = Helix;
}

const installed = [];

if (Helix && typeof Helix.use === 'function') {
${pluginRegistrations}
}

Helix.__bundledPlugins = installed;
Helix.__isUnifiedBundle = true;

// Re-export Core APIs
export default Helix;
export * from '../packages/core/src/index.js';
`;
}

/**
 * Formats byte size into human readable KB / MB
 */
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Computes Gzip compressed size
 */
function getGzipSize(content) {
    return zlib.gzipSync(content).length;
}

/**
 * Main build function
 */
export async function buildBundle(options = {}) {
    const {
        plugins = [],
        outName = 'helix.custom',
        outDir = path.join(rootDir, 'bundle'),
        banner = `/*! Helix Unified Framework Bundle | Plugins: [${plugins.join(', ')}] | (c) Helix.js */\n`
    } = options;

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const tempEntryFile = path.join(__dirname, `.temp-bundle-entry-${Date.now()}.js`);
    const entryCode = generateEntryCode(plugins);
    fs.writeFileSync(tempEntryFile, entryCode, 'utf8');

    const results = {};

    try {
        console.log(`\n📦 Building Helix Unified Bundle...`);
        console.log(`🔹 Selected plugins (${plugins.length}): ${plugins.join(', ') || 'None (Core Only)'}`);
        console.log(`🔹 Output directory: ${outDir}\n`);

        // 1. Build IIFE (Browser Standalone Script)
        const iifeOut = path.join(outDir, `${outName}.js`);
        await esbuild.build({
            entryPoints: [tempEntryFile],
            bundle: true,
            outfile: iifeOut,
            format: 'iife',
            globalName: 'HelixBundle',
            footer: {
                js: 'if (typeof window !== "undefined" && window.HelixBundle && window.HelixBundle.default) { window.Helix = window.HelixBundle.default; }'
            },
            banner: { js: banner },
            define: {
                'import.meta.env.VITE_FETCH_VERSION': '"2.8.7"',
                'import.meta.env.VITE_DIRECTIVES_VERSION': '"2.2.0"',
                'import.meta.env.VITE_HELPERS_VERSION': '"1.1.0"',
                'import.meta.env.VITE_LOADER_VERSION': '"2.2.0"',
                'import.meta.env.VITE_NOTIFY_VERSION': '"2.2.6"',
                'import.meta.env.VITE_TOOLTIP_VERSION': '"1.0.0"',
                'import.meta.env.VITE_SCOPE_VERSION': '"1.0.0"',
                'import.meta.env.VITE_MODEL_VERSION': '"1.0.0"',
                'import.meta.env.VITE_AXIOS_VERSION': '"2.2.0"',
                'import.meta.env.VITE_AXIOS_DEFAULT_URL': '"/"',
                'import.meta.env': '{}'
            },
            logOverride: {
                'empty-import-meta': 'silent'
            }
        });

        // 2. Build IIFE Minified
        const iifeMinOut = path.join(outDir, `${outName}.min.js`);
        await esbuild.build({
            entryPoints: [tempEntryFile],
            bundle: true,
            outfile: iifeMinOut,
            format: 'iife',
            globalName: 'HelixBundle',
            minify: true,
            footer: {
                js: 'if (typeof window !== "undefined" && window.HelixBundle && window.HelixBundle.default) { window.Helix = window.HelixBundle.default; }'
            },
            banner: { js: banner },
            define: {
                'import.meta.env.VITE_FETCH_VERSION': '"2.8.7"',
                'import.meta.env.VITE_DIRECTIVES_VERSION': '"2.2.0"',
                'import.meta.env.VITE_HELPERS_VERSION': '"1.1.0"',
                'import.meta.env.VITE_LOADER_VERSION': '"2.2.0"',
                'import.meta.env.VITE_NOTIFY_VERSION': '"2.2.6"',
                'import.meta.env.VITE_TOOLTIP_VERSION': '"1.0.0"',
                'import.meta.env.VITE_SCOPE_VERSION': '"1.0.0"',
                'import.meta.env.VITE_MODEL_VERSION': '"1.0.0"',
                'import.meta.env.VITE_AXIOS_VERSION': '"2.2.0"',
                'import.meta.env.VITE_AXIOS_DEFAULT_URL': '"/"',
                'import.meta.env': '{}'
            },
            logOverride: {
                'empty-import-meta': 'silent'
            }
        });

        // 3. Build ESM Module
        const esmOut = path.join(outDir, `${outName}.esm.js`);
        await esbuild.build({
            entryPoints: [tempEntryFile],
            bundle: true,
            outfile: esmOut,
            format: 'esm',
            banner: { js: banner },
            define: {
                'import.meta.env.VITE_FETCH_VERSION': '"2.8.7"',
                'import.meta.env.VITE_DIRECTIVES_VERSION': '"2.2.0"',
                'import.meta.env.VITE_HELPERS_VERSION': '"1.1.0"',
                'import.meta.env.VITE_LOADER_VERSION': '"2.2.0"',
                'import.meta.env.VITE_NOTIFY_VERSION': '"2.2.6"',
                'import.meta.env.VITE_TOOLTIP_VERSION': '"1.0.0"',
                'import.meta.env.VITE_SCOPE_VERSION': '"1.0.0"',
                'import.meta.env.VITE_MODEL_VERSION': '"1.0.0"',
                'import.meta.env.VITE_AXIOS_VERSION': '"2.2.0"',
                'import.meta.env.VITE_AXIOS_DEFAULT_URL': '"/"',
                'import.meta.env': '{}'
            }
        });

        // Stats
        const iifeContent = fs.readFileSync(iifeOut);
        const minContent = fs.readFileSync(iifeMinOut);
        const esmContent = fs.readFileSync(esmOut);

        results.iife = { path: iifeOut, size: iifeContent.length, gzip: getGzipSize(iifeContent) };
        results.min = { path: iifeMinOut, size: minContent.length, gzip: getGzipSize(minContent) };
        results.esm = { path: esmOut, size: esmContent.length, gzip: getGzipSize(esmContent) };

        // Sync to both dist/ and bundle/ directories
        const altDir = outDir.endsWith('dist') ? path.join(rootDir, 'bundle') : path.join(rootDir, 'dist');
        if (!fs.existsSync(altDir)) fs.mkdirSync(altDir, { recursive: true });
        fs.copyFileSync(iifeOut, path.join(altDir, `${outName}.js`));
        fs.copyFileSync(iifeMinOut, path.join(altDir, `${outName}.min.js`));
        fs.copyFileSync(esmOut, path.join(altDir, `${outName}.esm.js`));

        console.log(`✅ Bundle created successfully:`);
        console.log(`   📄 ${path.basename(iifeOut)}:      ${formatSize(results.iife.size)} (gzip: ${formatSize(results.iife.gzip)})`);
        console.log(`   ⚡ ${path.basename(iifeMinOut)}:  ${formatSize(results.min.size)} (gzip: ${formatSize(results.min.gzip)})`);
        console.log(`   📦 ${path.basename(esmOut)}:      ${formatSize(results.esm.size)} (gzip: ${formatSize(results.esm.gzip)})`);

    } finally {
        if (fs.existsSync(tempEntryFile)) {
            fs.unlinkSync(tempEntryFile);
        }
    }

    return results;
}

// CLI Execution Handler
async function runCLI() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Helix Framework Unified Bundler

Options:
  --all                   Bundle Helix Core + all 12 official plugins (helix.all.js)
  --preset=<name>         Use a preset: all, essentials, ui, forms, minimal
  --plugins=<id,id,...>   Comma-separated list of plugin IDs to include
  --out=<name>            Output bundle name (without extension, e.g. helix.all or helix.custom)
  --outdir=<path>         Target output directory (default: ./bundle)
  --list                  List all available plugins and presets
  --help                  Show this help screen

Examples:
  node scripts/bundle.js --all
  node scripts/bundle.js --preset=essentials
  node scripts/bundle.js --plugins=directives,helpers,fetch,store --out=helix.mybundle
`);
        return;
    }

    if (args.includes('--list')) {
        console.log('\n📦 Available Official Plugins:');
        Object.entries(PLUGINS).forEach(([id, meta]) => {
            console.log(`  • [${id}] - ${meta.name} (${meta.category}): ${meta.description}`);
        });

        console.log('\n🎯 Available Presets:');
        Object.entries(PRESETS).forEach(([key, preset]) => {
            console.log(`  • [${key}] - ${preset.name} -> [${preset.plugins.join(', ')}]`);
        });
        return;
    }

    let selectedPlugins = [];
    let outName = 'helix.custom';

    if (args.includes('--all')) {
        selectedPlugins = Object.keys(PLUGINS);
        outName = 'helix.all';
    } else {
        const presetArg = args.find(a => a.startsWith('--preset='));
        if (presetArg) {
            const presetKey = presetArg.split('=')[1].trim().toLowerCase();
            if (PRESETS[presetKey]) {
                selectedPlugins = PRESETS[presetKey].plugins;
                outName = `helix.${presetKey}`;
            } else {
                console.error(`❌ Unknown preset "${presetKey}". Use --list to view valid presets.`);
                process.exit(1);
            }
        }

        const pluginsArg = args.find(a => a.startsWith('--plugins='));
        if (pluginsArg) {
            const customList = pluginsArg.split('=')[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            selectedPlugins = customList;
            if (!presetArg) outName = 'helix.custom';
        }
    }

    const outArg = args.find(a => a.startsWith('--out='));
    if (outArg) {
        outName = outArg.split('=')[1].trim().replace(/\.js$/, '');
    }

    const outdirArg = args.find(a => a.startsWith('--outdir='));
    const outDir = outdirArg ? path.resolve(rootDir, outdirArg.split('=')[1].trim()) : path.join(rootDir, 'bundle');

    if (selectedPlugins.length === 0 && !args.includes('--all') && !args.some(a => a.startsWith('--preset='))) {
        console.log('💡 No plugins specified. Defaulting to --all.');
        selectedPlugins = Object.keys(PLUGINS);
        outName = 'helix.all';
    }

    await buildBundle({
        plugins: selectedPlugins,
        outName,
        outDir
    });
}

// Run if called directly from terminal
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runCLI().catch(err => {
        console.error('❌ Build failed:', err);
        process.exit(1);
    });
}
