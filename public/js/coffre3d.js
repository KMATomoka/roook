// Les coffres en vraie 3D (Three.js, WebGL), façon dark fantasy. Quatre modèles, du plus simple au plus luxueux :
//  - commun : planches de bois sombre veinées, fer martelé clouté, serrure en losange, gemme verte ;
//  - rare : bois bleui par le givre, argent poli, cristaux de glace aux coins, saphir, flocons qui flottent ;
//  - épique : bois violet laqué, or, plaques de runes qui brillent, pieds en boule, améthyste, éclats violets ;
//  - légendaire : or ancien ciselé, émail noir, ambres serties partout (une seule teinte), médaillons,
//    pattes de lion, grosse ambre de feu, et une aura dorée (halo, rayons, cercle au sol, quelques braises).
// Forme commune : corps en planches (ou plaques d'or) biseautées, couvercle bombé sur deux charnières à l'arrière,
// cornières aux quatre coins, bandes haute et basse, deux arceaux cloutés sur le couvercle, moraillon sur la serrure.
// Lumières : une principale chaude (avec ombres), un contre-jour de la couleur de la rareté, et une lumière
// dans le coffre qui s'allume quand le couvercle se soulève.
//
// createChest(hôte, options) → { setTint, setLeak, setOpen, hit, open, reset, moveTo, setPaused, setVariant, dispose },
// ou null sans WebGL. Un seul coffre animé par page : moveTo le fait passer de la carte à la scène.
// createShowcase([{ host, variant }]) : la vitrine des autres coffres, tous dessinés par un seul contexte WebGL.
import * as THREE from '../vendor/three/three.module.min.js';

// Dimensions (unités Three.js) : corps W × D × H, épaisseur des planches T, couvercle : lèvre A + arc RY
const W = 1.6;
const D = 1.08;
const H = 0.74;
const T = 0.07;
const A = 0.08;
const RY = 0.36;
const BAND_X = W / 2 - 0.2; // les deux arceaux du couvercle

/** Les quatre coffres : bois (ou or), métaux, gemme et ornements. */
export const VARIANTS = {
  commun: {
    name: 'Coffre commun', tint: '#2fe38a',
    wood: { tex: 'wood', colors: ['#8a6a54', '#7c5e49', '#93715a', '#73553f'], roughness: 0.82, bump: 2.2 },
    metal: { color: '#4a4a52', metalness: 0.9, roughness: 0.48, bump: 1.4 },
    metalDark: { color: '#2a2a30', metalness: 0.85, roughness: 0.55, bump: 1 },
    rivet: { color: '#8a8a94', metalness: 1, roughness: 0.3 },
    gem: { color: '#12a85c', emissive: '#06703a', light: '#3cf2a3', size: 1, sides: 8, prongs: 4 },
  },
  rare: {
    name: 'Coffre rare', tint: '#4fa8ff',
    wood: { tex: 'woodN', colors: ['#9dbde8', '#8badd9', '#a9c8f0', '#85a3cf'], roughness: 0.55, bump: 1.8 },
    metal: { color: '#d4dde9', metalness: 1, roughness: 0.3, bump: 0.6, env: 2.6 },
    metalDark: { color: '#8e9cb2', metalness: 1, roughness: 0.34, bump: 0.5, env: 2.2 },
    rivet: { color: '#f2f7ff', metalness: 1, roughness: 0.16, env: 2.4 },
    gem: { color: '#2f7bff', emissive: '#0b46c4', light: '#7cc0ff', size: 1.1, sides: 12, prongs: 6 },
    ice: true,
    motes: { n: 16, color: '#cfeaff', size: 0.05, r: 1.15, h: 1.5, speed: 0.07 },
  },
  epique: {
    name: 'Coffre épique', tint: '#b26bff',
    wood: { tex: 'woodN', colors: ['#7d4fa6', '#6c4294', '#8a5ab4', '#5f3a84'], roughness: 0.5, bump: 1.6 },
    metal: { color: '#e0ab48', metalness: 1, roughness: 0.32, bump: 0.7, env: 2.4 },
    metalDark: { color: '#8d6328', metalness: 1, roughness: 0.38, bump: 0.7, env: 2 },
    rivet: { color: '#ffd98a', metalness: 1, roughness: 0.18, env: 2.4 },
    gem: { color: '#a45cff', emissive: '#5a16c4', light: '#c88cff', size: 1.22, sides: 8, prongs: 8 },
    runes: '#c98aff',
    feet: 'ball',
    motes: { n: 22, color: '#d7a6ff', size: 0.05, r: 1.2, h: 1.6, speed: 0.11 },
  },
  legendaire: {
    name: 'Coffre légendaire', tint: '#f5b83d',
    gold: { colors: ['#cf9b42', '#c18d38'], roughness: 0.4, bump: 2.8, env: 2.6 },
    rows: 1,
    lidPlanks: 12,
    metal: { color: '#dfb158', metalness: 1, roughness: 0.28, bump: 0.5, env: 2.8 },
    metalDark: { color: '#141116', metalness: 0.5, roughness: 0.2, bump: 0, env: 2 },
    rivet: { color: '#f0c870', metalness: 1, roughness: 0.18, env: 2.6 },
    gem: { color: '#ff7a0a', emissive: '#c43c00', light: '#ff9a3a', size: 1.38, sides: 12, prongs: 8 },
    jewels: true,
    feet: 'paw',
    aura: '#f5b83d',
    motes: { n: 16, color: '#ffb85a', size: 0.04, r: 1.25, h: 1.8, speed: 0.09 },
  },
};
export const VARIANT_IDS = Object.keys(VARIANTS);

