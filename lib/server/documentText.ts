// 올린 PDF·Word 파일에서 글자를 뽑는다. 우리 서버 안에서만 처리하고 어디로도 보내지 않는다. (서버에서만 쓴다)
// 글자가 들어 있지 않은 스캔본·사진은 여기서 글자가 거의 나오지 않는다. (글자 인식은 하지 않는다)
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { ExtractError } from "./extractEvents";

const MAX_TEXT_CHARS = 200_000; // 이보다 길면 앞부분만 쓴다

export async function readDocumentText(kind: "pdf" | "docx", bytes: Buffer): Promise<string> {
  let text: string;
  if (kind === "pdf") {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      text = (await extractText(pdf, { mergePages: true })).text;
    } catch {
      throw new ExtractError(
        "UNREADABLE",
        "PDF 문서를 열 수 없습니다. 파일이 손상되었거나 암호가 걸려 있을 수 있습니다.",
      );
    }
  } else {
    try {
      text = (await mammoth.extractRawText({ buffer: bytes })).value;
    } catch {
      throw new ExtractError(
        "UNREADABLE",
        "Word 문서를 열 수 없습니다. 파일이 손상되었거나 암호가 걸려 있을 수 있습니다.",
      );
    }
  }
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
}
