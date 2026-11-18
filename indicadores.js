// Pila isométrica de los indicadores de Kennedy, con la misma transición que Salento.
// Datos: las mallas de picos de cada indicador (assets/indicadores.json). Cada estrato se pre-renderiza
// una vez en dos imágenes con la misma cámara ortográfica: plano y con picos.
import * as THREE from 'three';

const dec = (b) => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };

export async function iniciarIndicadores(sec, alProgreso = () => {}) {
  const $ = (s) => sec.querySelector(s);
  const D = await (await fetch('assets/indicadores.json?v=1')).json();
  const NC = D.length; const orden = D; // 01 abajo … arriba
  const IMG_W = 760;
  const [X0, X1, Y0, Y1] = D[0].b; const ANCHO = X1 - X0; const ALTO = ANCHO * 0.13; // altura visual del pico máximo (exagerada)

  const cv = document.createElement('canvas');
  const ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  ren.setPixelRatio(1); ren.outputColorSpace = THREE.SRGBColorSpace;
  const esc = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223038, 1.3); esc.add(hemi);
  const sol = new THREE.DirectionalLight(0xffffff, 1.5); sol.position.set(-0.5, 1, 0.4); esc.add(sol);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1e5, 1e5);
  const AZ = (-38 * Math.PI) / 180; const EL = (33 * Math.PI) / 180;
  cam.position.set(Math.sin(AZ) * Math.cos(EL) * 1e4, Math.sin(EL) * 1e4, Math.cos(AZ) * Math.cos(EL) * 1e4); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const esquinas = [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]].map(([x, y]) => [x, -y]); // y al norte → −z
  const proy = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse); return [v.x, v.y]; };
  const pts = esquinas.flatMap(([x, z]) => [proy(x, 0, z), proy(x, ALTO, z)]);
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]); const mg = (Math.max(...xs) - Math.min(...xs)) * 0.015;
  cam.left = Math.min(...xs) - mg; cam.right = Math.max(...xs) + mg; cam.top = Math.max(...ys) + mg; cam.bottom = Math.min(...ys) - mg; cam.updateProjectionMatrix();
  const RATIO = (cam.top - cam.bottom) / (cam.right - cam.left);
  ren.setSize(IMG_W, Math.round(IMG_W * RATIO), false);
  const base = esquinas.map(([x, z]) => { const [px, py] = proy(x, 0, z); return [(px - cam.left) / (cam.right - cam.left), (cam.top - py) / (cam.top - cam.bottom)]; });
  const iDer = base.reduce((b, p, i) => (p[0] > base[b][0] ? i : b), 0);
  // losa de fondo: el encuadre de Kennedy en gris oscuro, para que cada estrato se lea como una lámina
  const losa = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO, Y1 - Y0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x14191c }));
  losa.position.y = -1; esc.add(losa);
  const foto = () => new Promise((ok) => cv.toBlob((b) => ok(URL.createObjectURL(b)), 'image/webp', 0.9));

  for (let n = 0; n < NC; n++) {
    const d = orden[n]; const q = new Uint16Array(dec(d.pos).buffer); const nv = d.nV;
    const pos = new Float32Array(nv * 3); const h = new Float32Array(nv);
    for (let k = 0; k < nv; k++) { pos[k * 3] = d.b[0] + (q[k * 3] / 65535) * (d.b[1] - d.b[0]); pos[k * 3 + 2] = -(d.b[2] + (q[k * 3 + 1] / 65535) * (d.b[3] - d.b[2])); h[k] = q[k * 3 + 2] / 65535; }
    const cu = dec(d.col); const col = new Float32Array(nv * 3); for (let k = 0; k < nv * 3; k++) col[k] = cu[k] / 255;
    const qi = new Uint16Array(dec(d.idx).buffer); const idx = new Uint32Array(d.nF * 6);
    for (let f = 0; f < d.nF; f++) { const a = qi[f * 4], b = qi[f * 4 + 1], c = qi[f * 4 + 2], e = qi[f * 4 + 3]; idx.set([a, b, c, a, c, e], f * 6); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const plano = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    esc.add(plano); ren.render(esc, cam); d.imgPlano = await foto(); esc.remove(plano);
    for (let k = 0; k < nv; k++) pos[k * 3 + 1] = h[k] * ALTO; geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    const relieve = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    esc.add(relieve); ren.render(esc, cam); d.imgRelieve = await foto(); esc.remove(relieve);
    geo.dispose(); plano.material.dispose(); relieve.material.dispose();
    d.n2 = String(n + 1).padStart(2, '0'); alProgreso((n + 1) / NC);
    await new Promise((r) => setTimeout(r, 0));
  }
  ren.dispose(); losa.geometry.dispose(); losa.material.dispose();

  const pilaEl = $('#pila-ind');
  const poli = base.map(([x, y]) => `${x},${(y * RATIO).toFixed(4)}`).join(' ');
  pilaEl.innerHTML = '<svg class="pila__guias" aria-hidden="true"></svg>' + orden.map((d, i) => `
    <div class="estrato" data-id="${d.code}" style="--i:${i}">
      <img class="estrato__plano" src="${d.imgPlano}" alt="" draggable="false">
      <img class="estrato__relieve" src="${d.imgRelieve}" alt="" draggable="false">
      <svg class="estrato__contorno" viewBox="0 0 1 ${RATIO.toFixed(4)}" preserveAspectRatio="none" aria-hidden="true"><polygon class="estrato__borde" points="${poli}" vector-effect="non-scaling-stroke"/><polygon class="estrato__zona" points="${poli}"/></svg>
    </div>`).join('') + `<ol class="pila__rotulos">${orden.map((d) => `<li class="rotulo" data-id="${d.code}"><button type="button"><span class="rotulo__num">${d.code}</span><span class="rotulo__nombre">${d.name}</span></button></li>`).join('')}</ol>`;
  const estratos = [...pilaEl.querySelectorAll('.estrato')]; const rotulos = [...pilaEl.querySelectorAll('.rotulo')];
  const guias = pilaEl.querySelector('.pila__guias');
  function medir() {
    const vw = document.documentElement.clientWidth; const vh = innerHeight; const movil = vw < 820;
    const pAncho = movil ? vw * 0.52 : Math.min(640, vw * 0.4); const hImg = pAncho * RATIO;
    const disponible = movil ? Math.max(460, vh * 0.62) : Math.max(560, vh - 200);
    const paso = Math.max(16, Math.min(46, (disponible - hImg) / (NC - 1))); const alto = (NC - 1) * paso + hImg;
    pilaEl.style.width = `${pAncho}px`; pilaEl.style.height = `${alto}px`; pilaEl.style.setProperty('--paso', paso);
    const topDe = (i) => (NC - 1 - i) * paso;
    estratos.forEach((e, i) => { e.style.top = `${topDe(i)}px`; e.style.width = `${pAncho}px`; e.style.height = `${hImg}px`; e.style.zIndex = i + 1; });
    const [dx, dy] = base[iDer];
    rotulos.forEach((r, i) => { r.style.top = `${topDe(i) + dy * hImg}px`; r.style.setProperty('--x', `${dx * pAncho}px`); });
    guias.setAttribute('width', pAncho); guias.setAttribute('height', alto);
    guias.innerHTML = base.filter((_, i) => i !== iDer).map(([x, y]) => `<line x1="${x * pAncho}" x2="${x * pAncho}" y1="${y * hImg - 14}" y2="${topDe(0) + y * hImg + 20}"/>`).join('');
  }
  medir(); addEventListener('resize', medir);
  let hover = null; let fijo = null;
  function estado() {
    const act = hover ?? fijo; const ia = act ? orden.findIndex((d) => d.code === act) : -1;
    pilaEl.toggleAttribute('data-activo', ia >= 0);
    estratos.forEach((e, i) => { e.dataset.estado = ia < 0 ? 'reposo' : i === ia ? 'activo' : i > ia ? 'encima' : 'debajo'; });
    rotulos.forEach((r, i) => { r.dataset.estado = ia < 0 ? 'reposo' : i === ia ? 'activo' : i > ia ? 'encima' : 'atenuado'; });
  }
  const ficha = $('#ficha-ind');
  function abrir(code) {
    const d = orden.find((x) => x.code === code); fijo = code; estado();
    const rampa = `linear-gradient(90deg, ${d.ramp.join(',')})`;
    ficha.innerHTML = `<button class="cerrar" aria-label="Cerrar">✕</button>
      <p class="etq"><b style="color:${d.ramp[d.ramp.length - 1]}">${d.code}</b> · indicador ${d.n2} de ${NC}</p>
      <h3>${d.name}</h3>
      <figure class="ind-planta"><img src="${d.plan}" alt="Lámina de ${d.name}"><figcaption>Lámina actual</figcaption></figure>
      ${d.plan2020 ? `<figure class="ind-planta"><img src="${d.plan2020}" alt="Lámina de ${d.name} en 2020"><figcaption>Antes de 2020</figcaption></figure>` : ''}
      <div class="ind-rampa" style="background:${rampa}"></div><div class="ind-extremos"><span>bajo</span><span>alto</span></div>
      <p class="desc">La altura de cada pico es la intensidad del indicador sobre el encuadre de Kennedy; el color sigue su rampa.</p>`;
    ficha.classList.add('on'); sec.classList.add('abierto');
    ficha.querySelector('.cerrar').onclick = cerrar;
  }
  function cerrar() { ficha.classList.remove('on'); sec.classList.remove('abierto'); fijo = null; estado(); }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && ficha.classList.contains('on')) cerrar(); });
  estratos.forEach((e) => { const z = e.querySelector('.estrato__zona'); z.addEventListener('pointerenter', () => { hover = e.dataset.id; estado(); }); z.addEventListener('click', () => abrir(e.dataset.id)); });
  rotulos.forEach((r) => { const b = r.querySelector('button'); b.addEventListener('pointerenter', () => { hover = r.dataset.id; estado(); }); b.addEventListener('focus', () => { hover = r.dataset.id; estado(); }); b.addEventListener('blur', () => { hover = null; estado(); }); b.addEventListener('click', () => abrir(r.dataset.id)); });
  pilaEl.addEventListener('pointerleave', () => { hover = null; estado(); });
  estado(); requestAnimationFrame(() => pilaEl.classList.add('pila-lista'));
}
