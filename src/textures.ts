import * as THREE from "three";

const TEX_SIZE = 512;

// Simple seeded pseudo-random
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h ^ (h >> 16)) >>> 0;
}
function rand(x: number, y: number): number {
  return (hash(x, y) & 0xffff) / 0xffff;
}

// Smooth noise via bilinear interpolation of hash grid
function smoothNoise(fx: number, fy: number, scale: number): number {
  const sx = fx * scale;
  const sy = fy * scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const dx = sx - ix;
  const dy = sy - iy;
  const a = rand(ix, iy);
  const b = rand(ix + 1, iy);
  const c = rand(ix, iy + 1);
  const d = rand(ix + 1, iy + 1);
  const tx = dx * dx * (3 - 2 * dx);
  const ty = dy * dy * (3 - 2 * dy);
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

// Fractal Brownian motion
function fbm(fx: number, fy: number, octaves: number, scale: number): number {
  let val = 0, amp = 0.5, freq = scale, total = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(fx, fy, freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return val / total;
}

// Generate normal map from height function
function normalFromHeight(
  data: Uint8Array,
  size: number,
  heightFn: (x: number, y: number) => number,
  strength: number
) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      const fy = y / size;
      const s = 1 / size;
      const hL = heightFn(fx - s, fy);
      const hR = heightFn(fx + s, fy);
      const hU = heightFn(fx, fy - s);
      const hD = heightFn(fx, fy + s);
      let nx = (hL - hR) * strength;
      let ny = (hU - hD) * strength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      data[i] = ((nx * 0.5 + 0.5) * 255) | 0;
      data[i + 1] = ((ny * 0.5 + 0.5) * 255) | 0;
      data[i + 2] = ((nz * 0.5 + 0.5) * 255) | 0;
      data[i + 3] = 255;
    }
  }
}

function makeTexture(data: Uint8Array, size: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ---- CONCRETE ----
export function createConcreteTextures() {
  const size = TEX_SIZE;
  const colorData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const heightFn = (fx: number, fy: number) => {
    const coarse = fbm(fx, fy, 4, 8);
    const fine = fbm(fx + 100, fy + 100, 3, 32) * 0.3;
    const crack = Math.max(0, 1 - Math.abs(Math.sin(fx * 47 + coarse * 3) * Math.cos(fy * 53 + coarse * 2)) * 8) * 0.2;
    return coarse + fine + crack;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      const fy = y / size;
      const i = (y * size + x) * 4;

      const n = fbm(fx, fy, 5, 12);
      const stain = fbm(fx + 50, fy + 50, 3, 4) * 0.08;
      const base = 0.62 + n * 0.12 - stain;
      const warmth = fbm(fx + 200, fy + 200, 2, 6) * 0.03;

      colorData[i] = (Math.min(1, base + warmth * 0.5) * 255) | 0;
      colorData[i + 1] = (Math.min(1, base + warmth * 0.2) * 255) | 0;
      colorData[i + 2] = (Math.min(1, base - warmth * 0.3) * 255) | 0;
      colorData[i + 3] = 255;

      const r = 0.82 + fbm(fx + 300, fy + 300, 3, 16) * 0.15;
      roughData[i] = roughData[i + 1] = roughData[i + 2] = (r * 255) | 0;
      roughData[i + 3] = 255;
    }
  }

  normalFromHeight(normalData, size, heightFn, 3.0);

  return {
    map: makeTexture(colorData, size),
    normalMap: makeTexture(normalData, size),
    roughnessMap: makeTexture(roughData, size),
    repeat: 12,
  };
}

// ---- GRASS ----
export function createGrassTextures() {
  const size = TEX_SIZE;
  const colorData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const heightFn = (fx: number, fy: number) => {
    const blades = Math.abs(Math.sin(fx * 120 + fbm(fx, fy, 2, 8) * 4)) * 0.3;
    const clumps = fbm(fx, fy, 4, 16) * 0.5;
    return blades + clumps;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      const fy = y / size;
      const i = (y * size + x) * 4;

      const n1 = fbm(fx, fy, 5, 20);
      const n2 = fbm(fx + 99, fy + 99, 3, 8);
      const blade = Math.abs(Math.sin(fx * 120 + n1 * 4)) * 0.15;
      const shadow = fbm(fx + 50, fy + 50, 3, 12) * 0.1;

      const g = 0.32 + n1 * 0.18 + blade - shadow;
      const r = 0.18 + n2 * 0.08;
      const b = 0.10 + n1 * 0.06;

      colorData[i] = (Math.min(1, r) * 255) | 0;
      colorData[i + 1] = (Math.min(1, g) * 255) | 0;
      colorData[i + 2] = (Math.min(1, b) * 255) | 0;
      colorData[i + 3] = 255;

      roughData[i] = roughData[i + 1] = roughData[i + 2] = ((0.88 + n1 * 0.1) * 255) | 0;
      roughData[i + 3] = 255;
    }
  }

  normalFromHeight(normalData, size, heightFn, 2.5);

  return {
    map: makeTexture(colorData, size),
    normalMap: makeTexture(normalData, size),
    roughnessMap: makeTexture(roughData, size),
    repeat: 20,
  };
}

