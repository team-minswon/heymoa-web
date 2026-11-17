import { HttpResponse } from "msw";

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