// ---------------------------------------------------------------------------
// Textures dessinées à la volée (une fois) : bois, fer martelé, or ciselé, runes, halos
// ---------------------------------------------------------------------------
function noiseCanvas(size, draw, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  draw(c.getContext('2d'), size, h);
  return c;
}
/** Bois : fond, veinures ondulées le long des planches, quelques nœuds, grain. */
function woodCanvas(rand, base, dark, light) {
  return noiseCanvas(512, (g, n) => {
    g.fillStyle = base;
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) {
      const y = rand() * n;
      const amp = 2 + rand() * 6;
      const freq = 0.004 + rand() * 0.01;
      const ph = rand() * 6.28;
      g.strokeStyle = rand() < 0.5 ? `rgba(${dark},${0.12 + rand() * 0.3})` : `rgba(${light},${0.06 + rand() * 0.14})`;
      g.lineWidth = 0.6 + rand() * 2.2;
      g.beginPath();
      for (let x = 0; x <= n; x += 8) g.lineTo(x, y + Math.sin(x * freq + ph) * amp);
      g.stroke();
    }
    for (let k = 0; k < 5; k++) {
      const cx = rand() * n;
      const cy = rand() * n;
      for (let r = 14; r > 1; r -= 2.5) {
        g.strokeStyle = `rgba(${dark},${0.25 + (14 - r) * 0.03})`;
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
}
/** Or ciselé : volutes en S et perles, en motif qui se répète sans raccord. */
function filigreeCanvas() {
  return noiseCanvas(512, (g, n) => {
    g.fillStyle = '#cfcfcf';
    g.fillRect(0, 0, n, n);
    const spiral = (cx, cy, dir, rot) => {
      g.beginPath();
      for (let k = 0; k <= 60; k++) {
        const t = (k / 60) * Math.PI * 3.2;
        const r = 6 + t * 9;
        g.lineTo(cx + Math.cos(dir * t + rot) * r, cy + Math.sin(dir * t + rot) * r);
      }
      g.stroke();
    };
    const motif = (cx, cy) => {
      for (const [w, c] of [[11, '#7a7a7a'], [5, '#ffffff']]) {
        g.lineWidth = w;
        g.strokeStyle = c;
        g.lineCap = 'round';
        spiral(cx - 30, cy, 1, 0);
        spiral(cx + 30, cy, 1, Math.PI);
        g.beginPath();
        g.moveTo(cx - 64, cy + 64);
        g.quadraticCurveTo(cx, cy + 20, cx + 64, cy + 64);
        g.stroke();
      }
      for (const [x, y] of [[cx, cy - 58], [cx - 64, cy + 64], [cx + 64, cy + 64], [cx, cy + 40]]) {
        g.fillStyle = '#7a7a7a';
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(x, y, 5.5, 0, Math.PI * 2);
        g.fill();
      }
    };
    for (const [mx, my] of [[128, 128], [384, 384], [384, 128], [128, 384]]) {
      for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) motif(mx + dx, my + dy);
    }
  });
}
/** Une bande de runes lumineuses (blanc sur transparent, teintées par la matière). */
function runeCanvas(rand) {
  return noiseCanvas(1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.shadowColor = '#fff';
    g.shadowBlur = 18;
    // Branches possibles d'une rune, depuis le trait vertical : (x1, y1) → (x2, y2), en fractions
    const branches = [[0, 0, 1, 0.32], [0, 0.32, 1, 0], [0, 0.3, -1, 0.62], [0, 0.55, 1, 0.85], [0, 0, -1, 0.32], [-1, 0.2, 1, 0.55], [1, 0.45, -1, 0.8], [0, 0.5, 1, 0.25]];
    for (let i = 0; i < 16; i++) {
      const cx = 32 + i * 64;
      const top = 24;
      const span = 80;
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(cx, top);
      g.lineTo(cx, top + span);
      if (rand() < 0.25) {
        g.moveTo(cx + 20, top);
        g.lineTo(cx + 20, top + span);
      }
      const k = 1 + Math.floor(rand() * 2.6);
      for (let b = 0; b < k; b++) {
        const [x1, y1, x2, y2] = branches[Math.floor(rand() * branches.length)];
        g.moveTo(cx + x1 * 18, top + y1 * span);
        g.lineTo(cx + x2 * 18, top + y2 * span);
      }
      g.stroke();
    }
  }, 128);
}
/** Halo rond (blanc au centre, transparent au bord). */
function glowCanvas(stops) {
  return noiseCanvas(128, (g, n) => {
    const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    for (const [o, c] of stops) grd.addColorStop(o, c);
    g.fillStyle = grd;
    g.fillRect(0, 0, n, n);
  });
}
/** Rayons de lumière (pour l'aura du coffre légendaire). */
function raysCanvas(rand) {
  return noiseCanvas(256, (g, n) => {
    g.translate(n / 2, n / 2);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rand() * 0.15;
      const len = n * (0.3 + rand() * 0.14);
      const wid = 0.05 + rand() * 0.06;
      const grd = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a - wid) * len, Math.sin(a - wid) * len);
      g.lineTo(Math.cos(a + wid) * len, Math.sin(a + wid) * len);
      g.closePath();
      g.fill();
    }
  });
}
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const wood = woodCanvas(mulberry(7), '#5a3a22', '20,10,4', '140,96,60');
  const woodN = woodCanvas(mulberry(8), '#7a7a7a', '18,18,22', '190,190,200'); // neutre : la matière lui donne sa teinte
  // Fer martelé : gris sombre, petites cupules
  const rand = mulberry(9);
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
  const fil = filigreeCanvas();
  const mk = (canvas, repeat, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const plain = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  TEX = {
    wood: mk(wood, 1.2, true), woodBump: mk(wood, 1.2, false),
    woodN: mk(woodN, 1.2, true), woodNBump: mk(woodN, 1.2, false),
    iron: mk(iron, 3, false),
    fil: mk(fil, 2.2, true), filBump: mk(fil, 2.2, false),
    runes: plain(runeCanvas(mulberry(12))),
    dot: plain(glowCanvas([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']])),
    halo: plain(glowCanvas([[0, 'rgba(255,255,255,.85)'], [0.3, 'rgba(255,255,255,.32)'], [0.65, 'rgba(255,255,255,.08)'], [1, 'rgba(255,255,255,0)']])),
    ringTex: plain(glowCanvas([[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0)'], [0.72, 'rgba(255,255,255,.75)'], [0.8, 'rgba(255,255,255,.2)'], [1, 'rgba(255,255,255,0)']])),
    rays: plain(raysCanvas(mulberry(14))),
  };
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
/** Une planche (ou une plaque de métal) biseautée : longueur selon x, hauteur selon y, épaisseur selon z. */
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
/** Un clou à tête ronde (ou un cabochon), qui regarde vers +y. */
const rivetGeo = new THREE.SphereGeometry(0.026, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
function rivet(mat) {
  const m = new THREE.Mesh(rivetGeo, mat);
  m.castShadow = true;
  return m;
}
/** Une petite pierre taillée (table plate), qui regarde vers +y. */
const cutGeo = new THREE.CylinderGeometry(0.022, 0.034, 0.022, 8);
cutGeo.translate(0, 0.011, 0);
/** Un chaton (sertissure) sous une pierre, qui regarde vers +y. */
const bezelGeo = new THREE.CylinderGeometry(0.044, 0.048, 0.02, 16);
bezelGeo.translate(0, 0.01, 0);
/** Point de l'arc du couvercle (θ = 0 devant, π derrière), en y/z, décalé de « off » vers l'extérieur. */
function arcPoint(t, off = 0) {
  return { z: (D / 2 + off) * Math.cos(t), y: A + (RY + off) * Math.sin(t) };
}
/** Normale de l'arc au point θ : angle autour de x. */
function arcNormalAngle(t) {
  return Math.atan2(Math.sin(t) / RY, Math.cos(t) / (D / 2));
}

const stdMat = (o, tx) => new THREE.MeshStandardMaterial({
  color: o.color, metalness: o.metalness, roughness: o.roughness, envMapIntensity: o.env || 1,
  ...(o.bump ? { bumpMap: tx.iron, bumpScale: o.bump } : {}),
});
const jewelMat = (color, emissive) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.45, roughness: 0.08, metalness: 0.2, flatShading: true, envMapIntensity: 2.6 });

/** Construit un coffre ; renvoie ses pièces animées. */
function buildChest(variant = 'commun') {
  const V = VARIANTS[variant] || VARIANTS.commun;
  const tx = textures();
  const rand = mulberry(11);
  // Matières du corps : 4 bois (ou 2 ors) qui alternent
  let woods;
  if (V.gold) {
    woods = V.gold.colors.map((color, i) => {
      const map = tx.fil.clone();
      map.offset.set(i * 0.37, i * 0.21);
      map.needsUpdate = true;
      const bump = tx.filBump.clone();
      bump.offset.copy(map.offset);
      bump.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: V.gold.bump, color, metalness: 0.9, roughness: V.gold.roughness, envMapIntensity: V.gold.env });
    });
  } else {
    woods = V.wood.colors.map((color, i) => {
      const map = tx[V.wood.tex].clone();
      map.offset.set(i * 0.27, i * 0.41);
      map.needsUpdate = true;
      const bump = tx[`${V.wood.tex}Bump`].clone();
      bump.offset.copy(map.offset);
      bump.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: V.wood.bump, color: new THREE.Color(color), roughness: V.wood.roughness, metalness: 0 });
    });
  }
  const wood = () => woods[Math.floor(rand() * woods.length)];
  const iron = stdMat(V.metal, tx);
  const ironDark = stdMat(V.metalDark, tx);
  const rivetMat = stdMat(V.rivet, tx);
  const dark = new THREE.MeshStandardMaterial({ color: '#0d0805', roughness: 1 });
  // Coffre légendaire : des ambres, d'une seule teinte (les clous des arceaux deviennent des cabochons)
  const jewels = V.jewels ? [jewelMat('#ffab2e', '#a04c00'), jewelMat('#e0700f', '#7a2c00')] : null;
  let jewelK = 0;
  const nextJewel = () => jewels[jewelK++ % jewels.length];

  const chest = new THREE.Group();
  const body = new THREE.Group();
  chest.add(body);
  const lift = V.feet ? 0.1 : 0; // les pieds soulèvent le coffre

  // --- Corps : 4 planches par face (ou une plaque d'or) ---
  const rows = V.rows || 4;
  const ph = H / rows;
  for (let i = 0; i < rows; i++) {
    const y = ph * (i + 0.5);
    for (const side of [1, -1]) {
      const p = slab(W, ph - 0.012, T, wood(), 0.014);
      p.position.set((rand() - 0.5) * 0.01, y, side * (D / 2 - T / 2));
      p.rotation.z = (rand() - 0.5) * (V.gold ? 0 : 0.012);
      body.add(p);
      const q = slab(D - 2 * T + 0.004, ph - 0.012, T, wood(), 0.014);
      q.rotation.y = Math.PI / 2;
      q.rotation.x = (rand() - 0.5) * (V.gold ? 0 : 0.012);
      q.position.set(side * (W / 2 - T / 2), y, 0);
      body.add(q);
    }
  }
  // Fond et intérieur sombre (cache les joints entre les planches)
  const inside = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T + 0.01, H - 0.02, D - 2 * T + 0.01), new THREE.MeshStandardMaterial({ color: V.gold ? '#120c08' : '#1a0f08', roughness: 1, side: THREE.BackSide }));
  inside.position.y = H / 2 + 0.01;
  body.add(inside);
  const floor = slab(W, D, 0.05, dark, 0.01);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.025;
  body.add(floor);
  // La lumière dans le coffre : un fond qui brille + une lampe
  const glowMat = new THREE.MeshBasicMaterial({ color: V.tint, transparent: true, opacity: 0 });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T, D - 2 * T), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = H - 0.18;
  glow.userData.keep = true;
  body.add(glow);

  // --- Métal du corps : cornières aux 4 coins, bandes haute et basse, clous ---
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
  const ls = V.jewels ? 0.17 : 0.15;
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
    const r = rivet(jewels ? nextJewel() : rivetMat);
    r.rotation.x = Math.PI / 2;
    r.scale.setScalar(jewels ? 0.95 : 0.75);
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

  // --- Pieds (épique : boules d'or ; légendaire : pattes de lion) ---
  if (V.feet) {
    const ballGeo = new THREE.SphereGeometry(0.06, 18, 12);
    const collarGeo = new THREE.CylinderGeometry(0.08, 0.064, 0.024, 18);
    const toeGeo = new THREE.SphereGeometry(0.03, 12, 8);
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const x = sx * (W / 2 - 0.06);
        const z = sz * (D / 2 - 0.06);
        const collar = new THREE.Mesh(collarGeo, iron);
        collar.position.set(x, -0.012, z);
        body.add(collar);
        const ball = new THREE.Mesh(ballGeo, iron);
        ball.position.set(x, -0.04, z);
        body.add(ball);
        if (V.feet === 'paw') {
          // trois griffes tournées vers l'extérieur du coin
          const a0 = Math.atan2(sz, sx);
          for (const da of [-0.6, 0, 0.6]) {
            const toe = new THREE.Mesh(toeGeo, iron);
            toe.position.set(x + Math.cos(a0 + da) * 0.06, -0.07, z + Math.sin(a0 + da) * 0.06);
            body.add(toe);
          }
        }
      }
    }
  }

  // --- Rare : cristaux de glace qui poussent aux quatre coins, en bas ---
  let iceMat = null;
  if (V.ice) {
    iceMat = new THREE.MeshStandardMaterial({ color: '#d6efff', emissive: '#3f9bff', emissiveIntensity: 0.7, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.88, flatShading: true, envMapIntensity: 2.6 });
    const shard = new THREE.OctahedronGeometry(0.065, 0);
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        for (let k = 0; k < 5; k++) {
          const c = new THREE.Mesh(shard, iceMat);
          const hgt = 1.4 + rand() * 2;
          c.scale.set(0.7 + rand() * 0.4, hgt, 0.7 + rand() * 0.4);
          const ox = (rand() - 0.3) * 0.16;
          const oz = (rand() - 0.3) * 0.16;
          c.position.set(sx * (W / 2 + 0.01 - ox), 0.03 + hgt * 0.02, sz * (D / 2 + 0.01 - oz));
          c.rotation.set(sz * (0.25 + rand() * 0.4), rand() * 3, -sx * (0.25 + rand() * 0.4));
          body.add(c);
        }
      }
    }
    // Glaçons qui pendent sous la bande du haut (devant, derrière et sur les côtés)
    const icicle = new THREE.ConeGeometry(1, 1, 6);
    icicle.rotateX(Math.PI); // pointe en bas
    const hang = (x, z, rotY) => {
      if (rand() < 0.3) return; // des trous : pas une rangée de dents
      const len = 0.025 + rand() * rand() * 0.11;
      const c = new THREE.Mesh(icicle, iceMat);
      const r = 0.007 + rand() * 0.006;
      c.scale.set(r, len, r);
      c.rotation.y = rotY;
      c.position.set(x, H - 0.08 - len / 2, z);
      body.add(c);
    };
    for (let x = -0.56; x <= 0.56; x += 0.04 + rand() * 0.06) {
      if (Math.abs(x) > 0.2) hang(x, D / 2 + 0.012, 0);
      hang(x, -D / 2 - 0.012, 0);
    }
    for (let z = -0.32; z <= 0.32; z += 0.04 + rand() * 0.06) {
      for (const sx of [1, -1]) hang(sx * (W / 2 + 0.012), z, 0);
    }
  }

  // --- Épique : plaques d'or gravées de runes qui brillent ---
  let runeMat = null;
  const runeMats = [];
  const runeStrip = (group, wd, hg, pos, rotY, u0, rotX = 0) => {
    const plate = slab(wd + 0.04, hg + 0.04, 0.016, iron, 0.006);
    plate.rotation.set(rotX, rotY, 0, 'YXZ');
    plate.position.copy(pos);
    group.add(plate);
    const geo = new THREE.PlaneGeometry(wd, hg);
    // chaque plaque prend un morceau différent de la bande de runes
    const uw = (wd / hg) * (128 / 1024) * 0.82;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * uw);
    const mat = runeMat.clone();
    runeMats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.userData.keep = true; // pas fusionnée : elle s'allume seule
    m.rotation.set(rotX, rotY, 0, 'YXZ');
    const n = new THREE.Vector3(0, 0, 1).applyEuler(m.rotation);
    m.position.copy(pos).addScaledVector(n, 0.0095);
    group.add(m);
  };
  if (V.runes) {
    runeMat = new THREE.MeshBasicMaterial({ map: tx.runes, color: new THREE.Color(V.runes).multiplyScalar(1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    runeMat.userData.noShadow = true;
    const zf = D / 2 + 0.008;
    runeStrip(body, 0.34, 0.12, new THREE.Vector3(0.375, 0.3, zf), 0, 0.02);
    runeStrip(body, 0.34, 0.12, new THREE.Vector3(-0.375, 0.3, zf), 0, 0.33);
    runeStrip(body, 0.6, 0.1, new THREE.Vector3(0, 0.36, -zf), Math.PI, 0.12);
    runeStrip(body, 0.6, 0.1, new THREE.Vector3(W / 2 + 0.008, 0.36, 0), Math.PI / 2, 0.38);
    runeStrip(body, 0.6, 0.1, new THREE.Vector3(-W / 2 - 0.008, 0.36, 0), -Math.PI / 2, 0.08);
  }

  // --- Légendaire : volutes d'or et pierres sur le devant, médaillons sur les côtés ---
  if (V.jewels) {
    const medGeo = new THREE.TorusGeometry(0.075, 0.016, 8, 32);
    const petalGeo = new THREE.SphereGeometry(0.02, 10, 8);
    for (const sx of [1, -1]) {
      const md = new THREE.Mesh(medGeo, iron);
      md.position.set(sx * 0.4, 0.37, D / 2 + 0.01);
      body.add(md);
      // perles d'or tout autour, comme une fleur
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const pe = new THREE.Mesh(petalGeo, iron);
        pe.position.set(sx * 0.4 + Math.cos(a) * 0.115, 0.37 + Math.sin(a) * 0.115, D / 2 + 0.006);
        body.add(pe);
      }
      const bz = new THREE.Mesh(bezelGeo, iron);
      bz.rotation.x = Math.PI / 2;
      bz.position.set(sx * 0.4, 0.37, D / 2 + 0.004);
      body.add(bz);
      const st = new THREE.Mesh(cutGeo, jewels[1]);
      st.rotation.x = Math.PI / 2;
      st.scale.setScalar(1.25);
      st.position.set(sx * 0.4, 0.37, D / 2 + 0.022);
      body.add(st);
      // médaillon du côté : un anneau d'or et un gros cabochon
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 10, 32), iron);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * (W / 2 + 0.012), 0.37, 0);
      body.add(ring);
      const cab = rivet(jewels[0]);
      cab.rotation.z = -sx * Math.PI / 2;
      cab.scale.setScalar(3.2);
      cab.position.set(sx * (W / 2 + 0.006), 0.37, 0);
      body.add(cab);
    }
    // une rangée de pierres sur les bandes d'émail, devant
    for (const y of [0.05, H - 0.045]) {
      for (let k = -2; k <= 2; k++) {
        if (!k && y > 0.5) continue; // la serrure est là
        const r = rivet(nextJewel());
        r.rotation.x = Math.PI / 2;
        r.position.set(k * 0.22, y, D / 2 + 0.014);
        body.add(r);
      }
    }
  }

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
  const planks = V.lidPlanks || 7;
  for (let i = 0; i < planks; i++) {
    const t1 = (Math.PI * i) / planks;
    const t2 = (Math.PI * (i + 1)) / planks;
    const a1 = arcPoint(t1, -T / 2);
    const a2 = arcPoint(t2, -T / 2);
    const len = Math.hypot(a2.z - a1.z, a2.y - a1.y) + 0.012;
    const tm = (t1 + t2) / 2;
    const m = arcPoint(tm, -T / 2 + 0.002);
    const p = slab(W - 2 * T + 0.004, len, T, wood(), V.gold ? 0.008 : 0.014);
    p.rotation.x = -arcNormalAngle(tm);
    p.position.set((rand() - 0.5) * (V.gold ? 0 : 0.008), m.y, m.z);
    lid.add(p);
  }
  // Joues pleines, cerclées de métal
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
  // Arceaux sur le couvercle (épais, cloutés), et bordure de métal sur les joues
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
      const r = rivet(jewels ? nextJewel() : rivetMat);
      if (jewels) r.scale.setScalar(1.3);
      const na = arcNormalAngle(t);
      // la tête du clou regarde vers l'extérieur de l'arc
      r.rotation.x = Math.PI / 2 - na;
      r.position.set(sx * BAND_X, pt.y, pt.z);
      lid.add(r);
    }
  }
  // Épique : une bande de runes en travers du haut du couvercle
  if (V.runes) {
    const top = arcPoint(Math.PI / 2, 0.006);
    runeStrip(lid, 0.82, 0.1, new THREE.Vector3(0, top.y, top.z), 0, 0.1, -Math.PI / 2);
  }
  // Légendaire : des pierres serties en travers du haut du couvercle
  if (V.jewels) {
    for (let k = -2; k <= 2; k++) {
      const t = Math.PI / 2;
      const pt = arcPoint(t, 0.0);
      const bz = new THREE.Mesh(bezelGeo, iron);
      bz.position.set(k * 0.17, pt.y, pt.z);
      lid.add(bz);
      const st = new THREE.Mesh(cutGeo, nextJewel());
      st.scale.setScalar(1.15);
      st.position.set(k * 0.17, pt.y + 0.018, pt.z);
      lid.add(st);
    }
  }
  // Bande le long du bord avant du couvercle, et moraillon qui descend sur la serrure
  const lipBand = slab(W - 0.02, 0.06, 0.02, ironDark, 0.006);
  lipBand.position.set(0, 0.035, D / 2 + 0.006);
  lid.add(lipBand);
  const hasp = slab(0.1, 0.2, 0.022, iron, 0.008);
  hasp.position.set(0, -0.02, D / 2 + 0.024);
  lid.add(hasp);
  const haspRivet = rivet(jewels ? jewels[0] : rivetMat);
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

  // --- La gemme, sertie sur le devant du couvercle ---
  const G = V.gem;
  const tg = 0.95; // ~54° depuis l'avant
  const gp = arcPoint(tg, 0.0);
  const gemGroup = new THREE.Group();
  gemGroup.position.set(0, gp.y, gp.z);
  gemGroup.rotation.x = -arcNormalAngle(tg);
  gemGroup.scale.setScalar(G.size);
  lid.add(gemGroup);
  const setting = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.04, 32), iron);
  setting.rotation.x = Math.PI / 2;
  setting.position.z = 0.02;
  setting.castShadow = true;
  gemGroup.add(setting);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.016, 10, 32), rivetMat);
  ring.position.z = 0.042;
  gemGroup.add(ring);
  // Taille : une table plate, une couronne à facettes
  const gemMat = new THREE.MeshPhysicalMaterial({ color: G.color, emissive: G.emissive, emissiveIntensity: 0.35, roughness: 0.06, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2, flatShading: true });
  const gem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.092, 0.05, G.sides), gemMat);
  gem.rotation.x = Math.PI / 2;
  gem.rotation.y = Math.PI / G.sides;
  gem.position.z = 0.065;
  gemGroup.add(gem);
  const pavilion = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.07, 0.015, G.sides), gemMat);
  pavilion.rotation.x = Math.PI / 2;
  pavilion.rotation.y = Math.PI / G.sides;
  pavilion.position.z = 0.034;
  gemGroup.add(pavilion);
  const prongGeo = new THREE.ConeGeometry(0.014, 0.05, 6);
  for (let k = 0; k < G.prongs; k++) {
    const prong = new THREE.Mesh(prongGeo, rivetMat);
    const a = (k / G.prongs) * Math.PI * 2 + Math.PI / 4;
    prong.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.06);
    prong.rotation.x = Math.PI / 2;
    gemGroup.add(prong);
  }
  const gemLight = new THREE.PointLight(G.light, 0.6, 0.9, 2);
  gemLight.position.z = 0.16;
  gemGroup.add(gemLight);

  mergeByMaterial(body);
  mergeByMaterial(lid);
  chest.position.y = lift;

  // --- Ce qui flotte autour (ne tourne pas avec le coffre) : poussière, aura ---
  const world = new THREE.Group();
  const ticks = [];
  if (V.motes) {
    const M = V.motes;
    const n = LOW_POWER ? Math.ceil(M.n * 0.5) : M.n;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const base = new THREE.Color(M.color);
    const mr = mulberry(21);
    const dots = Array.from({ length: n }, () => ({ a: mr() * Math.PI * 2, r: M.r * (0.55 + mr() * 0.5), y: mr() * M.h, v: M.speed * (0.6 + mr() * 0.8), w: (mr() - 0.5) * 0.5, s: mr() * 6 }));
    const mat = new THREE.PointsMaterial({ size: M.size, map: tx.dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    world.add(pts);
    ticks.push((t, leak, dt) => {
      for (let i = 0; i < n; i++) {
        const p = dots[i];
        p.y += p.v * dt * (0.4 + parts.power * 0.6 + leak * 2);
        if (p.y > M.h) p.y -= M.h;
        p.a += p.w * dt;
        pos[i * 3] = Math.cos(p.a) * p.r;
        pos[i * 3 + 1] = p.y + parts.lift + parts.rise;
        pos[i * 3 + 2] = Math.sin(p.a) * p.r * 0.8;
        // elles naissent et s'éteignent doucement, et scintillent
        const f = Math.sin((Math.PI * p.y) / M.h) * (0.6 + 0.4 * Math.sin(t * 3 + p.s)) * (0.3 + parts.power * 0.7 + leak);
        col[i * 3] = base.r * f;
        col[i * 3 + 1] = base.g * f;
        col[i * 3 + 2] = base.b * f;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    });
  }
  if (V.aura) {
    const add = (map, color, opacity) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    const halo = new THREE.Sprite(add(tx.halo, V.aura, 0.55));
    halo.position.set(0, 0.62, -1.1);
    halo.scale.setScalar(3.1);
    world.add(halo);
    const rays = new THREE.Sprite(add(tx.rays, V.aura, 0.32));
    rays.position.set(0, 0.62, -1.2);
    rays.scale.setScalar(3.6);
    world.add(rays);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: tx.ringTex, color: V.aura, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    world.add(ring);
    ticks.push((t, leak) => {
      const p = 0.5 + 0.5 * Math.sin(t * 1.6);
      const k = 0.3 + parts.power * 0.7; // l'aura grandit à chaque coup
      halo.material.opacity = (0.42 + p * 0.22) * k + leak * 0.4;
      halo.scale.setScalar((3 + p * 0.25) * (0.8 + k * 0.2 + leak * 0.2));
      rays.material.rotation = t * (0.12 + leak * 0.5);
      rays.material.opacity = (0.24 + p * 0.14) * k + leak * 0.4;
      rays.scale.setScalar(3.6 * (0.85 + k * 0.15 + leak * 0.25));
      ring.material.opacity = (0.32 + p * 0.3) * k + leak * 0.3;
      ring.scale.setScalar((0.96 + p * 0.08) * (0.9 + k * 0.1 + leak * 0.4));
    });
  }
  if (runeMats.length) {
    // Les runes s'allument une par une avec la charge (au repos, toutes allumées)
    const lit = runeMats.map(() => 1);
    ticks.push((t, leak, dt) => {
      const on = Math.round(parts.power * runeMats.length);
      runeMats.forEach((m, i) => {
        lit[i] += ((i < on ? 1 : 0) - lit[i]) * Math.min(1, dt * 8);
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.9 + i * 0.7);
        m.opacity = 0.08 + lit[i] * (0.5 + 0.35 * pulse) + leak * 0.5;
      });
    });
  }
  if (iceMat) {
    ticks.push((t, leak) => {
      iceMat.emissiveIntensity = 0.35 + parts.power * 0.35 + leak * 0.9;
    });
  }
  const parts = { chest, world, lidPivot, glow, glowMat, gemMat, gemLight, lift, rise: 0, power: 1, variant: V === VARIANTS[variant] ? variant : 'commun', tint: V.tint, tick: (t, leak, dt) => ticks.forEach((f) => f(t, leak, dt)) };
  return parts;
}

/**
 * Fusionne les pièces d'un groupe qui partagent un matériau : une centaine de planches, clous et plaques deviennent
 * une dizaine d'objets, donc une dizaine d'appels de dessin par image au lieu de plus de cent.
 */
function mergeByMaterial(group) {
  const buckets = new Map();
  for (const m of [...group.children]) {
    if (!m.isMesh || m.userData.keep) continue;
    m.updateMatrix();
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material).push(g);
    group.remove(m);
  }
  for (const [mat, list] of buckets) {
    const merged = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const size = list[0].attributes[name].itemSize;
      const total = list.reduce((n, g) => n + g.attributes[name].array.length, 0);
      const arr = new Float32Array(total);
      let off = 0;
      for (const g of list) {
        arr.set(g.attributes[name].array, off);
        off += g.attributes[name].array.length;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    merged.computeBoundingSphere();
    list.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = !mat.userData.noShadow;
    mesh.receiveShadow = !mat.userData.noShadow;
    group.add(mesh);
  }
}

/** Un petit environnement pour les reflets du métal et de la gemme (une pièce sombre avec trois fenêtres de lumière). */
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
// La scène : lumières, sol, caméra
// ---------------------------------------------------------------------------
// Téléphones et petites tablettes : rendu allégé (moins de pixels, ombres plus simples, pas d'anticrénelage)
export const LOW_POWER = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

function makeRenderer() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !LOW_POWER, alpha: true, powerPreference: LOW_POWER ? 'low-power' : 'high-performance' });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = !LOW_POWER; // téléphone : pas d'ombres calculées (la tache au sol suffit)
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