// ---- BRICK / BUILDING WALLS ----
export function createBrickTextures() {
  const size = TEX_SIZE;
  const colorData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const brickW = 0.125;
  const brickH = 0.0625;
  const mortarW = 0.008;

  const heightFn = (fx: number, fy: number) => {
    const row = Math.floor(fy / brickH);
    const offset = (row % 2) * brickW * 0.5;
    const bx = (fx + offset) % brickW;
    const by = fy % brickH;
    const isMortar = bx < mortarW || by < mortarW * 0.7;
    if (isMortar) return 0;
    return 0.6 + fbm(fx, fy, 3, 32) * 0.3;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      const fy = y / size;
      const i = (y * size + x) * 4;

      const row = Math.floor(fy / brickH);
      const offset = (row % 2) * brickW * 0.5;
      const bx = (fx + offset) % brickW;
      const by = fy % brickH;
      const isMortar = bx < mortarW || by < mortarW * 0.7;

      if (isMortar) {
        colorData[i] = 180; colorData[i + 1] = 175; colorData[i + 2] = 165; colorData[i + 3] = 255;
        roughData[i] = roughData[i + 1] = roughData[i + 2] = 230; roughData[i + 3] = 255;
      } else {
        const n = fbm(fx * 4 + row * 0.1, fy * 4, 3, 8);
        const variation = rand(Math.floor(fx / brickW), row) * 0.15;
        const r = 0.52 + n * 0.12 + variation;
        const g = 0.38 + n * 0.08 + variation * 0.5;
        const b = 0.28 + n * 0.06;
        colorData[i] = (r * 255) | 0; colorData[i + 1] = (g * 255) | 0;
        colorData[i + 2] = (b * 255) | 0; colorData[i + 3] = 255;
        roughData[i] = roughData[i + 1] = roughData[i + 2] = ((0.78 + n * 0.12) * 255) | 0;
        roughData[i + 3] = 255;
      }
    }
  }

  normalFromHeight(normalData, size, heightFn, 4.0);

  return {
    map: makeTexture(colorData, size),
    normalMap: makeTexture(normalData, size),
    roughnessMap: makeTexture(roughData, size),
    repeat: 4,
  };
}

// ---- PONTOON / WOOD ----
export function createWoodTextures() {
  const size = TEX_SIZE;
  const colorData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const plankWidth = 0.1;
  const gapWidth = 0.006;

  const heightFn = (fx: number, fy: number) => {
    const plankIdx = Math.floor(fx / plankWidth);
    const localX = fx % plankWidth;
    const isGap = localX < gapWidth;
    if (isGap) return 0;
    const grain = Math.sin(fy * 80 + Math.sin(fx * 5 + plankIdx) * 3) * 0.15;
    const knot = smoothNoise(fx + plankIdx * 7, fy, 3) > 0.85 ? 0.3 : 0;
    return 0.5 + grain + fbm(fx, fy + plankIdx, 3, 20) * 0.2 - knot;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      const fy = y / size;
      const i = (y * size + x) * 4;

      const plankIdx = Math.floor(fx / plankWidth);
      const localX = fx % plankWidth;
      const isGap = localX < gapWidth;

      if (isGap) {
        colorData[i] = 40; colorData[i + 1] = 35; colorData[i + 2] = 30; colorData[i + 3] = 255;
        roughData[i] = roughData[i + 1] = roughData[i + 2] = 240; roughData[i + 3] = 255;
      } else {
        const grain = Math.sin(fy * 80 + Math.sin(fx * 5 + plankIdx) * 3) * 0.08;
        const n = fbm(fx + plankIdx * 7.3, fy, 4, 12);
        const age = rand(plankIdx, 0) * 0.08;
        const weathering = fbm(fx, fy + 300, 2, 4) * 0.06;

        const r = 0.50 + grain + n * 0.1 - age + weathering;
        const g = 0.38 + grain * 0.8 + n * 0.08 - age * 0.8;
        const b = 0.24 + n * 0.04 - age * 0.5;

        colorData[i] = (Math.min(1, r) * 255) | 0;
        colorData[i + 1] = (Math.min(1, g) * 255) | 0;
        colorData[i + 2] = (Math.min(1, b) * 255) | 0;
        colorData[i + 3] = 255;

        roughData[i] = roughData[i + 1] = roughData[i + 2] = ((0.68 + n * 0.15 + age * 0.5) * 255) | 0;
        roughData[i + 3] = 255;
      }
    }
  }

  normalFromHeight(normalData, size, heightFn, 3.5);

  return {
    map: makeTexture(colorData, size),
    normalMap: makeTexture(normalData, size),
    roughnessMap: makeTexture(roughData, size),
    repeat: 8,
  };
}

