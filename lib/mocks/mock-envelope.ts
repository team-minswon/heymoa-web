import { HttpResponse } from "msw";

/**
 * 계약의 실패 하나. 목 모듈이 던지고 [respond] 가 계약 봉투와 상태 코드로 옮긴다.
 * 문구는 계약 예시와 같아야 한다 — 화면이 `errorMessageOf` 로 그대로 그린다.
 */
export class MockFailure extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly text: string
  ) {
    super(code);
  }
}

export function failWith(code: string, status: number, text: string): never {
  throw new MockFailure(code, status, text);
}

/** 목 DB가 던지는 코드. 새 목 모듈이 목 DB를 거쳐 노트·프로젝트를 찾을 때 난다. */
const DB_FAILURES: Record<string, { status: number; text: string }> = {
  NOTE_NOT_FOUND: { status: 404, text: "노트를 찾을 수 없습니다." },
  PROJECT_NOT_FOUND: { status: 404, text: "프로젝트를 찾을 수 없습니다." },
  WORKSPACE_NOT_FOUND: { status: 404, text: "워크스페이스를 찾을 수 없습니다." },
};

export async function respond<T>(run: () => T | Promise<T>, okStatus = 200) {
  try {
    const data = await run();
    if (okStatus === 204) return new HttpResponse(null, { status: 204 });
    return HttpResponse.json(
      { success: true, data, error: null },
      { status: okStatus }
    );
  } catch (error) {
    const failure =
      error instanceof MockFailure
        ? error
        : error instanceof Error && DB_FAILURES[error.message]
          ? new MockFailure(
              error.message,
              DB_FAILURES[error.message].status,
              DB_FAILURES[error.message].text
            )
          : null;
    if (!failure) throw error;
    return HttpResponse.json(
      {
        success: false,
        data: null,
        error: { code: failure.code, message: failure.text, details: null },
      },
      { status: failure.status }
    );
  }
}

export function paramId(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value ?? "");
}
