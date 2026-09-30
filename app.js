(() => {
'use strict';
const L = (zh, es) => `<span lang="zh">${zh}</span><span lang="es">${es}</span>`;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n, lang) => Math.round(n).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US');
let lang = 'zh';
const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3l5 5-5 5"/></svg>';

/* ------------------------------------------------------------------ language */
function setLang(l) {
  lang = l;
  document.documentElement.dataset.lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'es';
  $$('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === l));
  moveThumb();
  try { localStorage.setItem('mv-lang', l); } catch (e) {}
  renderSide();
  updateCalc();
  if (window.__mapDraw) window.__mapDraw();
}
function moveThumb() {
  const on = $('.seg button[aria-pressed="true"]'), th = $('.seg .thumb');
  if (!on) return;
  th.style.left = on.offsetLeft + 'px';
  th.style.width = on.offsetWidth + 'px';
}
$$('.seg button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

/* ------------------------------------------------------------------ municipality facts */
const NOTES = {
  'Badalona': L('门店所在地。近一半中国籍居民（2,328 人，49%）住在南部第 IX 普查区，也就是 Sant Roc 一带，紧挨 Badalona Sud 园区；园区里还有 300 多家华人企业。一年增加 234 人（+5.2%）。',
                'Sede del concesionario. Casi la mitad de los residentes chinos (2.328, el 49 %) vive en el distrito censal IX, al sur, en la zona de Sant Roc, junto al polígono Badalona Sud, que además reúne más de 300 empresas chinas. Crecieron en 234 personas en un año (+5,2 %).'),
  'Santa Coloma de Gramenet': L('中国籍居民占比 3.91%，研究范围内最高。61%（2,964 人）集中在第 VI 普查区，也就是 Fondo 所在区域——加泰罗尼亚最具代表性的华人生活区之一，中餐、超市和服务业密集，是异业合作的首选地点。',
                'Un 3,91 % de residentes chinos, la mayor proporción de la zona. El 61 % (2.964) vive en el distrito censal VI, el de Fondo, uno de los núcleos chinos más conocidos de Cataluña, con restaurantes, supermercados y servicios: el lugar natural para alianzas locales.'),
  'Sant Adrià de Besòs': L('中国籍居民占比 2.32%，紧邻 Badalona Sud 园区，很多园区从业者住在这里。',
                'Un 2,32 % de residentes chinos, junto al polígono Badalona Sud; aquí viven muchos de quienes trabajan en él.'),
  'Montgat': L('门店往北第一站。中国籍居民占比 2.15%，比 Badalona 还高；收入指数 106，每千人 477 辆车。门店观察到 Hamelin 国际学校周边华人家庭较多（地图绿圈），与“华商家庭沿海往北住”一致。',
                'Primera parada al norte del concesionario. Un 2,15 % de residentes chinos, más que Badalona; índice de renta 106 y 477 turismos por cada 1.000 habitantes. El concesionario observa muchas familias chinas alrededor del colegio Hamelin (círculo verde), en línea con la idea de empresarios que viven en la costa.'),
  'el Masnou': L('收入指数 115，每千人 451 辆车。滨海走廊中段，距门店约 6 km。', 'Índice de renta 115 y 451 turismos por cada 1.000 habitantes. Tramo central del corredor costero, a unos 6 km.'),
  'Alella': L('收入指数 170，研究范围内最高。中国籍居民 155 人，一年增加 49%（基数小，但方向明确）。', 'Índice de renta 170, el más alto de la zona. 155 residentes chinos, un 49 % más en un año (base pequeña, tendencia clara).'),
  'Tiana': L('收入指数 135，每千人 471 辆车。紧挨 Badalona 与 Montgat 的住宅区。', 'Índice de renta 135 y 471 turismos por cada 1.000 habitantes. Zona residencial entre Badalona y Montgat.'),
  'Teià': L('收入指数 135，每千人 501 辆车，中国籍居民一年 +13.7%。', 'Índice de renta 135, 501 turismos por cada 1.000 habitantes y un 13,7 % más de residentes chinos en un año.'),
  'Premià de Mar': L('滨海走廊北段，距门店约 10 km。', 'Tramo norte del corredor costero, a unos 10 km.'),
  'Premià de Dalt': L('收入指数 127，每千人 491 辆车。', 'Índice de renta 127 y 491 turismos por cada 1.000 habitantes.'),
  'Vilassar de Mar': L('收入指数 121，研究范围北界。', 'Índice de renta 121; límite norte de la zona analizada.'),
};

/* ------------------------------------------------------------------ field observations (store knowledge, not statistics) */
const FIELD = [
  { id: 'hamelin', lat: 41.4742, lon: 2.2902, r: 420,
    t: L('Hamelin 国际学校周边', 'Alrededores del colegio Hamelin'),
    d: L('门店观察：Hamelin-Laie 国际学校（Montgat）周边住着较多华人家庭。官方统计只细到市镇，这一点在红点里看不出来。', 'Observación del concesionario: alrededor del colegio internacional Hamelin-Laie (Montgat) viven bastantes familias chinas. La estadística oficial solo llega a nivel municipal y no lo refleja.') },
];

/* ------------------------------------------------------------------ side panel */
const MD = window.MAPDATA;
const MUNIS = MD.munis.filter(m => m.study && m.stats);
let sortKey = 'cn';
let selected = null, hovered = null;
const SORTS = {
  cn: { l: L('华人人数', 'Chinos'), v: m => m.stats.cn, f: (m) => fmt(m.stats.cn, lang) },
  share: { l: L('华人占比', '% chinos'), v: m => m.stats.cn / m.stats.pop, f: m => (m.stats.cn / m.stats.pop * 100).toFixed(2).replace('.', lang === 'es' ? ',' : '.') + '%' },
  inc: { l: L('收入指数', 'Renta'), v: m => m.stats.rfdbIdx, f: m => String(Math.round(m.stats.rfdbIdx)) },
};
function renderSide() {
  const side = $('#side');
  if (!side) return;
  if (selected) return renderDetail(side, selected);
  const s = SORTS[sortKey];
  const rows = [...MUNIS].sort((a, b) => s.v(b) - s.v(a));
  const max = s.v(rows[0]);
  const total = MUNIS.reduce((a, m) => a + m.stats.cn, 0);
  side.innerHTML = `
    <div class="hd"><h3>${L('研究范围内的 11 个市镇', 'Los 11 municipios analizados')}</h3>
    <p>${L(`合计 <b class="num">${fmt(total, 'zh')}</b> 名中国籍居民 · Idescat 2025`, `En total, <b class="num">${fmt(total, 'es')}</b> residentes de nacionalidad china · Idescat 2025`)}</p></div>
    <div class="sortbar" role="group">${Object.entries(SORTS).map(([k, o]) => `<button class="chip" data-sort="${k}" aria-pressed="${k === sortKey}">${o.l}</button>`).join('')}</div>
    <div class="body">${rows.map(m => `
      <button class="mrow" data-muni="${m.name}">
        <span class="n">${m.name}</span><span class="v num">${s.f(m)}</span>
        <span class="bar"><i style="width:${Math.max(2, s.v(m) / max * 100)}%;background:${sortKey === 'inc' ? 'var(--violet)' : 'var(--red)'}"></i></span>
        <span class="s">${L(`占比 ${(m.stats.cn / m.stats.pop * 100).toFixed(2)}% · 收入指数 ${Math.round(m.stats.rfdbIdx)} · 距门店 ${m.dist} km`, `${(m.stats.cn / m.stats.pop * 100).toFixed(2).replace('.', ',')} % · renta ${Math.round(m.stats.rfdbIdx)} · a ${String(m.dist).replace('.', ',')} km`)}</span>
      </button>`).join('')}
    </div>`;
  $$('.chip', side).forEach(c => c.addEventListener('click', () => { sortKey = c.dataset.sort; renderSide(); }));
  $$('.mrow', side).forEach(r => {
    r.addEventListener('click', () => selectMuni(r.dataset.muni));
    r.addEventListener('mouseenter', () => { hovered = r.dataset.muni; window.__mapDraw && window.__mapDraw(); });
    r.addEventListener('mouseleave', () => { hovered = null; window.__mapDraw && window.__mapDraw(); });
  });
}
function renderDetail(side, name) {
  const m = MUNIS.find(x => x.name === name);
  if (!m) { selected = null; return renderSide(); }
  const st = m.stats, dec = v => lang === 'es' ? String(v).replace('.', ',') : String(v);
  side.innerHTML = `
    <div class="body detail" style="padding-top:12px">
      <button class="back" type="button">‹ ${L('全部市镇', 'Todos los municipios')}</button>
      <h4>${m.name}</h4>
      <p class="tag">${L(`距门店约 ${m.dist} km（直线）`, `A unos ${dec(m.dist)} km del concesionario (línea recta)`)}</p>
      <div class="kv">
        <div><b class="num" style="color:var(--red)">${fmt(st.cn, lang)}</b><span>${L('中国籍居民（2025）', 'Residentes chinos (2025)')}</span></div>
        <div><b class="num">${dec((st.cn / st.pop * 100).toFixed(2))}%</b><span>${L('占总人口', 'Sobre la población')}</span></div>
        <div><b class="num">${st.cnYoy >= 0 ? '+' : ''}${fmt(st.cnYoy, lang)}</b><span>${L('较 2024 年', 'Frente a 2024')}</span></div>
        <div><b class="num">${fmt(st.pop, lang)}</b><span>${L('总人口', 'Población total')}</span></div>
        <div><b class="num" style="color:var(--violet)">${Math.round(st.rfdbIdx)}</b><span>${L('人均可支配收入指数（加泰 = 100）', 'Índice de renta disponible (Cataluña = 100)')}</span></div>
        <div><b class="num">€${fmt(st.rfdb, lang)}</b><span>${L('人均可支配收入（2023）', 'Renta disponible por habitante (2023)')}</span></div>
        <div><b class="num">${fmt(st.cars / st.pop * 1000, lang)}</b><span>${L('每千人乘用车（2024）', 'Turismos por 1.000 hab. (2024)')}</span></div>
        <div><b class="num">${fmt(st.cars, lang)}</b><span>${L('乘用车保有量', 'Parque de turismos')}</span></div>
      </div>
      <p class="note">${NOTES[m.name] || ''}</p>
      ${districtList(m.name)}
    </div>`;
  $('.back', side).addEventListener('click', () => { selected = null; renderSide(); window.__mapReset && window.__mapReset(); });
}
function districtList(name) {
  const ds = (MD.districts || []).filter(d => d.muni === name).sort((a, b) => b.cn - a.cn);
  if (!ds.length) return '';
  const max = ds[0].cn;
  return `<p class="note" style="margin-top:16px;font-weight:600">${L('按普查区分布（Idescat 2025）', 'Por distrito censal (Idescat 2025)')}</p>` +
    ds.map(d => `<div class="mrow" style="cursor:default"><span class="n">${L('普查区 ' + d.roman, 'Distrito ' + d.roman)}</span><span class="v num">${fmt(d.cn, lang)}</span><span class="bar"><i style="width:${Math.max(2, d.cn / max * 100)}%"></i></span></div>`).join('');
}
function selectMuni(name) {
  selected = name;
  renderSide();
  window.__mapFocus && window.__mapFocus(name);
  window.__mapDraw && window.__mapDraw();
  if (innerWidth <= 1000) $('#side').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ map */
function initMap() {
  const canvas = $('#cv'), wrap = canvas.parentElement, ctx = canvas.getContext('2d');
  const QQ = MD.q;
  const u16 = b => { const s = atob(b), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new Uint16Array(a.buffer); };
  const lines = b => { const a = u16(b), out = []; for (let i = 0; i < a.length;) { const n = a[i++], p = new Float32Array(n * 2); for (let j = 0; j < n * 2; j++) p[j] = a[i++] / QQ; out.push(p); } return out; };
  const toPath = (ls, close) => { const p = new Path2D(); for (const pts of ls) { p.moveTo(pts[0], pts[1]); for (let j = 2; j < pts.length; j += 2) p.lineTo(pts[j], pts[j + 1]); if (close) p.closePath(); } return p; };
  const pts = b => { const a = u16(b), f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] / QQ; for (let i = f.length / 2 - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const x = f[2 * i], y = f[2 * i + 1]; f[2 * i] = f[2 * j]; f[2 * i + 1] = f[2 * j + 1]; f[2 * j] = x; f[2 * j + 1] = y; } return f; };

  const P = {
    sea: toPath(lines(MD.sea), true), green: toPath(lines(MD.green), true), bsud: toPath(lines(MD.bsud), true),
    bsudRings: lines(MD.bsud),
    minor: toPath(lines(MD.minor)), major: toPath(lines(MD.major)), coast: toPath(lines(MD.coast)), river: toPath(lines(MD.river)),
  };
  const districts = (MD.districts || []).map(d => { const rings = d.rings.map(r => lines(r)[0]).filter(Boolean); return { ...d, rings, path: toPath(rings, true), lx: d.label[0] / QQ, ly: d.label[1] / QQ }; });
  const field = FIELD.map(f => ({ ...f, xy: proj(f.lon, f.lat) }));
  const munis = MD.munis.map(m => { const rings = m.rings.map(r => lines(r)[0]).filter(Boolean); return { ...m, rings, path: toPath(rings, true), lx: m.label[0] / QQ, ly: m.label[1] / QQ }; });
  const D = { ctx: pts(MD.dots.ctx), res: pts(MD.dots.res), cn: pts(MD.dots.cn), biz: pts(MD.dots.biz) };
  const dealer = [MD.dealer[0] / QQ, MD.dealer[1] / QQ];
  const bsudC = (() => { let x = 0, y = 0, n = 0; P.bsudRings.forEach(r => { for (let i = 0; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; n++; } }); return [x / n, y / n]; })();
  const layers = { cn: true, biz: true, res: true, inc: false, ring: true, field: true };
  let W = 0, H = 0, dpr = 1, T = d3.zoomIdentity, kFit = 1, touched = false, progress = reduceMotion ? 1 : 0, pulse = 0;

  function inRing(r, x, y) { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; }
  const inRings = (rings, x, y) => rings.reduce((c, r) => inRing(r, x, y) ? !c : c, false);

  // free area = the part of the canvas not covered by the legend (left) and the municipality panel (right)
  const pads = () => W > 1000 ? { l: 310, r: 370, t: 16, b: 16 } : { l: 12, r: 12, t: 12, b: 12 };
  function fitTransform() {
    const p = pads();
    const k = Math.max(W / MD.w, H / MD.h);
    kFit = k;
    const [cx, cy] = proj(W > 1000 ? 2.262 : 2.245, 41.458);
    const fx = (p.l + W - p.r) / 2;
    let tx = fx - cx * k, ty = H / 2 - cy * k;
    tx = Math.min(p.l, Math.max(W - p.r - MD.w * k, tx));
    ty = Math.min(0, Math.max(H - MD.h * k, ty));
    return d3.zoomIdentity.translate(tx, ty).scale(k);
  }
  function proj(lon, lat) { const [W0, S0, E0, N0] = MD.bbox; const kx = 111320 * Math.cos((S0 + N0) / 2 * Math.PI / 180); return [(lon - W0) * kx, (N0 - lat) * 110574]; }

  const zoom = d3.zoom()
    .filter(ev => ev.type === 'wheel' ? (ev.ctrlKey || ev.metaKey) : (!ev.button && ev.type !== 'dblclick'))
    .on('start', ev => { if (ev.sourceEvent && ev.sourceEvent.type !== 'wheel') canvas.classList.add('dragging'); })
    .on('zoom', ev => { T = ev.transform; if (ev.sourceEvent) touched = true; draw(); })
    .on('end', () => canvas.classList.remove('dragging'));
  const sel = d3.select(canvas).call(zoom);

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const fit = fitTransform();
    // let every part of the data be dragged out from under the floating panels
    const p = pads();
    zoom.scaleExtent([Math.min((W - p.l - p.r) / MD.w, (H - p.t - p.b) / MD.h) * 0.96, kFit * 18]).translateExtent([[-(p.l + 40) / kFit, -(p.t + 60) / kFit], [MD.w + (p.r + 40) / kFit, MD.h + (p.b + 60) / kFit]]);
    if (!touched) { T = fit; sel.call(zoom.transform, fit); }
    draw();
  }

  const ease = t => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3);
  function dots(arr, frac, r, color, round) {
    const n = Math.floor(arr.length / 2 * frac);
    if (!n) return;
    const k = T.k, tx = T.x, ty = T.y;
    ctx.fillStyle = color;
    if (round) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const x = arr[2 * i] * k + tx, y = arr[2 * i + 1] * k + ty; if (x < -5 || y < -5 || x > W + 5 || y > H + 5) continue; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); }
      ctx.fill();
    } else {
      const d = r * 2;
      for (let i = 0; i < n; i++) { const x = arr[2 * i] * k + tx, y = arr[2 * i + 1] * k + ty; if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue; ctx.fillRect(x - r, y - r, d, d); }
    }
  }

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function draw() {
    if (!W) return;
    const k = T.k, z = k / kFit, zr = k / 0.076; // zr: absolute map scale vs. a 1400px-wide desktop view
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#F4F5F7'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * T.x, dpr * T.y);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, MD.w, MD.h);
    ctx.fillStyle = '#EEF2F6'; ctx.fill(P.sea, 'evenodd');
    ctx.fillStyle = '#F2F5EF'; ctx.fill(P.green, 'evenodd');
    if (layers.inc) {
      for (const m of munis) {
        if (!m.stats) continue;
        const a = Math.max(0, Math.min(1, (m.stats.rfdbIdx - 75) / 95));
        ctx.fillStyle = `rgba(122,90,248,${0.05 + a * 0.32})`;
        ctx.fill(m.path, 'evenodd');
      }
    }
    ctx.fillStyle = layers.biz ? 'rgba(31,91,255,.07)' : 'rgba(0,0,0,.025)'; ctx.fill(P.bsud, 'evenodd');
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#ECEDF1'; ctx.lineWidth = 0.7 / k; ctx.stroke(P.minor);
    ctx.strokeStyle = '#DFE1E6'; ctx.lineWidth = 1.6 / k; ctx.stroke(P.major);
    ctx.strokeStyle = '#D4DEE9'; ctx.lineWidth = 2.2 / k; ctx.stroke(P.river);
    ctx.strokeStyle = '#CFD8E3'; ctx.lineWidth = 1 / k; ctx.stroke(P.coast);
    for (const m of munis) {
      const hl = m.name === selected || m.name === hovered;
      if (hl) { ctx.fillStyle = 'rgba(29,29,31,.045)'; ctx.fill(m.path, 'evenodd'); }
    }
    for (const m of munis) {
      ctx.strokeStyle = m.study ? 'rgba(29,29,31,.42)' : 'rgba(29,29,31,.14)';
      ctx.lineWidth = (m.study ? 0.9 : 0.7) / k;
      ctx.stroke(m.path);
    }
    const showD = z >= 1.45 || selected === 'Badalona' || selected === 'Santa Coloma de Gramenet';
    if (showD) {
      ctx.setLineDash([2 / k, 3 / k]); ctx.strokeStyle = 'rgba(29,29,31,.28)'; ctx.lineWidth = 0.8 / k;
      for (const d of districts) ctx.stroke(d.path);
      ctx.setLineDash([]);
    }
    if (layers.field) {
      for (const f of field) {
        ctx.beginPath(); ctx.arc(f.xy[0], f.xy[1], f.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(30,158,97,.08)'; ctx.fill();
        ctx.setLineDash([5 / k, 4 / k]); ctx.strokeStyle = 'rgba(30,158,97,.9)'; ctx.lineWidth = 1.5 / k; ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (layers.biz) { ctx.setLineDash([3 / k, 3 / k]); ctx.strokeStyle = 'rgba(31,91,255,.55)'; ctx.lineWidth = 1 / k; ctx.stroke(P.bsud); ctx.setLineDash([]); }
    const selM = munis.find(m => m.name === (selected || hovered));
    if (selM) { ctx.strokeStyle = '#1D1D1F'; ctx.lineWidth = 2 / k; ctx.stroke(selM.path); }
    if (layers.ring) {
      ctx.setLineDash([4 / k, 5 / k]); ctx.strokeStyle = 'rgba(29,29,31,.35)'; ctx.lineWidth = 1 / k;
      for (const km of [2, 5, 10]) { ctx.beginPath(); ctx.arc(dealer[0], dealer[1], km * 1000, 0, 6.2832); ctx.stroke(); }
      ctx.setLineDash([]);
    }

    // dots (screen space)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = progress;
    const rs = Math.max(0.55, Math.min(2.4, 0.8 * Math.pow(zr, 0.55)));
    dots(D.ctx, ease(p / 0.5), rs, '#E3E5EA', false);
    if (layers.res) dots(D.res, ease(p / 0.5), rs, layers.cn || layers.biz ? '#B4B9C2' : '#8E939D', false);
    if (layers.cn) dots(D.cn, ease((p - 0.35) / 0.4), Math.max(0.7, Math.min(3.2, 0.95 * Math.pow(zr, 0.55))), '#E3263A', true);
    if (layers.biz) dots(D.biz, ease((p - 0.6) / 0.3), Math.max(0.9, Math.min(4, 1.3 * Math.pow(zr, 0.55))), '#1F5BFF', true);

    // soft edge where the data extent ends
    const ex0 = T.x, ey0 = T.y, ex1 = MD.w * T.k + T.x, ey1 = MD.h * T.k + T.y, F = 44;
    const fade = (x0, y0, x1, y1, rx, ry, rw, rh) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(244,245,247,1)'); g.addColorStop(1, 'rgba(244,245,247,0)'); ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh); };
    if (ex0 > -F) fade(ex0, 0, ex0 + F, 0, ex0, ey0, F, ey1 - ey0);
    if (ex1 < W + F) fade(ex1, 0, ex1 - F, 0, ex1 - F, ey0, F, ey1 - ey0);
    if (ey0 > -F) fade(0, ey0, 0, ey0 + F, ex0, ey0, ex1 - ex0, F);
    if (ey1 < H + F) fade(0, ey1, 0, ey1 - F, ex0, ey1 - F, ex1 - ex0, F);

    // labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (showD && z >= 1.9) {
      ctx.font = '500 11px -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif';
      for (const d of districts) {
        const x = d.lx * T.k + T.x, y = d.ly * T.k + T.y;
        if (x < 20 || x > W - 20 || y < 10 || y > H - 10) continue;
        const t = (lang === 'es' ? 'Distr. ' : '普查区 ') + d.roman;
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.strokeText(t, x, y + 16); ctx.fillStyle = '#8A8D95'; ctx.fillText(t, x, y + 16);
      }
    }
    if (layers.field) {
      ctx.font = '600 12px -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif';
      for (const f of field) {
        const x = f.xy[0] * T.k + T.x, y = (f.xy[1] - f.r) * T.k + T.y - 10;
        const t = lang === 'es' ? 'Observación · colegio Hamelin' : '一线观察 · Hamelin 国际学校';
        ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4; ctx.strokeText(t, x, y); ctx.fillStyle = '#137a4a'; ctx.fillText(t, x, y);
      }
    }
    ctx.lineJoin = 'round';
    for (const m of munis) {
      const x = m.lx * T.k + T.x, y = m.ly * T.k + T.y;
      if (x < 30 || x > W - 30 || y < 12 || y > H - 12) continue;
      if (!m.study && z < 1.3 && m.name !== 'Barcelona') continue;
      ctx.font = `${m.study ? 600 : 500} ${m.study ? 12.5 : 11.5}px -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif`;
      const hw = ctx.measureText(m.name).width / 2;
      if (x - hw < 6 || x + hw > W - 6) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 4; ctx.strokeText(m.name, x, y);
      ctx.fillStyle = m.study ? '#1D1D1F' : '#9A9CA3'; ctx.fillText(m.name, x, y);
    }
    const [sx, sy] = [(2.335 - 2.18) * 111320 * Math.cos(41.455 * Math.PI / 180) * T.k + T.x, (41.51 - 41.428) * 110574 * T.k + T.y];
    ctx.font = 'italic 500 13px -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif'; ctx.fillStyle = '#A9B6C5';
    ctx.fillText(lang === 'es' ? 'Mar Mediterráneo' : '地中海 · Mar Mediterrani', sx, sy);
    if (layers.ring) {
      ctx.font = '500 11px -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif'; ctx.fillStyle = '#6E6E73';
      for (const km of [2, 5, 10]) {
        const x = dealer[0] * T.k + T.x + km * 1000 * T.k * 0.7071, y = dealer[1] * T.k + T.y + km * 1000 * T.k * 0.7071;
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.strokeText(km + ' km', x, y); ctx.fillText(km + ' km', x, y);
      }
    }
    if (layers.biz && p > 0.85) {
      const x = bsudC[0] * T.k + T.x, y = bsudC[1] * T.k + T.y + 26 * Math.min(1.6, Math.sqrt(z));
      const t = lang === 'es' ? 'Badalona Sud · 300+ empresas chinas' : 'Badalona Sud · 300+ 家华企';
      ctx.font = '600 12px -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif';
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4; ctx.strokeText(t, x, y); ctx.fillStyle = '#1F5BFF'; ctx.fillText(t, x, y);
    }

    // dealer marker
    if (p > 0.9) {
      const x = dealer[0] * T.k + T.x, y = dealer[1] * T.k + T.y;
      if (pulse > 0) { ctx.beginPath(); ctx.arc(x, y, 10 + (1 - pulse) * 26, 0, 6.2832); ctx.strokeStyle = `rgba(29,29,31,${pulse * 0.5})`; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.fillStyle = '#1D1D1F'; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.fill();
      const label = 'Movento BYD';
      ctx.font = '600 13px -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif';
      const tw = ctx.measureText(label).width, bx = x + 16, by = y - 15;
      ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
      roundRect(bx, by, tw + 22, 30, 15); ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#1D1D1F'; ctx.textAlign = 'left'; ctx.fillText(label, bx + 11, by + 15.5); ctx.textAlign = 'center';
    }
    updateScale();
  }
  window.__mapDraw = draw;

  function updateScale() {
    const mpp = 1 / T.k; // metres per css px
    const target = 90 * mpp;
    const nice = [100, 200, 500, 1000, 2000, 5000].reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
    $('#scaleBar').style.width = (nice / mpp) + 'px';
    $('#scaleLabel').textContent = nice >= 1000 ? (nice / 1000) + ' km' : nice + ' m';
  }

  // hit testing
  const tip = $('#tip');
  function hit(ev) {
    const r = canvas.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    const [mx, my] = T.invert([px, py]);
    const dx = dealer[0] * T.k + T.x - px, dy = dealer[1] * T.k + T.y - py;
    if (dx * dx + dy * dy < 16 * 16 || (px > dealer[0] * T.k + T.x + 12 && px < dealer[0] * T.k + T.x + 130 && Math.abs(py - (dealer[1] * T.k + T.y)) < 16)) return { type: 'dealer', px, py };
    if (layers.field) for (const f of field) { const ddx = mx - f.xy[0], ddy = my - f.xy[1]; if (ddx * ddx + ddy * ddy < f.r * f.r) return { type: 'field', f, px, py }; }
    if (layers.biz && inRings(P.bsudRings, mx, my)) return { type: 'bsud', px, py };
    if (T.k / kFit >= 1.45) for (const d of districts) if (inRings(d.rings, mx, my)) { const m = munis.find(x => x.name === d.muni); return { type: 'muni', m, d, px, py }; }
    for (const m of munis) if (m.study && inRings(m.rings, mx, my)) return { type: 'muni', m, px, py };
    return { type: null, px, py };
  }
  canvas.addEventListener('pointermove', ev => {
    if (ev.buttons) return;
    const h = hit(ev);
    const prev = hovered;
    hovered = h.type === 'muni' ? h.m.name : null;
    canvas.classList.toggle('pointer', !!h.type);
    if (h.type) {
      let html = '';
      if (h.type === 'dealer') html = `<b>Movento BYD</b><br>${L('Carrer de l\'Acer 2 · 点击查看门店资产', 'Carrer de l\'Acer 2 · clic para ver los recursos')}`;
      else if (h.type === 'bsud') html = `<b>Badalona Sud</b><br>${L('300+ 家华人企业 · 点击了解', '300+ empresas chinas · clic para saber más')}`;
      else if (h.type === 'field') html = `<b>${h.f.t}</b><br>${L('门店一线观察 · 点击查看', 'Observación del concesionario · clic para ver')}`;
      else if (h.d) html = `<b>${h.m.name} · ${L('普查区 ' + h.d.roman, 'distrito ' + h.d.roman)}</b><br>${L(`中国籍居民 ${fmt(h.d.cn, 'zh')} · 全市 ${Math.round(h.d.cn / h.m.stats.cn * 100)}%`, `${fmt(h.d.cn, 'es')} residentes chinos · ${Math.round(h.d.cn / h.m.stats.cn * 100)} % del municipio`)}`;
      else { const s = h.m.stats; html = `<b>${h.m.name}</b><br>${L(`中国籍居民 ${fmt(s.cn, 'zh')} · 收入指数 ${Math.round(s.rfdbIdx)}`, `${fmt(s.cn, 'es')} residentes chinos · renta ${Math.round(s.rfdbIdx)}`)}`; }
      tip.innerHTML = html;
      const tx = Math.min(h.px + 14, W - 230), ty = Math.max(8, h.py - 54);
      tip.style.left = tx + 'px'; tip.style.top = ty + 'px'; tip.classList.add('on');
    } else tip.classList.remove('on');
    if (prev !== hovered) { draw(); $$('.mrow').forEach(r => r.classList.toggle('hl', r.dataset.muni === hovered)); }
  });
  canvas.addEventListener('pointerleave', () => { tip.classList.remove('on'); if (hovered) { hovered = null; draw(); } });
  canvas.addEventListener('click', ev => {
    const h = hit(ev);
    const o = { left: ev.clientX - 20, top: ev.clientY - 20, width: 40, height: 40 };
    if (h.type === 'dealer') openSheet('store', o);
    else if (h.type === 'bsud') openSheet('bsud', o);
    else if (h.type === 'field') openSheet('field-' + h.f.id, o);
    else if (h.type === 'muni') selectMuni(h.m.name);
  });

  $$('.layer').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.layer; layers[k] = !layers[k]; b.setAttribute('aria-pressed', layers[k]); draw();
  }));
  const dur = reduceMotion ? 0 : 650;
  $$('[data-zoom]').forEach(b => b.addEventListener('click', () => {
    touched = true;
    if (b.dataset.zoom === '0') { touched = false; sel.transition().duration(dur).call(zoom.transform, fitTransform()); return; }
    const c = [dealer[0] * T.k + T.x, dealer[1] * T.k + T.y];
    const inView = c[0] > 0 && c[0] < W && c[1] > 0 && c[1] < H;
    sel.transition().duration(dur).call(zoom.scaleBy, b.dataset.zoom > 0 ? 1.6 : 1 / 1.6, inView ? c : undefined);
  }));
  window.__mapFocus = name => {
    const m = munis.find(x => x.name === name);
    if (!m) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    m.rings.forEach(r => { for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); } });
    const desk = W > 1000, left = desk ? 300 : 20, right = desk ? W - 370 : W - 20, top = desk ? 30 : 20, bottom = H - 30;
    const k = Math.max(kFit, Math.min(kFit * 6, (right - left) / (x1 - x0), (bottom - top) / (y1 - y0)));
    const t = d3.zoomIdentity.translate((left + right) / 2 - (x0 + x1) / 2 * k, (top + bottom) / 2 - (y0 + y1) / 2 * k).scale(k);
    touched = true;
    sel.transition().duration(dur).call(zoom.transform, t);
  };
  window.__mapReset = () => { touched = false; sel.transition().duration(dur).call(zoom.transform, fitTransform()); };

  new ResizeObserver(resize).observe(wrap);
  resize();

  // single orchestrated reveal
  if (!reduceMotion) {
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now(), dur = 2600;
      const step = now => {
        progress = Math.min(1, (now - t0) / dur);
        if (progress >= 1) pulse = Math.max(0, 1 - (now - t0 - dur) / 1400);
        draw();
        if (progress < 1 || pulse > 0) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(() => { if (progress < 1) { progress = 1; draw(); } }, 3200);
    }, { threshold: 0.25 });
    io.observe(wrap);
  }
}