// ---- TARMAC / ROAD ----
export function createTarmacTextures() {
  const size = TEX_SIZE;
  const colorData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const heightFn = (fx: number, fy: number) => {
    const aggregate = fbm(fx, fy, 5, 40) * 0.4;
    const coarse = fbm(fx + 200, fy + 200, 3, 12) * 0.3;
    return aggregate + coarse;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      const fy = y / size;
      const i = (y * size + x) * 4;

      const n = fbm(fx, fy, 5, 40);
      const coarse = fbm(fx + 200, fy + 200, 3, 12);
      const speck = rand(x, y) > 0.92 ? 0.08 : 0;
      const patch = fbm(fx + 500, fy + 500, 2, 3) * 0.04;

      const base = 0.12 + n * 0.08 + coarse * 0.05 + speck + patch;

      colorData[i] = (base * 255) | 0;
      colorData[i + 1] = (base * 255) | 0;
      colorData[i + 2] = ((base + 0.01) * 255) | 0;
      colorData[i + 3] = 255;

      roughData[i] = roughData[i + 1] = roughData[i + 2] = ((0.82 + n * 0.12) * 255) | 0;
      roughData[i + 3] = 255;
    }
  }

  normalFromHeight(normalData, size, heightFn, 2.0);

  return {
    map: makeTexture(colorData, size),
    normalMap: makeTexture(normalData, size),
    roughnessMap: makeTexture(roughData, size),
    repeat: 15,
  };
}

// ---- ROOF (corrugated metal) ----
export function createRoofTextures() {
  const size = TEX_SIZE;
  const colorData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const ribSpacing = 0.04;

  const heightFn = (fx: number, fy: number) => {
    const rib = Math.sin(fx / ribSpacing * Math.PI * 2) * 0.5 + 0.5;
    const rust = fbm(fx + 400, fy + 400, 3, 8) * 0.1;
    return rib * 0.8 + rust;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      const fy = y / size;
      const i = (y * size + x) * 4;

      const rib = Math.sin(fx / ribSpacing * Math.PI * 2) * 0.5 + 0.5;
      const n = fbm(fx, fy, 3, 16);
      const rust = fbm(fx + 400, fy + 400, 3, 6);
      const isRusty = rust > 0.6;

      if (isRusty) {
        colorData[i] = ((0.45 + n * 0.1) * 255) | 0;
        colorData[i + 1] = ((0.30 + n * 0.05) * 255) | 0;
        colorData[i + 2] = ((0.18 + n * 0.03) * 255) | 0;
      } else {
        const shade = 0.42 + rib * 0.12 + n * 0.06;
        colorData[i] = ((shade - 0.02) * 255) | 0;
        colorData[i + 1] = ((shade + 0.02) * 255) | 0;
        colorData[i + 2] = ((shade + 0.06) * 255) | 0;
      }
      colorData[i + 3] = 255;

      const rr = isRusty ? 0.75 + n * 0.15 : 0.35 + n * 0.1 + (1 - rib) * 0.1;
      roughData[i] = roughData[i + 1] = roughData[i + 2] = (rr * 255) | 0;
      roughData[i + 3] = 255;
    }
  }

  normalFromHeight(normalData, size, heightFn, 5.0);

  return {
    map: makeTexture(colorData, size),
    normalMap: makeTexture(normalData, size),
    roughnessMap: makeTexture(roughData, size),
    repeat: 6,
  };
}

