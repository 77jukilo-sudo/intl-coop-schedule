"use client";

import { useEffect, useRef } from "react";

// 우주 배경: 반짝이는 별과 천천히 도는 지구. 모든 그림을 코드로 직접 그린다. (외부 이미지·영상 없음)
// - 화면 맨 뒤에 고정되어 있고 클릭을 가로채지 않는다.
// - 탭이 가려져 있으면 멈추고, "동작 줄이기" 설정이면 한 장만 그린다.
// - 지구 표면은 대륙 윤곽(경도·위도 좌표)에 "자연스러운 무늬(노이즈)"를 더해 해안선의 들쭉날쭉함,
//   사막·숲·산·눈, 얕은 바다, 구름, 극지방 얼음을 만든 것이다. 실제 위성 사진은 아니다.
// - 낮과 밤: 햇빛이 닿는 쪽은 밝고, 어두운 쪽에는 도시 불빛이 보인다. 서울에는 작은 불빛을 켠다.

// 대륙 윤곽 [경도, 위도] (단순화)
const CONTINENTS: [number, number][][] = [
  // 북아메리카
  [[-168, 66], [-160, 70], [-140, 70], [-125, 70], [-110, 72], [-95, 72], [-82, 68], [-65, 62], [-55, 52], [-67, 45], [-70, 42], [-76, 35], [-81, 30], [-80, 25], [-84, 30], [-90, 29], [-97, 26], [-97, 20], [-90, 21], [-87, 21], [-83, 10], [-79, 8], [-86, 12], [-95, 16], [-105, 20], [-110, 24], [-115, 30], [-117, 33], [-122, 37], [-124, 46], [-125, 50], [-130, 55], [-140, 60], [-150, 60], [-165, 60], [-165, 64]],
  // 그린란드
  [[-55, 60], [-45, 60], [-20, 70], [-20, 82], [-40, 83], [-60, 80], [-70, 77], [-55, 67]],
  // 남아메리카
  [[-77, 8], [-72, 12], [-62, 10], [-52, 5], [-50, 0], [-35, -5], [-35, -9], [-39, -15], [-41, -22], [-48, -26], [-53, -34], [-58, -38], [-65, -41], [-65, -47], [-68, -52], [-72, -54], [-75, -48], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 0], [-78, 3]],
  // 유라시아
  [[-9, 37], [-9, 43], [-1, 44], [-4, 48], [2, 51], [8, 54], [10, 57], [5, 58], [5, 62], [15, 69], [25, 71], [40, 68], [60, 69], [70, 73], [100, 77], [115, 74], [140, 72], [160, 70], [180, 68], [180, 65], [170, 60], [160, 58], [156, 51], [143, 59], [135, 55], [140, 48], [135, 43], [130, 42], [127, 39], [126, 37], [129, 35], [126, 34], [125, 38], [121, 40], [122, 37], [121, 32], [120, 26], [115, 22], [108, 21], [106, 18], [109, 12], [105, 9], [101, 13], [100, 7], [103, 1], [98, 8], [98, 16], [94, 17], [92, 21], [88, 22], [80, 15], [77, 8], [73, 17], [72, 21], [67, 24], [62, 25], [57, 26], [56, 27], [50, 30], [48, 29], [52, 24], [56, 25], [58, 23], [52, 17], [43, 13], [35, 28], [34, 31], [36, 36], [27, 37], [26, 40], [23, 40], [22, 37], [19, 41], [16, 45], [12, 45], [12, 42], [16, 38], [15, 40], [9, 44], [3, 43], [0, 40], [-5, 36]],
  // 아프리카
  [[-17, 21], [-17, 15], [-13, 9], [-8, 5], [0, 5], [9, 4], [9, -1], [13, -6], [12, -17], [15, -27], [18, -34], [25, -34], [32, -29], [35, -24], [40, -15], [40, -5], [51, 11], [43, 12], [38, 18], [33, 28], [32, 31], [20, 32], [10, 34], [10, 37], [0, 36], [-6, 36], [-10, 30]],
  // 오스트레일리아
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [141, -38], [135, -35], [130, -32], [116, -35], [114, -26]],
  // 일본, 영국, 마다가스카르, 동남아 섬들
  [[130, 31], [135, 34], [141, 38], [142, 43], [140, 41], [137, 36], [132, 34]],
  [[-5, 50], [1, 51], [0, 54], [-3, 58], [-6, 56], [-3, 54], [-5, 52]],
  [[44, -25], [48, -24], [50, -15], [47, -13], [44, -17]],
  [[95, 5], [98, 3], [106, -6], [102, -4], [95, 3]],
  [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]],
  [[131, -1], [141, -3], [150, -10], [141, -9], [134, -4]],
  // 뉴질랜드, 아이슬란드, 쿠바, 필리핀 등 작은 섬
  [[172, -34], [178, -38], [175, -41], [173, -41]],
  [[167, -46], [174, -41], [171, -45]],
  [[-24, 65], [-14, 66], [-14, 64], [-22, 63]],
  [[-85, 22], [-74, 20], [-78, 22]],
  [[120, 18], [124, 13], [126, 8], [122, 8], [120, 14]],
  // 남극
  [[-180, -72], [-120, -75], [-60, -73], [0, -70], [60, -68], [120, -66], [180, -70], [180, -90], [-180, -90]],
];

