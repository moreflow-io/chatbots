import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8');
const reactImport = /(?:from\s*|import\s*)["']react(?:\/[^"']*)?["']/u;

describe('published chatbot bundles', () => {
  it('keeps React out of the core and browser bundles and external in the React entry', () => {
    const index = read('index.js');
    const chunks = [...index.matchAll(/["']\.\/(chunks\/[^"']+\.js)["']/gu)].map((match) => match[1] ?? '');

    expect(chunks.length).toBeGreaterThan(0);
    for (const file of ['index.js', ...chunks]) expect(read(file), file).not.toMatch(reactImport);
    expect(read('browser.js')).not.toMatch(reactImport);
    expect(read('browser.js')).not.toContain('useSyncExternalStore');
    expect(read('react.js')).toMatch(reactImport);
    expect(read('react.d.ts')).toContain('useChatbot');
  });
});