/* ------------------------------------------------------------------ income chart */
function renderIncome() {
  const rows = MUNIS.map(m => ({ n: m.name, v: m.stats.rfdbIdx })).sort((a, b) => b.v - a.v);
  const max = 180;
  const maresme = new Set(['Alella', 'Tiana', 'Teià', 'Premià de Dalt', 'Vilassar de Mar', 'el Masnou', 'Montgat', 'Premià de Mar']);
  $('#incomeChart').innerHTML = rows.map(r => `
    <div class="ibar ${maresme.has(r.n) ? 'hl' : 'base'}"><span class="n">${r.n}</span>
      <span class="track"><i style="width:${r.v / max * 100}%"></i><span class="ref" style="left:${100 / max * 100}%"></span></span>
      <b class="num">${Math.round(r.v)}</b></div>`).join('') +
    `<div class="ibar" style="color:var(--quiet);font-size:12px"><span></span><span style="padding-left:${100 / max * 100 - 3}%">${L('加泰 = 100', 'Cataluña = 100')}</span><span></span></div>`;
}

/* ------------------------------------------------------------------ journey */
const JOURNEY = [
  { zh: ['发现', '刷到 Badalona 有家讲中文的 BYD'], es: ['Descubrir', 'Ve que en Badalona hay un BYD donde se habla chino'], plat: ['抖音', '视频号'] },
  { zh: ['研究', '搜攻略、看车主评价、比价格'], es: ['Investigar', 'Busca guías, opiniones y precios'], plat: ['小红书'] },
  { zh: ['咨询', '加微信，直接问中国员工'], es: ['Consultar', 'Añade al empleado en WeChat y pregunta'], plat: ['微信'] },
  { zh: ['到店', '预约看车，有人用中文接待'], es: ['Visitar', 'Cita en el concesionario, atención en chino'], plat: ['Movento'] },
  { zh: ['试驾', '带家人或合伙人一起'], es: ['Probar', 'Viene con la familia o el socio'], plat: ['Movento'] },
  { zh: ['成交', '报价、金融、公司名义手续一次讲清'], es: ['Comprar', 'Oferta, financiación y trámites de empresa, todo explicado'], plat: ['Gestoría'] },
  { zh: ['售后与转介绍', '保养有人管，满意了推荐朋友'], es: ['Posventa y recomendación', 'Mantenimiento atendido; si está contento, recomienda'], plat: ['Taller', '视频号'] },
];
function renderJourney() {
  $('#journey').innerHTML = JOURNEY.map((j, i) => `
    <button class="jstep tap sq" data-sheet="j${i}">
      <span class="ix num">${i + 1}</span>
      <h4>${L(j.zh[0], j.es[0])}</h4><p>${L(j.zh[1], j.es[1])}</p>
      <span class="plat">${j.plat.map(p => `<span>${p}</span>`).join('')}</span>
    </button>`).join('');
}

