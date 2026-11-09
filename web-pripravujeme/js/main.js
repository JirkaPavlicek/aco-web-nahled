/* Asociace civilní ochrany · vanilla JS, no build step. Content stays visible if this script fails. */
(() => {
  'use strict';
  const doc = document;
  const root = doc.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dict = window.ACO_I18N || {};

  /* ---------------- i18n ---------------- */
  const originals = new Map(); // element -> { text, attrs }
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  doc.querySelectorAll('[data-i18n], [data-i18n-attr]').forEach((el) => {
    const entry = { text: null, attrs: {} };
    if (el.hasAttribute('data-i18n')) entry.text = el.textContent;
    const spec = el.getAttribute('data-i18n-attr');
    if (spec) spec.split('|').forEach((pair) => { const [attr] = pair.split(':'); entry.attrs[attr] = el.getAttribute(attr); });
    originals.set(el, entry);
  });

  const t = (lang, key, fallback) => {
    const table = dict[lang];
    if (table && Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    return fallback;
  };

  let currentLang = 'cs';
  function applyLang(lang) {
    if (lang !== 'cs' && !dict[lang]) lang = 'cs';
    currentLang = lang;
    originals.forEach((entry, el) => {
      if (entry.text !== null) {
        const key = el.getAttribute('data-i18n');
        const value = lang === 'cs' ? t('cs', key, entry.text) : t(lang, key, entry.text);
        if (el.tagName === 'TITLE') doc.title = value; else el.textContent = value;
      }
      const spec = el.getAttribute('data-i18n-attr');
      if (spec) spec.split('|').forEach((pair) => {
        const [attr, key] = pair.split(':');
        const value = lang === 'cs' ? entry.attrs[attr] : t(lang, key, entry.attrs[attr]);
        if (value != null) el.setAttribute(attr, value);
      });
    });
    root.lang = lang;
    syncLangUi(lang);
    store('aco-lang', lang);
    const url = new URL(location.href);
    if (lang === 'cs') url.searchParams.delete('lang'); else url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
    // keep internal links in the chosen language
    doc.querySelectorAll('a[href$=".html"], a[href*=".html?"], a[href*=".html#"]').forEach((a) => {
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== location.origin && location.protocol !== 'file:') return;
      if (lang === 'cs') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang);
      const rel = a.getAttribute('href').split(/[?#]/)[0] + (u.search || '') + (u.hash || '');
      a.setAttribute('href', rel);
    });
    fitWords();
    errorsRelabel();
  }
  /* ---------------- Language dropdown ----------------
     A button opens a listbox of languages; arrows move, Enter/Space choose, Escape or an outside click closes. */
  const codeOf = (lang) => ({ cs: 'CZ', uk: 'UA' }[lang] || lang.toUpperCase());
  function syncLangUi(lang) {
    doc.querySelectorAll('[data-langdd]').forEach((dd) => {
      const code = dd.querySelector('[data-langdd-code]');
      if (code) code.textContent = codeOf(lang);
      dd.querySelectorAll('[data-lang]').forEach((o) => o.setAttribute('aria-selected', String(o.dataset.lang === lang)));
    });
  }
  doc.querySelectorAll('[data-langdd]').forEach((dd) => {
    const btn = dd.querySelector('.langdd__btn');
    const list = dd.querySelector('.langdd__list');
    const opts = [...list.querySelectorAll('[data-lang]')];
    const isOpen = () => btn.getAttribute('aria-expanded') === 'true';
    const focusOpt = (i) => { const o = opts[(i + opts.length) % opts.length]; opts.forEach((x) => x.tabIndex = -1); o.tabIndex = 0; o.focus(); };
    const open = (focusSelected = true) => {
      list.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      dd.classList.add('is-open');
      if (focusSelected) focusOpt(Math.max(0, opts.findIndex((o) => o.getAttribute('aria-selected') === 'true')));
    };
    const close = (restore = true) => {
      if (!isOpen()) return;
      btn.setAttribute('aria-expanded', 'false');
      dd.classList.remove('is-open');
      list.hidden = true;
      if (restore) btn.focus();
    };
    const choose = (o) => { applyLang(o.dataset.lang); close(); };
    btn.addEventListener('click', () => (isOpen() ? close() : open()));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    opts.forEach((o, i) => {
      o.addEventListener('click', () => choose(o));
      o.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); focusOpt(i + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); focusOpt(i - 1); }
        else if (e.key === 'Home') { e.preventDefault(); focusOpt(0); }
        else if (e.key === 'End') { e.preventDefault(); focusOpt(opts.length - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(o); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === 'Tab') close(false);
      });
    });
    doc.addEventListener('click', (e) => { if (isOpen() && !dd.contains(e.target)) close(false); });
  });
  doc.querySelectorAll('[data-lang-link]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); applyLang(a.dataset.langLink); window.scrollTo({ top: 0 }); }));

  /* ---------------- Monumental word fit ---------------- */
  function fitWords() {
    // Size comes from CSS (container width / character count); only the count changes with the language.
    doc.querySelectorAll('[data-fit]').forEach((el) => {
      el.style.setProperty('--chars', String(Math.max(1, el.textContent.trim().length)));
    });
  }
  let fitTimer;
  addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitWords, 120); });

  /* ---------------- Mobile menu ---------------- */
  const menu = doc.querySelector('[data-menu]');
  const burger = doc.querySelector('[data-burger]');
  let lastFocus = null;
  function openMenu() {
    if (!menu) return;
    lastFocus = doc.activeElement;
    menu.classList.add('is-open');
    doc.body.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    const first = menu.querySelector('[data-menu-close]');
    setTimeout(() => first && first.focus(), 30);
  }
  function closeMenu(restore = true) {
    if (!menu || !menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    doc.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    if (restore) (lastFocus && lastFocus !== doc.body ? lastFocus : burger).focus();
  }
  if (menu && burger) {
    burger.addEventListener('click', openMenu);
    menu.querySelector('[data-menu-close]').addEventListener('click', () => closeMenu());
    menu.querySelectorAll('[data-menu-link]').forEach((a) => a.addEventListener('click', () => closeMenu(false)));
    doc.addEventListener('keydown', (e) => {
      if (!menu.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key !== 'Tab') return;
      const items = [...menu.querySelectorAll('a[href], button:not([disabled])')].filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    matchMedia('(min-width: 1200px)').addEventListener('change', (m) => { if (m.matches) closeMenu(false); });
  }

  /* ---------------- One way to the contact page per screen ----------------
     The bar's action steps aside while another link to the contact page is on screen. */
  const barCta = doc.querySelector('.nav__cta[data-bar-cta]');
  if (barCta && 'IntersectionObserver' in window) {
    const target = barCta.getAttribute('href');
    const others = [...doc.querySelectorAll('main a[href], footer a[href]')].filter((a) => {
      const h = a.getAttribute('href');
      return h === target || h.startsWith('kontakt.html');
    });
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
      barCta.toggleAttribute('data-away', seen.size > 0);
      barCta.toggleAttribute('inert', seen.size > 0);
    }, { threshold: 0 });
    others.forEach((a) => io.observe(a));
  }

  /* ---------------- Load entrance ----------------
     The head adds html.js-enter before first paint (unless reduced motion); here every [data-hero]
     element gets its delay, then the class is removed and CSS transitions carry each one to rest. */
  function heroEntrance() {
    if (!root.classList.contains('js-enter')) return;
    if (reduced.matches) { root.classList.remove('js-enter'); return; }
    let rise = 0; let media = 0; let sp = 0;
    doc.querySelectorAll('[data-hero]').forEach((el) => {
      const kind = el.dataset.hero;
      let delay = 0;
      if (kind === 'word' || kind === 'sweep') delay = 120;
      else if (kind === 'card') delay = 0;
      else if (kind === 'media') delay = Math.min(media++ * 80, 240);
      else if (kind === 'sp') delay = 360 + Math.min(sp++ * 60, 240);
      else delay = Math.min(rise++ * 80, 240);
      if (el.dataset.heroDelay !== undefined) delay = Math.min(Number(el.dataset.heroDelay) || 0, 240);
      el.style.setProperty('--d', delay + 'ms');
    });
    void root.offsetWidth; // commit the start state, then let the transitions run
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('js-enter')));
  }

  /* ---------------- Scroll reveals: rise | media (wipe in frame) | sweep ---------------- */
  function installReferenceReveals(scope = doc) {
    const animations = new Map();
    let active = true;
    const elements = [...scope.querySelectorAll('[data-reveal]')];
    const finish = (element) => {
      element.dataset.revealPlayed = 'true';
      const t = animations.get(element);
      if (t) clearTimeout(t);
      animations.delete(element);
      element.removeAttribute('data-reveal-state');
      element.style.removeProperty('--rd');
    };
    // stagger among sibling reveal groups that share a parent (cards, panels, rows), capped at 240ms
    const siblingIndex = (el) => {
      const peers = [...el.parentElement.children].filter((n) => n.hasAttribute('data-reveal') && n.dataset.reveal === el.dataset.reveal);
      return peers.indexOf(el);
    };
    const types = { rise: 560, media: 700, sweep: 600 };
    // The hidden start state is created lazily, only for a group that is still fully below the
    // viewport when it reaches the 96px entry margin. At rest nothing on the page is hidden, so a
    // full-page capture, a print, a resize or a jump always shows the finished layout.
    // The move itself is a CSS transition from data-reveal-state="pre" to "in" (styles.css).
    const play = (element) => {
      const type = types[element.dataset.reveal] ? element.dataset.reveal : 'rise';
      const step = Number(element.dataset.revealStep) || 80;
      const fixed = element.dataset.revealDelay;
      const delay = fixed !== undefined ? Number(fixed) : Math.min(Math.max(siblingIndex(element), 0) * step, 240);
      element.style.setProperty('--rd', delay + 'ms');
      element.setAttribute('data-reveal-state', 'pre');
      element.getBoundingClientRect();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (element.getAttribute('data-reveal-state') === 'pre') element.setAttribute('data-reveal-state', 'in');
      }));
      animations.set(element, setTimeout(() => finish(element), types[type] + delay + 160));
    };
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          if (!active) return;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const element = entry.target;
            observer.unobserve(element);
            element.dataset.revealPlayed = 'true';
            const r = entry.boundingClientRect;
            // already painted on screen (jump, fast scroll, resize) or scrolled past: never hide it
            if (reduced.matches || doc.visibilityState === 'hidden' || r.bottom <= 0) finish(element);
            else play(element);
          }
        }, { threshold: 0, rootMargin: '0px 0px 96px 0px' })
      : undefined;
    const stop = () => { if (observer) observer.disconnect(); elements.forEach(finish); };
    const onPreference = () => { if (reduced.matches) { stop(); root.classList.remove('js-enter'); } };
    reduced.addEventListener('change', onPreference);
    const onPrint = () => { [...animations.keys()].forEach(finish); };
    addEventListener('beforeprint', onPrint);
    const detach = () => removeEventListener('beforeprint', onPrint);

    for (const element of elements) {
      if (element.dataset.revealPlayed === 'true') continue;
      const rect = element.getBoundingClientRect();
      if (reduced.matches || !observer || rect.top < innerHeight || doc.visibilityState === 'hidden') { finish(element); continue; }
      observer.observe(element);
    }
    return () => {
      active = false;
      detach();
      if (observer) observer.disconnect();
      [...animations.keys()].forEach(finish);
      reduced.removeEventListener('change', onPreference);
    };
  }

  /* ---------------- Contact form ---------------- */
  const form = doc.getElementById('formular');
  function fieldError(input) {
    const v = input.type === 'checkbox' ? input.checked : input.value.trim();
    if (input.required && !v) return input.tagName === 'SELECT' ? 'err.topic' : input.type === 'checkbox' ? 'err.consent' : 'err.required';
    if (input.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'err.email';
    return '';
  }
  function showError(input, key) {
    const field = input.closest('.field');
    const out = field && field.querySelector('[data-error]');
    if (!field || !out) return;
    field.dataset.invalid = key ? 'true' : 'false';
    field.dataset.errorKey = key;
    input.setAttribute('aria-invalid', key ? 'true' : 'false');
    out.textContent = key ? t(currentLang, key, t('cs', key, '')) : '';
  }
  function errorsRelabel() {
    if (!form) return;
    form.querySelectorAll('.field[data-error-key]').forEach((f) => {
      const out = f.querySelector('[data-error]');
      const key = f.dataset.errorKey;
      if (out) out.textContent = key ? t(currentLang, key, t('cs', key, '')) : '';
    });
  }
  if (form) {
    const params = new URLSearchParams(location.search);
    const topic = params.get('tema');
    const select = form.querySelector('select[name="tema"]');
    if (topic && select && [...select.options].some((o) => o.value === topic)) select.value = topic;
    const inputs = [...form.querySelectorAll('input, select, textarea')];
    inputs.forEach((input) => {
      const evt = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'blur';
      input.addEventListener(evt, () => showError(input, fieldError(input)));
    });
    // topic shortcuts on this page set the select instead of reloading
    doc.querySelectorAll('a[data-topic]').forEach((a) => a.addEventListener('click', (e) => {
      if (!select) return;
      e.preventDefault();
      select.value = a.dataset.topic;
      showError(select, '');
      const url = new URL(location.href);
      url.searchParams.set('tema', a.dataset.topic);
      url.hash = 'formular';
      history.replaceState(null, '', url);
      form.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
      select.focus({ preventScroll: true });
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = form.querySelector('[data-status]');
      let firstBad = null;
      inputs.forEach((input) => { const key = fieldError(input); showError(input, key); if (key && !firstBad) firstBad = input; });
      if (firstBad) {
        status.dataset.state = 'error';
        status.textContent = t(currentLang, 'status.invalid', t('cs', 'status.invalid', ''));
        firstBad.focus();
        return;
      }
      const data = new FormData(form);
      const topicLabel = select.options[select.selectedIndex].textContent;
      const subject = `${topicLabel}: ${data.get('organizace') || data.get('jmeno')}`;
      const body = [
        `${form.querySelector('label[for="f-org"]').textContent}: ${data.get('organizace') || '-'}`,
        `${form.querySelector('label[for="f-name"]').textContent.replace(' *', '')}: ${data.get('jmeno')}`,
        `E-mail: ${data.get('email')}`,
        '',
        data.get('zprava')
      ].join('\n');
      const submit = form.querySelector('[type="submit"]');
      submit.setAttribute('aria-busy', 'true');
      const recipient = form.dataset.recipient || '';
      location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.dataset.state = 'ok';
      status.textContent = t(currentLang, 'status.ok', t('cs', 'status.ok', ''));
      setTimeout(() => submit.removeAttribute('aria-busy'), 600);
    });
  }


  /* ---------------- Credits dialog ---------------- */
  doc.querySelectorAll('[data-dialog-open]').forEach((btn) => {
    const dlg = doc.getElementById(btn.dataset.dialogOpen);
    if (!dlg || typeof dlg.showModal !== 'function') return;
    btn.addEventListener('click', () => dlg.showModal());
    dlg.querySelectorAll('[data-dialog-close]').forEach((c) => c.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => btn.focus());
  });

  /* ---------------- Boot ---------------- */
  const requested = new URLSearchParams(location.search).get('lang') || read('aco-lang');
  if (requested && requested !== 'cs') applyLang(requested); else syncLangUi('cs');
  heroEntrance();
  fitWords();
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fitWords);
  const startReveals = () => installReferenceReveals(doc);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', startReveals); else startReveals();
})();
