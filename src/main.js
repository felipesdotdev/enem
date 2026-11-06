import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import './styles.css';
import './reader.css';
import { essayById, themeBySlug, searchEssays } from './catalog.js';
import {
  shell, home, library, libraryResults, librarySummary, catalogState, catalogUrl, reader, topics, topic, guide, saved,
  missing, searchPreview, partGroup, esc, icon, plural,
} from './views.js';

const app = document.querySelector('#app');
const account = document.querySelector('#account-dialog');
const search = document.querySelector('#search-dialog');
const readingSettings = document.querySelector('#reading-settings');
const notice = document.querySelector('#notice');
const themeColor = document.querySelector('meta[name="theme-color"]');
const preferencesKey = 'caderno.reading';
const readingThemes = [['paper', 'Papel'], ['contrast', 'Alto contraste'], ['dark', 'Escuro']];
const readingSizes = [['small', 'Menor'], ['normal', 'Padrão'], ['large', 'Maior'], ['extra', 'Extra grande']];
let readingPreferences = readPreferences();
const pending = new Set();
let user = null;
let reading = {};
let sessionVersion = 0;
let annotate = false;
let afterLogin = null;
let accountMode = 'login';
let accountBusy = false;
let noticeTimeout;
let searchTimeout;

const currentPath = () => location.pathname.replace(/\/$/, '') || '/';

function currentEssay() {
  return essayById.get(currentPath().split('/')[2]);
}

function readPreferences() {
  const defaults = { theme: 'paper', size: 'normal' };
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey));
    if (readingThemes.some(([value]) => value === saved?.theme)) defaults.theme = saved.theme;
    if (readingSizes.some(([value]) => value === saved?.size)) defaults.size = saved.size;
  } catch {
    // Reading settings still work for the current page if storage is blocked.
  }
  return defaults;
}

function applyReadingPreferences() {
  const root = document.documentElement;
  if (app.querySelector('.reader-page')) {
    root.dataset.readerTheme = readingPreferences.theme;
    root.dataset.readerSize = readingPreferences.size;
    themeColor.content = getComputedStyle(root).getPropertyValue('--reader-paper').trim();
  } else {
    delete root.dataset.readerTheme;
    delete root.dataset.readerSize;
    themeColor.content = '#ffffff';
  }
}

function render() {
  const path = currentPath();
  const params = new URLSearchParams(location.search);
  const essay = path.startsWith('/redacoes/') ? currentEssay() : undefined;
  const openStudy = essay && essay.id === app.querySelector('.reader')?.dataset.essay && app.querySelector('.reader-study')?.open;
  let content;
  let title;
  if (path === '/') {
    title = 'Redação Enem';
    content = home(reading);
  } else if (path === '/biblioteca') {
    title = 'Biblioteca';
    content = library(params, reading);
  } else if (path === '/temas') {
    title = 'Temas de treino';
    content = topics();
  } else if (path.startsWith('/temas/')) {
    const theme = themeBySlug.get(path.split('/')[2]);
    title = theme?.title || 'Temas de treino';
    content = topic(theme, reading);
  } else if (path.startsWith('/redacoes/')) {
    title = essay?.title || 'Redações';
    content = reader(essay, reading, annotate);
  } else if (path === '/guia') {
    title = 'Método';
    content = guide();
  } else if (path === '/salvos') {
    title = 'Minhas leituras';
    content = saved(user, reading);
  } else {
    title = 'Página não encontrada';
    content = missing(title, 'Ir ao início', '/');
  }
  app.innerHTML = essay ? `<main id="conteudo" class="reader-page" tabindex="-1">${content}</main>` : shell(path, user, content);
  if (openStudy) app.querySelector('.reader-study').open = true;
  applyReadingPreferences();
  document.title = `${title} — Caderno`;
}

function scrollToPage() {
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
  document.querySelector('#conteudo').focus({ preventScroll: true });
}

function navigate(url) {
  clearTimeout(searchTimeout);
  if (search.open) search.close();
  if (readingSettings.open) readingSettings.close();
  if (url.pathname !== location.pathname) annotate = false;
  history.pushState({}, '', url);
  render();
  scrollToPage();
}

function notify(message) {
  clearTimeout(noticeTimeout);
  notice.textContent = message;
  noticeTimeout = setTimeout(() => { notice.textContent = ''; }, 4200);
}