/* ------------------------------------------------------------------ models */
const MODELS = [
  { id: 'sealion7', n: 'SEALION 7', t: L('纯电 SUV · 旗舰', 'SUV eléctrico · gama alta'), price: 39475, fit: [2, 2, 1, 0] },
  { id: 'atto8', n: 'ATTO 8', t: L('新一代唐 · 7 座旗舰 SUV · 即将登陆欧洲', 'El nuevo Tang · SUV de 7 plazas · llegará pronto a Europa'), price: null, soon: true, fit: [2, 2, 0, 0] },
  { id: 'sealu', n: 'SEAL U DM-i', t: L('插电混动 SUV · 2025 西班牙最畅销插混', 'SUV híbrido enchufable · el PHEV más vendido de España en 2025'), price: 29990, fit: [2, 2, 0, 1] },
  { id: 'seal6', n: 'SEAL 6 DM-i', t: L('插电混动轿车 · 店用与第二台车', 'Berlina híbrida enchufable · negocio y segundo coche'), price: 26740, fit: [1, 0, 1, 2] },
  { id: 'seal', n: 'SEAL', t: L('纯电轿跑 · 对标 Model 3', 'Berlina eléctrica · rival del Model 3'), price: null, fit: [1, 0, 2, 0] },
  { id: 'atto2', n: 'ATTO 2 · DM-i / EV', t: L('紧凑 SUV · 2026 西班牙销量主力', 'SUV compacto · el más vendido de BYD en España en 2026'), price: 18739, fit: [0, 1, 2, 1] },
  { id: 'dolphin', n: 'DOLPHIN SURF', t: L('城市小车 · 第二台车', 'Urbano · segundo coche'), price: 12955, fit: [0, 1, 1, 1] },
];
const priceLabel = m => m.price ? '€' + fmt(m.price, 'zh') : m.soon ? L('待公布', 'Por anunciar') : L('见官网', 'Consultar');
function renderModels() {
  const head = `<div class="mhead"><div>${L('车型', 'Modelo')}</div><div>${L('起售价', 'Desde')}</div><div style="text-align:center">${L('生意老板', 'Empresarios')}</div><div style="text-align:center">${L('创一代家庭', 'Familias')}</div><div style="text-align:center">${L('二代 · 年轻', 'Jóvenes')}</div><div style="text-align:center">${L('店用 · 第二台', 'Negocio · 2º coche')}</div></div>`;
  $('#modelTable').innerHTML = head + MODELS.map(m => `
    <button class="mline" data-sheet="m-${m.id}">
      <div class="mn">${m.n}<small>${m.t}</small></div>
      <div class="pr num">${priceLabel(m)}</div>
      ${m.fit.map(f => `<div class="fit"><i class="${f === 2 ? 'f2' : f === 1 ? 'f1' : ''}"></i></div>`).join('')}
    </button>`).join('');
}

/* ------------------------------------------------------------------ phases */
const PHASES = [
  { now: true, when: L('第一阶段 · 2026 年 10–12 月 · 第 1–90 天', 'Fase 1 · octubre–diciembre 2026 · días 1–90'), h: L('试点：跑通第一个闭环', 'Piloto: cerrar el primer ciclo'),
    acts: [
      ['a-setup', L('开通账号与中文资料包', 'Cuentas y dossier en chino'), L('小红书、抖音、视频号（官方 + 个人），车型、价格、流程与 Taller 常见问题', 'Xiaohongshu, Douyin y WeChat (oficial y personal); modelos, precios, trámites y FAQ del taller'), L('第 1–2 周', 'Sem. 1–2')],
      ['a-content', L('每周 3 条内容', '3 publicaciones por semana'), L('70% 实用信息、20% 幕后、10% 促销', '70 % útil, 20 % día a día, 10 % promoción'), L('第 2–12 周', 'Sem. 2–12')],
      ['a-chamber', L('拜访 3–5 个商会与同乡会', 'Visitar 3–5 asociaciones'), L('先建立关系，不谈赞助', 'Primero la relación, no el patrocinio'), L('第 3–6 周', 'Sem. 3–6')],
      ['a-visit', L('商会专场：参观 + 试驾', 'Visita exclusiva de una asociación'), L('10–20 位老板，一个下午', '10–20 empresarios, una tarde'), L('第 6–8 周', 'Sem. 6–8')],
      ['a-tbd', L('更多动作 · 待定', 'Más acciones · por decidir'), L('华人试驾日、转介绍奖励等，看前 6 周数据再决定', 'Jornada de pruebas, plan de recomendación…: se decide con los datos de las 6 primeras semanas'), L('第 6 周后', 'Tras sem. 6')],
    ],
    gate: L('打个比方：如果 90 天内有 100+ 条中文咨询、20+ 次试驾、4+ 台成交，就进入第二阶段。数字仅作示意，最终门槛与销售经理一起定。', 'Por ejemplo: con más de 100 consultas, 20 pruebas y 4 ventas en 90 días, pasaríamos a la fase 2. Cifras solo orientativas; el umbral final se fija con el jefe de ventas.') },
  { when: L('第二阶段 · 2027 年 1–3 月 · 初步见效后', 'Fase 2 · enero–marzo 2027 · con primeros resultados'), h: L('放大：借商会与春节加码', 'Escalar: asociaciones y Año Nuevo chino'),
    acts: [
      ['b-member', L('商会会员礼遇', 'Ventajas para socios'), L('会员专属购车礼遇与优先 Taller 预约', 'Condiciones exclusivas y cita prioritaria en el taller'), ''],
      ['b-gestoria', L('企业购车与税务说明会', 'Sesión fiscal sobre compra de coche de empresa'), L('与商会内部 Gestoría 合办，听完直接试驾', 'Con la gestoría de la asociación; prueba al terminar'), ''],
      ['b-cny', L('春节开门红试驾季', 'Campaña de Año Nuevo chino'), L('2027 年 2 月 6 日春节前后，中式交车仪式', 'Alrededor del 6 de febrero de 2027, con entregas al estilo chino'), ''],
      ['b-partner', L('Fondo 与 Badalona 异业合作', 'Alianzas en Fondo y Badalona'), L('华人超市、餐厅台卡，扫码预约试驾', 'Expositores con QR en supermercados y restaurantes chinos'), ''],
    ],
    gate: L('前提：第一阶段达到门槛，且商会关系已建立', 'Requisito: umbral de la fase 1 alcanzado y relación con asociaciones consolidada') },
  { when: L('第三阶段 · 2027 年第二季度起 · 待评估', 'Fase 3 · desde el 2º trimestre de 2027 · por evaluar'), h: L('规模化：更多入口', 'Crecer: más puntos de entrada'),
    acts: [
      ['c-school', L('华人驾校合作', 'Alianza con autoescuelas chinas'), L('新移民要重新考驾照，驾校是最早的新车需求', 'Los recién llegados deben sacarse el carnet: la primera señal de compra'), ''],
      ['c-pickup', L('Taller 上门取送车', 'Recogida y entrega para el taller'), L('给 Badalona Sud 老板，保养不耽误生意', 'Para empresarios de Badalona Sud: mantenimiento sin parar el negocio'), ''],
      ['c-fleet', L('企业车队与公司用车', 'Flotas de empresa'), L('园区企业的多台车需求', 'Necesidades de varios vehículos en el polígono'), ''],
      ['c-young', L('年轻社群与学生会', 'Comunidades jóvenes y asociaciones de estudiantes'), L('面向二代与年轻职场人的试驾活动', 'Pruebas para segunda generación y jóvenes profesionales'), ''],
      ['c-club', L('车主会', 'Club de propietarios'), L('老车主年度聚会，巩固口碑', 'Encuentro anual para reforzar las recomendaciones'), ''],
    ],
    gate: L('每个想法先做一次小测试再决定', 'Cada idea se prueba a pequeña escala antes de decidir') },
];
function renderPhases() {
  $('#phases').innerHTML = PHASES.map((p, i) => `
    <div class="phase sq ${p.now ? 'now' : ''}">
      <div class="when">${p.when}</div>
      <h3>${p.h}</h3>
      ${p.acts.map(a => `<button class="act tap sq" data-sheet="${a[0]}"><span class="d ${i === 2 ? 'idea' : ''}"></span><span><b>${a[1]}</b><small>${a[2]}</small></span>${a[3] ? `<span class="wk">${a[3]}</span>` : ''}</button>`).join('')}
      <div class="gate">${p.gate}</div>
    </div>`).join('');
}

