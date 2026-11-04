// 서비스 워커: 앱 화면이 닫혀 있어도 푸시 알림을 받아 보여 주는 작은 프로그램이다.
// 서버가 보낸 알림(제목·내용)을 화면 위에 띄우고, 알림을 누르면 앱을 연다.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // 형식이 맞지 않으면 기본 문구를 보여 준다.
  }
  const title = data.title || "국제협력부 일정";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "일정이 바뀌었습니다.",
      // 같은 tag의 알림은 겹쳐 쌓이지 않고 최신 것으로 바뀐다.
      tag: data.tag || "schedule-change",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // 이미 열려 있는 앱 화면이 있으면 그 화면을 앞으로 가져온다.
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
