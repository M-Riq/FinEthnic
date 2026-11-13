import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const MARKER = '// --- Transcription exacte de INTEGRATION_CONTRACT.md §4 ---\n';

describe('src/language/contract.ts', () => {
  it('est identique au bloc TypeScript de INTEGRATION_CONTRACT.md §4', () => {
    const doc = read('INTEGRATION_CONTRACT.md');
    const section = doc.slice(doc.indexOf('## 4. Interface (TypeScript)'), doc.indexOf('\n## 5.'));
    const block = /```ts\n([\s\S]*?)```/u.exec(section)?.[1];
    expect(block, 'bloc ```ts introuvable au §4').toBeDefined();

    const source = read('src/language/contract.ts');
    expect(source).toContain(MARKER);
    expect(source.slice(source.indexOf(MARKER) + MARKER.length)).toBe(block);
  });
});
