"use client";

import { useEffect, useRef } from "react";

// 우주 배경: 반짝이는 별과 천천히 도는 지구. 모든 그림을 코드로 직접 그린다. (외부 이미지·영상 없음)
// - 화면 맨 뒤에 고정되어 있고 클릭을 가로채지 않는다.
// - 탭이 가려져 있으면 멈추고, "동작 줄이기" 설정이면 한 장만 그린다.
// - 지구의 대륙은 아주 단순한 윤곽(경도·위도 좌표)을 그린 것이라 실제 지도와는 다르다. 서울에는 작은 불빛을 켠다.

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
  // 남극
  [[-180, -72], [-120, -75], [-60, -73], [0, -70], [60, -68], [120, -66], [180, -70], [180, -90], [-180, -90]],
];

const SEOUL = { lon: 126.98, lat: 37.57 };
const TEX_W = 1080; // 지구 표면 그림의 가로 칸 수 (경도 1/3도마다 1칸)
const TEX_H = 540;
const SIZE = 620; // 지구를 그리는 내부 해상도(화면에는 크기에 맞게 늘려 보여 준다)
const SPIN_DEG_PER_SEC = 4; // 지구가 도는 속도
const LIGHT = normalize(-0.55, 0.45, 0.7); // 햇빛 방향 (왼쪽 위 앞쪽)

