export type AppResponse<T> = {
  success: boolean;
  data: T | null;
  error: AppError | null;
};

export type AppError = {
  code: string;
  message: string;
  details?: Array<{
    field?: string;
    message: string;
  }>;
};

export type AuthUser = {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  /** 계정 화면 언어(APP-1283). 고르지 않았으면 null 이고, 그때 화면은 쿠키 → 브라우저 언어로 정한다(APP-1285). */
  language: "ko" | "en" | null;
};
