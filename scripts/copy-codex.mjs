// Copy the codex files (`*.node.json`) next to their compiled nodes.
//
// n8n reads a node's categories and documentation links from a JSON file
// sitting beside the compiled node, found by appending "on" to the .js path.
// `n8n-node build` copies only images and __schema__ JSON, so without this the
// codex never reaches dist and every node lands in the panel uncategorized.
import { copyFile, mkdir } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const copied = [];
for await (const file of glob('{nodes,credentials}/**/*.node.json')) {
	const target = join('dist', file);
	await mkdir(dirname(target), { recursive: true });
	await copyFile(file, target);
	copied.push(target);
}

console.log(copied.length ? `Copied ${copied.length} codex file(s)` : 'No codex files found');
