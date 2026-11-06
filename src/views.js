import {
  analysis, essays, themes, themeBySlug, axes, years, officialCount, verifiedCount,
  originalCount, searchEssays, scoreLabel, readingTime, pageSize, practiceFilter, practiceThemes, isPracticeEssay,
} from './catalog.js';

const symbols = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => symbols[character]);
export const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
export const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">${__SOLAR_ICONS__[name] ?? ''}</svg>`;
const arrows = { right: icon('arrow-right-linear'), up: icon('arrow-right-up-linear'), left: icon('arrow-left-linear') };
const exam = analysis.edition;
const navigation = [
  ['/', 'Início', 'home-angle-linear'],
  ['/biblioteca', 'Biblioteca', 'book-linear'],
  ['/temas', `Temas ${exam}`, 'compass-linear'],
  ['/guia', 'Método', 'pen-new-square-linear'],
  ['/salvos', 'Salvos', 'bookmark-linear'],
];

export function shell(path, user, content) {
  const active = path.startsWith('/redacoes/') ? '/biblioteca' : path.startsWith('/temas/') ? '/temas' : path;
  const nav = navigation.map(([href, label, name]) => `<a class="nav-item" href="${href}" ${href === active ? 'aria-current="page"' : ''}>${icon(name)}<span>${label}</span></a>`).join('');
  const current = navigation.find(([href]) => href === active)?.[1] ?? 'Caderno';
  return `<aside class="sidebar">
    <a class="brand" href="/" aria-label="Caderno, início">
      <img src="/caderno.svg" alt="" width="38" height="38" />
      <span><strong>Caderno<span class="brand-period">.</span></strong><small>REDAÇÃO ENEM</small></span>
    </a>
    <div class="nav-label">ESPAÇO DE ESTUDO</div>
    <nav aria-label="Navegação principal">${nav}</nav>
    <div class="sidebar-foot">
      <div class="edition-mark">${icon('square-academic-cap-linear')}</div>
      <div><strong>Redação Enem</strong><span>Biblioteca de estudo</span></div>
    </div>
  </aside>
  <div class="workspace">
    <header class="topbar"><div class="topbar-inner">
      <a class="mobile-brand" href="/"><img src="/caderno.svg" alt="" width="30" height="30" /><span>Caderno.</span></a>
      <span class="breadcrumb"><a href="/">Caderno</a><span>/</span><strong>${esc(current)}</strong></span>
      <div class="top-actions">
        <button class="top-search" type="button" data-search aria-label="Buscar redações">${icon('rounded-magnifier-linear')}<span>Buscar</span><kbd>Ctrl K</kbd></button>
        ${user
          ? `<button class="button button-account" type="button" data-account="profile">${icon('user-rounded-linear')}<span>${esc(user.name)}</span></button>`
          : `<button class="button button-primary button-account" type="button" data-account="login">${icon('user-rounded-linear')}<span>Entrar</span></button>`}
      </div>
    </div></header>
    <main id="conteudo" class="main" tabindex="-1">${content}</main>
    <footer class="footer"><span>Caderno. <span>Redação Enem</span></span><a href="/guia">Sobre o acervo ${arrows.up}</a></footer>
  </div>
  <nav class="mobile-nav" aria-label="Navegação principal">${nav}</nav>`;
}

function pill(essay) {
  return `<span class="pill ${essay.score >= 900 ? 'pill-score' : ''}">${icon(essay.type === 'original' ? 'stars-line-linear' : essay.score >= 900 ? 'verified-check-linear' : 'book-linear')}${esc(scoreLabel(essay))}</span>`;
}

function saveButton(essay, reading, text = false) {
  const saved = Boolean(reading[essay.id]?.saved);
  const label = saved ? 'Remover dos salvos' : 'Salvar redação';
  return `<button class="${text ? 'button button-secondary' : 'icon-button save-button'}${saved ? ' is-saved' : ''}" type="button" data-save="${esc(essay.id)}" aria-label="${label}" aria-pressed="${saved}" title="${label}">${icon(saved ? 'bookmark-bold' : 'bookmark-linear')}${text ? `<span>${saved ? 'Salva' : 'Salvar'}</span>` : ''}</button>`;
}