async function api(path, method = 'GET', data) {
  const signal = AbortSignal.timeout(9000);
  const options = method === 'GET' ? { signal } : { signal, method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data ?? {}) };
  const response = await fetch(`/api${path}`, options);
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Ocorreu um erro. Tente novamente.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function setSession(session) {
  sessionVersion += 1;
  user = session.user;
  reading = Object.fromEntries(session.reading.map((entry) => [entry.id, entry]));
}

function updateReaderButtons(id) {
  const save = document.querySelector(`[data-save="${id}"]`);
  const done = document.querySelector(`[data-done="${id}"]`);
  const saved = Boolean(reading[id]?.saved);
  const complete = Boolean(reading[id]?.done);
  if (save) {
    const label = saved ? 'Remover dos salvos' : 'Salvar redação';
    save.classList.toggle('is-saved', saved);
    save.setAttribute('aria-label', label);
    save.setAttribute('aria-pressed', String(saved));
    save.title = label;
    save.innerHTML = icon(saved ? 'bookmark-bold' : 'bookmark-linear');
  }
  if (done) {
    done.setAttribute('aria-pressed', String(complete));
    done.innerHTML = `${icon('check-circle-linear')} ${complete ? 'Leitura concluída' : 'Marcar como lida'}`;
  }
}

async function updateReading(id, field) {
  if (!user) {
    openAccount('login', { id, field });
    return;
  }
  const version = sessionVersion;
  const operation = `${version}:${id}:${field}`;
  if (pending.has(operation)) return;
  pending.add(operation);
  const value = !reading[id]?.[field];
  const attr = field === 'saved' ? 'data-save' : 'data-done';
  const selector = `[${attr}="${id}"]`;
  const originalFocus = document.activeElement.matches(selector) ? document.activeElement : null;
  try {
    const entry = await api(`/reading/${encodeURIComponent(id)}`, 'PUT', { [field]: value });
    if (version !== sessionVersion) return;
    reading[id] = { ...reading[id], id, [field]: entry[field] };
    if (currentPath().startsWith('/redacoes/')) updateReaderButtons(id);
    else {
      const restore = originalFocus === document.activeElement;
      render();
      if (restore) (document.querySelector(selector) || document.querySelector('#conteudo')).focus({ preventScroll: true });
    }
    notify(field === 'saved' ? (value ? 'Redação salva.' : 'Redação removida dos salvos.') : (value ? 'Leitura marcada como concluída.' : 'Marcação de leitura removida.'));
  } catch (error) {
    if (version !== sessionVersion) return;
    if (error.status === 401) {
      setSession({ user: null, reading: [] });
      render();
      openAccount('login', { id, field });
    } else notify(error.message);
  } finally {
    pending.delete(operation);
  }
}

function dialogClose() {
  return `<button class="icon-button dialog-close" type="button" data-close-dialog aria-label="Fechar">${icon('close-linear')}</button>`;
}

function readingOptions(name, options) {
  return options.map(([value, label]) => `<label class="reader-option">
    <input class="sr-only" type="radio" name="${name}" value="${value}" ${readingPreferences[name] === value ? 'checked' : ''} />
    <span><i class="reader-option-sample" data-${name}-sample="${value}" aria-hidden="true">${name === 'size' ? 'Aa' : ''}</i>${label}</span>
  </label>`).join('');
}

function openReadingSettings() {
  if (readingSettings.open) return;
  readingSettings.innerHTML = `${dialogClose()}<h2 id="reading-settings-title">Preferências de leitura</h2>
    <form id="reading-settings-form">
      <fieldset><legend>Tamanho do texto</legend><div class="reader-options">${readingOptions('size', readingSizes)}</div></fieldset>
      <fieldset><legend>Aparência</legend><div class="reader-options">${readingOptions('theme', readingThemes)}</div></fieldset>
    </form>
    <p class="reader-settings-foot">Salvas neste navegador.</p>`;
  readingSettings.showModal();
}

