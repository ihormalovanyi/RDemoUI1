/* ============================================================
   map.js — будує стилізовану SVG-мапу регіону подорожі.
   Проєкція: x = (lon − 0.15)·280, y = (43.85 − lat)·380
   Світ мапи: ~0..1000 × 0..1300
   ============================================================ */

const MAP = (() => {

  const NS = 'http://www.w3.org/2000/svg';
  const WORLD = { w: 1000, h: 1300 };

  /* Узбережжя з півдня (дельта Ебро) на північ (Сет) */
  const COAST = [
    [40, 1290], [98, 1254], [199, 1189], [225, 1120], [235, 1083],
    [291, 1060], [300, 1049], [319, 1041], [350, 1030], [442, 1003],
    [468, 996], [512, 984], [538, 973], [566, 946], [588, 920],
    [644, 882], [700, 851], [739, 828], [778, 809], [806, 787],
    [834, 760], [860, 722], [854, 684], [826, 635], [846, 604],
    [888, 581], [846, 574], [843, 536], [809, 494], [809, 437],
    [809, 403], [812, 357], [815, 315], [829, 285], [846, 262],
    [941, 217], [994, 171], [1078, 133], [1140, 96],
  ];

  /* Маршрут: три головні відрізки (туди, на захід, назад) */
  const LEG1 = [ // Ла Пінеда → автобуси до Camp de Tarragona → TGV до Нарбонна
    [295, 1045], [319, 1035], [325, 1014], [368, 995], [434, 950],
    [498, 904], [545, 880], [599, 851], [650, 822], [697, 798],
    [748, 711], [787, 600], [762, 543], [750, 505], [769, 437],
    [776, 384], [792, 361], [792, 311], [799, 253],
  ];
  const LEG2 = [ // Нарбонн → Каркассон (A61)
    [799, 253], [770, 247], [731, 247], [683, 244], [641, 245], [616, 242],
  ];
  const LEG3 = [ // Каркассон → Барселона (повернення)
    [616, 242], [650, 266], [731, 266], [783, 278], [780, 320],
    [779, 361], [757, 437], [738, 500], [750, 548], [775, 600],
    [736, 711], [688, 796], [636, 838], [590, 862], [552, 900], [566, 946],
  ];

  const STOPS = {
    pineda:      { x: 295, y: 1045, name: 'La Pineda',   anchor: 'end',   dx: -16, dy: 6 },
    narbonne:    { x: 799, y: 253,  name: 'Narbonne',    anchor: 'start', dx: 16,  dy: -12 },
    carcassonne: { x: 616, y: 242,  name: 'Carcassonne', anchor: 'middle', dx: 0,  dy: -22 },
    barcelona:   { x: 566, y: 946,  name: 'Barcelona',   anchor: 'start', dx: 18,  dy: 22 },
  };

  const MINOR = [
    { x: 319, y: 1035, name: 'Tarragona', dx: 10, dy: -8 },
    { x: 277, y: 1054, name: 'Salou',     dx: -10, dy: 16, anchor: 'end' },
    { x: 588, y: 915,  name: 'Badalona',  dx: 12, dy: -6 },
    { x: 748, y: 711,  name: 'Girona',    dx: -12, dy: -8, anchor: 'end' },
    { x: 769, y: 437,  name: 'Perpignan', dx: -12, dy: 4,  anchor: 'end' },
    { x: 868, y: 194,  name: 'Béziers',   dx: 12,  dy: -4 },
  ];

  /* Додаткові шляхи: переліт, таксі, одноденні вилазки, метро */
  const AIRPORT = { x: 540, y: 969 }; // Ель-Прат
  const FLIGHT_IN  = 'M1150,-120 C 980,180 720,520 540,969';
  const FLIGHT_OUT = 'M540,969 C 760,560 1020,180 1230,-120';
  const TAXI = [
    [540, 969], [510, 985], [468, 996], [430, 1006], [386, 1006],
    [350, 1026], [319, 1037], [295, 1045],
  ];
  const TRIPS = [
    [[295, 1045], [305, 1038], [319, 1035]],  // Таррагона, 26.06
    [[295, 1045], [285, 1050], [277, 1054]],  // Салоу, 27.06
  ];
  const METRO = [[566, 946], [576, 930], [588, 918]];
  const DEPART = [
    [588, 918], [576, 930], [566, 946], [552, 958], [540, 969],
  ];

  /* Кордон Іспанія/Франція вздовж Піренеїв */
  const BORDER = [
    [843, 536], [790, 548], [700, 542], [600, 522], [500, 532],
    [400, 512], [300, 518], [150, 498], [-60, 505],
  ];

  const RIVERS = [
    [[540, 330], [616, 250], [700, 236], [780, 226], [862, 236]],            // Од
    [[-60, 1070], [80, 1110], [140, 1150], [199, 1189]],                     // Ебро
    [[452, 828], [505, 890], [530, 930], [546, 962]],                        // Льобрегат
  ];

  /* ---------- утиліти ---------- */

  function el(name, attrs = {}, parent) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  /* Плавна крива Catmull-Rom → кубічні Безьє */
  function smooth(pts, closed = false) {
    if (pts.length < 3) return 'M' + pts.map(p => p.join(',')).join('L');
    const P = i => pts[Math.max(0, Math.min(pts.length - 1, i))];
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return closed ? d + 'Z' : d;
  }

  /* Детермінований «шум» для гір (без Math.random — стабільний рендер) */
  function jitter(seed) {
    const s = Math.sin(seed * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }

  /* ---------- побудова ---------- */

  function build(svg) {
    svg.innerHTML = '';

    /* defs: градієнти й фільтри */
    const defs = el('defs', {}, svg);

    const sea = el('radialGradient', { id: 'g-sea', cx: '65%', cy: '55%', r: '90%' }, defs);
    el('stop', { offset: '0%',  'stop-color': '#16283e' }, sea);
    el('stop', { offset: '60%', 'stop-color': '#101c2e' }, sea);
    el('stop', { offset: '100%','stop-color': '#0a1220' }, sea);

    const land = el('linearGradient', { id: 'g-land', x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    el('stop', { offset: '0%',  'stop-color': '#1d2a30' }, land);
    el('stop', { offset: '55%', 'stop-color': '#1a2429' }, land);
    el('stop', { offset: '100%','stop-color': '#151d24' }, land);

    const glow = el('filter', { id: 'f-glow', x: '-80%', y: '-80%', width: '260%', height: '260%' }, defs);
    el('feGaussianBlur', { stdDeviation: '3.2', result: 'b' }, glow);
    const m = el('feMerge', {}, glow);
    el('feMergeNode', { in: 'b' }, m);
    el('feMergeNode', { in: 'SourceGraphic' }, m);

    /* море */
    el('rect', { x: -800, y: -800, width: 2800, height: 3000, fill: 'url(#g-sea)' }, svg);

    /* координатна сітка (граткула) */
    const grid = el('g', { stroke: 'rgba(160,190,220,0.055)', 'stroke-width': 1 }, svg);
    for (let gx = -700; gx <= 1900; gx += 140)
      el('line', { x1: gx, y1: -800, x2: gx, y2: 2200 }, grid);
    for (let gy = -700; gy <= 2100; gy += 140)
      el('line', { x1: -800, y1: gy, x2: 2000, y2: gy }, grid);

    /* хвилі в морі */
    const waves = el('g', {
      stroke: 'rgba(140,180,215,0.10)', 'stroke-width': 1.4,
      fill: 'none', 'stroke-linecap': 'round',
    }, svg);
    const WAVES = [
      [520, 1160], [660, 1060], [780, 900], [880, 760], [930, 470],
      [960, 330], [640, 1210], [900, 620], [990, 900], [430, 1240],
    ];
    WAVES.forEach(([wx, wy], i) => {
      const l = 26 + jitter(i) * 22;
      el('path', { d: `M${wx},${wy} q${l / 4},-7 ${l / 2},0 q${l / 4},7 ${l / 2},0` }, waves);
    });

    /* суходіл: узбережжя + рамка на північний захід */
    const coastRev = [...COAST].reverse();
    const landPath =
      smooth(coastRev)                       /* від Сета вниз до дельти Ебро */
      + ' L -300 1420 L -300 -300 L 1300 -300 Z'; /* захід/північ — суцільний суходіл */
    el('path', { d: landPath, fill: 'url(#g-land)', stroke: 'rgba(224,214,190,0.35)', 'stroke-width': 2 }, svg);

    /* мілководдя — світла смуга вздовж берега */
    el('path', {
      d: smooth(coastRev), fill: 'none',
      stroke: 'rgba(120,170,210,0.16)', 'stroke-width': 14, 'stroke-linecap': 'round',
    }, svg);

    /* річки */
    const rg = el('g', { fill: 'none', stroke: 'rgba(120,165,205,0.28)', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, svg);
    RIVERS.forEach(r => el('path', { d: smooth(r) }, rg));

    /* Піренеї + Чорна гора: стилізовані хребти */
    const mts = el('g', { stroke: 'rgba(224,214,190,0.4)', 'stroke-width': 1.6, fill: 'none', 'stroke-linejoin': 'round' }, svg);
    const ridge = (x0, y0, x1, y1, n, scale) => {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = x0 + (x1 - x0) * t + (jitter(i * 3.7 + x0) - 0.5) * 34;
        const y = y0 + (y1 - y0) * t + (jitter(i * 9.1 + y0) - 0.5) * 26;
        const s = scale * (0.7 + jitter(i * 5.3) * 0.6);
        el('path', { d: `M${x - 9 * s},${y} L${x},${y - 13 * s} L${x + 9 * s},${y}` }, mts);
        if (jitter(i * 7.9) > 0.55)
          el('path', { d: `M${x - 2 * s},${y - 10 * s} L${x + 4 * s},${y - 4 * s}`, 'stroke-width': 1 }, mts);
      }
    };
    ridge(-40, 470, 800, 545, 16, 1.35);  /* Піренеї */
    ridge(60, 555, 700, 590, 9, 0.85);    /* передгір'я */
    ridge(470, 130, 640, 165, 6, 0.9);    /* Чорна гора */
    ridge(120, 830, 330, 900, 6, 0.8);    /* гори за Таррагоною */

    /* кордон */
    el('path', {
      d: smooth(BORDER), fill: 'none',
      stroke: 'rgba(224,214,190,0.3)', 'stroke-width': 1.6,
      'stroke-dasharray': '7 7',
    }, svg);

    /* далекі підписи (видно на загальному плані) */
    const far = el('g', { id: 'labels-far', 'font-family': "'Cormorant Garamond', Georgia, serif" }, svg);
    const country = (x, y, text, rot = 0) => {
      const t = el('text', {
        x, y, fill: 'rgba(224,214,190,0.4)', 'font-size': 40,
        'letter-spacing': 14, 'font-weight': 600,
        transform: `rotate(${rot} ${x} ${y})`,
      }, far);
      t.textContent = text;
    };
    country(210, 760, 'SPAIN', -6);
    country(310, 105, 'FRANCE', 2);
    const seaT = el('text', {
      x: 720, y: 1005, fill: 'rgba(140,180,215,0.4)', 'font-size': 30,
      'letter-spacing': 9, 'font-style': 'italic',
      'font-family': "'Cormorant Garamond', Georgia, serif",
      transform: 'rotate(-28 720 1005)',
    }, far);
    seaT.textContent = 'Mediterranean Sea';

    /* майбутній маршрут — тонкий пунктир-прев'ю */
    const preview = el('g', {
      fill: 'none', stroke: 'rgba(224,164,88,0.22)',
      'stroke-width': 2, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round',
    }, svg);
    [LEG1, LEG2, LEG3].forEach(leg => el('path', { d: smooth(leg) }, preview));

    /* перельоти (з'являються у пролозі та фіналі)
       «сяйво» — ширша напівпрозора лінія замість дорогого blur-фільтра */
    const flightLine = (d, parent) => {
      el('path', {
        d, fill: 'none', stroke: 'rgba(86,156,255,0.25)',
        'stroke-width': 7.5, 'stroke-dasharray': '12 8', 'stroke-linecap': 'round',
      }, parent);
      return el('path', {
        d, fill: 'none', stroke: 'rgba(140,190,255,0.95)',
        'stroke-width': 2.4, 'stroke-dasharray': '12 8', 'stroke-linecap': 'round',
      }, parent);
    };
    const flightInG = el('g', { opacity: 0 }, svg);
    const flightInPath = flightLine(FLIGHT_IN, flightInG);
    const flightOutG = el('g', { opacity: 0 }, svg);
    const flightOutPath = flightLine(FLIGHT_OUT, flightOutG);

    /* нічне таксі Ель-Прат → Ла Пінеда */
    const taxiG = el('g', { opacity: 0 }, svg);
    el('path', {
      d: smooth(TAXI), fill: 'none', stroke: '#e0a458',
      'stroke-width': 2.6, 'stroke-dasharray': '1 7', 'stroke-linecap': 'round',
    }, taxiG);

    /* одноденні вилазки з Ла Пінеди та метро Барселона ↔ Бадалона */
    const dotted = pts => el('path', {
      d: smooth(pts), fill: 'none', stroke: 'rgba(232,226,212,0.65)',
      'stroke-width': 2.2, 'stroke-dasharray': '1 8', 'stroke-linecap': 'round',
    });
    const tripsG = el('g', { opacity: 0 }, svg);
    TRIPS.forEach(t => tripsG.appendChild(dotted(t)));
    const metroG = el('g', { opacity: 0 }, svg);
    metroG.appendChild(dotted(METRO));
    const departG = el('g', { opacity: 0 }, svg);
    departG.appendChild(dotted(DEPART));

    /* аеропорт Ель-Прат */
    const apG = el('g', {}, svg);
    el('circle', { cx: AIRPORT.x, cy: AIRPORT.y, r: 3.4, fill: 'none', stroke: 'rgba(86,156,255,0.95)', 'stroke-width': 1.6 }, apG);

    /* маршрут, який промальовується */
    const routeG = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const legs = [LEG1, LEG2, LEG3].map((leg, i) => {
      const color = i === 2 ? '#d96c4f' : '#e0a458';
      /* «сяйво» без blur-фільтра — ширша напівпрозора лінія */
      const halo = el('path', {
        d: smooth(leg), stroke: color, opacity: 0.2, 'stroke-width': 10,
      }, routeG);
      /* підкладка-«дорога» */
      const casing = el('path', {
        d: smooth(leg), stroke: 'rgba(4,7,12,0.55)', 'stroke-width': 7,
      }, routeG);
      const line = el('path', {
        d: smooth(leg), stroke: color, 'stroke-width': 3.4,
      }, routeG);
      return { line, casing, halo, len: 0 }; /* довжина обчислюється після вставки в DOM */
    });

    /* мінорні міста */
    const near = el('g', { id: 'labels-near', 'font-family': "'Manrope', system-ui, sans-serif" }, svg);
    MINOR.forEach(c => {
      el('circle', { cx: c.x, cy: c.y, r: 3.2, fill: 'rgba(232,226,212,0.45)' }, near);
      const t = el('text', {
        x: c.x + (c.dx || 8), y: c.y + (c.dy || -8),
        fill: 'rgba(232,226,212,0.5)', 'font-size': 13, 'letter-spacing': 1.5,
        'text-anchor': c.anchor || 'start',
      }, near);
      t.textContent = c.name;
    });

    /* зупинки маршруту */
    const stopsG = el('g', { id: 'stops' }, svg);
    const stopNodes = {};
    Object.entries(STOPS).forEach(([key, s]) => {
      const g = el('g', { class: 'stop', 'data-stop': key }, stopsG);
      el('circle', { class: 'pulse', cx: s.x, cy: s.y, r: 9, fill: 'none', stroke: 'rgba(224,164,88,0.7)', 'stroke-width': 1.6, opacity: 0 }, g);
      el('circle', { cx: s.x, cy: s.y, r: 6.5, fill: '#0d1420', stroke: '#e0a458', 'stroke-width': 2.4 }, g);
      el('circle', { class: 'core', cx: s.x, cy: s.y, r: 2.4, fill: '#e0a458' }, g);
      const label = el('text', {
        x: s.x + s.dx, y: s.y + s.dy,
        fill: '#e8e2d4', 'font-size': 19, 'font-weight': 600, 'letter-spacing': 2.4,
        'font-family': "'Manrope', system-ui, sans-serif",
        'text-anchor': s.anchor,
        'paint-order': 'stroke', stroke: 'rgba(4,7,12,0.75)', 'stroke-width': 5,
      }, g);
      label.textContent = s.name.toUpperCase();
      stopNodes[key] = g;
    });

    /* компас */
    const compass = el('g', {
      transform: 'translate(80, 180)',
      stroke: 'rgba(224,214,190,0.45)', fill: 'rgba(224,214,190,0.45)',
      'font-family': "'Cormorant Garamond', Georgia, serif",
    }, svg);
    el('circle', { cx: 0, cy: 0, r: 26, fill: 'none', 'stroke-width': 1.2 }, compass);
    el('path', { d: 'M0,-20 L6,6 L0,1 L-6,6 Z', stroke: 'none' }, compass);
    const nT = el('text', { x: 0, y: -34, 'text-anchor': 'middle', 'font-size': 20, stroke: 'none' }, compass);
    nT.textContent = 'N';

    /* маркер-мандрівник */
    const marker = el('g', { id: 'traveler', opacity: 0 }, svg);
    el('circle', { r: 18, fill: 'rgba(224,164,88,0.12)' }, marker);
    el('circle', { r: 11, fill: 'rgba(224,164,88,0.25)' }, marker);
    el('circle', { r: 5, fill: '#f4d9ac' }, marker);

    /* літачки, що летять дугами перельотів */
    const planeShape =
      'M0,-15 C1.6,-11 2.2,-8 2.2,-4.5 L2.2,-3 L14,4 L14,7.4 L2.4,4.6 ' +
      'L1.8,10 L6.4,13.4 L6.4,15.6 L0,14 L-6.4,15.6 L-6.4,13.4 L-1.8,10 ' +
      'L-2.4,4.6 L-14,7.4 L-14,4 L-2.2,-3 L-2.2,-4.5 C-2.2,-8 -1.6,-11 0,-15 Z';
    const mkPlane = () => {
      const g = el('g', { opacity: 0 }, svg);
      /* м'який синій ореол під корпусом */
      el('circle', { r: 24, fill: 'rgba(86,156,255,0.14)' }, g);
      el('circle', { r: 16, fill: 'rgba(86,156,255,0.28)' }, g);
      el('path', {
        d: planeShape, fill: '#f2f8ff',
        stroke: 'rgba(86,156,255,0.9)', 'stroke-width': 1.2,
      }, g);
      return g;
    };
    const planeIn = mkPlane();
    const planeOut = mkPlane();

    /* довжини відрізків — після вставки в DOM */
    legs.forEach(l => {
      l.len = l.line.getTotalLength();
      [l.line, l.casing, l.halo].forEach(p => {
        p.setAttribute('stroke-dasharray', l.len);
        p.setAttribute('stroke-dashoffset', l.len);
      });
    });

    return {
      legs, stops: STOPS, stopNodes, marker,
      farLabels: far, nearLabels: near, world: WORLD,
      extras: {
        flightIn: flightInG, flightInPath, planeIn,
        flightOut: flightOutG, flightOutPath, planeOut,
        taxi: taxiG, trips: tripsG, metro: metroG, depart: departG,
      },
    };
  }

  return { build, WORLD, STOPS };
})();