function essayCard(essay, reading) {
  const done = reading[essay.id]?.done;
  return `<article class="essay-card">
    <div class="essay-card-top">${pill(essay)}${saveButton(essay, reading)}</div>
    <div class="essay-card-copy">
      <div class="essay-overline">${esc(essay.category)}${essay.year ? ` <span>·</span> Enem ${essay.year}` : ''}</div>
      <h3><a href="/redacoes/${esc(essay.id)}">${esc(essay.title)}</a></h3>
      <p>${esc(essay.description || essay.topic)}</p>
    </div>
    <div class="essay-card-foot">
      <span>${icon(done ? 'check-circle-linear' : 'clock-circle-linear')}${done ? 'Lida' : `${readingTime(essay)} min`}</span>
      <a href="/redacoes/${esc(essay.id)}" aria-label="Ler ${esc(essay.title)}">Ler redação ${arrows.right}</a>
    </div>
  </article>`;
}

function essayGrid(entries, reading) {
  return `<div class="essay-grid">${entries.map((entry) => essayCard(entry, reading)).join('')}</div>`;
}

function sectionHead(label, title, description, action = '') {
  return `<header class="section-head"><div><div class="eyebrow">${label}</div><h2>${title}</h2>${description ? `<p>${description}</p>` : ''}</div>${action}</header>`;
}

function pageHead(label, title, description, glyph) {
  return `<header class="page-head"><div class="eyebrow">${icon(glyph)} ${label}</div><h1>${title}</h1>${description ? `<p>${description}</p>` : ''}</header>`;
}

function empty(title, description, action = '', glyph = 'rounded-magnifier-linear') {
  return `<div class="empty"><div class="tile-icon">${icon(glyph)}</div><h2>${title}</h2><p>${description}</p>${action}</div>`;
}

export function home(reading) {
  const best = essays.find((essay) => essay.score >= 900);
  const model = essays.find((essay) => essay.type === 'original');
  const recent = essays.find((essay) => essay.type === 'official' && essay.year !== best?.year) ?? essays.find((essay) => essay.type === 'official' && essay !== best);
  const featured = [best, model, recent].filter(Boolean);
  return `<section class="hero">
      <div class="hero-content">
        <div class="hero-label"><i></i> ESPAÇO DE ESTUDO <span> / </span> ENEM ${exam}</div>
        <h1>Leia boas redações.<br /><em>Escreva melhor.</em></h1>
        <p>Estude exemplos do Inep, entenda como cada argumento se encaixa e pratique com modelos para novos temas.</p>
        <div class="hero-actions"><a class="button button-primary" href="/biblioteca">Explorar biblioteca ${arrows.right}</a><a class="button button-secondary" href="/temas">Temas ${exam} ${arrows.up}</a></div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <span class="art-orbit"></span><span class="art-dot art-dot-a"></span><span class="art-dot art-dot-b"></span>
        <div class="paper paper-back"></div>
        <div class="paper paper-front">
          <div class="paper-meta"><span>${icon('notebook-linear')} CADERNO DE ESTUDO</span><span>Nº 01</span></div>
          <div class="paper-title">Da tese ao argumento.</div>
          <div class="paper-lines"><i></i><i></i><i></i></div>
          <div class="paper-highlight">Em primeiro lugar,</div>
          <div class="paper-lines paper-lines-small"><i></i><i></i></div>
          <div class="paper-sign">estrutura de uma redação</div>
        </div>
        <div class="art-note">${icon('layers-minimalistic-linear')} <span>Estrutura em foco</span></div>
      </div>
    </section>
    <div class="stats" aria-label="Números do acervo">
      <a href="/biblioteca?tipo=official">${icon('book-linear')}<strong>${officialCount}</strong><span>exemplos do Inep</span></a>
      <a href="${catalogUrl({ type: practiceFilter })}">${icon('pen-new-square-linear')}<strong>${originalCount}</strong><span>modelos comentados</span></a>
      <a href="/temas">${icon('compass-linear')}<strong>${themes.length}</strong><span>temas para treinar</span></a>
    </div>
    <section class="section home-featured">
      ${sectionHead('01 / LEITURA', 'Por onde começar', 'Escolha uma redação e observe como o texto constrói sua tese.', `<a class="text-link" href="/biblioteca">Ver biblioteca ${arrows.right}</a>`)}
      ${essayGrid(featured, reading)}
    </section>
    <section class="section home-topics">
      ${sectionHead('02 / PRÁTICA', 'Experimente um tema', 'Veja recortes, repertórios e propostas de intervenção para praticar.', `<a class="text-link" href="/temas">Ver todos os temas ${arrows.right}</a>`)}
      ${themeGrid(themes.slice(0, 3))}
    </section>`;
}

