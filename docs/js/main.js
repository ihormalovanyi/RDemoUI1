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
    /* титул — над Братиславою, звідки все починається */
    hero:        { x: 5080, y: -1890, z: 1.35, route: 0 },
    /* фокус етапу — праворуч, бо панель з інформацією тепер ліворуч */
    pineda:      { x: 180, y: 990,  z: 2.35, route: 0 },
    narbonne:    { x: 640, y: 320,  z: 2.35, route: 1 },
    carcassonne: { x: 580, y: 300,  z: 2.55, route: 2 },
    barcelona:   { x: 420, y: 890,  z: 2.35, route: 3 },
    /* z фіналу перераховується в measure(): має вміщати і Братиславу */
    finale:      { x: 2450, y: -280, z: 0.44, route: 3 },
  };
  const ORDER = ['hero', 'arrival', 'pineda', 'narbonne', 'carcassonne', 'barcelona', 'finale'];

  /* частка секції прольоту, за яку літак долає дугу (синхронно з driveExtras) */
  const FLIGHT_SPAN = 0.55;

  const sections = ORDER.map(k => document.querySelector(`[data-stage="${k}"]`));
  const cards = ORDER.map(k => document.querySelector(`[data-stage="${k}"] .card, [data-stage="${k}"] .hero-content`));
  const navBtns = [...document.querySelectorAll('#waypoints button')];
  const lbTop = document.querySelector('.letterbox.top');
  const lbBottom = document.querySelector('.letterbox.bottom');

  /* ---------- геометрія скролу ---------- */

  let keyframes = []; /* { y, shot } — кейфрейми камери */
  let navKF = [];     /* { y } — якорі навігації, по одному на секцію */
  let vw = innerWidth, vh = innerHeight, fitW = 1000;
  let arrTop = 0, arrSpan = 1; /* вікно секції прольоту */

  function measure() {
    vw = innerWidth; vh = innerHeight;
    const aspect = vh / vw;
    /* ширина світу, за якої вся мапа вміщується у в'юпорт при z=1 */
    fitW = Math.max(MAP.WORLD.w, MAP.WORLD.h / aspect) * 1.06;

    /* фінал: віддалити так, щоб було видно і Братиславу, і весь маршрут */
    SHOTS.finale.z = fitW / Math.max(5400, 3300 / aspect);

    const arr = sections[1];
    arrTop = arr.offsetTop;
    arrSpan = Math.max(arr.offsetHeight - vh, 1);

    navKF = ORDER.map((k, i) => {
      const s = sections[i];
      const y = i === 0 ? 0 : s.offsetTop + (s.offsetHeight - vh) * 0.55;
      return { y };
    });

    keyframes = [];
    ORDER.forEach((k, i) => {
      const s = sections[i];
      if (k === 'arrival') {
        /* межі вікна прольоту — всередині камера веде літак сама */
        keyframes.push({ y: arrTop, shot: arrivalShot(0) });
        keyframes.push({ y: arrTop + arrSpan, shot: arrivalShot(1) });
      } else {
        const y = i === 0 ? 0 : s.offsetTop + (s.offsetHeight - vh) * 0.55;
        keyframes.push({ y, shot: SHOTS[k] });
      }
    });
  }

  /* ---------- кадр «слідуй за літаком» ---------- */

  function arrivalShot(t) {
    const path = map.extras.flightInPath;
    let len = pathLenCache.get(path);
    if (!len) { len = path.getTotalLength(); pathLenCache.set(path, len); }
    const ft = clamp(t / FLIGHT_SPAN, 0, 1);
    const p = path.getPointAtLength(len * ft);

    /* зум: близько над Братиславою → віддалитись і летіти → зайти на посадку */
    let z;
    if (ft < 0.3)       z = lerp(1.7, 0.55, easeInOut(ft / 0.3));
    else if (ft < 0.85) z = 0.55;
    else                z = lerp(0.55, 1.1, easeInOut((ft - 0.85) / 0.15));

    let shot = { x: p.x, y: p.y, z, route: 0 };
    /* після посадки — плавний перехід до регіону Ель-Прат / узбережжя */
    if (t > 0.58) {
      const bt = easeInOut(clamp((t - 0.58) / 0.34, 0, 1));
      shot = {
        x: lerp(shot.x, 400, bt),
        y: lerp(shot.y, 880, bt),
        z: lerp(shot.z, 1.5, bt),
        route: 0,
      };
    }
    return shot;
  }

  /* ---------- інтерполяція ---------- */

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInCubic = t => t * t * t;

  function shotAt(scrollY) {
    /* усередині секції прольоту камера слідує за літаком */
    if (scrollY > arrTop && scrollY < arrTop + arrSpan)
      return arrivalShot((scrollY - arrTop) / arrSpan);

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

    /* на далеких планах підписи й точки зупинок тримають екранний розмір */
    const s = Math.round((1 / Math.min(cam.z, 1)) * 20) / 20;
    if (s !== lastStopScale) {
      lastStopScale = s;
      map.stopParts.forEach(p => {
        p.label.setAttribute('font-size', (19 * s).toFixed(1));
        p.ring.setAttribute('r', (6.5 * s).toFixed(1));
        p.ring.setAttribute('stroke-width', (2.4 * s).toFixed(1));
        p.core.setAttribute('r', (2.4 * s).toFixed(1));
        p.pulse.setAttribute('r', (9 * s).toFixed(1));
      });
    }
  }
  let lastStopScale = 1;

  function applyRoute(r) {
    map.legs.forEach((leg, i) => {
      const f = clamp(r - i, 0, 1);
      const off = leg.len * (1 - f);
      leg.line.setAttribute('stroke-dashoffset', off);
      leg.casing.setAttribute('stroke-dashoffset', off);
      leg.halo.setAttribute('stroke-dashoffset', off);
    });

    /* маркер їде кінчиком промальованого маршруту */
    const legIdx = clamp(Math.floor(r), 0, 2);
    const f = clamp(r - legIdx, 0, 1);
    const leg = map.legs[legIdx];
    const p = leg.line.getPointAtLength(leg.len * f);
    map.marker.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
    map.marker.setAttribute('opacity', r > 0.01 && r < 2.99 ? 1 : 0);
  }

  /* ---------- додаткові шари: перельоти, таксі, вилазки ---------- */

  const pathLenCache = new WeakMap();
  function placePlane(plane, path, ft, visible) {
    if (!visible) { plane.setAttribute('opacity', 0); return; }
    let len = pathLenCache.get(path);
    if (!len) { len = path.getTotalLength(); pathLenCache.set(path, len); }
    const p = path.getPointAtLength(len * ft);
    const p2 = path.getPointAtLength(Math.min(len, len * ft + 2));
    const ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI + 90;
    plane.setAttribute('opacity', 1);
    plane.setAttribute('transform',
      `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
  }

  function driveExtras(key, t) {
    const E = map.extras;
    if (key === 'arrival') {
      E.flightIn.setAttribute('opacity', clamp(t * 4, 0, 1));
      /* таксі промальовується від Ель-Прата після посадки */
      E.taxi.setAttribute('opacity', t > 0.52 ? 1 : 0);
      const tf = easeInOut(clamp((t - 0.54) / 0.3, 0, 1));
      const off = E.taxiLen * (1 - tf);
      E.taxiPaths.forEach(p => p.setAttribute('stroke-dashoffset', off));
      const ft = clamp(t / 0.55, 0, 1);
      placePlane(E.planeIn, E.flightInPath, ft, t > 0.01 && ft < 1);
    } else if (key === 'pineda') {
      E.trips.setAttribute('opacity', clamp((t - 0.25) * 3, 0, 1) * 0.9);
    } else if (key === 'barcelona') {
      E.metro.setAttribute('opacity', clamp((t - 0.3) * 3, 0, 1) * 0.9);
    } else if (key === 'finale') {
      E.depart.setAttribute('opacity', clamp(t * 3, 0, 1) * 0.9);
      E.flightOut.setAttribute('opacity', clamp((t - 0.15) * 4, 0, 1));
      const ft = clamp((t - 0.22) / 0.6, 0, 1);
      placePlane(E.planeOut, E.flightOutPath, ft, t > 0.22 && ft < 1);
    }
  }

  /* ---------- картки та інтерфейс ---------- */

  let activeCard = -2;

  function applyCards(scrollY) {
    ORDER.forEach((key, i) => {
      const card = cards[i];
      if (!card) return;
      const s = sections[i];
      const span = s.offsetHeight - vh;
      const t = clamp((scrollY - s.offsetTop) / Math.max(span, 1), -0.2, 1.2);
      driveExtras(key, clamp(t, 0, 1));
      if (i === 0 || i === ORDER.length - 1) {
        /* герой і титри — м'яке розчинення */
        const o = i === 0
          ? 1 - clamp(t * 2.4, 0, 1)
          : clamp(t * 4, 0, 1);
        card.style.opacity = o.toFixed(3);
        card.style.visibility = o < 0.02 ? 'hidden' : 'visible';
      }
    });

    /* Активний етап історії: перемикається в момент відправлення —
       щойно камера рушила з міста, панель уже розповідає про наступне. */
    let active = 0;
    for (let i = 1; i < ORDER.length; i++) {
      let thr;
      if (i === 1) thr = sections[1].offsetTop * 0.55;              /* політ — коли титул розтанув */
      else if (i === ORDER.length - 1) thr = sections[i].offsetTop; /* титри — з початком фіналу */
      else thr = navKF[i - 1].y + vh * 0.3;                         /* виїхали — читаємо про наступне */
      if (scrollY > thr) active = i;
    }
    navBtns.forEach((b, i) => b.classList.toggle('active', i === active));

    /* панель з інформацією: постійно на екрані, вміст міняється зі зміною етапу */
    const cardIdx = active >= 1 && active <= ORDER.length - 2 ? active : -1;
    if (cardIdx !== activeCard) {
      activeCard = cardIdx;
      ORDER.forEach((k, i) => {
        const c = cards[i];
        if (c && c.classList.contains('card')) c.classList.toggle('on', i === cardIdx);
      });
    }

    /* пульс активної зупинки — пункт призначення */
    const activeKey = ORDER[active];
    Object.entries(map.stopNodes).forEach(([k, node]) => {
      node.querySelector('.pulse').setAttribute('opacity', k === activeKey ? 1 : 0);
    });

    /* letterbox: широкий у героя та в титрах, тонкий у дорозі */
    const heroT = clamp(scrollY / (vh * 1.2), 0, 1);
    const endKf = navKF[navKF.length - 1];
    const endT = clamp((scrollY - endKf.y + vh) / vh, 0, 1);
    const lb = Math.max(lerp(7, 2.2, heroT), lerp(2.2, 7, endT));
    lbTop.style.setProperty('--lb', lb + 'vh');
    lbBottom.style.setProperty('--lb', lb + 'vh');
  }

  /* ---------- цикл ---------- */

  let targetShot = { ...SHOTS.hero };
  let lastY = -1, prevT = 0, settled = false;

  function frame(now) {
    const dt = Math.min(0.1, (now - prevT) / 1000 || 0.016);
    prevT = now;

    /* реагуємо на скрол раз на кадр, а не на кожну подію */
    const y = scrollY;
    if (y !== lastY) {
      lastY = y;
      targetShot = shotAt(y);
      applyCards(y);
      settled = false;
    }

    if (!settled) {
      /* незалежне від FPS згладжування */
      const a = reduceMotion ? 1 : 1 - Math.exp(-dt * 6.5);
      cam.x = lerp(cam.x, targetShot.x, a);
      cam.y = lerp(cam.y, targetShot.y, a);
      cam.z = lerp(cam.z, targetShot.z, a);
      routeSmooth = lerp(routeSmooth, targetShot.route, a * 1.3);

      /* коли доїхали — фіксуємось і перестаємо чіпати DOM */
      if (Math.abs(cam.x - targetShot.x) < 0.05 &&
          Math.abs(cam.y - targetShot.y) < 0.05 &&
          Math.abs(cam.z - targetShot.z) < 0.0008 &&
          Math.abs(routeSmooth - targetShot.route) < 0.0006) {
        cam.x = targetShot.x; cam.y = targetShot.y; cam.z = targetShot.z;
        routeSmooth = targetShot.route;
        settled = true;
      }
      applyCamera();
      applyRoute(routeSmooth);
    }
    requestAnimationFrame(frame);
  }

  addEventListener('resize', () => {
    measure();
    lastY = -1;   /* форсуємо перерахунок наступного кадру */
    settled = false;
  });

  /* навігація точками */
  navBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const y = i === 0 ? 0 : navKF[i].y;
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
  targetShot = shotAt(scrollY);
  applyCards(scrollY);
  Object.assign(cam, targetShot);
  routeSmooth = targetShot.route;
  applyCamera();
  applyRoute(routeSmooth);
  requestAnimationFrame(frame);

})();
