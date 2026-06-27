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
  id: number;
  email: string | null;
  name: string | null;
  image: string | null;
  onboardingCompleted: boolean;
};