function makeScene(renderer, tint) {
  const scene = new THREE.Scene();
  scene.environment = envMap(renderer);
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  /** Place la caméra : elle recule quand le cadre est étroit (téléphone), pour que le coffre tienne en largeur. */
  const placeCamera = (zoom, look = 0.5) => {
    const f = Math.max(1, 1.3 / camera.aspect) / zoom;
    camera.position.set(0, 1.55 * f, 4.6 * f);
    camera.lookAt(0, look, 0);
  };
  // Lumières : principale chaude (ombres), douce d'ambiance, contre-jour teinté
  scene.add(new THREE.HemisphereLight('#a99cc4', '#120c08', 0.5));
  const key = new THREE.DirectionalLight('#ffe0bd', 2.6);
  key.position.set(-2.2, 4, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(LOW_POWER ? 512 : 1024, LOW_POWER ? 512 : 1024);
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
  // Ombre au sol
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.55 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const blobTex = new THREE.CanvasTexture(glowCanvas([[0, 'rgba(0,0,0,.7)'], [1, 'rgba(0,0,0,0)']]));
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.002;
  scene.add(blob);
  return { scene, camera, placeCamera, rim };
}

/** Le coffre qui respire : gemme qui pulse, ornements animés. */
function breathe(parts, t, leak, dt) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  parts.gemMat.emissiveIntensity = 0.25 + pulse * 0.35 + leak * 0.6;
  parts.gemLight.intensity = 0.25 + pulse * 0.35;
  parts.tick(t, leak, dt);
}