/* ------------------------------------------------------------------ budget */
const LEDGER = [
  { g: L('第一阶段 · 试点（确定）', 'Fase 1 · piloto (confirmado)'), items: [
    { id: 'kit', t: L('内容拍摄设备', 'Equipo de grabación'), d: L('手机稳定器、无线麦克风、补光灯，一次性', 'Estabilizador, micrófono y luz; compra única'), unit: 350, qty: 1, u: L('套', 'lote'), on: true },
    { id: 'boost', t: L('平台小额投放测试', 'Pruebas de promoción pagada'), d: L('小红书 / 抖音 / 视频号', 'Xiaohongshu, Douyin y WeChat'), unit: 200, qty: 3, u: L('月', 'meses'), on: true },
    { id: 'chamber', t: L('商会专场', 'Visita de asociación'), d: L('茶歇、火腿、布置', 'Catering, jamón y ambientación'), unit: 500, qty: 1, u: L('场', 'eventos'), on: true },
    { id: 'print', t: L('中文线下物料', 'Material impreso en chino'), d: L('折页、易拉宝、二维码台卡', 'Folletos, roll-ups y expositores con QR'), unit: 350, qty: 1, u: L('套', 'lote'), on: true },
    { id: 'gift', t: L('试驾礼品', 'Obsequios de prueba'), d: L('到店试驾与商会活动', 'Pruebas y evento de la asociación'), unit: 15, qty: 60, u: L('份', 'uds.'), on: true },
  ]},
  { g: L('第一阶段 · 待定（看前 6 周数据）', 'Fase 1 · por decidir (según las 6 primeras semanas)'), items: [
    { id: 'day', t: L('华人试驾日', 'Jornada de pruebas'), d: L('餐饮、布置、亲子小活动', 'Catering, decoración y actividad infantil'), unit: 700, qty: 1, u: L('场', 'eventos'), on: false },
    { id: 'ref', t: L('转介绍奖励', 'Premios por recomendación'), d: L('成交后才发生', 'Solo si hay venta'), unit: 150, qty: 5, u: L('次', 'premios'), on: false, v: true },
  ]},
  { g: L('第二阶段 · 见效后可选', 'Fase 2 · opcional con resultados'), items: [
    { id: 'gest', t: L('Gestoría 企业购车说明会', 'Sesión fiscal con gestoría'), d: L('茶歇与讲师', 'Catering y ponente'), unit: 800, qty: 1, u: L('场', 'sesiones'), on: false },
    { id: 'cny', t: L('春节开门红试驾季', 'Campaña de Año Nuevo chino'), d: L('交车仪式布置、红包礼品、内容拍摄', 'Entregas, sobres rojos y grabación'), unit: 1200, qty: 1, u: L('季', 'campaña'), on: false },
    { id: 'part', t: L('异业合作物料与礼品', 'Material y obsequios para alianzas'), d: L('每家超市或餐厅的台卡与扫码礼品', 'Expositor y regalos por establecimiento'), unit: 150, qty: 6, u: L('家', 'locales'), on: false },
  ]},
];
const ALL_ITEMS = () => LEDGER.flatMap(g => g.items);
function budgetTotal() { return ALL_ITEMS().filter(i => i.on).reduce((s, i) => s + i.unit * i.qty, 0); }
const eurS = v => lang === 'es' ? fmt(v, 'es') + ' €' : '€' + fmt(v, 'zh');
function renderLedger() {
  $('#ledger').innerHTML = LEDGER.map(g => `<div class="grp">${g.g}</div>` + g.items.map(i => `
    <div class="li ${i.v ? 'var' : ''} ${i.on ? '' : 'off'}" data-id="${i.id}">
      <input type="checkbox" ${i.on ? 'checked' : ''} aria-label="include">
      <span class="t"><b>${i.t}</b><small>${i.d}</small></span>
      <span class="a num" data-sub></span>
      <span class="q">
        <span class="stp"><span class="cur">€</span><input type="number" inputmode="decimal" min="0" step="${i.unit >= 100 ? 50 : 1}" value="${i.unit}" data-f="unit" aria-label="unit price"></span>
        <span class="x">×</span>
        <span class="stp"><button type="button" data-d="-1" aria-label="less">−</button><input type="number" inputmode="numeric" min="0" step="1" value="${i.qty}" data-f="qty" aria-label="quantity"><button type="button" data-d="1" aria-label="more">+</button></span>
        <span class="u">${i.u}</span>
      </span>
    </div>`).join('')).join('') +
    `<div class="total"><span>${L('合计', 'Total')}<br><small style="color:var(--quiet);font-size:12px">${L('* 仅在成交后发生 · 单价与数量都可以直接改', '* Solo si hay venta · precio y cantidad editables')}</small></span><b class="num" id="ledgerTotal"></b></div>`;
  $$('#ledger .li').forEach(row => {
    const it = ALL_ITEMS().find(i => i.id === row.dataset.id);
    const cb = $('input[type=checkbox]', row);
    cb.addEventListener('change', () => { it.on = cb.checked; row.classList.toggle('off', !it.on); updateCalc(); });
    $$('input[data-f]', row).forEach(inp => inp.addEventListener('input', () => { it[inp.dataset.f] = Math.max(0, +inp.value || 0); if (!it.on) { it.on = true; cb.checked = true; row.classList.remove('off'); } updateCalc(); }));
    $$('button[data-d]', row).forEach(bt => bt.addEventListener('click', () => { const inp = $('input[data-f=qty]', row); it.qty = Math.max(0, it.qty + +bt.dataset.d); inp.value = it.qty; if (!it.on) { it.on = true; cb.checked = true; row.classList.remove('off'); } updateCalc(); }));
  });
}
function updateCalc() {
  const tot = budgetTotal();
  const eur = eurS;
  $$('#ledger .li').forEach(row => { const it = ALL_ITEMS().find(i => i.id === row.dataset.id); $('[data-sub]', row).textContent = eur(it.unit * it.qty); });
  if ($('#ledgerTotal')) $('#ledgerTotal').textContent = eur(tot);
  const leads = +$('#r-leads').value, td = +$('#r-td').value, cl = +$('#r-close').value, pr = +$('#r-price').value;
  $('#v-leads').textContent = leads; $('#v-td').textContent = td + '%'; $('#v-close').textContent = cl + '%'; $('#v-price').textContent = eur(pr);
  const tds = leads * td / 100, sales = tds * cl / 100;
  $('#o-td').textContent = Math.round(tds);
  $('#o-sales').textContent = sales < 10 ? sales.toFixed(1).replace('.', lang === 'es' ? ',' : '.') : Math.round(sales);
  const rev = sales * pr;
  $('#o-rev').textContent = rev >= 1e6 ? (lang === 'es' ? (rev / 1e6).toFixed(2).replace('.', ',') + ' M€' : '€' + (rev / 1e6).toFixed(2) + 'M') : (lang === 'es' ? fmt(rev / 1000, 'es') + ' k€' : '€' + fmt(rev / 1000, 'zh') + 'k');
  $('#o-cps').textContent = sales > 0 ? eur(tot / sales) : '—';
  $('#o-budget') && ($('#o-budget').textContent = eur(tot));
}
$$('.calc input[type=range]').forEach(r => r.addEventListener('input', updateCalc));

/* ------------------------------------------------------------------ sources */
const SOURCES = [
  [L('Idescat · 按国籍划分的外国人口（中国），2025 年 1 月 1 日，各市镇', 'Idescat · Población extranjera por nacionalidad (China), 1 de enero de 2025, por municipio'), 'https://www.idescat.cat/poblacioestrangera/?b=0&geo=mun%3A080155&nac=d407&lang=es'],
  [L('Idescat · 市镇数据（EMEX）：人均家庭可支配收入 2023（暂定）、乘用车保有量 2024、人口 2025', 'Idescat · El municipio en cifras (EMEX): RFDB por habitante 2023 (provisional), turismos 2024 y población 2025'), 'https://www.idescat.cat/emex/?lang=es'],
  [L('Badalona 市政府 · 2026 年 8 月 28 日：Badalona Sud 有 300 多家中国企业，全西班牙第二', 'Ajuntament de Badalona · 28/08/2026: más de 300 empresas chinas en Badalona Sud, segundo polígono de España'), 'https://www.badalona.cat/ca/actualitat/noticies/lalcalde-xavier-garcia-albiol-destaca-a-la-xina-que-badalona-te-el-segon-poligon-industrial-despanya-amb-mes-empreses-xineses-i-aposta-per-reforcar-aquesta-relacio-economica'],
  [L('BYD España · 2025 年成为插电车市场领导者（Seal U 10,366 辆）', 'BYD España · BYD termina 2025 como líder de vehículos enchufables (SEAL U, 10.366 unidades)'), 'https://www.byd.com/es-es/news-list/byd-lider-mercado-vehiculos-enchufables-2025'],
  [L('Bolsamanía · BYD 2025 年西班牙销量 25,552 辆，增长 373.7%', 'Bolsamanía · BYD dispara un 373 % sus ventas en España en 2025 (25.552 unidades)'), 'https://www.bolsamania.com/noticias/empresas/byd-dispara-373-ventas-espana-2025-tacha-historico--21447712.html'],
  [L('BYD España · 2026 年 1–7 月 26,757 辆，已超 2025 全年', 'BYD España · 26.757 matriculaciones de enero a julio de 2026, más que todo 2025'), 'https://www.byd.com/es-es/news-list/byd-record-ventas-anual-cierre-julio-2026'],
  [L('Gasgoo · BYD 2025 全球销量 4,602,436 辆，海外首次破百万', 'Gasgoo · BYD vendió 4.602.436 vehículos en 2025; más de un millón fuera de China'), 'https://autonews.gasgoo.com/articles/news/byd-wraps-up-2025-global-sales-46-million-overseas-market-becomes-new-growth-engine-2007831963937550337'],
  [L('BYD España 官网 · 车型起售价（2026 年 9 月 30 日查询）', 'Web de BYD España · precios desde (consultada el 30/09/2026)'), 'https://www.byd.com/es-es'],
  [L('Idescat · 按普查区划分的外国人口（中国），Badalona 与 Santa Coloma，2025', 'Idescat · Población extranjera por distrito censal (China), Badalona y Santa Coloma, 2025'), 'https://www.idescat.cat/poblacioestrangera/?b=10&geo=mun:080155&nac=d407&lang=es'],
  [L('INE · 2025 年普查分区边界图', 'INE · Cartografía de secciones censales 2025'), 'https://www.ine.es/prodyser/cartografia/seccionado_2025.zip'],
  [L('Bloomberg · BYD 计划把新一代唐推向欧洲（2026 年 6 月）', 'Bloomberg · BYD llevará el nuevo Tang a Europa (junio de 2026)'), 'https://www.bloomberg.com/news/articles/2026-06-18/byd-to-send-hot-selling-suv-to-europe-pressuring-incumbents'],
  [L('Zecar · Tang L 以 ATTO 8 名称全球上市', 'Zecar · El Tang L se lanza globalmente como ATTO 8'), 'https://zecar.com/reviews/byd-tang-l-with-1,086-hp-to-launch-globally-as-atto-8'],
  [L('数英网 · 蔚来小红书账号矩阵与 KOS 案例', 'Digitaling · NIO en Xiaohongshu: cuentas y KOS'), 'https://www.digitaling.com/projects/318947.html'],
  [L('Riseo · LSH Auto（奔驰）澳洲华人社媒案例', 'Riseo · LSH Auto (Mercedes-Benz) y la comunidad china australiana'), 'https://riseo.com.au/works/lsh-auto-mercedes-benz-chinese-australian/'],
  [L('数英网 · 知家 × 五菱经销商抖音矩阵', 'Digitaling · Zhijia × Wuling, red de concesionarios en Douyin'), 'https://www.digitaling.com/articles/1024295.html'],
  [L('界面新闻 · 汽车品牌如何进入小红书（官方号、门店号与销售个人号并存）', 'Jiemian · Marcas de coches en Xiaohongshu (cuentas oficiales, de concesionarios y de comerciales)'), 'https://www.jiemian.com/article/9995322.html'],
  [L('腾讯 · 微信及 WeChat 产品介绍', 'Tencent · Weixin y WeChat'), 'https://www.tencent.com/products/weixin-wechat/'],
  [L('Movento · 门店地址 Carrer de l\'Acer 2, 08915 Badalona', 'Movento · dirección Carrer de l\'Acer 2, 08915 Badalona'), 'https://www.movento.es/es/contacto'],
  [L('OpenStreetMap · 建筑、道路、市界与海岸线（ODbL），2026 年 9 月 30 日提取', 'OpenStreetMap · edificios, calles, límites municipales y costa (ODbL), extraídos el 30/09/2026'), 'https://www.openstreetmap.org/copyright'],
];
function renderSources() {
  $('#sourceList').innerHTML = SOURCES.map(s => `<p><a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a></p>`).join('') +
    `<p><b style="color:var(--ink)">${L('门店一线观察（待 CRM 验证）', 'Observaciones comerciales (pendientes de validar con el CRM)')}</b><br>${L('Badalona 商圈已有华人客户使用 BYD；原奔驰、宝马、奥迪车主转向以特斯拉为主的电动车；Montgat 以北滨海片区住有较高购买力的华商家庭。', 'Clientes chinos de Badalona que ya conducen BYD; antiguos propietarios de Mercedes, BMW y Audi que se pasan al eléctrico, sobre todo a Tesla; familias de empresarios chinos con alto poder adquisitivo en el litoral al norte de Montgat.')}</p>`;
}

/* ------------------------------------------------------------------ sheets */
const fact = (items) => `<div class="fact">${items.map(([b, s]) => `<div><b class="num">${b}</b><span>${s}</span></div>`).join('')}</div>`;
const ul = (arr) => `<ul>${arr.map(x => `<li>${x}</li>`).join('')}</ul>`;
const head = (lab, h, intro) => `<p class="lab">${lab}</p><h2 id="sheetTitle">${h}</h2>${intro ? `<p class="intro">${intro}</p>` : ''}`;
const h5 = (zh, es) => `<h5>${L(zh, es)}</h5>`;

function incomeTable() {
  const rows = [...MUNIS].sort((a, b) => b.stats.rfdbIdx - a.stats.rfdbIdx);
  return `<div style="border:1px solid var(--hair);border-radius:18px;overflow:hidden;background:rgba(255,255,255,.7)">
    <div style="display:grid;grid-template-columns:1.4fr .8fr .6fr .8fr;gap:6px;padding:10px 14px;font-size:12px;color:var(--graphite);background:rgba(0,0,0,.03)"><span>${L('市镇', 'Municipio')}</span><span>${L('人均收入', 'Renta/hab.')}</span><span>${L('指数', 'Índice')}</span><span>${L('车/千人', 'Turismos/1.000')}</span></div>
    ${rows.map(m => `<div style="display:grid;grid-template-columns:1.4fr .8fr .6fr .8fr;gap:6px;padding:9px 14px;font-size:13.5px;border-top:1px solid var(--hair)" class="num"><span>${m.name}</span><span>€${fmt(m.stats.rfdb, lang)}</span><span style="color:${m.stats.rfdbIdx >= 100 ? 'var(--violet)' : 'var(--graphite)'};font-weight:600">${Math.round(m.stats.rfdbIdx)}</span><span>${fmt(m.stats.cars / m.stats.pop * 1000, lang)}</span></div>`).join('')}
  </div>`;
}

const persona = (o) => head(o.lab, o.h, o.intro) +
  (o.card ? `<div class="quote">${o.card}</div>` : '') +
  h5('他们需要什么', 'Qué necesitan') + ul(o.needs) +
  h5('他们会犹豫什么', 'Qué les frena') + ul(o.worries) +
  h5('什么时候会买', 'Cuándo compran') + ul(o.triggers) +
  h5('我们怎么说', 'Qué les decimos') + ul(o.say) +
  h5('推荐车型与触达渠道', 'Modelos y canales') + `<p>${o.models}</p>` +
  (o.note ? `<p class="src">${o.note}</p>` : '');

