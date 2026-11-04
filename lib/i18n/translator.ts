import type { useTranslations } from "next-intl";

/**
 * React 밖 순수 함수가 받는 번역 함수. 부르는 컴포넌트가 `useTranslations("dates")` 를 넘긴다 — 함수는 순수하게 남고
 * 시험은 언어마다 만든 번역 함수(`createTranslator`)를 넘긴다.
 */
export type DatesT = ReturnType<typeof useTranslations<"dates">>;

/**
 * 이름공간 없는 번역 함수(`useTranslations()`). 복사본·회의록처럼 화면 여러 곳의 문구(`notes.*`)와 날짜 낱말(`dates.*`)을
 * 함께 쓰는 문서 조립 함수가 받는다. 화면과 같은 키를 읽어 화면과 복사본이 갈라지지 않는다.
 */
export type AppT = ReturnType<typeof useTranslations<never>>;

/** 문서(복사본·회의록)를 만드는 언어. 날짜 표시 locale(`useDisplayLocale`)과 이름공간 없는 번역 함수다. */
export type DocLanguage = { locale: string; t: AppT };
