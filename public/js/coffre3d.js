// Le coffre commun en vraie 3D (Three.js, WebGL), façon dark fantasy :
//  - corps en planches de bois sombre biseautées (veinures et nœuds dessinés à la volée, en relief) ;
//  - couvercle bombé : 7 planches en arc et deux joues pleines, monté sur deux charnières à l'arrière ;
//  - fer martelé : cornières aux quatre coins, bandes haute et basse, deux arceaux sur le couvercle, tous cloutés ;
//  - serrure en losange avec son moraillon, et la gemme verte du coffre commun sertie sur le couvercle.
// Lumières : une principale chaude (avec ombres), un contre-jour de la couleur de la rareté, et une lumière
// dans le coffre qui s'allume quand le couvercle se soulève.
//
// createChest(hôte, options) → { setTint, setLeak, setOpen, hit, open, reset, dispose } ou null sans WebGL.
import * as THREE from '../vendor/three/three.module.min.js';

// Dimensions (unités Three.js) : corps W × D × H, épaisseur des planches T, couvercle : lèvre A + arc RY
const W = 1.6;
const D = 1.08;
const H = 0.74;
const T = 0.07;
const A = 0.08;
const RY = 0.36;
const LID_PLANKS = 7;
const BAND_X = W / 2 - 0.2; // les deux arceaux de fer

