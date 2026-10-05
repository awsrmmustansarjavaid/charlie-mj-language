// Charlie MJ Language - tiny dependency-free manifest smoke test.
// Run with: node tests/manifest-check.mjs
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url)));
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 required');
if (!manifest.background?.service_worker) throw new Error('Missing service worker');
if (!manifest.action?.default_popup) throw new Error('Missing popup');
console.log('Manifest smoke test passed.');