const SHEETS = {
  method: () => head(L('方法说明', 'Metodología'), L('这张点状地图是怎么画出来的', 'Cómo se ha construido este mapa de puntos'), L('参考经典的人口点状地图做法：每个点代表一定数量的人，落在真实的住宅建筑上，因此能看出城市肌理和人群分布。', 'Sigue la técnica clásica de los mapas de densidad de puntos: cada punto representa un número de personas y se sitúa sobre un edificio residencial real, de modo que se ve la trama urbana.')) +
    h5('步骤', 'Pasos') + ul([
      L('从 OpenStreetMap 提取研究范围内约 44,000 栋建筑，保留住宅类建筑约 35,900 栋。', 'Se extraen de OpenStreetMap unos 44.000 edificios de la zona y se conservan unos 35.900 residenciales.'),
      L('按“占地面积 × 楼层数”估算每栋楼的居住体量。', 'Se estima el volumen residencial de cada edificio como superficie × plantas.'),
      L('把 Idescat 2025 年各市镇总人口按体量比例分配到楼栋，再随机落点。', 'La población total de Idescat 2025 se reparte por edificio en proporción a ese volumen y se coloca al azar dentro de él.'),
      L('华人：Badalona 和 Santa Coloma 使用 Idescat 按普查区（districte censal）的中国籍人数，普查区边界来自 INE 2025 年普查分区图；其他市镇 Idescat 没有公布普查区数据，只能按全市比例分配。', 'Población china: en Badalona y Santa Coloma se usan las cifras de Idescat por distrito censal, con los límites de la cartografía de secciones censales del INE 2025; en el resto de municipios Idescat no publica este detalle y se reparte con la proporción municipal.'),
      L('Badalona Sud 的 300 个蓝点，按园区内工业建筑面积分布，代表“300 多家企业”这一总数，不是每家公司的真实地址。', 'Los 300 puntos azules de Badalona Sud se reparten por la superficie industrial del polígono. Representan la cifra total de “más de 300 empresas”, no la dirección de cada una.'),
    ]) +
    h5('需要知道的局限', 'Limitaciones') + ul([
      L('Idescat 统计的是中国国籍。已入籍的华人和在西班牙出生的二代不在其中，实际社群更大。', 'Idescat cuenta nacionalidad china. Quienes se han nacionalizado y la segunda generación nacida en España no aparecen, así que la comunidad real es mayor.'),
      L('普查区（或市镇）内部仍按住宅体量平均分配，不代表某条街真的更集中。官方数据没有更细的中国籍统计。', 'Dentro de cada distrito (o municipio) el reparto sigue siendo proporcional al volumen residencial; no indica concentraciones reales por calle. No hay datos oficiales más finos.'),
      L('因此加了“门店一线观察”图层（绿圈），标出统计看不到、但门店确认的聚集点，例如 Hamelin 国际学校周边。以后发现新的点可以继续加。', 'Por eso existe la capa “Observación del concesionario” (círculos verdes): zonas que la estadística no recoge pero que el concesionario conoce, como el entorno del colegio Hamelin. Se pueden añadir más.'),
      L('红点与灰点比例不同（1 点 = 3 人 vs 1 点 = 10 人），是为了让华人分布看得清楚。', 'Los puntos rojos y grises tienen escalas distintas (3 frente a 10 personas) para que la distribución china sea visible.'),
      L('Barcelona 等研究范围外的市镇只画浅灰色背景点。', 'Barcelona y otros municipios fuera de la zona solo aparecen como puntos grises de fondo.'),
    ]),
  income: () => head(L('购买力 · 官方数据', 'Poder de compra · datos oficiales'), L('门店往北，收入和汽车保有量同时上升', 'Hacia el norte, suben la renta y el número de coches'), L('Idescat 人均家庭可支配收入（2023，暂定）与乘用车保有量（2024）。加泰罗尼亚平均 = 100。', 'Renta familiar disponible bruta por habitante de Idescat (2023, provisional) y parque de turismos (2024). Media de Cataluña = 100.')) +
    incomeTable() +
    h5('怎么解读', 'Cómo leerlo') + ul([
      L('Montgat 以北的 Tiana、Teià、Alella、Premià de Dalt，人均收入比加泰平均高 27%–70%，每千人约 470–510 辆车。', 'Al norte de Montgat, Tiana, Teià, Alella y Premià de Dalt superan la media catalana entre un 27 % y un 70 %, con 470–510 turismos por cada 1.000 habitantes.'),
      L('Badalona 和 Santa Coloma 收入低于平均，但这是全体居民的平均数。批发、进出口老板的购买力来自生意，不在这组居民收入数据里体现。', 'Badalona y Santa Coloma están por debajo de la media, pero es la media de toda la población. El poder de compra de los mayoristas e importadores viene de su negocio y no se refleja en este indicador.'),
      L('门店正好位于“生意在 Badalona、家在滨海走廊”这条通勤线上。', 'El concesionario está justo en el trayecto de quien trabaja en Badalona y vive en el corredor costero.'),
    ]) + `<p class="src">${L('来源：Idescat EMEX，2026 年 9 月查询。', 'Fuente: Idescat EMEX, consulta de septiembre de 2026.')}</p>`,
  brand: () => head(L('品牌认同', 'Afinidad de marca'), L('不需要解释 BYD 是谁', 'No hace falta explicar quién es BYD'), L('对西班牙本地客户，BYD 还是一个需要教育的新品牌；对华人客户，它是在国内人尽皆知的第一品牌。这让我们的沟通成本低得多。', 'Para el cliente español BYD todavía es una marca nueva que hay que explicar; para el cliente chino es la marca líder que todo el mundo conoce en China. Eso reduce mucho el coste de convencer.')) +
    fact([['4,602,436', L('BYD 2025 年全球新能源车销量', 'Ventas mundiales de BYD en 2025')], ['25,552', L('BYD 西班牙 2025 注册量（+373.7%）', 'Matriculaciones en España 2025 (+373,7 %)')], ['10,366', L('SEAL U 2025 年西班牙插混销量第一', 'SEAL U, PHEV más vendido de España en 2025')], ['26,757', L('2026 年 1–7 月，已超 2025 全年', 'Enero–julio 2026, más que todo 2025')]]) +
    h5('为什么华人更容易接受', 'Por qué la comunidad china lo acepta antes') + ul([
      L('在国内亲眼见过、坐过、身边人开过，信任是现成的。', 'Lo han visto, lo han probado o lo conduce alguien cercano en China: la confianza ya existe.'),
      L('中国品牌在海外成功，带有天然的认同感和自豪感。', 'El éxito de una marca china en el extranjero genera identificación y orgullo.'),
      L('国内车型和配置信息全都能用中文查到，决策更快。', 'Toda la información de modelos y equipamiento está disponible en chino, lo que acelera la decisión.'),
    ]) +
    h5('所以我们的话术是', 'Por eso nuestro mensaje es') + `<div class="quote">${L('国内的品牌，西班牙的本地服务：买车、上牌、保养，全程中文。', 'La marca que conoces de China, con servicio local en España: compra, matriculación y mantenimiento, todo en chino.')}</div>`,
  field: () => head(L('门店一线观察', 'Observación comercial'), L('购买意愿已经存在', 'La intención de compra ya existe'), L('以下来自门店和社区的日常观察，方向明确，但还没有系统数据。试点的一个目标，就是把它变成数据。', 'Estas observaciones vienen del día a día del concesionario y de la comunidad. La dirección es clara, pero aún no hay datos sistemáticos; convertirlas en datos es uno de los objetivos del piloto.')) +
    h5('我们看到的', 'Lo que vemos') + ul([
      L('Badalona 商圈里不少华人客户已经在开 BYD。', 'Muchos clientes chinos de Badalona ya conducen un BYD.'),
      L('大量原奔驰、宝马、奥迪车主已经换成新能源，其中以特斯拉为主。', 'Muchos antiguos propietarios de Mercedes, BMW y Audi ya se han pasado al eléctrico, sobre todo a Tesla.'),
      L('这说明这群人买得起、也愿意换新能源；我们要争取的是“下一次换车”。', 'Pueden permitírselo y están dispuestos a cambiar; nuestro objetivo es su próximo cambio de coche.'),
    ]) +
    h5('试点中怎么验证', 'Cómo lo validamos') + ul([
      L('每位华人到店客户登记“现在开什么车”和“车是公司名义还是个人名义”。', 'Registrar en cada visita qué coche tiene ahora y si está a nombre de empresa o particular.'),
      L('记录置换车品牌，统计 BBA 与特斯拉占比。', 'Anotar la marca del vehículo de cambio y medir el peso de BMW, Mercedes, Audi y Tesla.'),
      L('试驾后做 3 分钟访谈：为什么考虑 BYD，谁参与决定。', 'Tras la prueba, una entrevista de 3 minutos: por qué BYD y quién participa en la decisión.'),
    ]),
  'p-boss': () => persona({
    lab: L('主攻客群 · 约 70% 精力', 'Perfil prioritario · 70 % del esfuerzo'),
    h: L('生意老板', 'Empresarios'),
    intro: L('包括 Badalona Sud 的批发与进出口商、Fondo 和 Badalona 的餐饮、零售、美容店主，以及物流与服务业老板。', 'Incluye mayoristas e importadores de Badalona Sud, dueños de restaurantes, tiendas y centros de estética en Fondo y Badalona, y empresarios de logística y servicios.'),
    card: L('典型画像（虚构）：陈总，46 岁，在 Badalona Sud 做服装批发 15 年，家住 Montgat，两个孩子。现在开一台开了五年的奔驰 GLE，公司名下还有一辆货车。朋友圈里好几个同行已经换了特斯拉。', 'Perfil tipo (ficticio): el Sr. Chen, 46 años, mayorista textil en Badalona Sud desde hace 15 años, vive en Montgat y tiene dos hijos. Conduce un Mercedes GLE de cinco años y la empresa tiene una furgoneta. Varios conocidos del sector ya se han pasado a Tesla.'),
    needs: [L('面子：车就是生意的门面，不能比原来的 BBA 差。', 'Imagen: el coche es la tarjeta de visita del negocio; no puede ser peor que su BMW, Mercedes o Audi.'), L('空间：家人、样品、货物都要装得下。', 'Espacio para familia, muestras y mercancía.'), L('手续省心：公司名义购车、金融、上牌，一次讲清楚。', 'Trámites sencillos: compra a nombre de la empresa, financiación y matriculación explicadas de una vez.'), L('售后不耽误生意：保养快，有中文联系人。', 'Posventa que no pare el negocio: mantenimiento rápido y un contacto en chino.')],
    worries: [L('电车残值和充电方便不方便。', 'Valor residual y facilidad de carga.'), L('西班牙的售后网络靠不靠谱。', 'Si la red de posventa en España es fiable.'), L('税务上公司买还是个人买更划算。', 'Si fiscalmente conviene comprar como empresa o como particular.')],
    triggers: [L('旧车到换车周期（3–5 年）。', 'Fin del ciclo de su coche actual (3–5 años).'), L('年底公司做账前。', 'Antes del cierre contable de fin de año.'), L('同行或商会朋友推荐。', 'Recomendación de colegas o de la asociación.'), L('春节前“新年新车”。', 'Antes del Año Nuevo chino: coche nuevo para el año nuevo.')],
    say: [L('“国内的旗舰，西班牙的本地服务。”', '“El buque insignia que conoces de China, con servicio local.”'), L('“DM-i 插混：回国、跑长途，不用担心续航。”', '“Híbrido enchufable DM-i: viajes largos sin preocuparte por la autonomía.”'), L('“公司名义怎么买、怎么抵，我们请 Gestoría 一次讲清。”', '“Cómo comprar a nombre de la empresa y cómo deducirlo: te lo explica una gestoría.”')],
    models: L('SEALION 7（首推，对标 Model Y 与 BBA 中型 SUV）· SEAL U DM-i（没有续航焦虑）· ATTO 8（新一代唐，即将上市，可先登记意向）。店主的第二台车可以看 SEAL 6 DM-i。渠道：商会、微信与视频号、老客户转介绍。', 'SEALION 7 (principal, frente a Model Y y SUV medios alemanes) · SEAL U DM-i (sin ansiedad de autonomía) · ATTO 8 (el nuevo Tang, próximo lanzamiento: apuntar interesados). Para el segundo coche del negocio, SEAL 6 DM-i. Canales: asociaciones, WeChat y recomendaciones.'),
    note: L('画像为基于门店观察的虚构组合，用于统一团队认知，需通过试点访谈修正。', 'Perfil ficticio construido a partir de observaciones del concesionario; se ajustará con las entrevistas del piloto.'),
  }),
  'p-family': () => persona({
    lab: L('次要客群', 'Perfil secundario'), h: L('创一代家庭', 'Familias de primera generación'),
    intro: L('在西班牙打拼多年、事业稳定的家庭，很多住在 Montgat、Masnou、Tiana 等滨海或山边住宅区。', 'Familias asentadas tras años en España; muchas viven en Montgat, El Masnou, Tiana y otras zonas residenciales del litoral.'),
    needs: [L('从 BBA 换新能源，不想降级。', 'Pasar al eléctrico sin perder categoría.'), L('全家出行的空间与安全。', 'Espacio y seguridad para toda la familia.'), L('孩子上学、周末出游的日常便利。', 'Comodidad para el colegio y las escapadas.')],
    worries: [L('家里没有充电桩怎么办。', 'Qué hacer si no tienen cargador en casa.'), L('配偶或孩子的意见。', 'La opinión de la pareja o los hijos.')],
    triggers: [L('家庭成员增加或孩子开始上学。', 'Nace un hijo o empieza el colegio.'), L('朋友圈里有人换了 BYD。', 'Alguien de su entorno se compra un BYD.')],
    say: [L('“国内同款，全家都熟悉。”', '“El mismo modelo que en China: toda la familia lo conoce.”'), L('“周末带全家来试驾，孩子有专门的活动。”', '“Venid el fin de semana a probarlo; hay actividad para los niños.”')],
    models: L('SEALION 7 · SEAL U / SEAL U DM-i · ATTO 8（人口多的家庭）。渠道：小红书（做功课）、老客户转介绍。', 'SEALION 7 · SEAL U / SEAL U DM-i · ATTO 8 (familias numerosas). Canales: Xiaohongshu (investigación) y recomendaciones.'),
  }),
  'p-young': () => persona({
    lab: L('次要客群', 'Perfil secundario'), h: L('华人二代与年轻职场人', 'Segunda generación y jóvenes profesionales'),
    intro: L('在西班牙长大或来读书、工作的年轻华人，双语，习惯同时看小红书和 Google 评价。第一台车往往由父母参与出资和决策。', 'Jóvenes chinos que crecieron, estudian o trabajan en España. Bilingües, consultan Xiaohongshu y las reseñas de Google. En el primer coche los padres suelen pagar o decidir.'),
    needs: [L('颜值和科技感。', 'Diseño y tecnología.'), L('价格合适，月供可控。', 'Precio razonable y cuota mensual asumible.'), L('能说服父母的理由：安全、品牌、售后。', 'Argumentos para convencer a los padres: seguridad, marca y posventa.')],
    worries: [L('预算有限，和二手特斯拉比较。', 'Presupuesto limitado; lo comparan con un Tesla de segunda mano.')],
    triggers: [L('拿到驾照或开始第一份工作。', 'Sacarse el carnet o empezar a trabajar.'), L('家里换车，旧车给孩子或买第二台。', 'La familia cambia de coche y compra un segundo.')],
    say: [L('“国内同学都在开的车，在这里也有人用中文帮你搞定。”', '“El coche que conducen tus amigos en China, con alguien que te lo gestiona en chino.”')],
    models: L('ATTO 2 · DOLPHIN SURF · SEAL（对标 Model 3）。渠道：小红书、抖音，第三阶段加学生会与年轻社群。', 'ATTO 2 · DOLPHIN SURF · SEAL (frente al Model 3). Canales: Xiaohongshu y Douyin; en la fase 3, asociaciones de estudiantes.'),
  }),
  'p-network': () => head(L('放大器', 'Multiplicadores'), L('先赢得这些人的信任', 'Primero, ganarse a estas personas'), L('华人圈是熟人社会，决策高度依赖“谁推荐的”。这些节点本身不一定买车，但能带来一批客户。', 'La comunidad china funciona por confianza personal: importa mucho quién recomienda. Estas personas no siempre compran, pero atraen a muchos clientes.')) +
    h5('关键节点', 'Contactos clave') + ul([
      L('<b>商会与同乡会会长</b>：组织商会专场；第二阶段合作会员礼遇。', '<b>Presidentes de asociaciones</b>: organizan visitas exclusivas; en la fase 2, ventajas para socios.'),
      L('<b>商会内部的 Gestoría</b>：很多商会自带会计与税务服务，可以合办企业购车说明会。', '<b>Gestorías de las asociaciones</b>: muchas asociaciones tienen su propia gestoría; con ellas se organiza la sesión fiscal.'),
      L('<b>华人驾校</b>：中国驾照不能在西班牙直接换领，新移民需要重新考照，驾校学员就是未来的新车买家。', '<b>Autoescuelas chinas</b>: el carnet chino no se puede canjear en España, así que los recién llegados deben sacárselo; sus alumnos son los futuros compradores.'),
      L('<b>老客户</b>：每一位满意的华人车主，都会在微信群和朋友圈里被问“开得怎么样”。', '<b>Clientes actuales</b>: cada propietario chino satisfecho recibe preguntas en sus grupos de WeChat.'),
    ]),
  xhs: () => head('小红书 · Xiaohongshu', L('研究与信任：第一优先级', 'Investigación y confianza: primera prioridad'), L('给西班牙同事的类比：Instagram 的图文 + Pinterest 的收藏 + Google 评价的口碑。汽车是高决策成本产品，用户会反复搜索、收藏、比较。', 'Para el equipo español: las fotos de Instagram, el guardado de Pinterest y la credibilidad de las reseñas de Google. El coche es una compra meditada: se busca, se guarda y se compara.')) +
    h5('要占住的搜索词', 'Búsquedas que queremos ocupar') + `<div class="models" style="display:flex;flex-wrap:wrap;gap:6px">${['巴塞罗那买BYD', '西班牙买车', 'BYD SEAL U 西班牙', '西班牙电车充电', 'BYD 保养', '西班牙公司买车', 'Badalona BYD'].map(k => `<span class="pill">${k}</span>`).join('')}</div>` +
    h5('内容', 'Contenidos') + ul([
      L('攻略：在西班牙买车全流程、公司名义与个人名义的区别、上牌与保险。', 'Guías: proceso de compra en España, empresa frente a particular, matriculación y seguro.'),
      L('对比：SEAL U DM-i 与国内版本的配置差异。', 'Comparativas: SEAL U DM-i frente a la versión china.'),
      L('真实车主：交车分享（征得同意后）。', 'Propietarios reales: entregas compartidas con su permiso.'),
    ]) + h5('节奏与衡量', 'Ritmo y medición') + `<p>${L('每周 1–2 篇图文。看收藏数、私信数、通过小红书二维码加微信的人数。', '1–2 publicaciones por semana. Medimos guardados, mensajes privados y contactos de WeChat que llegan desde su QR.')}</p>`,
  douyin: () => head('抖音 · Douyin', L('曝光与人物感', 'Alcance y cercanía'), L('类比：面向华人的 TikTok。作用是扩大漏斗入口，让更多人知道“这里有一家 BYD，而且有人讲中文”。', 'Es el TikTok del público chino. Sirve para ampliar la entrada del embudo: que se sepa que aquí hay un BYD y alguien que habla chino.')) +
    fact([['15–30s', L('新车与功能亮点', 'Novedades y funciones')], ['30–60s', L('BYD 工作日记', 'Un día en BYD')], ['Q&A', L('客户真实问题', 'Preguntas reales')], [L('幕后', 'Backstage'), L('交车、Taller、准备过程', 'Entregas, taller y preparación')]]) +
    h5('衡量', 'Medición') + `<p>${L('看播放完成率和主页访问，重点是有多少人点进主页、再加微信。', 'Tasa de visualización completa y visitas al perfil; lo importante es cuántos acaban añadiéndonos en WeChat.')}</p>`,
  wechat: () => head('微信 · 视频号', L('沟通、成交与转介绍', 'Conversación, venta y recomendación'), L('类比：WhatsApp + Instagram Stories + 行业群组的合体。微信及 WeChat 合并月活超过 14 亿，几乎每位华人客户都在用。', 'Es WhatsApp, Stories de Instagram y los grupos profesionales a la vez. Weixin y WeChat superan los 1.400 millones de usuarios activos mensuales; prácticamente todos nuestros clientes chinos lo usan.')) +
    h5('怎么用', 'Cómo lo usamos') + ul([
      L('<b>个人微信</b>：所有平台的咨询最终加到这里，一对一跟进报价与试驾。', '<b>WeChat personal</b>: todas las consultas acaban aquí para el seguimiento individual de ofertas y pruebas.'),
      L('<b>视频号</b>：交车、活动视频可以一键转发到商会群和朋友圈，是转介绍的载体。', '<b>WeChat Channels</b>: vídeos de entregas y eventos que se reenvían con un clic a grupos y al muro personal; el vehículo de las recomendaciones.'),
      L('<b>朋友圈</b>：新车到店、活动预告、客户交车，保持存在感。', '<b>Momentos</b>: llegadas de coches, eventos y entregas para mantener presencia.'),
    ]) + `<p class="src">${L('月活数据来源：腾讯。', 'Fuente de usuarios: Tencent.')}</p>`,
  'acc-personal': () => head(L('个人号', 'Cuenta personal'), L('“这里真的有人懂我”', '“Aquí alguien me entiende”'), L('客户的心理是：我不是在看广告，我可以直接找这个人问问题，他懂西班牙的买车流程。', 'El cliente piensa: no es un anuncio, puedo preguntarle directamente a esta persona, que conoce los trámites en España.')) +
    h5('内容', 'Contenidos') + ul([L('“在 BYD 上班的一天”', '“Un día trabajando en BYD”'), L('“一分钟讲清一个购车问题”', '“Una duda de compra en un minuto”'), L('“今天客户问了我……”', '“Hoy un cliente me ha preguntado…”'), L('“带你看我们的 Taller”', '“Te enseño nuestro taller”')]) +
    h5('边界', 'Límites') + `<p>${L('价格与优惠只说门店公开的内容；个人号内容由本人把关，官方号内容与 Marketing 同步。', 'Precios y ofertas solo los públicos del concesionario. El empleado gestiona su cuenta personal; la cuenta oficial se coordina con Marketing.')}</p>`,
  'acc-official': () => head(L('官方号', 'Cuenta oficial'), L('“Movento 真的重视华人客户”', '“Movento se toma en serio a la comunidad china”'), L('证明这不是员工个人行为，而是公司支持的中文服务入口。内容要从华人视角重新策划，而不是把西语帖子翻译一遍再加一句“春节快乐”。', 'Demuestra que es un servicio en chino respaldado por la empresa. Los contenidos se piensan desde la perspectiva china, no se traducen del español añadiendo “feliz Año Nuevo”.')) +
    h5('节日日历', 'Calendario de fiestas') + fact([
      [L('11 月 11 日', '11 nov'), L('双十一 · 试点期内', 'Día del Soltero · durante el piloto')],
      [L('12 月 21 日', '21 dic'), L('冬至 · 试点期内', 'Solsticio de invierno · durante el piloto')],
      [L('2027 年 2 月 6 日', '6 feb 2027'), L('春节 · 第二阶段重点', 'Año Nuevo chino · clave en la fase 2')],
      [L('2027 年 2 月 20 日', '20 feb 2027'), L('元宵节', 'Festival de los Faroles')],
      [L('2027 年 6 月 9 日', '9 jun 2027'), L('端午节', 'Festival del Barco Dragón')],
      [L('2027 年 9 月 15 日', '15 sep 2027'), L('中秋节', 'Festival del Medio Otoño')],
    ]) + h5('四类内容', 'Cuatro tipos de contenido') + ul([L('品牌：我们是谁、团队、营业时间', 'Marca: quiénes somos, equipo, horario'), L('车型：新车、活动、试驾', 'Producto: modelos, eventos, pruebas'), L('服务：Taller、保养、常见问题', 'Servicio: taller, mantenimiento, FAQ'), L('文化：中国节日、社区、原生中文', 'Cultura: fiestas chinas, comunidad, chino nativo')]),
  store: () => head('Movento BYD Badalona', L('门店已经具备的资产', 'Lo que el concesionario ya tiene'), L('Carrer de l\'Acer 2, 08915 Badalona（Les Guixeres）。试点不需要新增人手或场地。', 'Carrer de l\'Acer 2, 08915 Badalona (Les Guixeres). El piloto no requiere más personal ni espacio.')) +
    fact([[L('中国员工', 'Empleado chino'), L('可用中文直接连接客户', 'Atiende directamente en chino')], [L('真实展厅', 'Exposición'), L('持续产出车型与交付内容', 'Contenido continuo de modelos y entregas')], ['Taller', L('把关系延伸到购车之后', 'La relación continúa tras la compra')], [L('低启动成本', 'Bajo coste'), L('用现有资源先验证', 'Validar con recursos existentes')]]) +
    h5('地理位置', 'Ubicación') + `<p>${L('距 Badalona Sud 园区约 3 km，距 Santa Coloma 约 4 km，距 Montgat 约 3 km，正好在“园区工作、滨海居住”的通勤线上。', 'A unos 3 km del polígono Badalona Sud, 4 km de Santa Coloma y 3 km de Montgat: justo en el trayecto entre el trabajo en el polígono y la vivienda en la costa.')}</p>`,
  bsud: () => head(L('Badalona Sud 工业园区', 'Polígono Badalona Sud'), L('西班牙第二大华人企业聚集园区', 'El segundo polígono de España con más empresas chinas'), L('Badalona 市长 2026 年 8 月在中国访问时公开表示，园区内有 300 多家中国企业。', 'El alcalde de Badalona afirmó en agosto de 2026, durante su visita a China, que el polígono reúne más de 300 empresas chinas.')) +
    fact([['300+', L('华人企业', 'Empresas chinas')], [L('第 2', '2º'), L('全西班牙园区排名', 'Polígono de España')], ['~3 km', L('距门店', 'Al concesionario')], [L('B2B + B2C', 'B2B + B2C'), L('老板本人与公司用车', 'Coche del empresario y de la empresa')]]) +
    h5('为什么重要', 'Por qué importa') + ul([
      L('一个园区里集中了几百位决策快、有购车能力的老板。', 'Cientos de empresarios con capacidad de compra y decisión rápida en un mismo lugar.'),
      L('老板之间高度互相认识，一台车交付就是一次口碑传播。', 'Se conocen entre ellos: cada entrega es publicidad boca a boca.'),
      L('第三阶段可延伸到公司车队与 Taller 上门取送车。', 'En la fase 3 se puede ampliar a flotas y a la recogida para el taller.'),
    ]) + `<p class="src">${L('地图上的蓝点按园区工业建筑分布示意，不是企业真实地址。', 'Los puntos azules del mapa se reparten por los edificios industriales del polígono y no son direcciones reales.')}</p>`,
};
SHEETS['field-hamelin'] = () => head(L('门店一线观察', 'Observación del concesionario'), L('Hamelin 国际学校周边', 'Alrededores del colegio Hamelin'), FIELD[0].d) +
  h5('为什么统计里看不出来', 'Por qué no aparece en la estadística') + `<p>${L('Montgat 只有一个普查区，Idescat 只公布全市 276 名中国籍居民，地图只能把他们平均分到全市住宅楼上。另外入籍华人和二代不计入“中国国籍”。', 'Montgat tiene un solo distrito censal: Idescat solo publica 276 residentes chinos para todo el municipio, así que el mapa los reparte por igual. Además, los nacionalizados y la segunda generación no cuentan como nacionalidad china.')}</p>` +
  h5('对我们的意义', 'Qué significa para nosotros') + ul([L('国际学校的家长群是高购买力家庭的集中入口，适合创一代家庭画像。', 'Los padres de un colegio internacional son un acceso directo a familias con alto poder adquisitivo: perfil de familias de primera generación.'), L('离门店约 3.5 km，接送孩子的路线经过门店附近。', 'Está a unos 3,5 km del concesionario, en la ruta diaria al colegio.'), L('后续可以考虑家长活动或周末亲子试驾（第二阶段评估）。', 'Más adelante, actividades para padres o pruebas en familia el fin de semana (a valorar en la fase 2).')]);