// ---------------------------------------------------------------------------
// Textures dessinées à la volée (une fois) : veinures du bois, fer martelé
// ---------------------------------------------------------------------------
function noiseCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return c;
}
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const rand = mulberry(7);
  // Bois : fond brun, veinures ondulées le long des planches, quelques nœuds
  const wood = noiseCanvas(512, (g, n) => {
    g.fillStyle = '#5a3a22';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) {
      const y = rand() * n;
      const amp = 2 + rand() * 6;
      const freq = 0.004 + rand() * 0.01;
      const ph = rand() * 6.28;
      g.strokeStyle = rand() < 0.5 ? `rgba(20,10,4,${0.12 + rand() * 0.3})` : `rgba(140,96,60,${0.06 + rand() * 0.14})`;
      g.lineWidth = 0.6 + rand() * 2.2;
      g.beginPath();
      for (let x = 0; x <= n; x += 8) g.lineTo(x, y + Math.sin(x * freq + ph) * amp);
      g.stroke();
    }
    for (let k = 0; k < 5; k++) {
      const cx = rand() * n;
      const cy = rand() * n;
      for (let r = 14; r > 1; r -= 2.5) {
        g.strokeStyle = `rgba(25,12,5,${0.25 + (14 - r) * 0.03})`;
        g.lineWidth = 1.4;
        g.beginPath();
        g.ellipse(cx, cy, r * 2.2, r * 0.8, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    const img = g.getImageData(0, 0, n, n);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (rand() - 0.5) * 18;
      img.data[i] += v;
      img.data[i + 1] += v * 0.8;
      img.data[i + 2] += v * 0.6;
    }
    g.putImageData(img, 0, 0);
  });
  // Fer martelé : gris sombre, petites cupules
  const iron = noiseCanvas(256, (g, n) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 500; i++) {
      const x = rand() * n;
      const y = rand() * n;
      const r = 2 + rand() * 7;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const d = rand() < 0.5;
      grd.addColorStop(0, d ? 'rgba(40,40,40,.5)' : 'rgba(200,200,200,.4)');
      grd.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  const mk = (canvas, repeat, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  TEX = { wood: mk(wood, 1.2, true), woodBump: mk(wood, 1.2, false), iron: mk(iron, 3, false) };
  return TEX;
}
/** Hasard reproductible (le coffre est le même à chaque fois). */
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Pièces du coffre
// ---------------------------------------------------------------------------
/** Une planche (ou une plaque de fer) biseautée : longueur selon x, hauteur selon y, épaisseur selon z. */
function slab(len, h, thick, mat, bevel = 0.012) {
  const b = Math.min(bevel, h / 3, len / 3);
  const shape = new THREE.Shape();
  shape.moveTo(-len / 2 + b, -h / 2 + b);
  shape.lineTo(len / 2 - b, -h / 2 + b);
  shape.lineTo(len / 2 - b, h / 2 - b);
  shape.lineTo(-len / 2 + b, h / 2 - b);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, thick - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -(thick - 2 * b) / 2);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
/** Un clou à tête ronde. */
const rivetGeo = new THREE.SphereGeometry(0.026, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
function rivet(mat) {
  const m = new THREE.Mesh(rivetGeo, mat);
  m.castShadow = true;
  return m;
}
/** Point de l'arc du couvercle (θ = 0 devant, π derrière), en y/z, décalé de « off » vers l'extérieur. */
function arcPoint(t, off = 0) {
  return { z: (D / 2 + off) * Math.cos(t), y: A + (RY + off) * Math.sin(t) };
}
/** Normale de l'arc au point θ : angle autour de x. */
function arcNormalAngle(t) {
  return Math.atan2(Math.sin(t) / RY, Math.cos(t) / (D / 2));
}

function buildChest() {
  const tx = textures();
  const rand = mulberry(11);
  const woods = [0, 1, 2, 3].map((i) => {
    const map = tx.wood.clone();
    map.offset.set(i * 0.27, i * 0.41);
    map.needsUpdate = true;
    const bump = tx.woodBump.clone();
    bump.offset.copy(map.offset);
    bump.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.2, color: new THREE.Color(['#8a6a54', '#7c5e49', '#93715a', '#73553f'][i]), roughness: 0.82, metalness: 0 });
  });
  const wood = () => woods[Math.floor(rand() * woods.length)];
  const iron = new THREE.MeshStandardMaterial({ color: '#4a4a52', metalness: 0.9, roughness: 0.48, bumpMap: tx.iron, bumpScale: 1.4 });
  const ironDark = new THREE.MeshStandardMaterial({ color: '#2a2a30', metalness: 0.85, roughness: 0.55, bumpMap: tx.iron, bumpScale: 1 });
  const rivetMat = new THREE.MeshStandardMaterial({ color: '#8a8a94', metalness: 1, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0d0805', roughness: 1 });

  const chest = new THREE.Group();
  const body = new THREE.Group();
  chest.add(body);

  // --- Corps : 4 planches par face ---
  const rows = 4;
  const ph = H / rows;
  for (let i = 0; i < rows; i++) {
    const y = ph * (i + 0.5);
    for (const side of [1, -1]) {
      const p = slab(W, ph - 0.012, T, wood(), 0.014);
      p.position.set((rand() - 0.5) * 0.01, y, side * (D / 2 - T / 2));
      p.rotation.z = (rand() - 0.5) * 0.012;
      body.add(p);
      const q = slab(D - 2 * T + 0.004, ph - 0.012, T, wood(), 0.014);
      q.rotation.y = Math.PI / 2;
      q.rotation.x = (rand() - 0.5) * 0.012;
      q.position.set(side * (W / 2 - T / 2), y, 0);
      body.add(q);
    }
  }
  // Fond et intérieur sombre (cache les joints entre les planches)
  const inside = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T + 0.01, H - 0.02, D - 2 * T + 0.01), new THREE.MeshStandardMaterial({ color: '#1a0f08', roughness: 1, side: THREE.BackSide }));
  inside.position.y = H / 2 + 0.01;
  body.add(inside);
  const floor = slab(W, D, 0.05, dark, 0.01);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.025;
  body.add(floor);
  // La lumière dans le coffre : un fond qui brille + une lampe
  const glowMat = new THREE.MeshBasicMaterial({ color: '#2fe38a', transparent: true, opacity: 0 });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T, D - 2 * T), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = H - 0.18;
  body.add(glow);

  // --- Fer du corps : cornières aux 4 coins, bandes haute et basse, clous ---
  const cw = 0.15; // largeur d'une aile de cornière
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const f = slab(cw, H + 0.03, 0.026, iron, 0.008);
      f.position.set(sx * (W / 2 - cw / 2 + 0.006), H / 2, sz * (D / 2 + 0.008));
      body.add(f);
      const s = slab(cw, H + 0.03, 0.026, iron, 0.008);
      s.rotation.y = Math.PI / 2;
      s.position.set(sx * (W / 2 + 0.008), H / 2, sz * (D / 2 - cw / 2 + 0.006));
      body.add(s);
      for (const yy of [0.12, H / 2, H - 0.12]) {
        const r1 = rivet(rivetMat);
        r1.rotation.x = sz * Math.PI / 2;
        r1.position.set(sx * (W / 2 - cw / 2 + 0.006), yy, sz * (D / 2 + 0.021));
        body.add(r1);
        const r2 = rivet(rivetMat);
        r2.rotation.z = -sx * Math.PI / 2;
        r2.position.set(sx * (W / 2 + 0.021), yy, sz * (D / 2 - cw / 2 + 0.006));
        body.add(r2);
      }
    }
  }
  for (const y of [0.05, H - 0.045]) {
    for (const sz of [1, -1]) {
      const b = slab(W - 2 * cw + 0.02, 0.07, 0.02, ironDark, 0.006);
      b.position.set(0, y, sz * (D / 2 + 0.005));
      body.add(b);
    }
    for (const sx of [1, -1]) {
      const b = slab(D - 2 * cw + 0.02, 0.07, 0.02, ironDark, 0.006);
      b.rotation.y = Math.PI / 2;
      b.position.set(sx * (W / 2 + 0.005), y, 0);
      body.add(b);
    }
  }
  // Serrure : plaque en losange cloutée, trou de serrure
  const lockShape = new THREE.Shape();
  const ls = 0.15;
  lockShape.moveTo(0, ls);
  lockShape.lineTo(ls, 0);
  lockShape.lineTo(0, -ls);
  lockShape.lineTo(-ls, 0);
  lockShape.closePath();
  const lockGeo = new THREE.ExtrudeGeometry(lockShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2 });
  const lock = new THREE.Mesh(lockGeo, iron);
  lock.castShadow = true;
  lock.position.set(0, H - 0.2, D / 2 + 0.01);
  body.add(lock);
  for (const [x, y] of [[0, ls - 0.04], [ls - 0.04, 0], [0, -ls + 0.04], [-ls + 0.04, 0]]) {
    const r = rivet(rivetMat);
    r.rotation.x = Math.PI / 2;
    r.scale.setScalar(0.75);
    r.position.set(x, H - 0.2 + y, D / 2 + 0.034);
    body.add(r);
  }
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 16), dark);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(0, H - 0.18, D / 2 + 0.035);
  body.add(keyhole);
  const keySlot = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.02), dark);
  keySlot.position.set(0, H - 0.215, D / 2 + 0.035);
  body.add(keySlot);

  // --- Couvercle, monté sur charnière à l'arrière ---
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H, -D / 2);
  chest.add(lidPivot);
  const lid = new THREE.Group();
  lid.position.set(0, 0, D / 2);
  lidPivot.add(lid);
  // Lèvre (devant et derrière)
  for (const sz of [1, -1]) {
    const lip = slab(W - 2 * T, A, T, wood(), 0.012);
    lip.position.set(0, A / 2, sz * (D / 2 - T / 2));
    lid.add(lip);
  }
  // Planches en arc
  for (let i = 0; i < LID_PLANKS; i++) {
    const t1 = (Math.PI * i) / LID_PLANKS;
    const t2 = (Math.PI * (i + 1)) / LID_PLANKS;
    const a1 = arcPoint(t1, -T / 2);
    const a2 = arcPoint(t2, -T / 2);
    const len = Math.hypot(a2.z - a1.z, a2.y - a1.y) + 0.012;
    const tm = (t1 + t2) / 2;
    const m = arcPoint(tm, -T / 2 + 0.002);
    const p = slab(W - 2 * T + 0.004, len, T, wood(), 0.014);
    p.rotation.x = -arcNormalAngle(tm);
    p.position.set((rand() - 0.5) * 0.008, m.y, m.z);
    lid.add(p);
  }
  // Joues pleines (bois), cerclées de fer
  const capShape = (off) => {
    const s = new THREE.Shape();
    s.moveTo(D / 2 + off, 0);
    s.lineTo(D / 2 + off, A);
    for (let k = 1; k <= 32; k++) {
      const t = (Math.PI * k) / 32;
      s.lineTo((D / 2 + off) * Math.cos(t), A + (RY + off) * Math.sin(t));
    }
    s.lineTo(-(D / 2 + off), 0);
    s.closePath();
    return s;
  };
  for (const sx of [1, -1]) {
    const cg = new THREE.ExtrudeGeometry(capShape(-0.004), { depth: T - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 32 });
    const cap = new THREE.Mesh(cg, wood());
    cap.castShadow = cap.receiveShadow = true;
    cap.rotation.y = Math.PI / 2;
    cap.position.set(sx * (W / 2 - T / 2) - (T - 0.02) / 2, 0, 0);
    lid.add(cap);
  }
  // Arceaux de fer sur le couvercle (épais, cloutés), et bordure de fer sur les joues
  const archShape = (inner, outer) => {
    const s = new THREE.Shape();
    const pts = [];
    pts.push([D / 2 + outer, 0], [D / 2 + outer, A]);
    for (let k = 1; k <= 40; k++) {
      const t = (Math.PI * k) / 40;
      pts.push([(D / 2 + outer) * Math.cos(t), A + (RY + outer) * Math.sin(t)]);
    }
    pts.push([-(D / 2 + outer), 0], [-(D / 2 + inner), 0]);
    for (let k = 40; k >= 0; k--) {
      const t = (Math.PI * k) / 40;
      pts.push([(D / 2 + inner) * Math.cos(t), A + (RY + inner) * Math.sin(t)]);
    }
    pts.push([D / 2 + inner, 0]);
    s.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
    s.closePath();
    return s;
  };
  const archGeo = (width) => {
    const g = new THREE.ExtrudeGeometry(archShape(-0.01, 0.024), { depth: width - 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 40 });
    g.translate(0, 0, -(width - 0.016) / 2);
    g.rotateY(Math.PI / 2);
    return g;
  };
  const bandW = 0.15;
  for (const sx of [1, -1]) {
    const arch = new THREE.Mesh(archGeo(bandW), iron);
    arch.castShadow = arch.receiveShadow = true;
    arch.position.x = sx * BAND_X;
    lid.add(arch);
    const rim = new THREE.Mesh(archGeo(0.05), ironDark);
    rim.castShadow = true;
    rim.position.x = sx * (W / 2 - 0.02);
    lid.add(rim);
    for (let k = 0; k <= 6; k++) {
      const t = (Math.PI * k) / 6;
      const pt = arcPoint(t, 0.024);
      const r = rivet(rivetMat);
      const na = arcNormalAngle(t);
      // la tête du clou regarde vers l'extérieur de l'arc
      r.rotation.x = Math.PI / 2 - na;
      r.position.set(sx * BAND_X, pt.y, pt.z);
      lid.add(r);
    }
  }
  // Bande de fer le long du bord avant du couvercle, et moraillon qui descend sur la serrure
  const lipBand = slab(W - 0.02, 0.06, 0.02, ironDark, 0.006);
  lipBand.position.set(0, 0.035, D / 2 + 0.006);
  lid.add(lipBand);
  const hasp = slab(0.1, 0.2, 0.022, iron, 0.008);
  hasp.position.set(0, -0.02, D / 2 + 0.024);
  lid.add(hasp);
  const haspRivet = rivet(rivetMat);
  haspRivet.rotation.x = Math.PI / 2;
  haspRivet.position.set(0, 0.04, D / 2 + 0.036);
  lid.add(haspRivet);
  // Charnières à l'arrière
  for (const sx of [1, -1]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 16), iron);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(sx * BAND_X, H, -D / 2 - 0.02);
    hinge.castShadow = true;
    chest.add(hinge);
  }

  // --- La gemme verte, sertie sur le devant du couvercle ---
  const tg = 0.95; // ~54° depuis l'avant
  const gp = arcPoint(tg, 0.0);
  const gemGroup = new THREE.Group();
  gemGroup.position.set(0, gp.y, gp.z);
  gemGroup.rotation.x = -arcNormalAngle(tg);
  lid.add(gemGroup);
  const setting = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.04, 32), iron);
  setting.rotation.x = Math.PI / 2;
  setting.position.z = 0.02;
  setting.castShadow = true;
  gemGroup.add(setting);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.016, 10, 32), rivetMat);
  ring.position.z = 0.042;
  gemGroup.add(ring);
  // Taille « émeraude » : une table plate, une couronne à 8 facettes
  const gemMat = new THREE.MeshPhysicalMaterial({ color: '#12a85c', emissive: '#06703a', emissiveIntensity: 0.35, roughness: 0.06, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2, flatShading: true });
  const gem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.092, 0.05, 8), gemMat);
  gem.rotation.x = Math.PI / 2;
  gem.rotation.y = Math.PI / 8;
  gem.position.z = 0.065;
  gemGroup.add(gem);
  const pavilion = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.07, 0.015, 8), gemMat);
  pavilion.rotation.x = Math.PI / 2;
  pavilion.rotation.y = Math.PI / 8;
  pavilion.position.z = 0.034;
  gemGroup.add(pavilion);
  for (let k = 0; k < 4; k++) {
    const prong = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 6), rivetMat);
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    prong.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.06);
    prong.rotation.x = Math.PI / 2;
    gemGroup.add(prong);
  }
  const gemLight = new THREE.PointLight('#3cf2a3', 0.6, 0.9, 2);
  gemLight.position.z = 0.16;
  gemGroup.add(gemLight);

  return { chest, lidPivot, glow, glowMat, gemMat, gemLight };
}

