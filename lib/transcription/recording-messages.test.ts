import { describe, expect, it } from "vitest";
import { startErrorMessage } from "./recording-messages";

describe("녹음 시작 실패 안내", () => {
  it.each([
    ["AUDIO_PERMISSION_DENIED", "마이크 또는 컴퓨터 소리 권한이 필요합니다."],
    ["SYSTEM_AUDIO_INPUT_MISSING", "컴퓨터 소리 입력을 찾지 못했습니다."],
    ["AUDIO_CAPTURE_FAILED", "소리를 연결하지 못했습니다."],
  ])("%s는 실패 종류와 재시도를 짧게 안내합니다", (code, reason) => {
    const message = startErrorMessage(new Error(code));
    expect(message).toContain(reason);
    expect(message).toContain("권한");
    expect(message).not.toContain("앱을 완전히 종료");
    expect(
      startErrorMessage(
        new Error(
          `Error invoking remote method 'heymoa:capture-begin': Error: ${code}`
        )
      )
    ).toBe(message);
  });

  it("브라우저의 마이크 거부는 브라우저 설정을 안내합니다", () => {
    expect(
      startErrorMessage(new DOMException("denied", "NotAllowedError"))
    ).toBe(
      "마이크 권한이 필요합니다. 브라우저 설정에서 마이크 사용을 허용해 주세요."
    );
  });

  it("종료되었거나 누락된 마이크를 권한 거부로 단정하지 않습니다", () => {
    expect(startErrorMessage(new Error("MICROPHONE_INPUT_MISSING"))).toBe(
      "사용할 수 있는 마이크를 찾지 못했습니다."
    );
  });

  it("서버 오류와 원인 불명의 오류를 권한 문제로 바꾸지 않습니다", () => {
    expect(
      startErrorMessage({ error: { code: "ERROR", message: "서버 안내" } })
    ).toBe("서버 안내");
    expect(startErrorMessage(new Error("unknown"))).toBe(
      "녹음을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요."
    );
  });
});