function openAccount(mode, action = null) {
  if (accountBusy) return;
  afterLogin = action;
  accountMode = mode;
  const register = mode === 'register';
  const profile = mode === 'profile' && user;
  account.innerHTML = `${dialogClose()}<div class="tile-icon">${icon('user-rounded-linear')}</div>
    <h2 id="account-title">${profile ? esc(user.name) : register ? 'Crie sua conta' : 'Entre no Caderno'}</h2>
    <p class="dialog-intro">${profile ? 'Suas leituras ficam salvas nesta conta.' : 'Use seu nome e senha para guardar e retomar leituras.'}</p>
    ${profile ? `<a class="button button-primary dialog-wide" href="/salvos">${icon('bookmark-linear')} Minhas leituras</a><button class="button button-secondary dialog-wide" type="button" data-logout>${icon('exit-linear')} Sair da conta</button>` : `<form id="account-form">
      <label>Nome<input name="name" required minlength="2" maxlength="40" autocomplete="username" placeholder="Seu nome" /></label>
      <label>Senha<input name="password" required maxlength="128" ${register ? 'minlength="8"' : ''} type="password" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="${register ? 'No mínimo 8 caracteres' : 'Sua senha'}" /></label>
      <p class="form-error" id="auth-error" role="alert" hidden></p>
      <button type="submit" class="button button-primary dialog-wide">${register ? 'Criar conta' : 'Entrar'}</button>
    </form><div class="auth-switch">${register ? 'Já tem uma conta?' : 'Primeira vez no Caderno?'} <button type="button" data-switch-account="${register ? 'login' : 'register'}">${register ? 'Entrar' : 'Criar conta'}</button></div>`}`;
  if (!account.open) account.showModal();
  account.querySelector('input, .dialog-wide')?.focus();
}

function openSearch() {
  if (account.open || search.open || readingSettings.open) return;
  search.innerHTML = `${dialogClose()}<h2 id="search-title">Buscar no acervo</h2>
    <form id="global-search"><label class="search-input">${icon('rounded-magnifier-linear')}<span class="sr-only">Busca</span><input name="q" type="search" placeholder="Tema, autor, ano ou repertório…" autocomplete="off" /></label></form>
    <div class="sr-only" role="status" id="search-summary"></div><div id="search-preview">${searchPreview('')}</div>`;
  search.showModal();
  search.querySelector('input').focus();
}

async function submitAccount(form) {
  const button = form.querySelector('[type="submit"]');
  if (accountBusy) return;
  const errorMessage = form.querySelector('#auth-error');
  const mode = accountMode;
  const action = afterLogin;
  accountBusy = true;
  button.disabled = true;
  account.querySelector('[data-switch-account]').disabled = true;
  account.querySelector('[data-close-dialog]').disabled = true;
  errorMessage.hidden = true;
  try {
    const data = Object.fromEntries(new FormData(form));
    const session = await api(mode === 'register' ? '/register' : '/login', 'POST', data);
    setSession(session);
    account.close();
    render();
    const readerAction = action?.field === 'done' ? '[data-done]' : '[data-save]';
    document.querySelector(`.button-account, .reader ${readerAction}`)?.focus({ preventScroll: true });
    notify(mode === 'register' ? 'Conta criada.' : 'Você entrou no Caderno.');
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    return;
  } finally {
    accountBusy = false;
    button.disabled = false;
    account.querySelector('[data-switch-account]').disabled = false;
    account.querySelector('[data-close-dialog]').disabled = false;
  }
  if (action && !reading[action.id]?.[action.field]) await updateReading(action.id, action.field);
}

function updateFilters(form, mode = 'replaceState') {
  clearTimeout(searchTimeout);
  const params = new URLSearchParams(location.search);
  params.delete('p');
  for (const [key, value] of new FormData(form)) {
    if (value.trim()) params.set(key, value.trim());
    else params.delete(key);
  }
  const state = catalogState(params);
  const url = catalogUrl(state);
  if (`${location.pathname}${location.search}` !== url) history[mode]({}, '', url);
  const matches = searchEssays(state.query, state);
  document.querySelector('#catalog-summary').innerHTML = librarySummary(matches.length, state.type);
  document.querySelector('#catalog-results').innerHTML = libraryResults(state, reading, matches);
  for (const anchor of document.querySelectorAll('[data-catalog-type]')) {
    anchor.href = catalogUrl({ ...state, type: anchor.dataset.catalogType, page: 1 });
  }
}

