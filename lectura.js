// Lectura territorial de Kennedy: pila de capas en 3D, relaciones y relieve («geografías latentes»).
// Adaptado de la lectura territorial de Tierra Bomba (tesis_tercer_corte, codigo/src/lib/analisis.js):
// aquí cada capa sale de uno de los 18 mapas del encuadre, leído píxel a píxel y llevado a 0–1.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export async function iniciarLectura(raiz, CAPAS_INFO, alProgreso = () => {}) {
const $ = (s) => raiz.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let pausado = reduce;
const entrada = {};
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const intro = (id, t, dur = 1600) => { if (!entrada[id]) return 0; return clamp01((t - entrada[id]) / dur); };
const suave = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const obsEntrada = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { if (!entrada[e.target.id]) entrada[e.target.id] = performance.now(); e.target.classList.add('visto'); } }), { threshold: 0.12 });
raiz.querySelectorAll('section').forEach((s) => obsEntrada.observe(s));
const DPR = Math.min(devicePixelRatio || 1, 2);
const cargarImg = (src) => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });

/* ---------- rampas de color (las mismas de la referencia) ---------- */
const RAMPAS = {
  relieve: ['#0d2a33', '#2f6f6a', '#8fb39a', '#d9d2b8', '#f4efe6'],
  magma: ['#0b0d1e', '#3b1e5a', '#8c2f6b', '#e05a4f', '#ffb48a'],
  riesgo: ['#1b2f2a', '#5c6b3a', '#c98a3a', '#ff6b4a', '#ffd2c4'],
  agua: ['#141b22', '#1b3550', '#2d78c8', '#49a6f0', '#9fd4ff'],
  calor: ['#130e10', '#4b1f28', '#a3343a', '#ff6b4a', '#ffd2c4'],
  viridis: ['#160f3b', '#2c3f8a', '#1f8a8a', '#53c08a', '#d8f1a0'],
  verde: ['#0d1a14', '#1d4b31', '#2f8a4f', '#7fcf7a', '#d6f5c6'],
  indice: ['#0b1216', '#1c3c4a', '#2e8aa0', '#ff8a6a', '#fff0e6'],
};
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rampaRGB = Object.fromEntries(Object.entries(RAMPAS).map(([k, v]) => [k, v.map(hexRGB)]));
const colorDe = (rampa, t) => { const st = rampaRGB[rampa]; const x = clamp01(t) * (st.length - 1); const i = Math.min(st.length - 2, Math.floor(x)); const f = x - i; return [0, 1, 2].map((k) => st[i][k] + (st[i + 1][k] - st[i][k]) * f); };
const gradCSS = (rampa) => `linear-gradient(90deg, ${RAMPAS[rampa].join(', ')})`;

/* ---------- datos: cada mapa se lee sobre la misma malla ---------- */
const GW = 154; const GH = 133; const N = GW * GH;
// cómo se lee el valor de cada mapa a partir de su color
const LECTURA = {
  lum: (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b,
  inv: (r, g, b) => 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b),
  rojo: (r, g, b) => r - g,
  azul: (r, g, b) => b - r,
  sat: (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b),
};
const cv0 = document.createElement('canvas'); cv0.width = GW; cv0.height = GH;
const cx0 = cv0.getContext('2d', { willReadFrequently: true }); cx0.imageSmoothingQuality = 'high';
const D = { capas: [] };
let hechas = 0;
await Promise.all(CAPAS_INFO.map(async (info, idx) => {
  const img = await cargarImg(info.src);
  // cada lectura en su propio lienzo para poder cargarlas en paralelo
  const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH; const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingQuality = 'high'; cx.drawImage(img, 0, 0, GW, GH);
  const d = cx.getImageData(0, 0, GW, GH).data; const f = LECTURA[info.lectura];
  let raw = new Float32Array(N); for (let k = 0; k < N; k++) raw[k] = f(d[k * 4] / 255, d[k * 4 + 1] / 255, d[k * 4 + 2] / 255);
  // suavizado 3×3 (dos pasadas) para que los picos sean superficies y no ruido de píxel
  for (let p = 0; p < 2; p++) { const o = new Float32Array(N); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { let s = 0; let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di; const jj = j + dj; if (ii < 0 || jj < 0 || ii >= GW || jj >= GH) continue; s += raw[jj * GW + ii]; n++; } o[j * GW + i] = s / n; } raw = o; }
  // lineal entre percentiles 2 y 98
  const ord = Float32Array.from(raw).sort(); const lo = ord[Math.floor(N * 0.02)]; const hi = ord[Math.floor(N * 0.98)];
  const v = new Float32Array(N); for (let k = 0; k < N; k++) v[k] = clamp01((raw[k] - lo) / Math.max(1e-6, hi - lo));
  D.capas[idx] = { ...info, n: String(idx + 1).padStart(2, '0'), v, val: (k) => v[k], img };
  alProgreso(++hechas / CAPAS_INFO.length);
}));
const capa = Object.fromEntries(D.capas.map((c) => [c.id, c]));

