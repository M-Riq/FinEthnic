import { startContent, type ContentController, type PageDeps } from '../../../src/content/controller';
import type { HighlightApi } from '../../../src/content/diagnostic';
import { createFakeEngine } from '../../../src/content/fake-engine';
import { createSettingsStore, SETTINGS_KEY } from '../../../src/shared/settings';
import { createFakeStorage } from './fake-storage';
import { frozenClock, manualFrames, recorder } from './page';

const running: ContentController[] = [];

/** Arrête les scripts de contenu lancés par `launch` (à appeler dans `afterEach`). */
export function stopAll(): void {
  running.splice(0).forEach((controller) => controller.stop());
}

/** Faux registre `CSS.highlights` : textes surlignés par nom. */
export function fakeHighlights() {
  const registry = new Map<string, readonly Range[]>();
  const api: HighlightApi = { set: (name, ranges) => void registry.set(name, ranges), delete: (name) => void registry.delete(name) };
  const texts = (name: string) => (registry.get(name) ?? []).map((range) => range.toString());
  return { registry, api, texts };
}

/** Lance le script de contenu sur `document` avec le faux moteur, des trames manuelles et un faux surlignage. */
export async function launch(initial: Record<string, unknown> = {}, page: Partial<PageDeps> = {}) {
  const fake = createFakeStorage({ [SETTINGS_KEY]: initial });
  const log = recorder();
  const frames = manualFrames();
  const highlights = fakeHighlights();
  const controller = await startContent(createSettingsStore(fake.storage), log.logger, {
    doc: document,
    engine: createFakeEngine(),
    schedule: frames.schedule,
    highlights: highlights.api,
    now: frozenClock,
    ...page,
  });
  running.push(controller);
  const update = async (patch: Record<string, unknown>) => {
    await createSettingsStore(fake.storage).update(patch);
    await frames.frames();
  };
  return { controller, fake, frames, highlights, update, ...log };
}
