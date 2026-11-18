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
const media = (...a) => a.reduce((p, x) => p + x, 0) / a.length;
// usa: capas que entran; de: índices que entran. Pesos iguales: índices exploratorios, no validados.
const IND = {
  E: { nombre: 'Estrés ambiental', formula: 'media(térmica, NDBI, 1 − NDMI)', texto: 'Donde la superficie es caliente, impermeable y seca a la vez.', usa: ['termica', 'ndbi', 'ndmi'], f: (k) => media(v0(capa.termica, k), v0(capa.ndbi, k), 1 - v0(capa.ndmi, k)) },
  V: { nombre: 'Valor ecológico', formula: 'media(NDVI, clorofila, EEP)', texto: 'Dónde se concentra la vegetación activa y el suelo de la estructura ecológica.', usa: ['ndvi', 'chl', 'eep_parques'], f: (k) => media(v0(capa.ndvi, k), v0(capa.chl, k), v0(capa.eep_parques, k)) },
  A: { nombre: 'Contaminación', formula: 'media(CO, CH₄, UWQV)', texto: 'Aire y agua cargados: monóxido, metano y la carga del agua del humedal.', usa: ['co', 'ch4', 'uwqv'], f: (k) => media(v0(capa.co, k), v0(capa.ch4, k), v0(capa.uwqv, k)) },
  P: { nombre: 'Presión productiva', formula: 'media(comercio, industria)', texto: 'Dónde se concentran la actividad comercial y la industria pesada.', usa: ['comercio', 'industria'], f: (k) => media(v0(capa.comercio, k), v0(capa.industria, k)) },
  S: { nombre: 'Presión social', formula: '√(E · densidad)', texto: 'Alta solo donde el estrés ambiental coincide con mucha gente.', usa: ['densidad'], de: ['E'], f: (k) => Math.sqrt(IND.E.v[k] * v0(capa.densidad, k)) },
  M: { nombre: 'Riesgo de movilidad', formula: '√(malla vial · accidentalidad)', texto: 'Los ejes arteriales donde además se concentran los siniestros.', usa: ['malla_vial', 'accidentalidad'], f: (k) => Math.sqrt(v0(capa.malla_vial, k) * v0(capa.accidentalidad, k)) },
  K: { nombre: 'Capacidad comunitaria', formula: 'media(colegios, ed. sup., JAC, equip.)', texto: 'Dónde hay instituciones y organización barrial para sostener una propuesta.', usa: ['colegios', 'educacion_superior', 'jac', 'equipamientos'], f: (k) => media(v0(capa.colegios, k), v0(capa.educacion_superior, k), v0(capa.jac, k), v0(capa.equipamientos, k)) },
  C: { nombre: 'Convergencia de presión', formula: 'S ⊕ M ⊕ √(E · V) ⊕ √(A · P)', texto: 'Dónde la presión toca a la vez gente, calles, vida y aire. Cualquier señal suma; su ausencia no resta.', de: ['S', 'M', 'E', 'V', 'A', 'P'], f: (k) => ou(IND.S.v[k], IND.M.v[k], Math.sqrt(IND.E.v[k] * IND.V.v[k]), Math.sqrt(IND.A.v[k] * IND.P.v[k])) },
  O: { nombre: 'Oportunidad', formula: '√(V · K)', texto: 'Alta solo donde el valor ecológico y la capacidad comunitaria coinciden: dónde una convención puede empezar.', de: ['V', 'K'], f: (k) => Math.sqrt(IND.V.v[k] * IND.K.v[k]) },
};
const ORDEN_IND = ['E', 'V', 'A', 'P', 'S', 'M', 'K', 'C', 'O'];
for (const id of ORDEN_IND) { const I = IND[id]; I.id = id; I.v = new Float32Array(N); for (let k = 0; k < N; k++) I.v[k] = I.f(k);
  // cada índice se reescala 0–1 entre sus percentiles 2 y 98 para que sea comparable
  const ord = Float32Array.from(I.v).sort(); const lo = ord[Math.floor(N * 0.02)]; const hi = ord[Math.floor(N * 0.98)]; for (let k = 0; k < N; k++) I.v[k] = clamp01((I.v[k] - lo) / Math.max(1e-6, hi - lo)); }