/* ---------- índices exploratorios (pesos iguales; no son índices validados) ---------- */
const v0 = (c, k) => Math.max(0, c.val(k));
const ou = (...a) => 1 - a.reduce((p, x) => p * (1 - x), 1);
const IND = {
  E: { nombre: 'Estrés ambiental', formula: 'E = media(térmica, NDBI, 1 − NDMI)', texto: 'Donde la superficie es caliente, impermeable y seca a la vez.', f: (k) => (v0(capa.termica, k) + v0(capa.ndbi, k) + (1 - v0(capa.ndmi, k))) / 3 },
  S: { nombre: 'Presión social', formula: 'S = √(E · densidad)', texto: 'Alta solo donde el estrés ambiental coincide con mucha gente.', f: (k) => Math.sqrt(IND.E.v[k] * v0(capa.densidad, k)) },
  M: { nombre: 'Riesgo de movilidad', formula: 'M = √(malla vial · accidentalidad)', texto: 'Los ejes arteriales donde además se concentran los siniestros.', f: (k) => Math.sqrt(v0(capa.malla_vial, k) * v0(capa.accidentalidad, k)) },
  V: { nombre: 'Valor ecológico', formula: 'V = media(NDVI, clorofila, EEP)', texto: 'Dónde se concentra la vegetación activa y el suelo de la estructura ecológica.', f: (k) => (v0(capa.ndvi, k) + v0(capa.chl, k) + v0(capa.eep_parques, k)) / 3 },
  C: { nombre: 'Convergencia', formula: 'C = S ⊕ M ⊕ √(E · V)', texto: 'Dónde el estrés toca a la vez gente, calles y vida. Cualquiera de las tres suma; ninguna resta.', f: (k) => ou(IND.S.v[k], IND.M.v[k], Math.sqrt(IND.E.v[k] * IND.V.v[k])) },
};
for (const id of ['E', 'S', 'M', 'V', 'C']) { const I = IND[id]; I.id = id; I.v = new Float32Array(N); for (let k = 0; k < N; k++) I.v[k] = I.f(k); }

/* ---------- lienzos de capas e índices ---------- */
const lienzoDe = (valor, rampa) => {
  const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH;
  const cx = cv.getContext('2d'); const im = cx.createImageData(GW, GH);
  for (let k = 0; k < N; k++) { const rgb = colorDe(rampa, valor(k)); im.data[k * 4] = rgb[0]; im.data[k * 4 + 1] = rgb[1]; im.data[k * 4 + 2] = rgb[2]; im.data[k * 4 + 3] = 255; }
  cx.putImageData(im, 0, 0); return cv;
};
D.capas.forEach((c) => { c.lienzo = lienzoDe((k) => c.val(k), c.rampa); });
Object.values(IND).forEach((I) => { I.lienzo = lienzoDe((k) => I.v[k], 'indice'); });