/** Un petit environnement pour les reflets du fer et de la gemme (une pièce sombre avec deux fenêtres de lumière). */
function envMap(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  room.background = new THREE.Color('#0c0a12');
  const lamp = (color, w, h, pos, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  lamp('#ffe2b8', 6, 3, new THREE.Vector3(0, 6, 3), 3);
  lamp('#9fb4ff', 4, 4, new THREE.Vector3(-6, 2, -2), 1.2);
  lamp('#ffffff', 3, 5, new THREE.Vector3(6, 1, 4), 1.5);
  const env = pm.fromScene(room, 0.04).texture;
  pm.dispose();
  return env;
}

// ---------------------------------------------------------------------------
// Le coffre dans une page
// ---------------------------------------------------------------------------
export function createChest(host, { idle = true, tint = '#2fe38a', leak = 0, zoom = 1 } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'chest3d-canvas';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.environment = envMap(renderer);
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  /** Place la caméra : elle recule quand le cadre est étroit (téléphone), pour que le coffre tienne en largeur. */
  const placeCamera = () => {
    const f = Math.max(1, 1.3 / camera.aspect) / zoom;
    camera.position.set(0, 1.55 * f, 4.6 * f);
    camera.lookAt(0, 0.5, 0);
  };

  // Lumières : principale chaude (ombres), douce d'ambiance, contre-jour teinté, lampe dans le coffre
  scene.add(new THREE.HemisphereLight('#a99cc4', '#120c08', 0.5));
  const key = new THREE.DirectionalLight('#ffe0bd', 2.6);
  key.position.set(-2.2, 4, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -1.6;
  key.shadow.camera.right = 1.6;
  key.shadow.camera.top = 1.6;
  key.shadow.camera.bottom = -1.6;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#b8c8ff', 0.55);
  fill.position.set(3, 1.5, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(tint, 1.1);
  rim.position.set(0.5, 2.2, -3.5);
  scene.add(rim);

  const parts = buildChest();
  const root = new THREE.Group(); // tremblements, écrasement
  root.add(parts.chest);
  parts.chest.position.y = 0;
  scene.add(root);
  const inner = new THREE.PointLight(tint, 0, 3.2, 1.6);
  inner.position.set(0, H - 0.1, 0);
  parts.chest.add(inner);
  // Ombre au sol
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.55 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const blobTex = new THREE.CanvasTexture(noiseCanvas(128, (g, n) => {
    const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grd.addColorStop(0, 'rgba(0,0,0,.7)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, n, n);
  }));
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.002;
  scene.add(blob);

  // État animé
  const st = {
    tint: new THREE.Color(tint),
    leak, leakT: leak,
    open: 0, openT: 0, openV: 0, // angle du couvercle (degrés), cible, vitesse (ressort)
    squash: 0, squashV: 0, jolt: 0,
    spin: 0, t: 0, idle,
    alive: true, visible: true,
  };
  const applyTint = () => {
    rim.color.copy(st.tint);
    inner.color.copy(st.tint);
    parts.glowMat.color.copy(st.tint);
  };
  applyTint();

  function resize() {
    const w = host.clientWidth || 300;
    const h = host.clientHeight || 260;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    placeCamera();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => {
    st.visible = e.isIntersecting;
  });
  io.observe(host);

  let last = performance.now();
  let raf = 0;
  function frame(now) {
    if (!st.alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!st.visible) return;
    st.t += dt;
    // Ressort du couvercle
    const k = 120;
    const c = 14;
    st.openV += (k * (st.openT - st.open) - c * st.openV) * dt;
    st.open += st.openV * dt;
    parts.lidPivot.rotation.x = -THREE.MathUtils.degToRad(st.open);
    // Ressort de l'écrasement (coups)
    st.squashV += (-260 * st.squash - 11 * st.squashV) * dt;
    st.squash += st.squashV * dt;
    st.jolt *= Math.pow(0.02, dt);
    root.scale.set(1 + st.squash * 0.6, 1 - st.squash, 1 + st.squash * 0.6);
    root.rotation.z = Math.sin(st.t * 40) * st.jolt * 0.06;
    root.position.x = Math.sin(st.t * 55) * st.jolt * 0.04;
    // Balancement au repos
    const sway = st.idle ? Math.sin(st.t * 0.55) * 0.5 : Math.sin(st.t * 0.5) * 0.18;
    parts.chest.rotation.y = -0.6 + sway + st.spin;
    parts.chest.position.y = st.idle ? Math.sin(st.t * 1.3) * 0.03 + 0.03 : 0;
    // Lumière dans le coffre et gemme qui respire
    st.leak += (st.leakT - st.leak) * Math.min(1, dt * 6);
    // Couvercle fermé, la lumière ne passe que par la fente ; ouvert, elle inonde
    inner.intensity = st.leak * (0.8 + 8 * Math.min(1, Math.max(0, st.open) / 60));
    parts.glowMat.opacity = Math.min(1, st.leak * 1.3);
    const pulse = 0.5 + 0.5 * Math.sin(st.t * 2.4);
    parts.gemMat.emissiveIntensity = 0.25 + pulse * 0.35 + st.leak * 0.6;
    parts.gemLight.intensity = 0.25 + pulse * 0.35;
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    canvas,
    /** Couleur du contre-jour et de la lumière intérieure (la rareté). */
    setTint(color) {
      st.tint.set(color);
      applyTint();
    },
    /** Lumière qui fuit du coffre (0 à 1). */
    setLeak(v) {
      st.leakT = v;
    },
    /** Couvercle entrouvert (degrés). */
    setOpen(deg) {
      st.openT = deg;
    },
    /** Un coup : le coffre s'écrase, tremble, le couvercle saute un peu. */
    hit(n = 0) {
      st.squashV += 6 + n * 1.2;
      st.jolt = Math.min(1.5, 0.8 + n * 0.2);
      st.openV += 260 + n * 40;
    },
    /** Le couvercle s'ouvre en grand (avec un rebond). */
    open() {
      st.openT = 112;
      st.openV += 500;
      st.leakT = 1;
    },
    /** Remet le coffre fermé et éteint. */
    reset() {
      Object.assign(st, { open: 0, openT: 0, openV: 0, squash: 0, squashV: 0, jolt: 0, leak: 0, leakT: 0 });
    },
    setIdle(v) {
      st.idle = v;
    },
    dispose() {
      st.alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
