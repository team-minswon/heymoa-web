import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

// `next/root-params` 는 Next 컴파일러가 바꿔 끼우는 자리표시 모듈이라 vitest 에서는 던진다.
// 마케팅 루트의 기본 언어(한국어)로 둔다. 영어판을 보는 시험은 자기 파일에서 다시 목한다.
vi.mock("next/root-params", () => ({ lang: async () => "ko" }));
