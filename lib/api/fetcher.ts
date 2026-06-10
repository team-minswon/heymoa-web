type ApiFetchOptions = RequestInit & {
  headers?: HeadersInit;
  data?: BodyInit | Record<string, unknown>;
  params?: Record<string, unknown>;
  responseType?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function buildUrl(path: string, params?: Record<string, unknown>) {
  const url = new URL(path, apiBaseUrl || "http://localhost");

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  if (!apiBaseUrl) {
    return `${url.pathname}${url.search}`;
  }

  return url.toString();
}

function buildBody(data: ApiFetchOptions["data"]) {
  if (!data || data instanceof FormData || data instanceof Blob) {
    return data;
  }

  return JSON.stringify(data);
}

export async function apiFetch<T>(
  url: string,
  options?: ApiFetchOptions
): Promise<T> {
  const { headers, data, params, signal, responseType, ...requestOptions } =
    options ?? {};
  const isJsonBody =
    data && !(data instanceof FormData) && !(data instanceof Blob);

  const response = await fetch(buildUrl(url, params), {
    ...requestOptions,
    headers: {
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: buildBody(data),
    signal,
  });

  const responseData =
    response.status === 204
      ? undefined
      : responseType === "blob"
        ? await response.blob()
        : await response.json();

  if (!response.ok) {
    throw responseData;
  }

  return {
    data: responseData as T,
    status: response.status,
    headers: response.headers,
  } as T;
}
