/**
 * 예전에 녹음 조각을 남기던 IndexedDB 이름. 디스크 보관은 APP-705 에서 걷었고, 그 전에 쓰던
 * 브라우저에 남은 DB 를 계정 탈퇴 때 지우려고 이름만 둔다(APP-1478).
 */
const DATABASE = "heymoa-transcription";

export async function deleteAudioStore() {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}
