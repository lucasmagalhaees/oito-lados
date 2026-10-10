// Entry point: wires the listeners, exposes the test handle and starts the first sync.
import './styles.css';
import { Core } from './core';
import { initEvents } from './app/events';
import { FX } from './app/fx';
import { render } from './app/render';
import { settle } from './app/settle';
import { D, S, imp, slip, ui } from './app/state';
import { initSync, pickEvent, sync } from './app/sync';

initSync();
initEvents();
window.__OL = { Core, D, ui, slip, imp, sync, settle, get S() { return S; }, get FX() { return FX; } };
pickEvent(); render(); sync(false);