function normalize(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

// 대륙 윤곽을 표면 그림(바다=0, 육지=1)으로 만든다.
function buildLandMask(): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");
  const mask = new Uint8Array(TEX_W * TEX_H);
  if (!ctx) return mask;
  ctx.fillStyle = "#fff";
  const toXY = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * TEX_W, ((90 - lat) / 180) * TEX_H];
  for (const polygon of CONTINENTS) {
    ctx.beginPath();
    polygon.forEach(([lon, lat], i) => {
      const [x, y] = toXY(lon, lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  // 해안선이 계단처럼 보이지 않도록 살짝 흐리게 한 뒤, 흐린 정도(0~255)를 "육지 비율"로 쓴다.
  const soft = document.createElement("canvas");
  soft.width = TEX_W;
  soft.height = TEX_H;
  const softCtx = soft.getContext("2d");
  if (!softCtx) return mask;
  softCtx.filter = "blur(1.6px)";
  softCtx.drawImage(canvas, 0, 0);
  const data = softCtx.getImageData(0, 0, TEX_W, TEX_H).data;
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4];
  return mask;
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
    const mask = buildLandMask();
    globeCanvas.width = SIZE;
    globeCanvas.height = SIZE;
    const radius = SIZE / 2 - 2;
    // 화면의 점마다 "위도 칸, 기준 경도, 밝기, 가장자리 빛"을 미리 계산해 둔다. (회전할 때는 경도만 더하면 된다)
    const count = SIZE * SIZE;
    const rowOf = new Int16Array(count).fill(-1);
    const baseLon = new Float32Array(count);
    const light = new Float32Array(count);
    const rim = new Float32Array(count);
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const x = (px + 0.5 - SIZE / 2) / radius;
        const y = -(py + 0.5 - SIZE / 2) / radius;
        const rr = x * x + y * y;
        if (rr > 1) continue;
        const z = Math.sqrt(1 - rr);
        const i = py * SIZE + px;
        const lat = Math.asin(y) * (180 / Math.PI);
        rowOf[i] = Math.min(TEX_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * TEX_H)));
        baseLon[i] = Math.atan2(x, z) * (180 / Math.PI);
        light[i] = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
        rim[i] = Math.pow(1 - z, 2.4);
      }
    }
    const image = globeCtx.createImageData(SIZE, SIZE);
    const px32 = new Uint32Array(image.data.buffer);

    function drawGlobe(rotationDeg: number) {
      const rot = rotationDeg;
      for (let i = 0; i < count; i++) {
        const row = rowOf[i];
        if (row < 0) {
          px32[i] = 0;
          continue;
        }
        let lon = baseLon[i] + rot;
        lon = ((((lon + 180) % 360) + 360) % 360) - 180;
        const col = Math.min(TEX_W - 1, Math.floor(((lon + 180) / 360) * TEX_W));
        const cov = mask[row * TEX_W + col] / 255; // 0=바다, 1=육지 (해안선은 그 사이로 부드럽게)
        const lit = 0.1 + 0.9 * light[i];
        // 육지: 낮은 위도는 초록빛, 높은 위도(극지방)는 하얗게
        const polar = Math.abs(row - TEX_H / 2) / (TEX_H / 2);
        const snow = polar > 0.82 ? (polar - 0.82) / 0.18 : 0;
        const landR = 52 + 150 * snow;
        const landG = 130 + 80 * snow;
        const landB = 92 + 120 * snow;
        let r = 14 + (landR - 14) * cov;
        let g = 58 + (landG - 58) * cov;
        let b = 128 + (landB - 128) * cov;
        // 대기 가장자리의 푸른 빛
        const glow = rim[i] * 190;
        r = Math.min(255, r * lit + glow * 0.45);
        g = Math.min(255, g * lit + glow * 0.75);
        b = Math.min(255, b * lit + glow);
        px32[i] = (255 << 24) | (b << 16) | (g << 8) | r; // 리틀 엔디안: ABGR
      }
      globeCtx!.putImageData(image, 0, 0);

      // 서울의 불빛
      let seoulLon = SEOUL.lon - rot;
      seoulLon = ((((seoulLon + 180) % 360) + 360) % 360) - 180;
      const lonRad = (seoulLon * Math.PI) / 180;
      const latRad = (SEOUL.lat * Math.PI) / 180;
      const x = Math.cos(latRad) * Math.sin(lonRad);
      const y = Math.sin(latRad);
      const z = Math.cos(latRad) * Math.cos(lonRad);
      if (z > 0.05) {
        const sx = SIZE / 2 + x * radius;
        const sy = SIZE / 2 - y * radius;
        const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 500);
        const glow = globeCtx!.createRadialGradient(sx, sy, 0, sx, sy, 16 + 6 * pulse);
        glow.addColorStop(0, "rgba(255,236,170,0.95)");
        glow.addColorStop(1, "rgba(255,200,90,0)");
        globeCtx!.fillStyle = glow;
        globeCtx!.beginPath();
        globeCtx!.arc(sx, sy, 22, 0, Math.PI * 2);
        globeCtx!.fill();
        globeCtx!.fillStyle = "#fff7d6";
        globeCtx!.beginPath();
        globeCtx!.arc(sx, sy, 2.6, 0, Math.PI * 2);
        globeCtx!.fill();
      }
    }

    resizeStars();
    const startRotation = -35; // 서울이 왼쪽에서 나타나 천천히 지나가도록
    let frame = 0;
    let running = true;
    let last = performance.now();
    let spin = startRotation;

    function tick(now: number) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spin += SPIN_DEG_PER_SEC * dt;
      drawStars(now / 1000);
      drawGlobe(-spin + 127); // 서울이 정면 근처를 지나가도록 기준을 맞춘다
      frame = requestAnimationFrame(tick);
    }

    drawStars(0);
    drawGlobe(-spin + 127);
    if (!reduceMotion) frame = requestAnimationFrame(tick);

    const onResize = () => {
      resizeStars();
      drawStars(performance.now() / 1000);
    };
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!reduceMotion && !running) {
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
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
      <div className="earth-glow absolute -bottom-[22vmin] -right-[14vmin] h-[88vmin] w-[88vmin] max-h-[860px] max-w-[860px] rounded-full opacity-90 max-sm:-right-[30vmin] max-sm:-bottom-[10vmin] max-sm:h-[96vmin] max-sm:w-[96vmin]">
        <canvas ref={globeRef} className="h-full w-full rounded-full" />
      </div>
    </div>
  );
}
