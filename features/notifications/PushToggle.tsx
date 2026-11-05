"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { signOut } from "../../app/login/actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Support = "checking" | "supported" | "unsupported" | "ios-install";

// 이 기기·브라우저에서 푸시 알림을 쓸 수 있는지 (서버에서는 알 수 없어 "checking")
function detectSupport(): Support {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (capable) return "supported";
  // iPhone은 사파리 탭에서는 알림을 쓸 수 없고, "홈 화면에 추가"한 앱에서만 쓸 수 있다.
  if (isIos && !standalone) return "ios-install";
  return "unsupported";
}
const subscribeNothing = () => () => {};

// 브라우저가 요구하는 형식(Uint8Array)으로 공개 키를 바꾼다.
function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type On = "unknown" | "on" | "off";

// "알림 받기" 켜기/끄기. 켜 두면 다른 부원이 일정을 바꿀 때 앱을 열지 않아도 알림이 온다.
export default function PushToggle() {
  const support = useSyncExternalStore<Support>(subscribeNothing, detectSupport, () => "checking");
  const [on, setOn] = useState<On>("unknown");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 이 기기가 이미 알림을 켜 둔 상태인지 확인한다.
  useEffect(() => {
    if (support !== "supported") return;
    let cancelled = false;
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (!cancelled) setOn(subscription ? "on" : "off");
    })().catch(() => {
      if (!cancelled) setOn("off");
    });
    return () => {
      cancelled = true;
    };
  }, [support]);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(
          permission === "denied"
            ? "알림이 차단되어 있습니다. 브라우저(또는 휴대폰) 설정에서 이 사이트의 알림을 허용해 주세요."
            : "알림 허용을 선택하지 않아 켜지 못했습니다.",
        );
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyToBytes(PUBLIC_KEY),
        }));
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (response.status === 401) {
        await signOut();
        return;
      }
      if (!response.ok) {
        await subscription.unsubscribe();
        setMessage("알림을 켜지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        return;
      }
      setOn("on");
      setMessage("알림을 켰습니다. 다른 부원이 일정을 바꾸면 알려 드립니다.");
    } catch {
      setMessage("이 기기에서는 알림을 켜지 못했습니다. 다른 브라우저로 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setOn("off");
      setMessage("알림을 껐습니다.");
    } catch {
      setMessage("알림을 끄지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (!PUBLIC_KEY || support === "checking") return null;

  if (support === "ios-install") {
    return (
      <p className="text-xs text-foreground/60">
        iPhone은 사파리의 공유 버튼에서 &lsquo;홈 화면에 추가&rsquo;한 뒤, 홈 화면의 앱에서 알림을 켤 수 있습니다.
      </p>
    );
  }
  if (support === "unsupported") {
    return <p className="text-xs text-foreground/60">이 브라우저는 알림을 지원하지 않습니다.</p>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy || on === "unknown"}
        onClick={() => void (on === "on" ? turnOff() : turnOn())}
        aria-pressed={on === "on"}
        className="h-11 rounded-full border border-white/25 bg-white/5 px-3 text-sm font-medium hover:bg-foreground/5 disabled:opacity-60"
      >
        {on === "on" ? "🔔 알림 켜짐 (끄기)" : "🔕 알림 받기"}
      </button>
      {message ? (
        <p role="status" className="text-xs text-foreground/70">
          {message}
        </p>
      ) : null}
    </div>
  );
}
