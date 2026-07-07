/* ============================================================
   main.js — скрол-режисура: камера, маршрут, картки, титри.
   ============================================================ */

(() => {

  const svg = document.getElementById('map');
  const map = MAP.build(svg);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- кадри камери за етапами ----------
     x, y — центр кадру у світі мапи; z — наближення.
     route — скільки відрізків промальовано на момент прибуття. */
  const SHOTS = {
    hero:        { x: 545, y: 660,  z: 1.0,  route: 0 },
    pineda:      { x: 180, y: 990,  z: 2.35, route: 0 },
    narbonne:    { x: 890, y: 320,  z: 2.35, route: 1 },
    carcassonne: { x: 620, y: 300,  z: 2.55, route: 2 },
    barcelona:   { x: 680, y: 890,  z: 2.35, route: 3 },
    finale:      { x: 545, y: 660,  z: 1.12, route: 3 },
  };
  const ORDER = ['hero', 'pineda', 'narbonne', 'carcassonne', 'barcelona', 'finale'];
  const STAGE_KEYS = ['pineda', 'narbonne', 'carcassonne', 'barcelona'];

  const sections = ORDER.map(k => document.querySelector(`[data-stage="${k}"]`));
  const cards = ORDER.map(k => document.querySelector(`[data-stage="${k}"] .card, [data-stage="${k}"] .hero-content`));
  const navBtns = [...document.querySelectorAll('#waypoints button')];
  const lbTop = document.querySelector('.letterbox.top');
  const lbBottom = document.querySelector('.letterbox.bottom');

  /* ---------- геометрія скролу ---------- */

  let keyframes = []; /* { y, shot } — позиція скролу, на якій кадр "у фокусі" */
  let vw = innerWidth, vh = innerHeight, fitW = 1000;

  function measure() {
    vw = innerWidth; vh = innerHeight;
    const aspect = vh / vw;
    /* ширина світу, за якої вся мапа вміщується у в'юпорт при z=1 */
    fitW = Math.max(MAP.WORLD.w, MAP.WORLD.h / aspect) * 1.06;
    keyframes = ORDER.map((k, i) => {
      const s = sections[i];
      const top = s.offsetTop, h = s.offsetHeight;
      /* героям — початок сцени, етапам — середина їхньої "липкої" зони */
      const y = i === 0 ? 0 : top + (h - vh) * 0.55;
      return { y, shot: SHOTS[k], key: k };
    });
  }

  /* ---------- інтерполяція ---------- */

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function shotAt(scrollY) {
    const kf = keyframes;
    if (scrollY <= kf[0].y) return { ...kf[0].shot };
    if (scrollY >= kf[kf.length - 1].y) return { ...kf[kf.length - 1].shot };
    let i = 0;
    while (i < kf.length - 2 && scrollY > kf[i + 1].y) i++;
    const a = kf[i], b = kf[i + 1];
    const t = easeInOut(clamp((scrollY - a.y) / (b.y - a.y), 0, 1));
    /* кінематографічний dolly: камера трохи відлітає вгору між кадрами */
    const dolly = 1 - 0.38 * Math.sin(Math.PI * t) *
      (Math.hypot(b.shot.x - a.shot.x, b.shot.y - a.shot.y) > 250 ? 1 : 0.25);
    return {
      x: lerp(a.shot.x, b.shot.x, t),
      y: lerp(a.shot.y, b.shot.y, t),
      z: lerp(a.shot.z, b.shot.z, t) * dolly,
      route: lerp(a.shot.route, b.shot.route, t),
    };
  }

  /* ---------- застосування кадру ---------- */

  const cam = { ...SHOTS.hero };            /* поточний (згладжений) стан */
  let routeSmooth = 0;

  function applyCamera() {
    const w = fitW / cam.z;
    const h = w * (vh / vw);
    /* на мобільному картка внизу — тримаємо точку інтересу у верхній третині */
    const yShift = vw <= 760 ? h * 0.2 : 0;
    svg.setAttribute('viewBox',
      `${(cam.x - w / 2).toFixed(1)} ${(cam.y + yShift - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);

    /* далекі підписи видно здалеку, ближні — при наближенні */
    map.farLabels.setAttribute('opacity', clamp((1.9 - cam.z) / 0.6, 0, 1).toFixed(2));
    map.nearLabels.setAttribute('opacity', clamp((cam.z - 1.35) / 0.6, 0, 1).toFixed(2));
  }

  function applyRoute(r) {
    map.legs.forEach((leg, i) => {
      const f = clamp(r - i, 0, 1);
      const off = leg.len * (1 - f);
      leg.line.setAttribute('stroke-dashoffset', off);
      leg.casing.setAttribute('stroke-dashoffset', off);
    });

    /* маркер їде кінчиком промальованого маршруту */
    const legIdx = clamp(Math.floor(r), 0, 2);
    const f = clamp(r - legIdx, 0, 1);
    const leg = map.legs[legIdx];
    const p = leg.line.getPointAtLength(leg.len * f);
    map.marker.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
    map.marker.setAttribute('opacity', r > 0.01 && r < 2.99 ? 1 : 0);
  }

  /* ---------- картки та інтерфейс ---------- */

  function applyCards(scrollY) {
    ORDER.forEach((key, i) => {
      const card = cards[i];
      if (!card) return;
      const s = sections[i];
      const span = s.offsetHeight - vh;
      const t = clamp((scrollY - s.offsetTop) / Math.max(span, 1), -0.2, 1.2);
      /* плавно з'являється на вході в сцену, зникає на виході */
      let o;
      if (i === 0) o = 1 - clamp(t * 2.4, 0, 1);                       /* герой тане */
      else o = clamp(t * 4, 0, 1) * (1 - clamp((t - 0.82) * 6, 0, 1)); /* картки */
      card.style.opacity = o.toFixed(3);
      card.style.transform = `translateY(${(1 - o) * 26}px)`;
      card.style.visibility = o < 0.02 ? 'hidden' : 'visible';
    });

    /* активна точка навігації */
    let active = 0;
    keyframes.forEach((kf, i) => { if (scrollY > kf.y - vh * 0.5) active = i; });
    navBtns.forEach((b, i) => b.classList.toggle('active', i === active));

    /* пульс активної зупинки */
    const activeKey = ORDER[active];
    Object.entries(map.stopNodes).forEach(([k, node]) => {
      node.querySelector('.pulse').setAttribute('opacity', k === activeKey ? 1 : 0);
    });

    /* letterbox: широкий у героя та в титрах, тонкий у дорозі */
    const heroT = clamp(scrollY / (vh * 1.2), 0, 1);
    const endKf = keyframes[keyframes.length - 1];
    const endT = clamp((scrollY - endKf.y + vh) / vh, 0, 1);
    const lb = Math.max(lerp(7, 2.2, heroT), lerp(2.2, 7, endT));
    lbTop.style.setProperty('--lb', lb + 'vh');
    lbBottom.style.setProperty('--lb', lb + 'vh');
  }

  /* ---------- цикл ---------- */

  let targetShot = { ...SHOTS.hero };

  function frame(now) {
    const k = reduceMotion ? 1 : 0.085;
    cam.x = lerp(cam.x, targetShot.x, k);
    cam.y = lerp(cam.y, targetShot.y, k);
    cam.z = lerp(cam.z, targetShot.z, k);
    routeSmooth = lerp(routeSmooth, targetShot.route, k * 1.4);

    applyCamera();
    applyRoute(routeSmooth);
    requestAnimationFrame(frame);
  }

  function onScroll() {
    const y = scrollY;
    targetShot = shotAt(y);
    applyCards(y);
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { measure(); onScroll(); });

  /* навігація точками */
  navBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const y = i === 0 ? 0 : keyframes[i].y;
      scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------- фото: реальні знімки поверх заглушок ---------- */

  document.querySelectorAll('.photo img[data-src]').forEach(img => {
    const probe = new Image();
    probe.onload = () => { img.src = img.dataset.src; img.classList.add('loaded'); };
    probe.src = img.dataset.src;
  });

  /* пульс зупинок */
  const style = document.createElement('style');
  style.textContent = `
    #stops .pulse { transform-origin: center; transform-box: fill-box; animation: stop-pulse 2.2s ease-out infinite; }
    @keyframes stop-pulse {
      0%   { transform: scale(0.6); stroke-opacity: 0.9; }
      100% { transform: scale(2.6); stroke-opacity: 0; }
    }`;
  document.head.appendChild(style);

  /* старт */
  measure();
  onScroll();
  Object.assign(cam, targetShot);
  routeSmooth = targetShot.route;
  requestAnimationFrame(frame);

})();