const ORGS = [
  ['温州总商会', 'Cámara de Comercio de Wenzhou', ''],
  ['西班牙侨商总会', 'Asociación de Empresarios Chinos de Ultramar en España', ''],
  ['西班牙华侨华人社团联谊总会', 'Federación de Asociaciones Chinas en España', L('会长在政府关系方面影响力更大：适合官方活动与背书，而不是直接卖车。', 'Su presidente tiene más peso en relaciones institucionales que en lo comercial: útil para actos oficiales y respaldo, no para venta directa.')],
  ['西班牙妇女联谊总会', 'Asociación de Mujeres Chinas en España', L('内部有律所 / Gestoría 资源：第二阶段企业购车说明会的合作候选。', 'Cuenta con despacho de abogados o gestoría: candidata para la sesión fiscal de la fase 2.')],
  ['浙江总商会', 'Cámara de Comercio de Zhejiang', ''],
  ['欧洲福建联盟闽商总会', 'Asociación Europea de Empresarios de Fujian', ''],
  ['西班牙华人山东总会', 'Asociación de Shandong en España', ''],
  ['西班牙深圳总商会', 'Cámara de Comercio de Shenzhen en España', ''],
  ['一峰律师事务所', 'Despacho de abogados Yifeng', L('律所：公司与法律事务，可作为说明会或手续咨询的合作方。', 'Despacho de abogados: posible colaborador para sesiones informativas y trámites.')],
];
SHEETS.orgs = () => head(L('参考名单', 'Referencia'), L('有影响力的华人社团与机构', 'Asociaciones e instituciones chinas con influencia'), L('名单由门店提供，用来让公司了解华人圈有哪些重要节点。接触顺序与合作方式在第一阶段拜访后确定。', 'Lista aportada por el concesionario para que la empresa conozca los principales nodos de la comunidad. El orden de contacto y la colaboración se decidirán tras las visitas de la fase 1.')) +
  `<div style="display:grid;gap:8px">${ORGS.map(o => `<div style="background:rgba(255,255,255,.75);border:1px solid var(--hair);border-radius:18px;padding:12px 16px"><b style="font-size:16px">${o[0]}</b><div style="font-size:13px;color:var(--graphite)">${o[1]}</div>${o[2] ? `<div style="font-size:14px;margin-top:6px">${o[2]}</div>` : ''}</div>`).join('')}</div>` +
  `<p class="src">${L('西语名称为描述性翻译，正式名称以各机构为准。', 'Los nombres en español son traducciones descriptivas; prevalece el nombre oficial de cada entidad.')}</p>`;