/* ---------- lienzos de capas e índices ---------- */
const lienzoDe = (valor, rampa) => {
  const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH;
  const cx = cv.getContext('2d'); const im = cx.createImageData(GW, GH);
  for (let k = 0; k < N; k++) { const rgb = colorDe(rampa, valor(k)); im.data[k * 4] = rgb[0]; im.data[k * 4 + 1] = rgb[1]; im.data[k * 4 + 2] = rgb[2]; im.data[k * 4 + 3] = 255; }
  cx.putImageData(im, 0, 0); return cv;
};
D.capas.forEach((c) => { c.lienzo = lienzoDe((k) => c.val(k), c.rampa); });
Object.values(IND).forEach((I) => { I.lienzo = lienzoDe((k) => I.v[k], 'indice'); });

/* ================= pila isométrica (como en Salento): un estrato por mapa, el relieve se levanta al activarlo ================= */
// cada estrato se pre-renderiza una vez en dos imágenes con la misma cámara ortográfica: plano y con relieve
const orden = [...D.capas]; // 01 abajo … 18 arriba
const NC = orden.length;
const IMG_W = 760; const ALTO_REL = 34; // altura visual del valor máximo (exagerada)
const rCv = document.createElement('canvas');
const rRen = new THREE.WebGLRenderer({ canvas: rCv, antialias: true, alpha: true, preserveDrawingBuffer: true });
rRen.setPixelRatio(1); rRen.outputColorSpace = THREE.SRGBColorSpace;
const rEsc = new THREE.Scene();
rEsc.add(new THREE.HemisphereLight(0xffffff, 0x223038, 1.25));
const rSol = new THREE.DirectionalLight(0xffffff, 1.6); rSol.position.set(-80, 140, 60); rEsc.add(rSol);
const rCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
const AZ = (-38 * Math.PI) / 180; const EL = (33 * Math.PI) / 180;
rCam.position.set(Math.sin(AZ) * Math.cos(EL) * 500, Math.sin(EL) * 500, Math.cos(AZ) * Math.cos(EL) * 500); rCam.lookAt(0, 0, 0); rCam.updateMatrixWorld();
// encuadre: las 4 esquinas en el piso y a la altura máxima
const esquinas = [[-GW / 2, -GH / 2], [GW / 2, -GH / 2], [GW / 2, GH / 2], [-GW / 2, GH / 2]];
const proy = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(rCam.matrixWorldInverse); return [v.x, v.y]; };
const pts = esquinas.flatMap(([x, z]) => [proy(x, 0, z), proy(x, ALTO_REL, z)]);
const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
const mx = (Math.max(...xs) - Math.min(...xs)) * 0.015;
rCam.left = Math.min(...xs) - mx; rCam.right = Math.max(...xs) + mx; rCam.top = Math.max(...ys) + mx; rCam.bottom = Math.min(...ys) - mx; rCam.updateProjectionMatrix();
const RATIO = (rCam.top - rCam.bottom) / (rCam.right - rCam.left);
const IMG_H = Math.round(IMG_W * RATIO);
rRen.setSize(IMG_W, IMG_H, false);
// esquinas del piso en fracción de la imagen (0–1): contorno y zona sensible
const base = esquinas.map(([x, z]) => { const [px, py] = proy(x, 0, z); return [(px - rCam.left) / (rCam.right - rCam.left), (rCam.top - py) / (rCam.top - rCam.bottom)]; });
const iDer = base.reduce((b, p, i) => (p[0] > base[b][0] ? i : b), 0); // esquina derecha: de ahí sale la guía al rótulo
const geoR = new THREE.PlaneGeometry(GW, GH, GW - 1, GH - 1); geoR.rotateX(-Math.PI / 2);
const posR = geoR.attributes.position;
const matR = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
const mallaR = new THREE.Mesh(geoR, matR); rEsc.add(mallaR);
const aFoto = () => new Promise((ok) => rCv.toBlob((b) => ok(URL.createObjectURL(b)), 'image/webp', 0.9));
for (const c of orden) {
  const tex = new THREE.Texture(c.img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
  matR.map = tex; matR.needsUpdate = true;
  for (let v = 0; v < posR.count; v++) posR.setY(v, 0); posR.needsUpdate = true; geoR.computeVertexNormals();
  matR.emissive = new THREE.Color(0x000000); rEsc.children[0].intensity = 2.2; rSol.intensity = 0.4;
  rRen.render(rEsc, rCam); c.plano = await aFoto();
  for (let v = 0; v < posR.count; v++) posR.setY(v, c.v[v] * ALTO_REL); posR.needsUpdate = true; geoR.computeVertexNormals();
  rEsc.children[0].intensity = 1.25; rSol.intensity = 1.6;
  rRen.render(rEsc, rCam); c.relieve = await aFoto();
  tex.dispose();
}
geoR.dispose(); matR.dispose(); rRen.dispose();

const pilaEl = $('#pila');
const poli = base.map(([x, y]) => `${x},${(y * RATIO).toFixed(4)}`).join(' ');
pilaEl.innerHTML = `<svg class="pila__guias" aria-hidden="true"></svg>` + orden.map((c, i) => `
  <div class="estrato" data-id="${c.id}" style="--i:${i}">
    <img class="estrato__plano" src="${c.plano}" alt="" draggable="false">
    <img class="estrato__relieve" src="${c.relieve}" alt="" draggable="false">
    <svg class="estrato__contorno" viewBox="0 0 1 ${RATIO.toFixed(4)}" preserveAspectRatio="none" aria-hidden="true"><polygon class="estrato__borde" points="${poli}" vector-effect="non-scaling-stroke"/><polygon class="estrato__zona" points="${poli}"/></svg>
  </div>`).join('') + `<ol class="pila__rotulos">${orden.map((c) => `<li class="rotulo" data-id="${c.id}"><button type="button"><span class="rotulo__num">${c.n}</span><span class="rotulo__nombre">${c.nombre}</span></button></li>`).join('')}</ol>`;
const estratos = [...pilaEl.querySelectorAll('.estrato')]; const rotulos = [...pilaEl.querySelectorAll('.rotulo')];
let pAncho = 0; let pPaso = 0;
function medirPila() {
  const vw = document.documentElement.clientWidth; const vh = innerHeight; const movil = vw < 820;
  pAncho = movil ? vw * 0.52 : Math.min(640, vw * 0.4);
  const hImg = pAncho * RATIO; const disponible = movil ? Math.max(460, vh * 0.62) : Math.max(560, vh - 200);
  pPaso = Math.max(12, Math.min(34, (disponible - hImg) / (NC - 1)));
  const alto = (NC - 1) * pPaso + hImg;
  pilaEl.style.width = `${pAncho}px`; pilaEl.style.height = `${alto}px`; pilaEl.style.setProperty('--alzado', `${Math.round(hImg * 0.5)}px`); pilaEl.style.setProperty('--paso', pPaso);
  const topDe = (i) => (NC - 1 - i) * pPaso;
  estratos.forEach((e, i) => { e.style.top = `${topDe(i)}px`; e.style.width = `${pAncho}px`; e.style.height = `${hImg}px`; e.style.zIndex = i + 1; });
  const [dx, dy] = base[iDer];
  rotulos.forEach((r, i) => { r.style.top = `${topDe(i) + dy * hImg}px`; r.style.setProperty('--x', `${dx * pAncho}px`); });
  // guías verticales en las otras tres esquinas
  $('.pila__guias').setAttribute('width', pAncho); $('.pila__guias').setAttribute('height', alto);
  $('.pila__guias').innerHTML = base.filter((_, i) => i !== iDer).map(([x, y]) => `<line x1="${x * pAncho}" x2="${x * pAncho}" y1="${y * hImg - 14}" y2="${topDe(0) + y * hImg + 20}"/>`).join('');
}
medirPila(); addEventListener('resize', medirPila);
let pHover = null; let pScroll = null;
function estadoPila() {
  const act = pHover ?? pScroll; const ia = act ? orden.findIndex((c) => c.id === act) : -1;
  pilaEl.toggleAttribute('data-activo', ia >= 0);
  estratos.forEach((e, i) => { e.dataset.estado = ia < 0 ? 'reposo' : i === ia ? 'activo' : i > ia ? 'encima' : 'debajo'; });
  rotulos.forEach((r, i) => { r.dataset.estado = ia < 0 ? 'reposo' : i === ia ? 'activo' : i > ia ? 'encima' : 'atenuado'; });
}
estratos.forEach((e) => { const z = e.querySelector('.estrato__zona'); z.addEventListener('pointerenter', () => { pHover = e.dataset.id; estadoPila(); }); z.addEventListener('click', () => abrirFicha(capa[e.dataset.id])); });
rotulos.forEach((r) => { const b = r.querySelector('button'); b.addEventListener('pointerenter', () => { pHover = r.dataset.id; estadoPila(); }); b.addEventListener('focus', () => { pHover = r.dataset.id; estadoPila(); }); b.addEventListener('blur', () => { pHover = null; estadoPila(); }); b.addEventListener('click', () => abrirFicha(capa[r.dataset.id])); });
pilaEl.addEventListener('pointerleave', () => { pHover = null; estadoPila(); });
// el scroll recorre los estratos de abajo arriba mientras la pila está fija
const secPila = $('#capas');
function dibujarPila() { return;
  const r = secPila.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const rango = Math.max(1, r.height - innerHeight); const p = clamp01(-r.top / rango);
  let id = null; if (!pausado && p > 0.06 && p < 0.97) id = orden[Math.min(NC - 1, Math.floor(((p - 0.06) / 0.91) * NC))].id;
  if (id !== pScroll) { pScroll = id; estadoPila(); }
}
estadoPila();
requestAnimationFrame(() => pilaEl.classList.add('pila-lista'));
function abrirFicha(c) {
  const f = raiz.querySelector('#ficha-capa');
  f.innerHTML = `<button class="cerrar" aria-label="Cerrar">✕</button><p class="rotulo">Capa ${c.n} · ${c.grupo}</p><h3>${c.nombre}</h3><p class="desc">${c.d}</p><dl><dt>Unidad</dt><dd>${c.unidad}</dd><dt>Cálculo</dt><dd class="dato">${c.f}</dd><dt>Normalización</dt><dd>lineal p2–p98 sobre el mapa</dd><dt>Fuente</dt><dd>${c.fu}</dd></dl>`;
  const fila = document.createElement('div'); fila.className = 'ficha-imgs';
  const orig = document.createElement('img'); orig.src = c.src; orig.alt = `Mapa original: ${c.nombre}`;
  const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH; cv.getContext('2d').drawImage(c.lienzo, 0, 0);
  fila.append(orig, cv); f.append(fila);
  const rb = document.createElement('div'); rb.className = 'rampa'; rb.style.cssText = 'position:static;width:100%;margin-top:8px'; rb.innerHTML = `<i style="background:${gradCSS(c.rampa)}"></i><div><span>${c.el[0]}</span><span>${c.el[1]}</span></div>`; f.append(rb);
  const ver = document.createElement('button'); ver.className = 'chip'; ver.style.marginTop = '12px'; ver.textContent = 'Ver en el relieve 3D →';
  ver.onclick = () => { pintar(c.id, c.id); f.classList.remove('on'); $('#capas').classList.remove('abierto'); raiz.querySelector('#relieve').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
  f.append(ver);
  f.classList.add('on'); $('#capas').classList.add('abierto'); f.querySelector('.cerrar').onclick = () => { f.classList.remove('on'); $('#capas').classList.remove('abierto'); };
}
const alEsc = (e) => { if (e.key === 'Escape') raiz.querySelector('#ficha-capa').classList.remove('on'); $('#capas').classList.remove('abierto'); }; addEventListener('keydown', alEsc);

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

/* ================= genealogía: filamentos de las capas a los índices ================= */
(() => {
  const svg = $('#gen-svg'); if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg'; const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const COLI = { E: '#ff6b4a', V: '#7fd08a', A: '#b9a4ff', P: '#f2cf94', S: '#ff9f80', M: '#8fe7f2', K: '#f7e07a', C: '#ff6b4a', O: '#cfff5e' };
  const W = 1180, fila = 30, H = Math.max(D.capas.length, 9) * fila + 60; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const xC = 250, xI = 560, xF = 880; const yC = (i) => 40 + i * fila;
  const nivel1 = ['E', 'V', 'A', 'P', 'M', 'K'], nivel2 = ['S', 'C', 'O'];
  const pasoI = (H - 80) / (nivel1.length - 1), pasoF = (H - 80) * 0.78 / (nivel2.length - 1);
  const pos = {}; D.capas.forEach((c, i) => { pos[c.id] = [xC, yC(i)]; });
  nivel1.forEach((id, i) => { pos[id] = [xI, 40 + i * pasoI]; }); nivel2.forEach((id, i) => { pos[id] = [xF, 40 + i * pasoF]; });
  const gF = el('g', {}), gN = el('g', {}); svg.append(gF, gN);
  const fil = [];
  const curva = (a, b, col, de, a2) => { const [x1, y1] = pos[a], [x2, y2] = pos[b]; const m = (x1 + x2) / 2; const p = el('path', { d: `M${x1 + 6},${y1} C${m},${y1} ${m},${y2} ${x2 - 10},${y2}`, class: 'fil', stroke: col }); gF.append(p); fil.push({ de, a: a2, p }); };
  for (const id of ORDEN_IND) { const I = IND[id]; (I.usa || []).forEach((c) => curva(c, id, COLI[id], c, id)); (I.de || []).forEach((d) => curva(d, id, COLI[id], d, id)); }
  // qué toca cada nodo, hacia atrás y hacia delante
  const nodos = [];
  D.capas.forEach((c) => { const [x, y] = pos[c.id]; const g = el('g', { class: 'g-nodo', transform: `translate(${x},${y})`, tabindex: 0 }); g.append(el('circle', { r: 4, fill: '#a7b3b8' })); const t = el('text', { x: -14, y: 4, 'text-anchor': 'end' }); t.textContent = `${c.n} · ${c.corto}`; g.append(t); gN.append(g); nodos.push({ id: c.id, g }); });
  for (const id of ORDEN_IND) { const I = IND[id]; const [x, y] = pos[id]; const g = el('g', { class: 'g-nodo ind', transform: `translate(${x},${y})`, tabindex: 0 }); g.append(el('circle', { r: 9, fill: '#0b0f11', stroke: COLI[id], 'stroke-width': 2 })); const t = el('text', { x: 16, y: 1 }); t.textContent = `${id} · ${I.nombre}`; const f = el('text', { x: 16, y: 15, class: 'f' }); f.textContent = I.formula; g.append(t, f); gN.append(g); nodos.push({ id, g }); }
  const foco = (id) => { svg.classList.toggle('foco', !!id); if (!id) return;
    // capa: todo lo que alimenta; índice: solo lo que lo compone
    const comp = IND[id] ? (() => { const r = new Set([id]); const sub = (n) => fil.filter((f) => f.a === n).forEach((f) => { r.add(f.de); sub(f.de); }); sub(id); return r; })() : (() => { const r = new Set([id]); const sube = (n) => fil.filter((f) => f.de === n).forEach((f) => { r.add(f.a); sube(f.a); }); sube(id); return r; })();
    fil.forEach((f) => f.p.classList.toggle('on', comp.has(f.de) && comp.has(f.a))); nodos.forEach((n) => n.g.classList.toggle('on', comp.has(n.id))); };
  nodos.forEach((n) => { n.g.addEventListener('pointerenter', () => foco(n.id)); n.g.addEventListener('pointerleave', () => foco(null)); n.g.addEventListener('focus', () => foco(n.id)); n.g.addEventListener('blur', () => foco(null)); if (capa[n.id]) n.g.addEventListener('click', () => abrirFicha(capa[n.id])); });
  const sinUso = D.capas.filter((c) => !fil.some((f) => f.de === c.id)).map((c) => c.corto);
  $('#gen-nota').textContent = `Índices exploratorios con pesos iguales; no son índices validados. Cada índice se reescala 0–1 entre sus percentiles 2 y 98. ⊕ suma sin restar: 1 − ∏(1 − x).${sinUso.length ? ' Capas sin índice: ' + sinUso.join(', ') + '.' : ''}`;
})();

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
const MODOS = [...['C', 'O', 'E', 'V', 'A', 'P', 'S', 'M', 'K'].map((id) => [id, IND[id].nombre]), ...D.capas.map((c) => [c.id, c.corto])];
$('#chips').innerHTML = MODOS.map(([m, t]) => `<button class="chip" data-modo3d="${m}" aria-pressed="false">${IND[m] ? `<b>${m}</b>` : ''}${t}</button>`).join('');
raiz.querySelectorAll('[data-modo3d]').forEach((b) => { b.onclick = () => pintar(b.dataset.modo3d, $('#ata').checked ? b.dataset.modo3d : alturaActual); });
$('#sel-altura').innerHTML = MODOS.map(([m]) => `<option value="${m}">${nombreDe(m)}</option>`).join('');
$('#sel-altura').onchange = (e) => pintar(colorActual, e.target.value);
$('#relieve-texto').textContent = 'Cada capa del encuadre se vuelve terreno: sube donde su valor es mayor. Elija una capa para vestir la superficie con sus valores, cambie la capa que da la altura para cruzarlas y haga clic en un pico para acercarse.';
pintar('C', 'C');
// pasar el cursor: valor de altura y color en ese punto
const ptr = new THREE.Vector2(); const tip = $('#tip-relieve'); const rayR = new THREE.Raycaster(); rayR.params.Points.threshold = 40;
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
return { pintar, abrirFicha: (id) => abrirFicha(capa[id]), parar: () => { vivo = false; obsEntrada.disconnect(); removeEventListener('keydown', alEsc); ctrl3d.dispose(); renderer.dispose(); } };
}