// ---------------------------------------------------------------------------
// Le coffre dans une page
// ---------------------------------------------------------------------------
export function createChest(host, { idle = true, tint, leak = 0, zoom = 1, variant = 'commun' } = {}) {
  const renderer = makeRenderer();
  if (!renderer) return null;
  renderer.setPixelRatio(Math.min(LOW_POWER ? 1 : 1.25, devicePixelRatio || 1));
  const canvas = renderer.domElement;
  canvas.className = 'chest3d-canvas';
  host.appendChild(canvas);
  let curHost = host;
  let curZoom = zoom;
  let curLook = 0.5; // hauteur visée par la caméra (plus haut dans la scène : le couvercle ouvert doit tenir)

  const rigs = {};
  const rig = (v) => (rigs[v] ||= buildChest(v));
  let parts = rig(variant);
  const { scene, camera, placeCamera, rim } = makeScene(renderer, tint || parts.tint);
  const root = new THREE.Group(); // tremblements, écrasement
  root.add(parts.chest);
  scene.add(root);
  scene.add(parts.world);
  const inner = new THREE.PointLight(tint || parts.tint, 0, 3.2, 1.6);
  inner.position.set(0, H - 0.1, 0);
  parts.chest.add(inner);

  // État animé
  const st = {
    tint: new THREE.Color(tint || parts.tint),
    leak, leakT: leak,
    open: 0, openT: 0, openV: 0, // angle du couvercle (degrés), cible, vitesse (ressort)
    squash: 0, squashV: 0, jolt: 0,
    spin: 0, spinT: 0, rise: 0, riseT: 0, power: 1, powerT: 1, t: 0, idle,
    alive: true, visible: true, paused: false, skip: false,
  };
  const applyTint = () => {
    rim.color.copy(st.tint);
    inner.color.copy(st.tint);
    parts.glowMat.color.copy(st.tint);
  };
  applyTint();

  function resize() {
    const w = curHost.clientWidth || 300;
    const h = curHost.clientHeight || 260;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    placeCamera(curZoom, curLook);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => {
    st.visible = e.isIntersecting;
  });
  io.observe(host);

  // Prépare les shaders tout de suite (sinon le premier affichage fige un instant)
  renderer.compile(scene, camera);
  let last = performance.now();
  let raf = 0;
  function frame(now) {
    if (!st.alive) return;
    raf = requestAnimationFrame(frame);
    if (!st.visible || st.paused) {
      last = now;
      return;
    }
    // Au repos (et toujours sur téléphone) : une image sur deux suffit, 30 images par seconde
    if (st.idle || LOW_POWER) {
      st.skip = !st.skip;
      if (st.skip) return;
    }
    // Temps écoulé depuis la dernière image dessinée (les images sautées comptent)
    const full = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Les ressorts sont calculés par petits pas (stables même à 30 images par seconde)
    const steps = full > 0.034 ? 2 : 1;
    const dt = full / steps;
    st.t += full;
    // Ressort du couvercle
    const k = 120;
    const c = 14;
    for (let n = 0; n < steps; n++) {
      st.openV += (k * (st.openT - st.open) - c * st.openV) * dt;
      st.open += st.openV * dt;
      st.squashV += (-260 * st.squash - 11 * st.squashV) * dt;
      st.squash += st.squashV * dt;
    }
    parts.lidPivot.rotation.x = -THREE.MathUtils.degToRad(st.open);
    // Ressort de l'écrasement (coups)
    st.jolt *= Math.pow(0.02, full);
    root.scale.set(1 + st.squash * 0.6, 1 - st.squash, 1 + st.squash * 0.6);
    root.rotation.z = Math.sin(st.t * 40) * st.jolt * 0.06;
    root.position.x = Math.sin(st.t * 55) * st.jolt * 0.04;
    // Balancement au repos
    const sway = st.idle ? Math.sin(st.t * 0.55) * 0.5 : Math.sin(st.t * 0.5) * 0.18;
    // Ouverture : l'Épique lévite, le Légendaire s'élève en faisant un tour sur lui-même
    st.rise += (st.riseT - st.rise) * Math.min(1, full * 3);
    st.spin += (st.spinT - st.spin) * Math.min(1, full * 2.4);
    st.power += (st.powerT - st.power) * Math.min(1, full * 5);
    parts.power = st.power;
    parts.rise = st.rise;
    parts.chest.rotation.y = -0.6 + sway + st.spin;
    parts.chest.position.y = parts.lift + st.rise + (st.idle ? Math.sin(st.t * 1.3) * 0.03 + 0.03 : st.rise > 0.02 ? Math.sin(st.t * 2.2) * 0.025 : 0);
    // Lumière dans le coffre et gemme qui respire
    st.leak += (st.leakT - st.leak) * Math.min(1, full * 6);
    // Couvercle fermé, la lumière ne passe que par la fente ; ouvert, elle inonde
    inner.intensity = st.leak * (0.8 + 8 * Math.min(1, Math.max(0, st.open) / 60));
    parts.glowMat.opacity = Math.min(1, st.leak * 1.3);
    breathe(parts, st.t, st.leak, full);
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
    /** Change de modèle (commun, rare, epique, legendaire), sans recréer la 3D. Renvoie sa couleur. */
    setVariant(v) {
      if (!VARIANTS[v]) v = 'commun';
      const next = rig(v);
      if (next !== parts) {
        root.remove(parts.chest);
        scene.remove(parts.world);
        parts.lidPivot.rotation.x = 0;
        parts = next;
        root.add(parts.chest);
        scene.add(parts.world);
        parts.chest.add(inner);
        applyTint();
        renderer.compile(scene, camera);
      }
      return parts.tint;
    },
    /** Lumière qui fuit du coffre (0 à 1). */
    setLeak(v) {
      st.leakT = v;
    },
    /** Couvercle entrouvert (degrés). */
    setOpen(deg) {
      st.openT = deg;
    },
    /** Un coup : le coffre s'écrase, tremble, le couvercle saute un peu (chaque coffre à sa façon). */
    hit(n = 0) {
      const v = parts.variant;
      if (v === 'rare') {
        // la glace frissonne : plus de tremblement, moins d'écrasement
        st.squashV += 4 + n;
        st.jolt = Math.min(1.9, 1.1 + n * 0.25);
        st.openV += 200 + n * 40;
      } else if (v === 'epique') {
        // il se soulève un peu à chaque coup, comme aspiré par la magie
        st.squashV += 5 + n;
        st.jolt = Math.min(1.2, 0.6 + n * 0.15);
        st.openV += 220 + n * 40;
        st.riseT = Math.min(0.12, 0.03 + n * 0.025);
      } else if (v === 'legendaire') {
        // lourd : un gros écrasement, peu de tremblement
        st.squashV += 8 + n * 1.5;
        st.jolt = Math.min(1.1, 0.5 + n * 0.15);
        st.openV += 300 + n * 50;
      } else {
        st.squashV += 6 + n * 1.2;
        st.jolt = Math.min(1.5, 0.8 + n * 0.2);
        st.openV += 260 + n * 40;
      }
    },
    /** Le couvercle s'ouvre en grand, chaque coffre à sa façon. */
    open() {
      const v = parts.variant;
      st.leakT = 1;
      st.powerT = 1;
      if (v === 'rare') {
        // il claque d'un coup sec, et la glace tremble
        st.openT = 118;
        st.openV += 850;
        st.jolt = 1.6;
      } else if (v === 'epique') {
        // il lévite et le couvercle s'ouvre doucement
        st.openT = 104;
        st.openV += 260;
        st.riseT = 0.2;
      } else if (v === 'legendaire') {
        // il s'élève, fait un tour sur lui-même, et le couvercle saute en grand
        st.openT = 116;
        st.openV += 650;
        st.riseT = 0.15;
        st.spinT = Math.PI * 2;
        st.squashV -= 5;
      } else {
        st.openT = 112;
        st.openV += 500;
      }
    },
    /** Charge du coffre (0 à 1) : runes allumées, aura, givre. Au repos : 1. */
    setPower(p) {
      st.powerT = p;
    },
    /** Remet le coffre fermé et éteint. */
    reset() {
      Object.assign(st, { open: 0, openT: 0, openV: 0, squash: 0, squashV: 0, jolt: 0, leak: 0, leakT: 0, spin: 0, spinT: 0, rise: 0, riseT: 0 });
    },
    setIdle(v) {
      st.idle = v;
    },
    /**
     * Déplace le coffre dans un autre hôte (la carte de la page ↔ la scène d'ouverture), sans recréer la 3D.
     * opts : { zoom, idle, sharp, look } (sharp : plus de pixels, pour la grande scène ; look : hauteur visée).
     */
    moveTo(h, { zoom: z = curZoom, idle: i = st.idle, sharp = false, look = 0.5 } = {}) {
      ro.unobserve(curHost);
      io.unobserve(curHost);
      curHost = h;
      curZoom = z;
      curLook = look;
      st.idle = i;
      h.appendChild(canvas);
      renderer.setPixelRatio(Math.min(LOW_POWER ? 1.1 : sharp ? 1.5 : 1.25, devicePixelRatio || 1));
      ro.observe(h);
      io.observe(h);
      resize();
      last = performance.now();
    },
    /** Met le rendu en pause (coffre caché sous la scène, ou parti) : plus aucun calcul. */
    setPaused(v) {
      st.paused = v;
      last = performance.now();
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

// ---------------------------------------------------------------------------
// La vitrine : plusieurs coffres au repos, dessinés à tour de rôle par un seul contexte WebGL,
// puis recopiés chacun dans sa petite image (un canevas 2D par carte)
// ---------------------------------------------------------------------------
/**
 * items : [{ host, variant, dim }] (dim : un peu plus sombre, pour un coffre verrouillé).
 * Renvoie { setPaused, dispose }, ou null sans WebGL.
 */
export function createShowcase(items, { zoom = 1.12 } = {}) {
  const renderer = makeRenderer();
  if (!renderer) return null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pr = Math.min(LOW_POWER ? 1.5 : 1.5, devicePixelRatio || 1);
  renderer.setPixelRatio(pr);
  const { scene, camera, placeCamera, rim } = makeScene(renderer, '#ffffff');
  const views = items.map(({ host, variant, dim = false }, i) => {
    const parts = buildChest(variant);
    parts.chest.visible = parts.world.visible = false;
    scene.add(parts.chest);
    scene.add(parts.world);
    const c2 = document.createElement('canvas');
    c2.className = 'chest3d-canvas';
    host.appendChild(c2);
    return { host, parts, dim, c2, ctx: c2.getContext('2d'), w: 0, h: 0, visible: true, phase: i * 2.1 };
  });
  let bufW = 0;
  let bufH = 0;
  function resize() {
    for (const v of views) {
      v.w = Math.max(1, Math.round(v.host.clientWidth));
      v.h = Math.max(1, Math.round(v.host.clientHeight));
      v.c2.width = Math.round(v.w * pr);
      v.c2.height = Math.round(v.h * pr);
    }
    const mw = Math.max(...views.map((v) => v.w));
    const mh = Math.max(...views.map((v) => v.h));
    if (mw !== bufW || mh !== bufH) {
      bufW = mw;
      bufH = mh;
      renderer.setSize(mw, mh, false);
    }
    draw(0);
  }
  let t = 0;
  function draw(dt) {
    t += dt;
    const src = renderer.domElement;
    for (const v of views) {
      if (!v.visible || !v.w) continue;
      for (const o of views) o.parts.chest.visible = o.parts.world.visible = o === v;
      rim.color.set(v.parts.tint);
      camera.aspect = v.w / v.h;
      camera.updateProjectionMatrix();
      placeCamera(zoom);
      const tt = t + v.phase;
      v.parts.chest.rotation.y = -0.6 + Math.sin(tt * 0.55) * 0.5;
      v.parts.chest.position.y = v.parts.lift + Math.sin(tt * 1.3) * 0.03 + 0.03;
      v.parts.rise = 0;
      breathe(v.parts, tt, 0, dt);
      renderer.toneMappingExposure = v.dim ? 0.95 : 1.3;
      renderer.setViewport(0, 0, v.w, v.h);
      renderer.render(scene, camera);
      // L'image vient d'être dessinée : on la recopie tout de suite (en bas à gauche du tampon)
      v.ctx.clearRect(0, 0, v.c2.width, v.c2.height);
      v.ctx.drawImage(src, 0, src.height - v.c2.height, v.c2.width, v.c2.height, 0, 0, v.c2.width, v.c2.height);
    }
  }
  const ro = new ResizeObserver(() => resize());
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = views.find((x) => x.host === e.target);
      if (v) v.visible = e.isIntersecting;
    }
  });
  for (const v of views) {
    ro.observe(v.host);
    io.observe(v.host);
  }
  for (const v of views) v.parts.chest.visible = v.parts.world.visible = true;
  renderer.compile(scene, camera);
  resize();
  // 30 images par seconde (24 sur téléphone) : des coffres au repos n'ont pas besoin de plus
  const step = 1 / (LOW_POWER ? 24 : 30);
  let alive = true;
  let paused = false;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (paused || reduce || !views.some((v) => v.visible)) return;
    acc += dt;
    if (acc < step) return;
    draw(Math.min(0.1, acc));
    acc = 0;
  }
  raf = requestAnimationFrame(frame);
  return {
    setPaused(v) {
      paused = v;
      last = performance.now();
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
      renderer.forceContextLoss?.();
      views.forEach((v) => v.c2.remove());
    },
  };
}
