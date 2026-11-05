"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 로그인 화면의 "포털 창": 둥근 사각형 창 안에 지구 영상이 보이고,
// 마우스를 따라 창이 입체적으로 기울어진다(영상은 화면에 고정, 창만 움직이는 시차 효과).
// 영상은 public/video/earth-observation.mp4(NASA 지구 관측 영상)를 쓰며,
// 다른 영상으로 바꾸려면 아래 VIDEO_SRC만 바꾸면 된다.
// 창은 큰 canvas에 그린다. canvas는 body에 직접 붙여서 다른 요소의 움직임 효과에 영향받지 않게 한다.

const VIDEO_SRC = "/video/earth-observation.mp4";
const FOCAL = 850; // 가짜 원근법의 초점 거리
const MAX_TILT_Y = 37.4 / 2; // 좌우로 기울어지는 최대 각도(도)
const MAX_TILT_X = 33 / 2; // 위아래로 기울어지는 최대 각도(도)
const REVEAL_MS = 1050; // 처음 창이 열리는 시간
// 영상 앞뒤에는 흰 타이틀·크레딧 화면이 있어서, 어두운 지구 장면(8~58초)만 반복해서 보여 준다
const LOOP_START = 8;
const LOOP_END = 58;
const MEDIA_ZOOM = 1.35; // 창보다 조금 크게 깔아 두어 기울 때 영상 가장자리가 보이지 않게 함

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// 둥근 사각형(가로 w, 세로 h, 모서리 r)의 윤곽 점들. 중심이 (0,0).
function roundedRectPoints(w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  const corners: [number, number, number, number][] = [
    [w / 2 - rr, -h / 2 + rr, -Math.PI / 2, 0],
    [w / 2 - rr, h / 2 - rr, 0, Math.PI / 2],
    [-w / 2 + rr, h / 2 - rr, Math.PI / 2, Math.PI],
    [-w / 2 + rr, -h / 2 + rr, Math.PI, Math.PI * 1.5],
  ];
  const pts: [number, number][] = [];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  }
  return pts;
}

export default function PortalWindow({ className = "" }: { className?: string }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // canvas를 붙일 곳(body)은 브라우저에서만 알 수 있어 열린 뒤에 정한다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(document.body);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const anchor = anchorRef.current;
    const video = videoRef.current;
    if (!host || !canvas || !anchor || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // 마우스 위치에 따른 목표 기울기(터치 기기·동작 줄이기에서는 0 유지)
    let targetX = 0;
    let targetY = 0;
    let rotX = 0;
    let rotY = 0;
    const onMove = (e: PointerEvent) => {
      if (!finePointer || reduce) return;
      targetY = (e.clientX / window.innerWidth - 0.5) * 2 * MAX_TILT_Y;
      targetX = (e.clientY / window.innerHeight - 0.5) * -2 * MAX_TILT_X;
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);

    // 영상: 소리 없이 반복 재생. 탭이 가려지면 멈춘다.
    video.muted = true;
    const play = () => {
      if (reduce || document.hidden) return;
      video.play().catch(() => {});
    };
    const onVisibility = () => (document.hidden ? video.pause() : play());
    document.addEventListener("visibilitychange", onVisibility);
    const start = () => {
      video.currentTime = LOOP_START; // 흰 타이틀 화면을 건너뛰고 시작
      if (!reduce) play(); // 동작 줄이기이면 정지 화면 한 장만 보여 줌
    };
    video.addEventListener("loadeddata", start);
    // 영상이 이 코드보다 먼저 다 불러와졌을 수도 있어서 바로 한 번 확인한다
    if (video.readyState >= 2) start();

    let raf = 0;
    let last = performance.now();
    let revealStart = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(now - last, 40);
      last = now;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      if (video.currentTime >= LOOP_END) video.currentTime = LOOP_START;

      // 첫 진입 연출이 도는 동안은 창을 열지 않고 기다린다
      if (document.documentElement.dataset.intro === "running") return;
      if (!revealStart) revealStart = now;
      const reveal = reduce ? 1 : easeInOutCubic(Math.min(1, (now - revealStart) / REVEAL_MS));

      rotX += (targetX - rotX) * Math.min(1, dt * 0.009);
      rotY += (targetY - rotY) * Math.min(1, dt * 0.009);

      const rect = anchor.getBoundingClientRect();
      if (rect.width < 1 || rect.bottom < 0 || rect.top > h) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const pw = rect.width * reveal;
      const ph = rect.height * reveal;
      if (pw < 2 || ph < 2) return;

      // 둥근 사각형을 기울여 화면에 투영(가짜 3D)
      const ax = (rotX * Math.PI) / 180;
      const ay = (rotY * Math.PI) / 180;
      const radius = Math.min(90, rect.width * 0.28) * reveal;
      const pts = roundedRectPoints(pw, ph, radius).map(([x, y]) => {
        const xx = x * Math.cos(ay);
        const yy = y * Math.cos(ax);
        const z = x * Math.sin(ay) - y * Math.sin(ax);
        const p = FOCAL / (FOCAL + z);
        return [cx + xx * p, cy + yy * p] as const;
      });

      ctx.save();
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = "#030308";
      ctx.fillRect(0, 0, w, h);

      // 영상은 화면에 고정(창이 움직여도 따라가지 않음)해서 창 너머로 보이는 느낌을 낸다
      const mw = video.videoWidth;
      const mh = video.videoHeight;
      if (mw && mh && video.readyState >= 2) {
        const bw = rect.width * MEDIA_ZOOM;
        const bh = rect.height * MEDIA_ZOOM;
        const s = Math.max(bw / mw, bh / mh);
        ctx.drawImage(video, cx - (mw * s) / 2, cy - (mh * s) / 2, mw * s, mh * s);
      }
      // 아래쪽을 살짝 어둡게
      const g = ctx.createLinearGradient(0, cy - rect.height / 2, 0, cy + rect.height / 2);
      g.addColorStop(0.55, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - rect.width, cy - rect.height, rect.width * 2, rect.height * 2);
      ctx.restore();

      // 창 테두리 빛
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = "rgba(160,200,255,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      video.removeEventListener("loadeddata", start);
      video.pause();
    };
  }, [host]);

  return (
    <>
      {/* 창이 놓일 자리(크기만 차지). 실제 그림은 아래 canvas가 그린다 */}
      <div
        ref={anchorRef}
        aria-hidden="true"
        className={`aspect-[320/350] ${className}`}
      />
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
      {host &&
        createPortal(
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="intro-hide pointer-events-none fixed inset-0 z-[5]"
          />,
          host,
        )}
    </>
  );
}
