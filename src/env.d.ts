/// <reference types="vite/client" />
// What the page gets from outside TypeScript's view.
import type { Core } from './core';
import type { AppState, FxRates } from './core';
import type { Data, ImportState, Slip, Ui } from './app/state';

declare global {
  interface Window {
    /** Handle for the tests: the pure core and the live state of the page. */
    __OL: { Core: typeof Core; D: Data; ui: Ui; slip: Slip; imp: ImportState; sync(force: boolean): Promise<void>; settle(): void; readonly S: AppState; readonly FX: (FxRates & { ts: number }) | null };
    /** Tesseract.js, present only after the image reader has been downloaded. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Tesseract?: any;
  }
}