document.addEventListener('click', async (event) => {
  const anchor = event.target.closest('a[href]');
  if (anchor && event.button === 0 && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !anchor.target && !anchor.hasAttribute('download')) {
    const url = new URL(anchor.href);
    if (url.origin === location.origin && !anchor.getAttribute('href').startsWith('#')) {
      event.preventDefault();
      if (account.open) account.close();
      navigate(url);
      return;
    }
  }
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;
  if (data.search !== undefined) openSearch();
  else if (data.readerSettings !== undefined) openReadingSettings();
  else if (data.account) openAccount(data.account);
  else if (data.switchAccount) openAccount(data.switchAccount, afterLogin);
  else if (data.closeDialog !== undefined) {
    const dialog = button.closest('dialog');
    if (dialog !== account || !accountBusy) dialog.close();
  }
  else if (data.save) await updateReading(data.save, 'saved');
  else if (data.done) await updateReading(data.done, 'done');
  else if (data.annotate !== undefined) {
    annotate = data.annotate === 'true';
    const text = document.querySelector('#reading-text');
    text.innerHTML = currentEssay().paragraphs.map((paragraph) => partGroup(paragraph, annotate)).join('');
    for (const tab of document.querySelectorAll('[data-annotate]')) tab.setAttribute('aria-pressed', String(tab.dataset.annotate === data.annotate));
  } else if (data.pdf) {
    const view = button.closest('.pdf-panel').querySelector('.pdf-view');
    if (view.hidden && !view.firstElementChild) {
      const frame = document.createElement('iframe');
      frame.src = data.pdf;
      frame.title = 'Redação na cartilha do Inep';
      view.append(frame);
    }
    view.hidden = !view.hidden;
    button.innerHTML = view.hidden ? `Ler aqui ${icon('arrow-right-linear')}` : 'Recolher PDF';
    button.setAttribute('aria-expanded', String(!view.hidden));
  } else if (data.logout !== undefined) {
    if (accountBusy) return;
    accountBusy = true;
    try {
      button.disabled = true;
      setSession(await api('/logout', 'POST'));
      account.close();
      render();
      document.querySelector('.button-account')?.focus({ preventScroll: true });
      notify('Você saiu da sua conta.');
    } catch (error) {
      account.querySelector('.dialog-intro').textContent = error.message;
    } finally {
      accountBusy = false;
      button.disabled = false;
    }
  }
});

document.addEventListener('input', (event) => {
  const form = event.target.form;
  if (form?.id === 'global-search') {
    const query = event.target.value.trim();
    const matches = query ? searchEssays(query) : [];
    document.querySelector('#search-preview').innerHTML = searchPreview(query, matches);
    document.querySelector('#search-summary').textContent = query ? plural(matches.length, 'redação encontrada', 'redações encontradas') : '';
  }
  if (form?.id === 'library-filters' && event.target.name === 'q') {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => updateFilters(form), 110);
  }
});

document.addEventListener('change', (event) => {
  if (event.target.form?.id === 'library-filters' && event.target.tagName === 'SELECT') updateFilters(event.target.form, 'pushState');
  if (event.target.form?.id === 'reading-settings-form') {
    const { name, value } = event.target;
    readingPreferences = { ...readingPreferences, [name]: value };
    applyReadingPreferences();
    try { localStorage.setItem(preferencesKey, JSON.stringify(readingPreferences)); } catch { /* Keep the current preferences in memory. */ }
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.id === 'account-form') {
    event.preventDefault();
    void submitAccount(form);
  } else if (form.id === 'global-search') {
    event.preventDefault();
    const query = form.elements.q.value.trim();
    navigate(new URL(query ? `/biblioteca?${new URLSearchParams({ q: query })}` : '/biblioteca', location.origin));
  } else if (form.id === 'library-filters') {
    event.preventDefault();
    updateFilters(form, 'pushState');
  }
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openSearch();
  }
});

for (const dialog of [account, search, readingSettings]) {
  dialog.addEventListener('cancel', (event) => {
    if (dialog === account && accountBusy) event.preventDefault();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog || (dialog === account && accountBusy)) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}

window.addEventListener('popstate', () => {
  clearTimeout(searchTimeout);
  if (readingSettings.open) readingSettings.close();
  annotate = false;
  render();
});

window.addEventListener('storage', (event) => {
  if (event.key !== preferencesKey && event.key !== null) return;
  readingPreferences = readPreferences();
  applyReadingPreferences();
  for (const option of readingSettings.querySelectorAll('input')) option.checked = readingPreferences[option.name] === option.value;
});

try {
  setSession(await api('/session'));
} catch {
  // The public library remains available if the account service cannot be reached.
}
render();
if (location.hash) requestAnimationFrame(scrollToPage);