/* ================= pila de capas en 3D: cada ráster con altura donde su valor es mayor ================= */
const orden = [...D.capas].reverse();
$('#pila-lista').innerHTML = orden.map((c) => `<li><button data-capa="${c.id}"><em>${c.n}</em>${c.nombre}</button></li>`).join('');
let pHover = null;
raiz.querySelectorAll('[data-capa]').forEach((b) => { b.onmouseenter = () => { pHover = b.dataset.capa; }; b.onmouseleave = () => { pHover = null; }; b.onfocus = b.onmouseenter; b.onblur = b.onmouseleave; b.onclick = () => abrirFicha(capa[b.dataset.capa]); });
const pCont = $('#pila-3d');
const pRen = new THREE.WebGLRenderer({ antialias: true, alpha: true }); pRen.setPixelRatio(DPR); pCont.append(pRen.domElement);
const pEsc = new THREE.Scene();
pEsc.add(new THREE.AmbientLight(0xffffff, 1.15)); const pSol = new THREE.DirectionalLight(0xffffff, 1.1); pSol.position.set(-60, 120, -40); pEsc.add(pSol);
const pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
const BW = GW; const BH = GH; const PASO = 2; const SX = Math.ceil(BW / PASO); const SY = Math.ceil(BH / PASO);
const ALT_BASE = 12; const ALT_HOVER = 44;
const ELEV = (38 * Math.PI) / 180;
const DIAG = Math.hypot(BW, BH);
const ESCALA_PILA = 0.4;
let giroPila = -0.7;
const SEP = (DIAG * 0.82 * Math.sin(ELEV) + ALT_HOVER * Math.cos(ELEV) * 0.55) / Math.cos(ELEV) + 6;
const capas3d = orden.map((c, i) => {
  const geo = new THREE.PlaneGeometry(BW, BH, SX - 1, SY - 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const n = pos.count; const val = new Float32Array(n); const col = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    const ix = v % SX; const iy = Math.floor(v / SX); const k = Math.min(GH - 1, iy * PASO) * GW + Math.min(GW - 1, ix * PASO);
    const t = c.val(k); val[v] = t; const rgb = colorDe(c.rampa, Math.max(0.12, t));
    col[v * 3] = rgb[0] / 255; col[v * 3 + 1] = rgb[1] / 255; col[v * 3 + 2] = rgb[2] / 255;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const malla = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const borde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(BW, BH).rotateX(-Math.PI / 2)), new THREE.LineBasicMaterial({ color: 0xd6e6ec, transparent: true, opacity: 0.5 }));
  const grupo = new THREE.Group(); grupo.add(malla, borde); grupo.userData = { c, i, val, alt: ALT_BASE }; malla.userData.id = c.id;
  pEsc.add(grupo); return grupo;
});
const aplicarAltura = (g, alt) => { const pos = g.children[0].geometry.attributes.position; const val = g.userData.val; for (let v = 0; v < pos.count; v++) pos.setY(v, val[v] * alt); pos.needsUpdate = true; g.children[0].geometry.computeVertexNormals(); };
capas3d.forEach((g) => aplicarAltura(g, ALT_BASE));
const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
pRen.domElement.addEventListener('pointermove', (e) => { const r = pRen.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, pCam); const hit = ray.intersectObjects(capas3d.map((g) => g.children[0]))[0]; pHover = hit ? hit.object.userData.id : null; if (arrastre === null) pRen.domElement.style.cursor = pHover ? 'pointer' : 'grab'; });
pRen.domElement.addEventListener('pointerleave', () => { pHover = null; });
let arrastre = null; let movido = 0;
pRen.domElement.style.touchAction = 'pan-y'; pRen.domElement.style.cursor = 'grab';
pRen.domElement.addEventListener('pointerdown', (e) => { arrastre = e.clientX; movido = 0; pRen.domElement.setPointerCapture(e.pointerId); pRen.domElement.style.cursor = 'grabbing'; });
pRen.domElement.addEventListener('pointermove', (e) => { if (arrastre === null) return; const dx = e.clientX - arrastre; arrastre = e.clientX; movido += Math.abs(dx); giroPila += dx * 0.009; });
const soltar = () => { arrastre = null; pRen.domElement.style.cursor = 'grab'; };
pRen.domElement.addEventListener('pointerup', soltar); pRen.domElement.addEventListener('pointercancel', soltar);
pRen.domElement.addEventListener('click', () => { if (pHover && movido < 5) abrirFicha(capa[pHover]); });
function dibujarPila() {
  const r = pCont.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const w = Math.max(1, r.width); const h = Math.max(1, r.height); const vh = Math.max(1, Math.min(innerHeight, h));
  if (pRen.domElement.width !== Math.round(w * DPR) || pRen.domElement.height !== Math.round(vh * DPR)) pRen.setSize(w, vh, false);
  const alto = (orden.length - 1) * SEP * Math.cos(ELEV) + BW * Math.sin(ELEV) + ALT_HOVER + 40;
  const altoPx = Math.round(w * ESCALA_PILA * alto / (DIAG * 1.04));
  if (Math.abs(pCont.offsetHeight - altoPx) > 2) pCont.style.height = `${altoPx}px`;
  const mitadH = Math.max(alto * 0.5, (DIAG * 0.52 / ESCALA_PILA) / (w / h));
  pCam.left = -mitadH * (w / h); pCam.right = mitadH * (w / h); pCam.top = mitadH; pCam.bottom = -mitadH;
  const offY = Math.max(0, Math.min(h - vh, -r.top)); pCam.setViewOffset(w, h, 0, offY, w, vh);
  const d = 1600; const cy = -((orden.length - 1) * SEP) / 2 + 20; pCam.position.set(Math.cos(ELEV) * Math.cos(giroPila) * d, cy + Math.sin(ELEV) * d, Math.cos(ELEV) * Math.sin(giroPila) * d); pCam.lookAt(0, cy, 0);
  raiz.querySelectorAll('[data-capa]').forEach((b) => (b.dataset.capa === pHover ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
  const ahora = performance.now(); const ia = intro('capas', ahora, 2600);
  const iSel = pHover ? orden.findIndex((o) => o.id === pHover) : -1;
  capas3d.forEach((g) => {
    const { c, i } = g.userData; const sel = c.id === pHover;
    const ola = pausado || pHover ? 0 : Math.max(0, Math.sin(ahora * 0.0011 - i * 0.55)) ** 6; const meta = sel ? ALT_HOVER : ALT_BASE + ola * 22; const nueva = g.userData.alt + (meta - g.userData.alt) * 0.14;
    if (Math.abs(nueva - g.userData.alt) > 0.02) { g.userData.alt = nueva; aplicarAltura(g, nueva); }
    const ic = suave((ia - (orden.length - 1 - i) * 0.04) / 0.4);
    const flota = pausado ? 0 : Math.sin(ahora * 0.0012 + i * 0.6) * 3.2 + ola * 10;
    const sube = iSel >= 0 && i < iSel ? 26 : sel ? 6 : 0; g.userData.sube = (g.userData.sube || 0) + (sube - (g.userData.sube || 0)) * 0.14;
    g.position.y = -i * SEP + flota + g.userData.sube + (1 - ic) * 260;
    g.visible = ic > 0.01; g.children[0].material.color.setScalar(pHover && !sel ? 0.4 : 1);
    g.children[1].material.color.set(sel ? 0xff6b4a : 0xd6e6ec); g.children[1].material.opacity = ic * (sel ? 0.95 : 0.25 + 0.4 * ola);
  });
  pRen.render(pEsc, pCam);
}
function abrirFicha(c) {
  const f = raiz.querySelector('#ficha-capa');
  f.innerHTML = `<button class="cerrar" aria-label="Cerrar">✕</button><p class="rotulo">Capa ${c.n} · ${c.grupo}</p><h3>${c.nombre}</h3><p class="desc">${c.d}</p><dl><dt>Unidad</dt><dd>${c.unidad}</dd><dt>Cálculo</dt><dd class="dato">${c.f}</dd><dt>Normalización</dt><dd>lineal p2–p98 sobre el mapa</dd><dt>Fuente</dt><dd>${c.fu}</dd></dl>`;
  const fila = document.createElement('div'); fila.className = 'ficha-imgs';
  const orig = document.createElement('img'); orig.src = c.src; orig.alt = `Mapa original: ${c.nombre}`;
  const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH; cv.getContext('2d').drawImage(c.lienzo, 0, 0);
  fila.append(orig, cv); f.append(fila);
  const rb = document.createElement('div'); rb.className = 'rampa'; rb.style.cssText = 'position:static;width:100%;margin-top:8px'; rb.innerHTML = `<i style="background:${gradCSS(c.rampa)}"></i><div><span>${c.el[0]}</span><span>${c.el[1]}</span></div>`; f.append(rb);
  const ver = document.createElement('button'); ver.className = 'chip'; ver.style.marginTop = '12px'; ver.textContent = 'Ver en el relieve 3D →';
  ver.onclick = () => { pintar(c.id, c.id); f.classList.remove('on'); raiz.querySelector('#relieve').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
  f.append(ver);
  f.classList.add('on'); f.querySelector('.cerrar').onclick = () => f.classList.remove('on');
}
const alEsc = (e) => { if (e.key === 'Escape') raiz.querySelector('#ficha-capa').classList.remove('on'); }; addEventListener('keydown', alEsc);

/* ================= relaciones ================= */
const TEXTOS_REL = {
  '': `${D.capas.length} lecturas del mismo encuadre, sobre la misma malla de ${GW} × ${GH} celdas. Hasta aquí cada una se lee sola; desde aquí empiezan a relacionarse.`,
  'modo-norm': 'Cada mapa llega en su propia escala de color: índices espectrales, concentraciones, conteos suavizados. Para compararlos se leen como un valor y se llevan a 0–1; la lectura del color cambia según la capa.',
  'modo-media': 'Las capas del mismo proceso comparten un peso: NDVI, clorofila y estructura ecológica se promedian en el valor ecológico, con pesos iguales.',
  'modo-op': 'Las capas que describen la superficie (térmica, impermeabilización y humedad) se unen en el estrés ambiental; desde él se cruzan con la gente, las calles y la vida.',
};
const ENMEDIA = new Set(['ndvi', 'chl', 'eep_parques']); const ENOP = new Set(['termica', 'ndbi', 'ndmi']);
$('#rejilla').innerHTML = D.capas.map((c) => `<div class="mini ${ENMEDIA.has(c.id) ? 'peso' : ''} ${ENOP.has(c.id) ? 'op' : ''}" data-mini="${c.id}" tabindex="0" role="button" aria-label="${c.nombre}"><b>${c.n}</b><span>${c.corto}</span><div class="metodo">${c.lecturaTxt}</div></div>`).join('');
raiz.querySelectorAll('[data-mini]').forEach((el) => { const c = capa[el.dataset.mini]; const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH; const cx = cv.getContext('2d'); cx.drawImage(c.lienzo, 0, 0); el.prepend(cv); el.onclick = () => abrirFicha(c); el.onkeydown = (e) => { if (e.key === 'Enter') abrirFicha(c); }; });
function modoRel(m) { $('#rejilla').className = `rejilla ${m}`; $('#rel-texto').textContent = TEXTOS_REL[m]; raiz.querySelectorAll('#rel-pestanas button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.modo === m))); }
raiz.querySelectorAll('#rel-pestanas button').forEach((b) => { b.onclick = () => modoRel(b.dataset.modo); }); modoRel('');

/* ================= relieve en 3D: «geografías latentes» ================= */
// la altura sale de una capa y el color de otra: los picos son los valores altos
const cont = $('#relieve-3d');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(DPR); cont.append(renderer.domElement);
const escena = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(36, 1, 1, 50000);
const CELDA = 30; const ALTO_MAX = 900;
const pos = new Float32Array(N * 3); const ind = [];
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const k = j * GW + i; pos[k * 3] = (i - GW / 2) * CELDA; pos[k * 3 + 2] = (j - GH / 2) * CELDA; }
for (let j = 0; j < GH; j++) for (let i = 0; i < GW - 1; i++) ind.push(j * GW + i, j * GW + i + 1);
const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const cols = new Float32Array(N * 3); geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.setIndex(ind);
const lineas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
const puntos = new THREE.Points(geo, new THREE.PointsMaterial({ vertexColors: true, size: 2.2 * DPR, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
escena.add(lineas, puntos);
const ctrl3d = new OrbitControls(cam, renderer.domElement); ctrl3d.enableDamping = true; ctrl3d.autoRotate = !pausado; ctrl3d.autoRotateSpeed = 0.9; ctrl3d.maxPolarAngle = Math.PI * 0.48; ctrl3d.minDistance = 1200; ctrl3d.maxDistance = 14000;
cam.position.set(2400, 4200, 5600); ctrl3d.target.set(0, 0, 0);
renderer.domElement.addEventListener('pointerdown', () => { ctrl3d.autoRotate = false; });
const altOrigen = new Float32Array(N); const altMeta = new Float32Array(N); const altAhora = new Float32Array(N); let tCambio = 0;
const valorDe = (id, k) => (IND[id] ? IND[id].v[k] : capa[id].val(k));
const nombreDe = (id) => (IND[id] ? IND[id].nombre : capa[id].nombre);
const rampaDe = (id) => (IND[id] ? 'indice' : capa[id].rampa);
const colsBase = new Float32Array(N * 3); let colorActual = 'C'; let alturaActual = 'C';
// picos: máximos locales de la capa de altura, con su etiqueta
const etq = $('#picos'); let picos = [];
function buscarPicos(id) {
  const cand = []; for (let k = 0; k < N; k++) cand.push(k); cand.sort((a, b) => valorDe(id, b) - valorDe(id, a));
  const elegidos = []; const minD = 22;
  for (const k of cand) { if (elegidos.length >= 5 || valorDe(id, k) < 0.55) break; const i = k % GW; const j = Math.floor(k / GW); if (i < 3 || j < 3 || i > GW - 4 || j > GH - 4) continue; if (elegidos.every((q) => Math.hypot((q % GW) - i, Math.floor(q / GW) - j) > minD)) elegidos.push(k); }
  return elegidos;
}
function pintar(colorId, alturaId = alturaActual) {
  colorActual = colorId; const rampa = rampaDe(colorId);
  for (let k = 0; k < N; k++) { const rgb = colorDe(rampa, Math.max(0.08, valorDe(colorId, k))); cols[k * 3] = rgb[0] / 255; cols[k * 3 + 1] = rgb[1] / 255; cols[k * 3 + 2] = rgb[2] / 255; }
  geo.attributes.color.needsUpdate = true; colsBase.set(cols);
  if (alturaId !== alturaActual || !tCambio) { alturaActual = alturaId; altOrigen.set(altAhora); for (let k = 0; k < N; k++) altMeta[k] = valorDe(alturaId, k) * ALTO_MAX; tCambio = performance.now(); }
  picos = buscarPicos(alturaActual);
  etq.innerHTML = picos.map((k, q) => `<button class="pico" data-k="${k}"><b>${String(q + 1).padStart(2, '0')} · ${Math.round(valorDe(alturaActual, k) * 100)} %</b><i></i></button>`).join('');
  etq.querySelectorAll('.pico').forEach((b) => { b.onclick = () => volarA(+b.dataset.k); });
  $('#rampa').innerHTML = `<i style="background:${gradCSS(rampa)}"></i><div><span>bajo</span><span>${nombreDe(colorId)}</span><span>alto</span></div>`;
  $('#relieve-estado').innerHTML = `<b>Altura</b> ${nombreDe(alturaActual)} · <b>Color</b> ${nombreDe(colorId)}`;
  raiz.querySelectorAll('[data-modo3d]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo3d === colorId)));
  $('#sel-altura').value = alturaActual;
}
let vuelo = null;
function volarA(k) {
  const x = pos[k * 3]; const y = altAhora[k]; const z = pos[k * 3 + 2];
  vuelo = { t0: performance.now(), d: 1400, tA: ctrl3d.target.clone(), tB: new THREE.Vector3(x, y * 0.6, z), cA: cam.position.clone(), cB: new THREE.Vector3(x + 1300, y + 1500, z + 1700) };
  ctrl3d.autoRotate = false;
}
const MODOS = [['C', 'Convergencia'], ['E', 'Estrés ambiental'], ['S', 'Presión social'], ['M', 'Riesgo de movilidad'], ['V', 'Valor ecológico'], ...D.capas.map((c) => [c.id, c.corto])];
$('#chips').innerHTML = MODOS.map(([m, t]) => `<button class="chip" data-modo3d="${m}" aria-pressed="false">${IND[m] ? `<b>${m}</b>` : ''}${t}</button>`).join('');
raiz.querySelectorAll('[data-modo3d]').forEach((b) => { b.onclick = () => pintar(b.dataset.modo3d, $('#ata').checked ? b.dataset.modo3d : alturaActual); });
$('#sel-altura').innerHTML = MODOS.map(([m]) => `<option value="${m}">${nombreDe(m)}</option>`).join('');
$('#sel-altura').onchange = (e) => pintar(colorActual, e.target.value);
$('#relieve-texto').textContent = 'Cada capa del encuadre se vuelve terreno: sube donde su valor es mayor. Elija una capa para vestir la superficie con sus valores, cambie la capa que da la altura para cruzarlas y haga clic en un pico para acercarse.';
pintar('C', 'C');
// pasar el cursor: valor de altura y color en ese punto
const tip = $('#tip-relieve'); const rayR = new THREE.Raycaster(); rayR.params.Points.threshold = 40;
renderer.domElement.addEventListener('pointermove', (e) => {
  const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  rayR.setFromCamera(ptr, cam); const hit = rayR.intersectObject(puntos)[0];
  if (!hit) { tip.style.display = 'none'; return; }
  const k = hit.index; tip.style.display = 'block'; tip.style.left = `${e.clientX - r.left}px`; tip.style.top = `${e.clientY - r.top}px`;
  tip.innerHTML = `<strong>${Math.round(valorDe(alturaActual, k) * 100)} %</strong>${nombreDe(alturaActual)}${alturaActual !== colorActual ? `<br><span style="color:var(--mar)">${Math.round(valorDe(colorActual, k) * 100)} %</span> ${nombreDe(colorActual)}` : ''}`;
});
renderer.domElement.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
const vtmp = new THREE.Vector3();
function dibujar3d(t) {
  const r = cont.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const sube = suave(intro('relieve', t, 2400));
  const pc = suave((t - tCambio) / 1100);
  for (let k = 0; k < N; k++) { altAhora[k] = altOrigen[k] + (altMeta[k] - altOrigen[k]) * pc; pos[k * 3 + 1] = altAhora[k] * sube; }
  geo.attributes.position.needsUpdate = true;
  if (!pausado) { const zMin = -GH / 2 * CELDA; const zRango = GH * CELDA; const zb = zMin + (((t * 0.00011) % 1.3) - 0.15) * zRango; const ancho = zRango * 0.05; for (let k = 0; k < N; k++) { const dz = Math.abs(pos[k * 3 + 2] - zb); const a = dz < ancho ? 1 - dz / ancho : 0; const aa = a * a; cols[k * 3] = Math.min(1, colsBase[k * 3] + aa * 0.9); cols[k * 3 + 1] = Math.min(1, colsBase[k * 3 + 1] + aa * 0.45); cols[k * 3 + 2] = Math.min(1, colsBase[k * 3 + 2] + aa * 0.3); } geo.attributes.color.needsUpdate = true; }
  const w = Math.max(1, r.width); const h = Math.max(1, r.height); if (renderer.domElement.width !== Math.round(w * DPR) || renderer.domElement.height !== Math.round(h * DPR)) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  if (vuelo) { const p = suave((t - vuelo.t0) / vuelo.d); ctrl3d.target.lerpVectors(vuelo.tA, vuelo.tB, p); cam.position.lerpVectors(vuelo.cA, vuelo.cB, p); if (p >= 1) vuelo = null; }
  ctrl3d.update(); renderer.render(escena, cam);
  etq.querySelectorAll('.pico').forEach((b) => { const k = +b.dataset.k; vtmp.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).project(cam); const vis = vtmp.z < 1 && Math.abs(vtmp.x) < 1.05 && Math.abs(vtmp.y) < 1.05 && sube > 0.9; b.classList.toggle('oculto', !vis); b.style.transform = `translate(${(vtmp.x * 0.5 + 0.5) * w}px, ${(-vtmp.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`; });
}

/* ---------- bucle ---------- */
let vivo = true;
(function bucle(t) { if (!vivo) return; requestAnimationFrame(bucle); if (document.hidden) return; dibujarPila(); dibujar3d(t); })(performance.now());
raiz.querySelectorAll('section').forEach((s) => { s.querySelectorAll(':scope h2, :scope .capas-cab p, :scope .rel-cuerpo p, :scope .rel-izq > p, :scope .chips, :scope .mini, :scope .pila li').forEach((e, q) => { e.classList.add('rv'); e.style.transitionDelay = `${Math.min(q, 14) * 0.06}s`; }); });
const pausa = $('#pausa'); if (pausa) { pausa.setAttribute('aria-pressed', String(pausado)); pausa.textContent = pausado ? 'Reanudar movimiento' : 'Pausar movimiento'; pausa.onclick = () => { pausado = !pausado; ctrl3d.autoRotate = !pausado; pausa.setAttribute('aria-pressed', String(pausado)); pausa.textContent = pausado ? 'Reanudar movimiento' : 'Pausar movimiento'; }; }
return { pintar, abrirFicha: (id) => abrirFicha(capa[id]), parar: () => { vivo = false; obsEntrada.disconnect(); removeEventListener('keydown', alEsc); ctrl3d.dispose(); pRen.dispose(); renderer.dispose(); } };
}