const CASE = (lab, h, intro, facts, what, learn, src) => head(lab, h, intro) + fact(facts) + h5('他们怎么做', 'Cómo lo hacen') + ul(what) + h5('对我们的启发', 'Qué aprendemos') + ul(learn) + `<p class="src">${src}</p>`;
SHEETS['case-nio'] = () => CASE(L('案例 · 中国 · 小红书', 'Caso · China · Xiaohongshu'), L('蔚来：三层账号矩阵', 'NIO: tres niveles de cuentas'),
  L('蔚来在小红书搭了完整的账号矩阵：总部官方号、区域门店号、销售个人号（KOS，即“关键意见销售”）。', 'NIO montó en Xiaohongshu una estructura completa: cuenta oficial, cuentas de tiendas por región y cuentas personales de sus comerciales (KOS, “key opinion sales”).'),
  [['160+', L('位销售在小红书卖出了车', 'comerciales vendieron desde Xiaohongshu')], ['~1,000', L('台车累计成交', 'coches vendidos')], [L('4.5 亿+', '450 M+'), L('元营收', 'yuanes de facturación')], ['9×', L('搜索带来的线索锁单率是浏览的 9 倍', 'conversión de contactos por búsqueda frente a navegación')]],
  [L('销售真人出镜分享新车和用车，客户直接私信一对一咨询。', 'Los comerciales dan la cara, enseñan coches y responden por mensaje privado.'), L('总部给笔记创作指导，并按层级给激励。', 'La central da pautas de contenido e incentivos por niveles.'), L('线索成本从千元级降到百元以内（2023 年初至 2024 年 8 月）。', 'El coste por contacto bajó de miles a menos de cien yuanes (de inicios de 2023 a agosto de 2024).')],
  [L('员工个人号本身就能卖车，这正是我们“个人号”的角色。', 'La cuenta personal de un empleado vende por sí misma: es el papel de nuestra cuenta personal.'), L('搜索流量质量最高，所以小红书放在第一优先级。', 'El tráfico de búsqueda es el de mayor calidad: por eso Xiaohongshu es la primera prioridad.')],
  L('来源：数英网 · 蔚来小红书 KOS 案例', 'Fuente: Digitaling · caso NIO en Xiaohongshu'));
SHEETS['case-lsh'] = () => CASE(L('案例 · 澳大利亚 · 微信 + 小红书', 'Caso · Australia · WeChat + Xiaohongshu'), L('利星行：奔驰经销商经营华人社媒', 'LSH Auto: concesionario Mercedes-Benz para la comunidad china'),
  L('LSH Auto Australia 是利星行集团旗下的奔驰零售集团，在墨尔本、悉尼、布里斯班有 9 家门店，专门为澳洲华人运营微信和小红书。', 'LSH Auto Australia, del grupo Lei Shing Hong, tiene 9 puntos de venta Mercedes-Benz en Melbourne, Sídney y Brisbane, y gestiona WeChat y Xiaohongshu para la comunidad china australiana.'),
  [['1', L('集团官方号（微信公众号）', 'cuenta oficial del grupo (WeChat)')], ['3 + 3', L('奔驰门店 + smart 展厅', 'concesionarios Mercedes + tiendas smart')], [L('每周', 'Semanal'), L('内容更新', 'publicación')], [L('双语', 'Bilingüe'), L('内容日历', 'calendario de contenidos')]],
  [L('新车上市、门店活动、售后指南，每周一篇。', 'Lanzamientos, eventos y guías de posventa cada semana.'), L('奔驰做高端长内容，smart 做生活方式内容，按品牌区分语气。', 'Contenido largo y premium para Mercedes, estilo de vida para smart.'), L('强调母语内容和文化语境，而不是翻译。', 'Contenido nativo con contexto cultural, no traducciones.')],
  [L('在西方市场，豪华品牌经销商已经在专门服务华人客户，我们不是在做实验。', 'En mercados occidentales, concesionarios premium ya atienden específicamente a la comunidad china: no es un experimento.'), L('集团号 + 门店号的结构，和我们“官方号 + 个人号”思路一致。', 'La estructura grupo + concesionario coincide con nuestra “cuenta oficial + cuenta personal”.')],
  L('来源：Riseo（原 DC Groups）案例页，2024', 'Fuente: caso de Riseo (antes DC Groups), 2024'));
SHEETS['case-wuling'] = () => CASE(L('案例 · 中国 · 抖音', 'Caso · China · Douyin'), L('五菱：上千个经销商账号统一作战', 'Wuling: más de mil cuentas de concesionarios a la vez'),
  L('五菱把经销商账号组织成矩阵：品牌统一提供脚本、话术和时间表，各门店账号在本地开播和发布。', 'Wuling organizó a sus concesionarios en una red de cuentas: la marca da guiones, argumentario y calendario, y cada concesionario publica y emite en directo en local.'),
  [['1000+', L('经销商账号', 'cuentas de concesionarios')], ['18', L('天', 'días de campaña')], [L('1 亿+', '100 M+'), L('抖音传播', 'impactos en Douyin')], [L('春节', 'Año Nuevo'), L('节点主题', 'como tema')]],
  [L('品牌培训门店统一脚本、节奏和促销组合。', 'La marca forma a los concesionarios con guion, ritmo y ofertas comunes.'), L('春节主题活动，门店集中直播。', 'Campaña de Año Nuevo chino con directos coordinados.')],
  [L('品牌给素材、门店做本地执行的分工很有效：我们可以向 BYD 争取中文素材支持。', 'Funciona el reparto “la marca da material, el concesionario ejecuta en local”: podemos pedir a BYD material en chino.'), L('春节是最强的节点，对应我们第二阶段的“春节开门红”。', 'El Año Nuevo chino es la fecha más fuerte, como nuestra campaña de la fase 2.')],
  L('来源：数英网 · 知家 × 五菱，2024 年 1 月', 'Fuente: Digitaling · Zhijia × Wuling, enero de 2024'));