const filters = [
  ['', 'Todas'], ['verified', 'Notas 900+'], ['official', 'Acervo Inep'], [practiceFilter, 'Possíveis temas'],
];

export function catalogState(params) {
  const query = params.get('q') || '';
  const requestedType = params.get('tipo') || '';
  const type = requestedType === 'original' ? practiceFilter : requestedType;
  const practice = type === practiceFilter;
  const axis = practice ? '' : params.get('eixo') || '';
  const year = practice ? '' : params.get('ano') || '';
  const theme = practice ? params.get('tema') || '' : '';
  const page = Number(params.get('p')) || 1;
  return { query, type, axis, year, theme, page };
}

export function catalogUrl({ query, type, axis, year, theme, page }) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (type) params.set('tipo', type);
  if (type === practiceFilter) {
    if (theme) params.set('tema', theme);
  } else {
    if (axis) params.set('eixo', axis);
    if (year) params.set('ano', year);
    if (page > 1) params.set('p', page);
  }
  return `/biblioteca${params.size ? `?${params}` : ''}`;
}

export function library(params, reading) {
  const state = catalogState(params);
  const practice = state.type === practiceFilter;
  const matches = searchEssays(state.query, state);
  return `${pageHead('ACERVO', 'Biblioteca', practice ? '' : 'Leia redações do Inep e modelos comentados. Busque por tema, repertório ou ano de prova.', 'book-linear')}
    <nav class="catalog-tabs" aria-label="Tipo de redação">${filters.map(([value, label]) => `<a href="${esc(catalogUrl({ ...state, type: value, page: 1 }))}" data-catalog-type="${value}" ${state.type === value ? 'aria-current="true"' : ''}>${label}</a>`).join('')}</nav>
    ${practice ? `<section class="practice-intro"><div><div class="eyebrow">${icon('compass-linear')} ENEM ${exam} · PROPOSTAS DE TREINO</div><h2>Possíveis temas de redação</h2><p>Compare modelos autorais sobre o mesmo enunciado. O modo Estrutura e os comentários mostram como cada texto sustenta sua tese e propõe uma intervenção.</p></div><a class="text-link" href="/temas#padroes">Ver análise dos temas ${arrows.right}</a></section>` : ''}
    <form class="filters${practice ? ' filters-practice' : ''}" id="library-filters">
      <label class="search-input">${icon('rounded-magnifier-linear')}<span class="sr-only">Buscar no acervo</span><input type="search" name="q" value="${esc(state.query)}" placeholder="${practice ? 'Buscar por tema ou repertório…' : 'Buscar por tema, autor ou ano…'}" autocomplete="off" /></label>
      ${practice
        ? `<label class="select"><span class="sr-only">Tema de treino</span><select name="tema"><option value="">Todos os temas</option>${practiceThemes.map((theme) => `<option value="${esc(theme.slug)}" ${theme.slug === state.theme ? 'selected' : ''}>${esc(theme.title)}</option>`).join('')}</select>${icon('alt-arrow-down-linear')}</label>`
        : `<label class="select"><span class="sr-only">Eixo temático</span><select name="eixo"><option value="">Todos os eixos</option>${axes.map((axis) => `<option ${axis === state.axis ? 'selected' : ''}>${esc(axis)}</option>`).join('')}</select>${icon('alt-arrow-down-linear')}</label>
          <label class="select"><span class="sr-only">Ano do Enem</span><select name="ano"><option value="">Todos os anos</option>${years.map((year) => `<option ${String(year) === state.year ? 'selected' : ''}>${year}</option>`).join('')}</select>${icon('alt-arrow-down-linear')}</label>`}
    </form>
    <div class="results-meta" role="status" id="catalog-summary">${librarySummary(matches.length, state.type)}</div>
    <div id="catalog-results">${libraryResults(state, reading, matches)}</div>`;
}

export function librarySummary(count, type) {
  return `${plural(count, 'redação', 'redações')}${type === 'official' ? ` <span>· ${verifiedCount} com nota 900+ verificada no acervo</span>` : ''}`;
}