const SEOUL = { lon: 126.98, lat: 37.57 };
// 지구 표면 그림은 두 번에 나눠 만든다: 먼저 거친 그림으로 빨리 보여 주고, 이어서 고해상도로 바꿔 끼운다.
const TEX_STEPS: [number, number][] = [
  [512, 256],
  [1536, 768],
];
const MIN_GLOBE_PX = 560; // 지구를 그리는 가로세로 칸 수의 최소·최대(화면에 보이는 크기에 맞춰 정한다)
const MAX_GLOBE_PX = 860;
const FRAME_MS = 50; // 지구는 느리게 돌기 때문에 초당 약 20번만 새로 그려도 충분하다(나머지 화면이 버벅이지 않게)
const SPIN_DEG_PER_SEC = 4; // 지구가 도는 속도
const CLOUD_DRIFT = 0.35; // 구름이 땅보다 조금 다르게 흘러가는 정도(1이면 땅과 똑같이 움직임)
const LIGHT = normalize(-0.62, 0.22, 0.5); // 햇빛 방향 (왼쪽 위 앞쪽)
const RAD = Math.PI / 180;

function normalize(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number, a: number, b: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---- 자연스러운 무늬(노이즈) ----
// 3차원 점마다 0~1 사이의 부드러운 무작위 값을 주는 함수. 구의 표면 좌표(x,y,z)를 쓰기 때문에
// 지도의 이음새나 극지방에서 무늬가 찌그러지지 않는다.
function hash3(ix: number, iy: number, iz: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  let fx = x - ix;
  let fy = y - iy;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iy, iz);
  const b = hash3(ix + 1, iy, iz);
  const c = hash3(ix, iy + 1, iz);
  const d = hash3(ix + 1, iy + 1, iz);
  const e = hash3(ix, iy, iz + 1);
  const f = hash3(ix + 1, iy, iz + 1);
  const g = hash3(ix, iy + 1, iz + 1);
  const h = hash3(ix + 1, iy + 1, iz + 1);
  const x1 = a + (b - a) * fx;
  const x2 = c + (d - c) * fx;
  const x3 = e + (f - e) * fx;
  const x4 = g + (h - g) * fx;
  const y1 = x1 + (x2 - x1) * fy;
  const y2 = x3 + (x4 - x3) * fy;
  return y1 + (y2 - y1) * fz;
}
// 크고 작은 무늬를 겹친 값(0~1)
function fbm3(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise3(x, y, z);
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

// 대륙 윤곽을 그림으로 그린 뒤 흐리게 해서 "육지 비율(0~255)" 칸으로 돌려준다.
function buildCoverage(w: number, h: number, blurPx: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return out;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  for (const polygon of CONTINENTS) {
    ctx.beginPath();
    polygon.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * w;
      const y = ((90 - lat) / 180) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  const soft = document.createElement("canvas");
  soft.width = w;
  soft.height = h;
  const softCtx = soft.getContext("2d");
  if (!softCtx) return out;
  softCtx.filter = `blur(${blurPx * (w / 1024)}px)`; // 그림 크기에 비례해 흐리게
  softCtx.drawImage(canvas, 0, 0);
  const data = softCtx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4];
  return out;
}

// 지구 표면 그림(색, 바다 표시, 도시 불빛, 구름)을 한꺼번에 만든다.
interface Surface {
  w: number; // 그림의 가로·세로 칸 수
  h: number;
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
  sea: Uint8Array; // 바다일수록 255 (햇빛이 반짝이는 곳)
  city: Uint8Array; // 도시 불빛 세기
  cloud: Uint8Array; // 구름 짙기
}

// 한 번에 다 만들면 화면이 잠깐 멈추므로, 몇 줄씩 나눠서 만들고 끝나면 알려 준다.
function buildSurface(
  TEX_W: number,
  TEX_H: number,
  onDone: (s: Surface) => void,
  isCancelled: () => boolean,
) {
  const size = TEX_W * TEX_H;
  const s: Surface = {
    w: TEX_W,
    h: TEX_H,
    r: new Uint8Array(size),
    g: new Uint8Array(size),
    b: new Uint8Array(size),
    sea: new Uint8Array(size),
    city: new Uint8Array(size),
    cloud: new Uint8Array(size),
  };
  const near = buildCoverage(TEX_W, TEX_H, 1.1); // 해안선 근처 흐림(육지/바다 경계)
  const wide = buildCoverage(TEX_W, TEX_H, 5); // 넓게 흐린 것(얕은 바다 표시용)
  const scale = TEX_W / 1024; // 해안선 흔들림 크기를 그림 크기에 맞춘다

  const ROWS_PER_STEP = Math.max(8, Math.round(24 / (scale * scale)));
  let row = 0;
  const step = () => {
    if (isCancelled()) return;
    const end = Math.min(TEX_H, row + ROWS_PER_STEP);
    for (; row < end; row++) {
      const lat = 90 - ((row + 0.5) / TEX_H) * 180;
      const latRad = lat * RAD;
      const cy = Math.sin(latRad);
      const cr = Math.cos(latRad);
      const absLat = Math.abs(lat);
      for (let col = 0; col < TEX_W; col++) {
        const lon = ((col + 0.5) / TEX_W) * 360 - 180;
        const lonRad = lon * RAD;
        const px = cr * Math.sin(lonRad);
        const pz = cr * Math.cos(lonRad);
        const i = row * TEX_W + col;

        // 해안선을 들쭉날쭉하게: 윤곽을 보는 위치를 무늬만큼 살짝 흔든다
        const dx = (fbm3(px * 7 + 11, cy * 7, pz * 7, 3) - 0.5) * 16 * scale;
        const dy = (fbm3(px * 7, cy * 7 + 23, pz * 7, 3) - 0.5) * 12 * scale;
        const sc = Math.min(TEX_W - 1, Math.max(0, Math.round(col + dx)));
        const sr = Math.min(TEX_H - 1, Math.max(0, Math.round(row + dy)));
        const rough = fbm3(px * 26, cy * 26, pz * 26, 3);
        let land = smooth(near[sr * TEX_W + sc] / 255 + (rough - 0.5) * 0.35, 0.42, 0.58);

        // 땅의 높낮이·건조한 정도·숲의 짙기
        const height = fbm3(px * 4.2 + 5, cy * 4.2, pz * 4.2, 4);
        const dry = fbm3(px * 2.6, cy * 2.6 + 9, pz * 2.6, 3);
        const detail = fbm3(px * 14, cy * 14, pz * 14, 2);

        // ---- 바다 ----
        const shallow = smooth(wide[sr * TEX_W + sc] / 255, 0.0, 0.5); // 해안에 가까울수록 1
        let or = 7 + 18 * shallow * shallow + 8 * detail;
        let og = 34 + 82 * shallow + 12 * detail;
        let ob = 92 + 62 * shallow + 14 * detail;
        // ---- 육지 ----
        // 건조 지대(위도 12~38도, 무늬가 큰 곳)는 사막색, 그 밖은 위도에 따라 열대 숲~초원
        const desert = smooth(dry, 0.46, 0.62) * smooth(absLat, 10, 20) * (1 - smooth(absLat, 38, 50));
        const tropic = 1 - smooth(absLat, 8, 34);
        let lr = 50 + 40 * (1 - tropic) + 22 * detail;
        let lg = 96 + 22 * (1 - tropic) + 24 * detail - 14 * tropic;
        let lb = 50 + 16 * (1 - tropic) + 12 * detail;
        lr += (200 - lr) * desert;
        lg += (168 - lg) * desert;
        lb += (110 - lb) * desert;
        // 산: 높은 곳은 갈색·회색
        const mount = smooth(height, 0.56, 0.74);
        lr += (122 - lr) * mount * 0.8;
        lg += (108 - lg) * mount * 0.8;
        lb += (94 - lb) * mount * 0.8;
        // 눈: 위도가 높을수록, 산꼭대기일수록 하얗게
        const snow = clamp01(smooth(absLat + (height - 0.5) * 18, 58, 72) + mount * smooth(height, 0.7, 0.8) * 0.5);
        lr += (240 - lr) * snow;
        lg += (244 - lg) * snow;
        lb += (250 - lb) * snow;
        // 극지방 바다는 얼음
        const ice = smooth(absLat + (rough - 0.5) * 8, 70, 78) * (1 - land);
        or += (226 - or) * ice;
        og += (236 - og) * ice;
        ob += (244 - ob) * ice;
        land = Math.max(land, 0);

        s.r[i] = Math.round(or + (lr - or) * land);
        s.g[i] = Math.round(og + (lg - og) * land);
        s.b[i] = Math.round(ob + (lb - ob) * land);
        s.sea[i] = Math.round(255 * (1 - land) * (1 - ice));

        // 도시 불빛: 육지에서 무늬가 몰린 곳, 눈·사막 깊은 곳은 적게
        const cityNoise = smooth(fbm3(px * 20, cy * 20, pz * 20, 3), 0.55, 0.78);
        s.city[i] = Math.round(255 * land * cityNoise * (1 - snow) * (1 - desert * 0.7));

        // 구름: 큰 무늬를 한 번 비틀어서 소용돌이 느낌을 낸다
        const wx = fbm3(px * 2.4 + 40, cy * 2.4, pz * 2.4, 3);
        const cn = fbm3(px * 3.6 + wx * 1.6, cy * 3.6 + wx * 1.6, pz * 3.6 - wx * 1.2, 5);
        s.cloud[i] = Math.round(255 * smooth(cn, 0.56, 0.76));
      }
    }
    if (row < TEX_H) setTimeout(step, 0);
    else onDone(s);
  };
  step();
}

interface Star {
  x: number; // 0~1 (화면 비율)
  y: number;
  r: number;
  phase: number;
  speed: number;
}

export default function SpaceBackground() {
  const starsRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const starCanvas = starsRef.current;
    const globeCanvas = globeRef.current;
    if (!starCanvas || !globeCanvas) return;
    const starCtx = starCanvas.getContext("2d");
    const globeCtx = globeCanvas.getContext("2d");
    if (!starCtx || !globeCtx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;

    // ---- 별 ----
    const stars: Star[] = Array.from({ length: 170 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.3 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.2,
    }));
    function resizeStars() {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      starCanvas!.width = Math.floor(window.innerWidth * d);
      starCanvas!.height = Math.floor(window.innerHeight * d);
      starCtx!.setTransform(d, 0, 0, d, 0, 0);
    }
    function drawStars(t: number) {
      starCtx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const s of stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        starCtx!.globalAlpha = reduceMotion ? 0.7 : twinkle;
        starCtx!.fillStyle = "#dfe9ff";
        starCtx!.beginPath();
        starCtx!.arc(s.x * window.innerWidth, s.y * window.innerHeight, s.r, 0, Math.PI * 2);
        starCtx!.fill();
      }
      starCtx!.globalAlpha = 1;
    }

    // ---- 지구 ----
    // 화면에 실제로 보이는 크기(고해상도 화면이면 2배)에 맞춰 그려야 흐릿하게 늘어나지 않는다.
    const half = normalize(LIGHT[0], LIGHT[1], LIGHT[2] + 1); // 햇빛과 보는 방향의 중간 방향
    let S = 0; // 지구 그림의 가로세로 칸 수
    let radius = 0;
    let count = 0;
    let latFrac = new Float32Array(0); // 위도 위치(0=북극, 1=남극), 지구 밖이면 -1
    let baseLon = new Float32Array(0);
    let ndl = new Float32Array(0); // 햇빛과 표면이 이루는 각도(-1~1, 음수면 밤)
    let rim = new Float32Array(0);
    let glint = new Float32Array(0); // 바다에 햇빛이 반사되어 번쩍이는 정도
    let image: ImageData | null = null;
    let px32 = new Uint32Array(0);
    let surface: Surface | null = null;

    // 화면의 점마다 "위도, 기준 경도, 햇빛 각도, 가장자리 빛, 바다 반짝임"을 미리 계산해 둔다.
    // (회전할 때는 경도만 더하면 된다)
    function setupGeometry() {
      const cssWidth = globeCanvas!.parentElement?.clientWidth || 600;
      const want = Math.round(cssWidth * Math.min(window.devicePixelRatio || 1, 2));
      const next = Math.max(MIN_GLOBE_PX, Math.min(MAX_GLOBE_PX, want)) & ~1;
      if (next === S) return false;
      S = next;
      globeCanvas!.width = S;
      globeCanvas!.height = S;
      radius = S / 2 - 2;
      count = S * S;
      latFrac = new Float32Array(count).fill(-1);
      baseLon = new Float32Array(count);
      ndl = new Float32Array(count);
      rim = new Float32Array(count);
      glint = new Float32Array(count);
      for (let py = 0; py < S; py++) {
        for (let px = 0; px < S; px++) {
          const x = (px + 0.5 - S / 2) / radius;
          const y = -(py + 0.5 - S / 2) / radius;
          const rr = x * x + y * y;
          if (rr > 1) continue;
          const z = Math.sqrt(1 - rr);
          const i = py * S + px;
          latFrac[i] = (90 - Math.asin(y) * (180 / Math.PI)) / 180;
          baseLon[i] = Math.atan2(x, z) * (180 / Math.PI);
          ndl[i] = x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2];
          rim[i] = Math.pow(1 - z, 2.4);
          glint[i] = Math.pow(Math.max(0, x * half[0] + y * half[1] + z * half[2]), 90);
        }
      }
      image = globeCtx!.createImageData(S, S);
      px32 = new Uint32Array(image.data.buffer);
      return true;
    }
    setupGeometry();

    function drawGlobe(rotationDeg: number, spinDeg: number) {
      if (!surface || !image) return;
      const { w: TEX_W, h: TEX_H, r: sr, g: sg, b: sb, sea, city, cloud } = surface;
      const wrapCol = (lonDeg: number) => {
        const lon = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
        return Math.min(TEX_W - 1, Math.floor(((lon + 180) / 360) * TEX_W));
      };
      const cloudShift = spinDeg * CLOUD_DRIFT; // 구름은 땅과 조금 다른 속도로 흐른다
      for (let i = 0; i < count; i++) {
        const lf = latFrac[i];
        if (lf < 0) {
          px32[i] = 0;
          continue;
        }
        const row = Math.min(TEX_H - 1, Math.floor(lf * TEX_H));
        const col = wrapCol(baseLon[i] + rotationDeg);
        const ccol = wrapCol(baseLon[i] + rotationDeg + cloudShift);
        const ti = row * TEX_W + col;
        const ci = row * TEX_W + ccol;
        const n = ndl[i];

        // 밝기: 낮은 밝고 밤은 어둡다. 경계(저녁노을 선)는 부드럽게.
        const t = clamp01((n + 0.08) / 0.9);
        const shade = 0.05 + 0.95 * t * (2 - t);
        const night = 1 - smooth(n, -0.02, 0.2);

        // 구름을 표면 위에 하얗게 덮는다
        const cv = (cloud[ci] / 255) * 0.88;
        let r = sr[ti] + (238 - sr[ti]) * cv;
        let g = sg[ti] + (242 - sg[ti]) * cv;
        let b = sb[ti] + (250 - sb[ti]) * cv;
        r *= shade;
        g *= shade;
        b *= shade;

        // 바다에 햇빛이 반사되어 번쩍임 (구름이 덮으면 약해짐)
        const spec = glint[i] * (sea[ti] / 255) * (1 - cv) * 230;
        r += spec;
        g += spec * 0.95;
        b += spec * 0.8;

        // 해 질 녘 하늘의 주황빛
        const twil = Math.exp(-((n / 0.14) * (n / 0.14))) * 0.3;
        r += 70 * twil;
        g += 28 * twil;

        // 밤 쪽의 도시 불빛
        const lights = (city[ti] / 255) * night * (1 - cv * 0.75);
        r += 255 * lights * 0.95;
        g += 205 * lights * 0.95;
        b += 120 * lights * 0.95;

        // 대기 가장자리의 푸른 빛 (햇빛 쪽이 더 밝다)
        const rimLit = rim[i] * (0.4 + 0.6 * clamp01((n + 0.3) / 0.9));
        const glow = rimLit * 210;
        r += glow * 0.4;
        g += glow * 0.72;
        b += glow;

        r = r > 255 ? 255 : r;
        g = g > 255 ? 255 : g;
        b = b > 255 ? 255 : b;
        px32[i] = (255 << 24) | (b << 16) | (g << 8) | r; // 리틀 엔디안: ABGR
      }
      globeCtx!.putImageData(image, 0, 0);

      // 서울의 불빛 (위에서 만든 image는 setupGeometry가 정한 크기 S로 그려져 있다)
      let seoulLon = SEOUL.lon - rotationDeg;
      seoulLon = ((((seoulLon + 180) % 360) + 360) % 360) - 180;
      const lonRad = (seoulLon * Math.PI) / 180;
      const latRad = (SEOUL.lat * Math.PI) / 180;
      const x = Math.cos(latRad) * Math.sin(lonRad);
      const y = Math.sin(latRad);
      const z = Math.cos(latRad) * Math.cos(lonRad);
      if (z > 0.05) {
        const k = S / 620; // 그림 크기에 맞춰 불빛 크기도 키운다
        const sx = S / 2 + x * radius;
        const sy = S / 2 - y * radius;
        const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 500);
        const glowG = globeCtx!.createRadialGradient(sx, sy, 0, sx, sy, (14 + 5 * pulse) * k);
        glowG.addColorStop(0, "rgba(255,236,170,0.9)");
        glowG.addColorStop(1, "rgba(255,200,90,0)");
        globeCtx!.fillStyle = glowG;
        globeCtx!.beginPath();
        globeCtx!.arc(sx, sy, 20 * k, 0, Math.PI * 2);
        globeCtx!.fill();
        globeCtx!.fillStyle = "#fff7d6";
        globeCtx!.beginPath();
        globeCtx!.arc(sx, sy, 2.2 * k, 0, Math.PI * 2);
        globeCtx!.fill();
      }
    }

    resizeStars();
    const startRotation = -35; // 서울이 왼쪽에서 나타나 천천히 지나가도록
    let frame = 0;
    let running = true;
    let last = performance.now();
    let lastGlobe = 0;
    let spin = startRotation;

    function tick(now: number) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spin += SPIN_DEG_PER_SEC * dt;
      drawStars(now / 1000);
      if (now - lastGlobe >= FRAME_MS) {
        lastGlobe = now;
        drawGlobe(-spin + 127, spin); // 서울이 정면 근처를 지나가도록 기준을 맞춘다
      }
      frame = requestAnimationFrame(tick);
    }

    drawStars(0);
    // 거친 표면을 먼저 만들어 빨리 보여 주고, 이어서 고해상도 표면으로 바꿔 끼운다
    const showSurface = (s: Surface, first: boolean) => {
      if (cancelled) return;
      surface = s;
      drawGlobe(-spin + 127, spin);
      if (first) {
        globeCanvas.style.opacity = "1";
        if (!reduceMotion && !document.hidden) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        } else {
          running = false;
        }
      }
    };
    buildSurface(
      TEX_STEPS[0][0],
      TEX_STEPS[0][1],
      (rough) => {
        showSurface(rough, true);
        buildSurface(
          TEX_STEPS[1][0],
          TEX_STEPS[1][1],
          (fine) => showSurface(fine, false),
          () => cancelled,
        );
      },
      () => cancelled,
    );

    const onResize = () => {
      resizeStars();
      drawStars(performance.now() / 1000);
      // 창 크기가 크게 달라지면 지구 그림 크기도 다시 맞춘다
      if (setupGeometry()) drawGlobe(-spin + 127, spin);
    };
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!reduceMotion && !running && surface) {
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <canvas ref={starsRef} className="absolute inset-0 h-full w-full" />
      {/* 지구: 오른쪽 아래에 크게, 절반쯤 화면 밖으로 걸쳐 둔다 */}
      <div className="earth-glow absolute -bottom-[22vmin] -right-[14vmin] h-[88vmin] w-[88vmin] max-h-[860px] max-w-[860px] rounded-full opacity-95 max-sm:-right-[30vmin] max-sm:-bottom-[10vmin] max-sm:h-[96vmin] max-sm:w-[96vmin]">
        <canvas
          ref={globeRef}
          className="h-full w-full rounded-full"
          style={{ opacity: 0, transition: "opacity 1.2s ease" }}
        />
      </div>
    </div>
  );
}
