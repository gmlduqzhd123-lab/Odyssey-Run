// Record files chosen by the player: a size limit first, then JSON, each with its own message.
export async function readJsonFile(file: Blob, limit: number, tooLarge: string): Promise<unknown> {
  if (file.size > limit) throw Error(tooLarge);
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw Error('JSON 파일을 읽을 수 없어요. 올바른 기록 파일을 선택해 주세요.');
  }
}