export function libraryResults(state, reading, matches = searchEssays(state.query, state)) {
  if (!matches.length) return empty('Nenhuma redação encontrada', 'Experimente outro termo ou limpe os filtros.', `<a class="button button-secondary" href="${esc(catalogUrl({ type: state.type }))}">Limpar filtros</a>`);
  if (state.type === practiceFilter) {
    return practiceThemes.map((theme) => {
      const models = matches.filter((essay) => essay.themeId === theme.slug);
      if (!models.length) return '';
      return `<section class="practice-group">
        <header class="section-head"><div><div class="eyebrow">${esc(theme.axis)}</div><h2>${esc(theme.title)}</h2></div>
          <a class="text-link" href="/temas/${esc(theme.slug)}" aria-label="Ver proposta de treino sobre o tema ${esc(theme.title)}">Ver proposta ${arrows.right}</a>
        </header>
        ${essayGrid(models, reading)}
      </section>`;
    }).join('');
  }
  const total = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.max(1, Math.min(total, Math.floor(state.page)));
  return `${essayGrid(matches.slice((page - 1) * pageSize, page * pageSize), reading)}
    ${total > 1 ? `<nav class="pagination" aria-label="Páginas de resultados">
      ${page > 1 ? `<a class="button button-secondary" href="${esc(catalogUrl({ ...state, page: page - 1 }))}">${arrows.left} Anterior</a>` : '<span></span>'}
      <span>Página ${page} de ${total}</span>
      ${page < total ? `<a class="button button-secondary" href="${esc(catalogUrl({ ...state, page: page + 1 }))}">Próxima ${arrows.right}</a>` : '<span></span>'}
    </nav>` : ''}`;
}

