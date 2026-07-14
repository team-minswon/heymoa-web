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
};
