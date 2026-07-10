import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(extensionRoot, 'dist');

mkdirSync(distDir, { recursive: true });
copyFileSync(resolve(extensionRoot, 'manifest.json'), resolve(distDir, 'manifest.json'));