function resourceList(resources) {
  return `<ul class="resource-list">${resources.map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ${arrows.up}</a>${item.description ? `<p>${esc(item.description)}</p>` : ''}</li>`).join('')}</ul>`;
}

export function partGroup(paragraph, annotate) {
  if (!annotate) return `<p>${paragraph.parts.map((part) => esc(part.text)).join(' ')}</p>`;
  return `<section class="annotated-block"><h3>${esc(paragraph.label)}</h3>${paragraph.parts.map((part) => `<div><span>${esc(part.label)}</span><p>${esc(part.text)}</p></div>`).join('')}</section>`;
}

function pdfUrl(source, embedded = false) {
  const params = new URLSearchParams();
  if (source.page) params.set('page', source.page);
  if (embedded) {
    params.set('view', 'FitH');
    params.set('navpanes', '0');
  }
  return `${source.url.split('#')[0]}${params.size ? `#${params}` : ''}`;
}

export function reader(essay, reading, annotate) {
  if (!essay) return missing('Redação não encontrada', 'Voltar à biblioteca', '/biblioteca');
  const done = Boolean(reading[essay.id]?.done);
  const theme = themeBySlug.get(essay.themeId);
  const practice = isPracticeEssay(essay);
  const backUrl = practice ? catalogUrl({ type: practiceFilter, theme: theme.slug }) : '/biblioteca';
  const studyNotes = essay.type === 'original' ? essay.studyNotes : essay.notes;
  const alternatives = practice ? essays.filter((item) => isPracticeEssay(item) && item.themeId === theme.slug && item.id !== essay.id) : [];
  return `<div class="reader">
    <a class="back-link" href="${esc(backUrl)}">${arrows.left} ${practice ? 'Possíveis temas' : 'Biblioteca'}</a>
    <header class="reader-head"><div class="reader-kicker">${pill(essay)}<span>${esc(essay.category)}${essay.year ? ` · Enem ${essay.year}` : ''}</span></div>
      <h1>${esc(essay.title)}</h1>
      <p class="reader-topic">${esc(essay.topic)}</p>
      <div class="reader-meta"><span>${icon('user-rounded-linear')}${esc(essay.author || (essay.type === 'original' ? 'Modelo com IA' : 'Participante do Enem'))}</span><span>${icon('clock-circle-linear')}${readingTime(essay)} min de leitura</span></div>
    </header>
    <div class="reader-tools">
      ${essay.type === 'original' ? `<div class="reading-tabs" aria-label="Modo de leitura"><button type="button" data-annotate="false" aria-pressed="${!annotate}">Texto corrido</button><button type="button" data-annotate="true" aria-pressed="${annotate}">${icon('layers-minimalistic-linear')} Estrutura</button></div>` : `<span class="source-type">${icon('document-text-linear')} Fonte original do Inep</span>`}
      ${saveButton(essay, reading, true)}
    </div>
    <div class="reader-layout"><div class="reader-main">
      ${essay.type === 'original' ? `<div id="reading-text" class="reading-text${annotate ? ' annotated' : ''}">${essay.paragraphs.map((paragraph) => partGroup(paragraph, annotate)).join('')}</div>` : `<div class="pdf-panel">
        <div class="tile-icon">${icon('document-text-linear')}</div>
        <h2>Leia na cartilha do Inep</h2>
        <p>${esc(essay.source.title)}${essay.source.page ? ` · página ${esc(essay.source.page)} do PDF` : ''}</p>
        <div class="inline-actions"><button class="button button-primary" type="button" data-pdf="${esc(pdfUrl(essay.source, true))}" aria-expanded="false" aria-controls="cartilha-pdf">Ler aqui ${arrows.right}</button><a class="button button-secondary" href="${esc(pdfUrl(essay.source))}" target="_blank" rel="noopener noreferrer">Abrir PDF ${arrows.up}</a></div>
        <div id="cartilha-pdf" class="pdf-view" hidden></div>
      </div>`}
      ${studyNotes?.length ? `<section class="study-section"><div class="eyebrow">LEITURA GUIADA</div><h2>O que observar</h2>${studyNotes.map((note) => `<div class="study-note"><h3>${esc(note.title)}</h3><p>${esc(note.description)}</p></div>`).join('')}</section>` : ''}
      <div class="reader-end"><button class="button ${done ? 'button-secondary' : 'button-primary'}" type="button" data-done="${esc(essay.id)}" aria-pressed="${done}">${icon('check-circle-linear')} ${done ? 'Leitura concluída' : 'Marcar como lida'}</button><a class="text-link" href="${esc(backUrl)}">${practice ? 'Ver redações deste tema' : 'Voltar à biblioteca'} ${arrows.right}</a></div>
    </div>
    <aside class="reader-aside">
      ${essay.type === 'original' ? `<section class="aside-card"><h2>${icon('link-linear')} Conectivos</h2><dl class="connector-list">${essay.connectors.map((item) => `<dt>${esc(item.term)}</dt><dd>${esc(item.use)}</dd>`).join('')}</dl></section>
      <section class="aside-card"><h2>${icon('lightbulb-minimalistic-linear')} Repertório</h2>${resourceList(essay.repertoire)}</section>` : `<section class="aside-card"><h2>${icon('verified-check-linear')} Sobre a avaliação</h2><p>${essay.scoreSource ? `Nota ${essay.score} confirmada na fonte indicada abaixo.` : essay.score >= 900 ? `O Inep identifica esta redação com nota ${essay.score} na cartilha de origem.` : 'O Inep selecionou este texto como exemplo de boa redação na cartilha. A nota individual não foi informada na fonte.'}</p>${essay.scoreSource ? resourceList([essay.scoreSource]) : ''}</section>`}
      ${alternatives.length ? `<section class="aside-card"><h2>${icon('book-linear')} Compare as abordagens</h2><ul class="resource-list">${alternatives.map((item) => `<li><a href="/redacoes/${esc(item.id)}">${esc(item.title)} ${arrows.right}</a><p>${esc(item.description)}</p></li>`).join('')}</ul></section>` : ''}
      ${theme ? `<section class="aside-card"><h2>${icon('compass-linear')} Pratique este tema</h2><p>${esc(theme.description || theme.why)}</p><a class="text-link" href="/temas/${esc(theme.slug)}">Ver proposta ${arrows.right}</a></section>` : ''}
    </aside></div>
  </div>`;
}

function themeGrid(entries) {
  return `<div class="theme-grid">${entries.map((theme) => `<article class="theme-card"><span class="theme-axis">${icon('compass-linear')} ${esc(theme.axis)}</span><h3><a href="/temas/${esc(theme.slug)}">${esc(theme.title)}</a></h3><p>${esc(theme.description || theme.why)}</p><a class="text-link" href="/temas/${esc(theme.slug)}" aria-label="Explorar ${esc(theme.title)}">Explorar tema ${arrows.right}</a></article>`).join('')}</div>`;
}

export function topics() {
  return `${pageHead(`PREPARAÇÃO / ${exam}`, `Temas ${exam}`, esc(analysis.intro), 'compass-linear')}
    <div class="page-jumps"><a href="#propostas">Propostas de treino</a><a href="#padroes">Padrões do Enem</a><a href="#historico">Histórico</a></div>
    <section class="section" id="propostas">${sectionHead('01 / PROPOSTAS', 'Temas para praticar', 'Cada proposta reúne recortes, repertórios com fontes e um caminho de intervenção.', `<a class="text-link" href="${catalogUrl({ type: practiceFilter })}">Ver redações autorais ${arrows.right}</a>`)}${themeGrid(themes)}</section>
    <section class="section" id="padroes">${sectionHead('02 / ANÁLISE', 'Como o Enem recorta um assunto', esc(analysis.method))}
      <div class="pattern-grid">${analysis.patterns.map((pattern, index) => `<article class="pattern-card"><span class="pattern-number">${String(index + 1).padStart(2, '0')}</span><h3>${esc(pattern.title)}</h3><p>${esc(pattern.description)}</p><ul>${pattern.examples.map((example) => `<li>${esc(example)}</li>`).join('')}</ul></article>`).join('')}</div>
    </section>
    <section class="section" id="historico">${sectionHead('03 / ARQUIVO', 'Histórico de temas', 'Enem regular, 1998 a 2025. As provas de cada edição estão nas fontes do Inep.')}
      <div class="history"><table><thead><tr><th scope="col">Ano</th><th scope="col">Tema</th><th scope="col">Eixo</th></tr></thead><tbody>${analysis.history.map((item) => `<tr><th scope="row">${item.year}</th><td><a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.theme)} ${arrows.up}</a></td><td>${esc(item.axis)}</td></tr>`).join('')}</tbody></table></div>
      <div class="study-section"><h2>Fontes da análise</h2>${resourceList(analysis.sources)}</div>
    </section>`;
}

export function topic(theme, reading) {
  if (!theme) return missing('Tema não encontrado', 'Voltar aos temas', '/temas');
  const models = essays.filter((essay) => essay.themeId === theme.slug);
  return `<a class="back-link" href="/temas">${arrows.left} Temas ${exam}</a>
    ${pageHead(`PROPOSTA DE TREINO / ${esc(theme.axis)}`, esc(theme.title), esc(theme.why), 'compass-linear')}
    <div class="topic-layout">
      <section class="study-section"><div class="eyebrow">ARGUMENTAÇÃO</div><h2>Recortes para desenvolver</h2><ol class="angles">${theme.angles.map((angle) => `<li>${esc(angle)}</li>`).join('')}</ol><h2>Caminho de intervenção</h2><p>${esc(theme.intervention)}</p></section>
      <section class="aside-card"><h2>${icon('lightbulb-minimalistic-linear')} Repertório para o tema</h2>${resourceList(theme.repertoire)}</section>
    </div>
    ${models.length ? `<section class="section">${sectionHead('LEITURA GUIADA', 'Redações deste tema', 'Alterne entre texto corrido e estrutura para acompanhar as escolhas de cada parágrafo.')}${essayGrid(models, reading)}</section>` : ''}`;
}

const guideSteps = [
  { title: 'Introdução', labels: ['Assunto', 'Tema', 'Tese'], text: 'Comece pelo assunto que circunda a questão. Em seguida, apresente o recorte do enunciado e formule a tese que seus dois argumentos vão defender.' },
  { title: 'Desenvolvimento 1', labels: ['Tópico frasal', 'Desenvolvimento e repertório', 'Ligação'], text: 'Abra com a primeira ideia da tese. Explique como ela opera, use um repertório pertinente e ligue o raciocínio ao problema apresentado.' },
  { title: 'Desenvolvimento 2', labels: ['Tópico frasal', 'Desenvolvimento e repertório', 'Ligação'], text: 'Apresente o segundo argumento. Mostre uma causa, consequência ou dimensão complementar e feche o parágrafo retomando o recorte do tema.' },
  { title: 'Proposta de intervenção', labels: ['Quem', 'O quê', 'Como', 'Para quê', 'Detalhamento'], text: 'Indique o agente, a ação, o meio de execução e a finalidade. Termine com um detalhe concreto sobre um desses elementos e respeite os direitos humanos.' },
];

export function guide() {
  return `${pageHead('GUIA DE ESTUDO', 'Do assunto à intervenção', 'A ordem usada nos modelos do Caderno segue o método da sua professora. Abra o modo Estrutura para ver o papel de cada trecho.', 'pen-new-square-linear')}
    <div class="guide-grid">${guideSteps.map((step, index) => `<article class="guide-card"><div class="pattern-number">0${index + 1}</div><h2>${step.title}</h2><ol class="step-labels">${step.labels.map((label) => `<li>${label}</li>`).join('')}</ol><p>${step.text}</p></article>`).join('')}</div>
    <section class="section"><div class="study-section"><div class="eyebrow">O ACERVO</div><h2>Como ler os rótulos</h2><div class="study-note"><h3>Nota 900+</h3><p>O acervo tem ${verifiedCount} redações nessa faixa. A nota consta na cartilha ou na fonte indicada junto ao texto.</p></div><div class="study-note"><h3>Destaque Inep</h3><p>Exemplo selecionado pelo Inep cuja nota individual não foi informada na fonte. A íntegra e os comentários oficiais ficam na cartilha.</p></div><div class="study-note"><h3>Modelo com IA</h3><p>Texto original criado para estudo, sem correção oficial. Inclui o mapa da estrutura, os conectivos e as fontes de repertório.</p></div><a class="text-link" href="/biblioteca">Explorar biblioteca ${arrows.right}</a></div></section>
    <section class="section"><div class="study-section"><h2>Créditos</h2>${resourceList([
      { title: 'Cartilhas do participante · Inep', url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/outros-documentos' },
      { title: 'Solar Icons · 480 Design', url: 'https://www.figma.com/community/file/1166831539721848736', description: 'Ícones distribuídos sob Creative Commons Attribution 4.0.' },
      { title: 'Licença CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    ])}</div></section>`;
}

export function saved(user, reading) {
  const entries = essays.filter((essay) => reading[essay.id]?.saved);
  const complete = essays.filter((essay) => reading[essay.id]?.done);
  return `${pageHead('MINHA BIBLIOTECA', 'Minhas leituras', 'Reabra suas redações salvas e acompanhe as que já leu.', 'bookmark-linear')}
    ${!user ? empty('Guarde suas próximas leituras', 'Entre ou crie uma conta com nome e senha para acessar suas marcações em outros dispositivos.', '<button class="button button-primary" type="button" data-account="login">Entrar</button>', 'bookmark-linear') : `
      <section class="section">${sectionHead('LISTA PESSOAL', 'Salvas', plural(entries.length, 'redação guardada', 'redações guardadas'))}${entries.length ? essayGrid(entries, reading) : empty('Nenhuma redação salva', 'Use o marcador ao lado de uma redação para guardar.', '<a class="button button-secondary" href="/biblioteca">Explorar biblioteca</a>', 'bookmark-linear')}</section>
      ${complete.length ? `<section class="section">${sectionHead('PROGRESSO', 'Leituras concluídas', plural(complete.length, 'redação lida', 'redações lidas'))}${essayGrid(complete, reading)}</section>` : ''}`}`;
}

export function missing(title, label, href) {
  return empty(title, 'Confira o endereço ou continue pelo acervo.', `<a class="button button-secondary" href="${href}">${label}</a>`, 'document-text-linear');
}

export function searchPreview(query, matches = []) {
  if (!query.trim()) return '<p class="search-hint">Tente um tema, ano, nome ou repertório.</p>';
  if (!matches.length) return '<p class="search-hint">Nenhuma redação encontrada.</p>';
  return `<ul class="search-results">${matches.slice(0, 6).map((essay) => `<li><a href="/redacoes/${esc(essay.id)}">${icon('document-text-linear')}<span><strong>${esc(essay.title)}</strong><small>${esc(scoreLabel(essay))} · ${esc(essay.category)}</small></span>${arrows.right}</a></li>`).join('')}</ul><a class="text-link search-all" href="${esc(catalogUrl({ query }))}">Ver todos os resultados ${arrows.right}</a>`;
}