// ---- HARDSTAND (weathered concrete yard) ----
export function createHardstandTextures() {
  const size = TEX_SIZE;
  const colorData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const heightFn = (fx: number, fy: number) => {
    const base = fbm(fx, fy, 4, 10);
    const wear = fbm(fx + 700, fy + 700, 3, 24) * 0.25;
    const crack = Math.max(0, 1 - Math.abs(Math.sin(fx * 31 + base * 5) + Math.cos(fy * 37 + base * 3)) * 3) * 0.3;
    return base + wear + crack;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      const fy = y / size;
      const i = (y * size + x) * 4;

      const n = fbm(fx, fy, 5, 14);
      const stain = fbm(fx + 800, fy + 800, 3, 5);
      const oilPatch = stain > 0.7 ? (stain - 0.7) * 0.3 : 0;
      const tireMarks = Math.abs(Math.sin(fy * 60 + fbm(fx, fy, 2, 3) * 2)) < 0.05 ? 0.06 : 0;

      const base = 0.56 + n * 0.12 - oilPatch - tireMarks;
      const warm = fbm(fx + 900, fy + 900, 2, 8) * 0.04;

      colorData[i] = (Math.min(1, base + warm) * 255) | 0;
      colorData[i + 1] = (Math.min(1, base + warm * 0.5) * 255) | 0;
      colorData[i + 2] = (Math.min(1, base - warm * 0.3) * 255) | 0;
      colorData[i + 3] = 255;

      const r = 0.85 + fbm(fx + 1000, fy + 1000, 2, 20) * 0.12 - oilPatch * 0.3;
      roughData[i] = roughData[i + 1] = roughData[i + 2] = (r * 255) | 0;
      roughData[i + 3] = 255;
    }
  }

  normalFromHeight(normalData, size, heightFn, 2.5);

  return {
    map: makeTexture(colorData, size),
    normalMap: makeTexture(normalData, size),
    roughnessMap: makeTexture(roughData, size),
    repeat: 14,
  };
}

// ---- STEEL (piles, dolphins) ----
export function createSteelTextures() {
  const size = TEX_SIZE;
  const colorData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const heightFn = (fx: number, fy: number) => {
    const scratch = Math.abs(Math.sin(fy * 200 + fx * 30)) * 0.2;
    const pitting = fbm(fx, fy, 4, 40) * 0.3;
    return scratch + pitting;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size;
      const fy = y / size;
      const i = (y * size + x) * 4;

      const n = fbm(fx, fy, 4, 24);
      const rust = fbm(fx + 600, fy + 600, 3, 8);
      const isRusty = rust > 0.55;
      const scratch = Math.abs(Math.sin(fy * 200 + fx * 30)) < 0.03 ? 0.1 : 0;

      if (isRusty) {
        const ri = (rust - 0.55) * 2;
        colorData[i] = ((0.45 + ri * 0.15 + n * 0.05) * 255) | 0;
        colorData[i + 1] = ((0.28 + ri * 0.05 + n * 0.03) * 255) | 0;
        colorData[i + 2] = ((0.15 + n * 0.02) * 255) | 0;
      } else {
        const base = 0.50 + n * 0.08 + scratch;
        colorData[i] = (base * 255) | 0;
        colorData[i + 1] = ((base - 0.01) * 255) | 0;
        colorData[i + 2] = ((base - 0.02) * 255) | 0;
      }
      colorData[i + 3] = 255;

      const rr = isRusty ? 0.7 + n * 0.15 : 0.3 + n * 0.1;
      roughData[i] = roughData[i + 1] = roughData[i + 2] = (rr * 255) | 0;
      roughData[i + 3] = 255;
    }
  }

  normalFromHeight(normalData, size, heightFn, 2.0);

  return {
    map: makeTexture(colorData, size),
    normalMap: makeTexture(normalData, size),
    roughnessMap: makeTexture(roughData, size),
    repeat: 4,
  };
}

export type ProceduralTexture = {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  repeat: number;
};

export function applyProceduralTexture(
  mat: THREE.MeshStandardMaterial,
  tex: ProceduralTexture,
  envMap: THREE.Texture,
  envIntensity = 0.5
) {
  for (const t of [tex.map, tex.normalMap, tex.roughnessMap]) {
    t.repeat.set(tex.repeat, tex.repeat);
  }
  mat.map = tex.map;
  mat.normalMap = tex.normalMap;
  mat.normalScale = new THREE.Vector2(0.8, 0.8);
  mat.roughnessMap = tex.roughnessMap;
  mat.roughness = 1.0; // let the map drive it
  mat.metalness = mat.metalness || 0;
  mat.color.set(0xffffff); // let the map drive color
  mat.envMap = envMap;
  mat.envMapIntensity = envIntensity;
  mat.needsUpdate = true;
}