// journey sheets
const JDETAIL = [
  [L('抖音短视频与视频号内容，让人“刷到”我们。', 'Vídeos en Douyin y WeChat Channels para que nos encuentren.'), L('播放、主页访问', 'Reproducciones y visitas al perfil'), L('短视频每周 1–2 条；视频号同步发布。', '1–2 vídeos por semana, también en WeChat Channels.')],
  [L('小红书攻略与车主分享，回答“值不值得、怎么买”。', 'Guías y experiencias en Xiaohongshu que responden si vale la pena y cómo comprar.'), L('收藏、私信', 'Guardados y mensajes'), L('每篇结尾放个人微信二维码。', 'Cada publicación termina con el QR de WeChat.')],
  [L('所有平台的咨询都导到中国员工的微信，24 小时内回复。', 'Todas las consultas se dirigen al WeChat del empleado chino, con respuesta en 24 horas.'), L('新增微信咨询数', 'Nuevas consultas en WeChat'), L('CRM 中登记来源平台。', 'Se registra la plataforma de origen en el CRM.')],
  [L('预约到店，中文接待，准备好中文车型资料。', 'Visita con cita, atención y documentación en chino.'), L('预约数、到店数', 'Citas y visitas'), L('周末与晚间时段优先安排，老板白天忙生意。', 'Priorizar fines de semana y tardes: de día están en su negocio.')],
  [L('鼓励带家人或合伙人一起试驾，决策人都在场。', 'Invitar a venir con familia o socio para que estén todos los que deciden.'), L('试驾数', 'Pruebas'), L('试驾后做 3 分钟访谈。', 'Entrevista de 3 minutos tras la prueba.')],
  [L('报价、金融、公司名义手续由中国员工全程中文解释；复杂税务问题转给合作 Gestoría。', 'Oferta, financiación y trámites de empresa explicados en chino; las dudas fiscales complejas, a la gestoría colaboradora.'), L('报价数、成交数', 'Ofertas y ventas'), L('中式交车仪式，征得同意后拍成视频号内容。', 'Entrega al estilo chino, grabada para WeChat Channels con permiso.')],
  [L('Taller 保养提醒与中文预约；满意客户进入转介绍计划。', 'Recordatorios y citas de taller en chino; los clientes satisfechos entran en el plan de recomendación.'), L('转介绍成交数', 'Ventas por recomendación'), L('奖励：火腿礼盒或中餐宴请券，比购物卡更有面子。', 'Premio: jamón ibérico o cena en restaurante chino; más valorado que una tarjeta regalo.')],
];
JOURNEY.forEach((j, i) => {
  SHEETS['j' + i] = () => head(L(`客户旅程 · 第 ${i + 1} 步`, `Recorrido del cliente · paso ${i + 1}`), L(j.zh[0], j.es[0]), JDETAIL[i][0]) +
    h5('看什么数', 'Qué medimos') + `<p>${JDETAIL[i][1]}</p>` + h5('要点', 'Clave') + `<p>${JDETAIL[i][2]}</p>` +
    h5('平台', 'Plataformas') + `<div style="display:flex;gap:6px;flex-wrap:wrap">${j.plat.map(p => `<span class="pill">${p}</span>`).join('')}</div>`;
});
// model sheets
const MDETAIL = {
  sealion7: [L('生意老板、创一代家庭的首推。纯电 SUV 旗舰，空间与配置对标特斯拉 Model Y 和 BBA 中型 SUV。', 'Primera opción para empresarios y familias. SUV eléctrico de gama alta, frente al Model Y y los SUV medios alemanes.'), L('“从奔驰 GLE、宝马 X3 换过来，不是降级，是换了一个时代。”', '“Pasar de un GLE o un X3 no es bajar de categoría: es cambiar de época.”'), L('家里或公司有没有充电条件；残值担忧用 BYD 在欧洲的增长和质保回应。', 'Si puede cargar en casa o en la empresa; la duda del valor residual se responde con el crecimiento de BYD en Europa y la garantía.')],
  sealu: [L('2025 年西班牙最畅销的插电混动车（10,366 辆）。适合常跑长途、回国前后需要机场往返、家里暂时没有充电桩的客户。', 'El híbrido enchufable más vendido de España en 2025 (10.366 unidades). Para quien hace viajes largos, va a menudo al aeropuerto o aún no tiene cargador.'), L('“能充电就是电车，不能充就是省油车，没有续航焦虑。”', '“Si puedes cargar, es eléctrico; si no, gasta muy poco. Sin ansiedad de autonomía.”'), L('是置换老款中型 BBA SUV 的最稳妥选择。', 'La opción más segura para sustituir un SUV medio alemán antiguo.')],
  seal6: [L('插混轿车，入手价格低、油耗低，适合店主日常用车和公司第二台车。也有旅行版（Touring），但华人客户普遍更喜欢轿车和 SUV，旅行版不作主推。', 'Berlina híbrida enchufable, precio de entrada bajo y consumo mínimo: coche diario del comerciante o segundo coche de empresa. Existe versión familiar (Touring), pero el cliente chino prefiere berlinas y SUV, así que no es la apuesta principal.'), L('“每天跑批发市场、接送孩子，油钱省下来就是利润。”', '“Mercado, colegio y vuelta cada día: lo que ahorras en gasolina es beneficio.”'), L('适合 Fondo 和 Badalona 的店主。', 'Ideal para comerciantes de Fondo y Badalona.')],
  atto8: [L('新一代唐（国内 Tang L 的出口版），7 座全尺寸旗舰 SUV，有纯电和插混两种动力。据 Bloomberg 报道，BYD 计划 2026 年底到 2027 年初把它推向欧洲。对家里人口多、需要接待客人的老板，它是奔驰 GLE、宝马 X5、奥迪 Q7 的直接替代。', 'El nuevo Tang (versión de exportación del Tang L), SUV de 7 plazas de gama alta, eléctrico o híbrido enchufable. Según Bloomberg, BYD prevé llevarlo a Europa entre finales de 2026 y comienzos de 2027. Para empresarios con familia numerosa o que reciben clientes, es la alternativa directa al GLE, X5 o Q7.'), L('“国内的唐，终于来了。”', '“El Tang que conocen de China, por fin aquí.”'), L('试点期间可以先登记意向客户，上市时第一时间邀请试驾。上市时间和价格以 BYD España 公布为准。', 'Durante el piloto podemos apuntar a los interesados e invitarles a probarlo en cuanto llegue. Fecha y precio, según anuncie BYD España.')],
  seal: [L('纯电轿跑，颜值与驾驶感并重。面向二代和年轻专业人士，是特斯拉 Model 3 的直接替代。', 'Berlina eléctrica con diseño y dinámica. Para la segunda generación y jóvenes profesionales; alternativa directa al Model 3.'), L('“和 Model 3 同级，配置更满，国内同学都在开。”', '“Misma categoría que el Model 3, más equipamiento, y tus amigos en China ya lo conducen.”'), L('价格以门店报价为准。', 'Precio según oferta del concesionario.')],
  atto2: [L('2026 年 BYD 西班牙销量主力（1–7 月 9,946 辆）。适合第一台车、年轻家庭和店用。', 'El más vendido de BYD en España en 2026 (9.946 unidades de enero a julio). Primer coche, familias jóvenes o uso en el negocio.'), L('“入门价格，BYD 的品质和中文售后一样不少。”', '“Precio de entrada con la misma calidad BYD y posventa en chino.”'), L('有 DM-i 插混与纯电两种版本。', 'Disponible en versión DM-i y eléctrica.')],
  dolphin: [L('城市小车，适合家里的第二台车，或二代的第一台车。', 'Urbano; segundo coche familiar o primer coche de la segunda generación.'), L('“城里停车方便，每天通勤成本很低。”', '“Fácil de aparcar y muy barato para el día a día.”'), L('起售价 €12,955，是 BYD 在西班牙最低门槛的车型。', 'Desde 12.955 €, la entrada a la gama BYD en España.')],
};
const PERSONA_NAMES = [L('生意老板', 'Empresarios'), L('创一代家庭', 'Familias'), L('二代 · 年轻', 'Jóvenes'), L('店用 · 第二台', 'Negocio')];
MODELS.forEach(m => {
  SHEETS['m-' + m.id] = () => head(L('车型', 'Modelo'), m.n, MDETAIL[m.id][0]) +
    fact([[priceLabel(m), m.soon ? L('尚未在西班牙发布', 'Aún sin lanzamiento en España') : L('官网起售价（2026 年 9 月）', 'Precio desde (sept. 2026)')], [PERSONA_NAMES.filter((_, i) => m.fit[i] === 2).join(' · ') || '—', L('首推给', 'Recomendado para')]]) +
    h5('推荐话术', 'Argumento de venta') + `<div class="quote">${MDETAIL[m.id][1]}</div>` + `<p>${MDETAIL[m.id][2]}</p>` +
    `<p class="src">${L('价格来自 BYD España 官网，以门店报价为准。', 'Precios de la web de BYD España; prevalece la oferta del concesionario.')}</p>`;
});
// action sheets
const ADETAIL = {
  'a-setup': [L('先把基础设施搭好：账号认证、头像与简介统一，中文资料包可以直接发给客户。', 'Preparar la base: cuentas verificadas, perfil unificado y un dossier en chino listo para enviar.'), [L('开通小红书、抖音、视频号官方号与个人号', 'Crear cuentas oficiales y personales en Xiaohongshu, Douyin y WeChat Channels'), L('中文资料包：车型对比、价格区间、购车流程、Taller 预约方式', 'Dossier en chino: comparativa de modelos, precios, proceso de compra y citas de taller'), L('CRM 新增来源“华人社区”，每个平台一个二维码', 'Nuevo origen “Comunidad china” en el CRM y un QR por plataforma')]],
  'a-content': [L('稳定的节奏比爆款更重要。每周 3 条，分配到三个平台。', 'Más importa la constancia que el viral: 3 publicaciones semanales repartidas entre plataformas.'), [L('周一：小红书攻略或对比', 'Lunes: guía o comparativa en Xiaohongshu'), L('周三：抖音 / 视频号短视频', 'Miércoles: vídeo corto en Douyin y WeChat Channels'), L('周六：交车、活动或客户问答', 'Sábado: entrega, evento o preguntas de clientes')]],
  'a-chamber': [L('从关系开始，而不是从赞助开始。先了解商会需要什么，再谈合作。', 'Empezar por la relación, no por el patrocinio: entender qué necesita la asociación antes de proponer.'), [L('名单：Badalona 与 Santa Coloma 的华人商会、同乡会、行业协会', 'Lista: asociaciones chinas de Badalona y Santa Coloma, asociaciones de paisanos y sectoriales'), L('带上中文资料包，邀请会长到店参观', 'Llevar el dossier e invitar al presidente al concesionario'), L('了解商会内部是否有 Gestoría 等服务，为第二阶段做准备', 'Averiguar si la asociación tiene gestoría propia, pensando en la fase 2')]],
  'a-visit': [L('一个下午，10–20 位老板，参观展厅、试驾、看 Taller。', 'Una tarde con 10–20 empresarios: exposición, pruebas y taller.'), [L('茶歇配伊比利亚火腿，西班牙特色也是面子', 'Catering con jamón ibérico: lo local también da prestigio'), L('每人一次试驾，重点车型 SEALION 7 与 SEAL U DM-i；现场登记 ATTO 8 意向', 'Una prueba por persona, sobre todo SEALION 7 y SEAL U DM-i; lista de interesados en el ATTO 8'), L('活动照片与视频用于视频号，发到商会群', 'Fotos y vídeos para WeChat Channels y los grupos de la asociación')]],
  'a-day': [L('周末面向家庭，一次活动既能获客，又能产出好几周的线上内容。', 'Un fin de semana para familias: capta clientes y genera contenido para varias semanas.'), [L('Taller 开放，演示保养流程', 'Taller abierto con demostración de mantenimiento'), L('孩子有小活动，家人可以一起试驾', 'Actividad para niños y pruebas en familia'), L('现场扫码加微信，领取试驾礼品', 'Escanear el QR de WeChat en el acto y recibir un obsequio')]],
  'a-tbd': [L('第一阶段只锁定最必要、最便宜的动作。下面这些已经有想法，但等前 6 周的数据出来再决定做不做、怎么做。', 'La fase 1 solo fija lo imprescindible y más barato. Estas ideas ya están pensadas, pero se decidirán con los datos de las seis primeras semanas.'), [L('<b>华人试驾日</b>：周末、家庭友好、Taller 开放；一次活动能产出数周内容', '<b>Jornada de pruebas</b>: fin de semana, familias y taller abierto; contenido para varias semanas'), L('<b>华人版转介绍奖励</b>：成交后才发放，火腿礼盒或中餐宴请券', '<b>Plan de recomendación</b>: solo tras la venta, jamón ibérico o cena en restaurante chino'), L('<b>ATTO 8 意向登记</b>：新一代唐上市前先收集名单', '<b>Lista de interesados en el ATTO 8</b> antes de su llegada'), L('决定依据：哪个平台带来真实到店、商会反馈如何', 'Criterio: qué canal trae visitas reales y cómo responden las asociaciones')]],
  'a-referral': [L('对开奔驰、保时捷的老板来说，购物卡没有吸引力。奖励要有面子，也适合发朋友圈。', 'Para quien conduce un Mercedes o un Porsche, una tarjeta regalo no motiva. El premio tiene que dar prestigio y ser compartible.'), [L('老客户推荐新客户成交后发放', 'Se entrega cuando el recomendado compra'), L('选项：伊比利亚火腿礼盒，或高档中餐厅宴请券', 'Opciones: jamón ibérico o cena en un restaurante chino de categoría'), L('预算按成交计算，没有成交不产生费用', 'El coste depende de las ventas: sin venta, no hay gasto')]],
  'b-member': [L('第一阶段建立关系后，给商会会员一个“自己人”的理由。', 'Tras la fase 1, dar a los socios una razón para sentirse de casa.'), [L('会员专属购车礼遇（内容由品牌与门店政策确定）', 'Condiciones exclusivas para socios (según la política de marca y concesionario)'), L('会员优先 Taller 预约', 'Cita prioritaria en el taller'), L('商会年会或活动上的展车', 'Coche expuesto en eventos de la asociación')]],
  'b-gestoria': [L('很多商会内部有会计与税务服务。与他们合办说明会，老板来听的是“怎么省钱”，顺便试驾。', 'Muchas asociaciones tienen gestoría propia. Con ellas organizamos una sesión: los empresarios vienen a saber cómo ahorrar y de paso prueban el coche.'), [L('主题：公司或自雇名义购车的 IVA、折旧与当期电动车激励，由 Gestoría 按当期政策讲解', 'Tema: IVA, amortización e incentivos vigentes al comprar como empresa o autónomo, explicados por la gestoría'), L('地点在门店，听完直接试驾', 'En el concesionario, con pruebas al terminar'), L('Gestoría 也成为长期的转介绍节点', 'La gestoría se convierte en fuente de recomendaciones')]],
  'b-cny': [L('春节是华人一年中最重要的节点，“新年新车”是真实的购买动机。', 'El Año Nuevo chino es la fecha más importante del año y estrenar coche es un motivo real de compra.'), [L('春节前后的试驾季，配合中文内容倒计时', 'Temporada de pruebas alrededor del Año Nuevo, con cuenta atrás en chino'), L('中式交车仪式：红绸、合影、红包', 'Entregas al estilo chino: lazo rojo, foto y sobre rojo'), L('交车视频发视频号，客户转发即传播', 'Vídeos de entrega en WeChat Channels que los clientes comparten')]],
  'b-partner': [L('华人生活高度集中在少数超市、餐厅和服务场所。在这些地方出现，就能接触到线上接触不到的人。', 'La vida diaria se concentra en unos pocos supermercados, restaurantes y servicios. Estar ahí llega a quien no vemos en internet.'), [L('Fondo 与 Badalona 的华人超市、餐厅放置设计精美的台卡', 'Expositores cuidados en supermercados y restaurantes chinos de Fondo y Badalona'), L('扫码加微信预约试驾，领取小礼品', 'Escanear para reservar una prueba y recibir un obsequio'), L('每个合作点一个二维码，看哪里真的带来客户', 'Un QR por establecimiento para saber cuál trae clientes')]],
  'c-school': [L('中国驾照不能在西班牙直接换领，新移民需要在这里重新考照。驾校学员正处在“马上要买车”的阶段。', 'El carnet chino no se canjea en España: los recién llegados deben sacárselo aquí. Los alumnos están a punto de comprar coche.'), [L('与华人驾校合作，学员拿证后享试驾礼遇', 'Alianza con autoescuelas chinas: ventaja de prueba al aprobar'), L('驾校可用 BYD 车辆做宣传或教学（视合作方式）', 'Posible uso de coches BYD por la autoescuela (según el acuerdo)')]],
  'c-pickup': [L('老板最缺的是时间。上门取车保养，把 Taller 变成服务优势。', 'Al empresario le falta tiempo: recoger el coche para el taller convierte la posventa en ventaja.'), [L('先在 Badalona Sud 园区试点', 'Prueba primero en el polígono Badalona Sud'), L('中文预约与进度通知', 'Citas y avisos en chino')]],
  'c-fleet': [L('园区企业除了老板用车，还有员工与业务用车。', 'Además del coche del dueño, las empresas del polígono necesitan vehículos para empleados y operaciones.'), [L('与 Movento 企业销售团队联合跟进', 'Seguimiento conjunto con el equipo de empresas de Movento'), L('视 BYD 在西班牙的商用车供应情况决定', 'Según la oferta de vehículos comerciales de BYD en España')]],
  'c-young': [L('二代和年轻职场人决策方式不同，需要单独的触达方式。', 'La segunda generación decide de otra forma y necesita su propio canal.'), [L('巴塞罗那高校华人学生会、年轻职场社群的试驾活动', 'Pruebas con asociaciones de estudiantes chinos y redes de jóvenes profesionales en Barcelona'), L('小红书与抖音上的年轻化内容', 'Contenido juvenil en Xiaohongshu y Douyin')]],
  'c-club': [L('老车主是最可信的销售。每年聚一次，口碑就会自己传播。', 'Los propietarios son los mejores vendedores. Un encuentro al año y el boca a boca funciona solo.'), [L('Taller 开放日与车主聚会', 'Jornada de taller y encuentro de propietarios'), L('推荐成交的车主在活动上致谢', 'Reconocimiento público a quien trae nuevos clientes')]],
};
PHASES.forEach((p, pi) => p.acts.forEach(a => {
  SHEETS[a[0]] = () => head(p.when, a[1], ADETAIL[a[0]][0]) + h5('具体做法', 'Qué haremos') + ul(ADETAIL[a[0]][1]) + (a[3] ? `<p class="src">${L('时间：', 'Calendario: ')}${a[3]}</p>` : '');
}));

const scrim = $('#scrim'), sheet = $('#sheet'), body = $('#sheetBody');
let lastFocus = null, originEl = null, originRect = null, busy = false;
const EASE = 'cubic-bezier(.32,.72,0,1)';
function morph(from, to, dur) {
  // FLIP: draw the sheet at the origin rectangle, then let it grow to its real (centred) box
  const f = sheet.getBoundingClientRect();
  const tf = r => `translate(${r.left - f.left}px, ${r.top - f.top}px) scale(${Math.max(.02, r.width / f.width)}, ${Math.max(.02, r.height / f.height)})`;
  return sheet.animate([
    { transform: from ? tf(from) : 'none', opacity: from ? .4 : 1, borderRadius: from ? '28px' : '' },
    { transform: to ? tf(to) : 'none', opacity: to ? 0 : 1 }
  ], { duration: dur, easing: EASE, fill: 'forwards' }).finished;
}
const settle = (p, dur) => Promise.race([p, new Promise(r => setTimeout(r, dur + 120))]);
async function openSheet(id, rect) {
  const f = SHEETS[id];
  if (!f || busy) return;
  busy = true;
  lastFocus = document.activeElement;
  originEl = rect && rect.nodeType ? rect : null;
  originRect = originEl ? originEl.getBoundingClientRect() : rect || null;
  body.innerHTML = f();
  body.scrollTop = 0;
  sheet.getAnimations().forEach(a => a.cancel());
  sheet.classList.add('on', 'morph');
  scrim.classList.add('on');
  document.body.style.overflow = 'hidden';
  if (!reduceMotion && originRect) await settle(morph(originRect, null, 560), 560);
  sheet.classList.remove('morph');
  $('#sheetClose').focus({ preventScroll: true });
  busy = false;
}
async function closeSheet() {
  if (!sheet.classList.contains('on') || busy) return;
  busy = true;
  scrim.classList.remove('on');
  sheet.classList.add('morph');
  const back = originEl && document.contains(originEl) ? originEl.getBoundingClientRect() : originRect;
  if (!reduceMotion && back) await settle(morph(null, back, 420), 420);
  sheet.classList.remove('on', 'morph');
  sheet.getAnimations().forEach(a => a.cancel());
  document.body.style.overflow = '';
  if (lastFocus) lastFocus.focus({ preventScroll: true });
  busy = false;
}
document.addEventListener('click', e => { const t = e.target.closest('[data-sheet]'); if (t) { e.preventDefault(); openSheet(t.dataset.sheet, t); } });
scrim.addEventListener('click', closeSheet);
$('#sheetClose').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ------------------------------------------------------------------ nav highlight */
const secs = $$('main section, #map');
const navIO = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) $$('.nav .links a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
secs.forEach(s => navIO.observe(s));

/* ------------------------------------------------------------------ floating section menu */
const fabnav = $('#fabnav'), fab = $('#fab');
fab.addEventListener('click', () => { const o = !fabnav.classList.contains('open'); fabnav.classList.toggle('open', o); fab.setAttribute('aria-expanded', o); });
$$('#fabmenu a').forEach(a => a.addEventListener('click', () => { fabnav.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); }));
document.addEventListener('click', e => { if (!fabnav.contains(e.target)) { fabnav.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); } });
const fabIO = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  $$('#fabmenu a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
[$('#top'), ...secs].forEach(s => s && fabIO.observe(s));

/* ------------------------------------------------------------------ boot */
renderIncome(); renderJourney(); renderModels(); renderPhases(); renderLedger(); renderSources();
let saved = 'zh';
try { saved = localStorage.getItem('mv-lang') || 'zh'; } catch (e) {}
setLang(saved === 'es' ? 'es' : 'zh');
addEventListener('resize', moveThumb);
document.fonts && document.fonts.ready.then(moveThumb);
initMap();
})();
