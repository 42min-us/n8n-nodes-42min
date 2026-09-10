// Copy the codex files (`*.node.json`) next to their compiled nodes.
//
// n8n reads a node's categories and documentation links from a JSON file sitting
// beside the compiled node, found by appending "on" to the .js path. `n8n-node
// build` copies only images and __schema__ JSON, so without this the codex never
// reaches dist and both nodes land in the panel uncategorized.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Deliberately not fs/promises' glob, which only exists from Node 22.
async function* findCodexFiles(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* findCodexFiles(path);
		else if (entry.name.endsWith('.node.json')) yield path;
	}
}

const copied = [];
for (const root of ['nodes', 'credentials']) {
	for await (const file of findCodexFiles(root)) {
		const target = join('dist', file);
		await mkdir(dirname(target), { recursive: true });
		await copyFile(file, target);
		copied.push(target);
	}
}

console.log(copied.length ? `Copied ${copied.length} codex file(s)` : 'No codex files found');
