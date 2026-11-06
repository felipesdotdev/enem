import originals from '../data/originals.json';
import official from '../data/official.json';
import analysis from '../data/analysis.json';

export { analysis };

export const essays = [
  ...official.map((essay) => ({ ...essay, type: 'official' })).sort((a, b) => b.year - a.year),
  ...originals.map((essay) => ({ ...essay, type: 'original' })),
];
export const essayById = new Map(essays.map((essay) => [essay.id, essay]));
export const themes = analysis.themes;
export const themeBySlug = new Map(themes.map((theme) => [theme.slug, theme]));
export const axes = [...new Set(essays.map((essay) => essay.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
export const years = [...new Set(official.map((essay) => essay.year))].sort((a, b) => b - a);
export const officialCount = official.length;
export const verifiedCount = official.filter((essay) => essay.score >= 900).length;
export const originalCount = originals.length;
export const pageSize = 12;

export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function scoreLabel(essay) {
  if (essay.type === 'original') return 'Modelo com IA';
  if (essay.score === 1000) return 'Nota 1000';
  if (essay.score >= 900) return `Nota ${essay.score}`;
  return essay.scoreLabel || 'Destaque Inep';
}

export function searchEssays(query, filter = {}) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  return essays.filter((essay) => {
    if (filter.type === 'official' && essay.type !== 'official') return false;
    if (filter.type === 'verified' && !(essay.score >= 900)) return false;
    if (filter.type === 'original' && essay.type !== 'original') return false;
    if (filter.axis && essay.category !== filter.axis) return false;
    if (filter.year && String(essay.year) !== filter.year) return false;
    if (!tokens.length) return true;
    const searchable = normalize([
      essay.title, essay.topic, essay.description, essay.category, essay.year, essay.author,
      scoreLabel(essay), ...(essay.tags ?? []), ...(essay.repertoire ?? []).map((item) => item.title),
    ].join(' '));
    return tokens.every((token) => searchable.includes(token));
  });
}

export function readingTime(essay) {
  if (!essay.paragraphs) return 3;
  const count = essay.paragraphs.flatMap((paragraph) => paragraph.parts.map((part) => part.text)).join(' ').trim().split(/\s+/).length;
  return Math.max(2, Math.ceil(count / 160));
}
