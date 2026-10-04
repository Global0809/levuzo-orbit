/* Progressive enhancement: content and controls work without this file. */
(() => {
  'use strict';
  const one = (s, root = document) => root.querySelector(s);
  const all = (s, root = document) => [...root.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 749px), (pointer: coarse)');
  const ease = 'cubic-bezier(.22,1,.36,1)';
  const active = new Set();
  const dialogJobs = new WeakMap();

  function animate(element, frames, options = {}) {
    if (!element || reduced.matches || !element.animate) return null;
    const timing = { duration: 700, easing: ease, ...options };
    if (compact.matches) { timing.duration = Math.min(450, timing.duration * .6); timing.delay = (timing.delay || 0) * .4; }
    const animation = element.animate(frames, timing);
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    return animation;
  }

  function dialogOpened(dialog) {
    dialogJobs.get(dialog)?.animation?.cancel();
    const job = {};
    dialogJobs.set(dialog, job);
    dialog.classList.remove('is-closing');
    const start = dialog.classList.contains('drawer')
      ? `translateX(${dialog.classList.contains('left-drawer') ? '-100%' : '100%'})`
      : 'translateY(14px) scale(.985)';
    job.animation = animate(dialog, [{ opacity: .4, transform: start }, { opacity: 1, transform: 'none' }], { duration: 480 });
    all('.dialog-head, nav a, .drawer-copy, #bag-content, .search-label, #search-input, #search-results', dialog)
      .forEach((el, i) => animate(el, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: Math.min(i * 30, 160) + 70, fill: 'backwards' }));
  }

  function closeDialog(dialog) {
    const previous = dialogJobs.get(dialog);
    if (previous?.closing) return previous.promise;
    previous?.animation?.cancel();
    if (!dialog.open) return Promise.resolve();
    if (reduced.matches) { dialog.close(); return Promise.resolve(); }
    const job = { closing: true };
    dialogJobs.set(dialog, job);
    dialog.classList.add('is-closing');
    const end = dialog.classList.contains('drawer')
      ? `translateX(${dialog.classList.contains('left-drawer') ? '-100%' : '100%'})`
      : 'translateY(10px) scale(.985)';
    job.animation = animate(dialog, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: end }], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)' });
    const done = () => {
      if (dialogJobs.get(dialog) !== job) return;
      dialog.close();
      dialog.classList.remove('is-closing');
      dialogJobs.delete(dialog);
    };
    job.promise = job.animation ? job.animation.finished.then(done, () => {}) : Promise.resolve().then(done);
    return job.promise;
  }

  window.LevuzoMotion = { dialogOpened, closeDialog };

  const header = one('.header');
  const progress = document.createElement('span');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  header.append(progress);

  // Native scrolling, with a single frame of work per scroll event.
  let frame = 0;
  function updateScroll() {
    frame = 0;
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 16);
    const range = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${range > 0 ? Math.min(1, Math.max(0, y / range)) : 0})`;

  }
  function scheduleScroll() { if (!frame) frame = requestAnimationFrame(updateScroll); }
  if ('IntersectionObserver' in window) {
    // Animate on entry once. No CSS hides content while JavaScript or an observer is unavailable.
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        revealObserver.unobserve(target);
        animate(target, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], {
          duration: 850, delay: Number(target.dataset.motionDelay || 0), fill: 'backwards'
        });
      });
    }, { threshold: .08 });
    all('.story-copy, .split-copy, .closing').forEach(group => {
      [...group.children].forEach((el, index) => { el.dataset.motionDelay = String(index * 75); revealObserver.observe(el); });
    });
    all('.specifications, .detail-strip, .footer-grid').forEach(group => {
      [...group.children].forEach((el, index) => { el.dataset.motionDelay = String(index * 70); revealObserver.observe(el); });
    });
  }
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', scheduleScroll, { passive: true });
  addEventListener('load', scheduleScroll, { once: true });
  scheduleScroll();

  const stage = one('.product-stage');
  one('#add-bag').addEventListener('click', () => animate(one('#bag-count'), [{ transform: 'scale(.7)' }, { transform: 'scale(1.2)', offset: .45 }, { transform: 'scale(1)' }], { duration: 450 }));

  // A focused control is never left visually midway through a reveal.
  document.addEventListener('focusin', event => {
    active.forEach(animation => {
      const target = animation.effect?.target;
      if (target && !target.matches('dialog') && target.contains(event.target)) animation.finish();
    });
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      active.forEach(animation => { try { animation.finish(); } catch { animation.cancel(); } });
    }
    scheduleScroll();
  });

  if (!location.hash || location.hash === '#product' || location.hash === '#main') {
    animate(stage, [{ opacity: 0, transform: 'translateY(14px) scale(1.025)' }, { opacity: 1, transform: 'none' }], { duration: 1050 });
    all('.product-info > *').forEach((el, i) => animate(el, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 750, delay: 100 + i * 45, fill: 'backwards' }));
  }
})();
