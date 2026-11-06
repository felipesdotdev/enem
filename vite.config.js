import { defineConfig } from 'vite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { icons } = require('@iconify-json/solar/icons.json');
const names = [
  'alt-arrow-down-linear', 'alt-arrow-left-linear', 'alt-arrow-right-linear', 'arrow-left-linear',
  'arrow-right-linear', 'arrow-right-up-linear', 'book-bookmark-minimalistic-linear', 'book-linear',
  'bookmark-linear', 'bookmark-bold', 'calendar-minimalistic-linear', 'check-circle-linear', 'check-linear',
  'clock-circle-linear', 'close-linear', 'compass-linear', 'document-text-linear', 'exit-linear',
  'home-angle-linear', 'layers-minimalistic-linear', 'lightbulb-minimalistic-linear', 'link-linear', 'notebook-linear',
  'pen-new-square-linear', 'rounded-magnifier-linear', 'square-academic-cap-linear', 'stars-line-linear',
  'user-rounded-linear', 'list-ordered-minimalistic-linear', 'verified-check-linear',
];
const solar = Object.fromEntries(names.map((name) => [name, icons[name].body]));

export default defineConfig({
  define: { __SOLAR_ICONS__: JSON.stringify(solar) },
  server: { proxy: { '/api': 'http://127.0.0.1:3764' } },
});
