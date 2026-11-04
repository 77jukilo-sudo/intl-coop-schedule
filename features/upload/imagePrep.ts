// 사진을 올리기 전에 브라우저에서 크기를 줄인다. (서버로 보낼 수 있는 크기에 맞추고, 업로드도 빨라진다)
// 글자를 읽어야 하는 사진이라 너무 줄이지 않도록 긴 변 2400px, 화질 88%부터 시작한다.
const MAX_SIDE = 2400;
const QUALITIES = [0.88, 0.8, 0.7, 0.6, 0.5];

export class ImagePrepError extends Error {}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// maxBytes 이하의 사진 파일을 돌려준다. 이미 충분히 작으면 원본 그대로 쓴다.
export async function prepareImage(file: File, maxBytes: number): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    // 휴대폰으로 찍은 사진의 회전 정보를 반영해서 바로 세워 읽는다.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImagePrepError(
      "이 사진 형식은 읽을 수 없습니다. JPEG나 PNG 사진으로 올려 주세요.",
    );
  }

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= maxBytes) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new ImagePrepError("사진을 줄이지 못했습니다. 다른 사진으로 시도해 주세요.");
    }
    // 투명한 부분(PNG)이 검게 나오지 않도록 흰 바탕을 깐다.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITIES) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size <= maxBytes) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
        return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
      }
    }
    throw new ImagePrepError(
      "사진이 너무 커서 줄이지 못했습니다. 더 작은 사진으로 올려 주세요.",
    );
  } finally {
    bitmap.close();
  }
}
