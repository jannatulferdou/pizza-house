export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      result?.error || "Unable to complete your request.",
      response.status,
    );
  if (result === null)
    throw new ApiError(
      "The shop service is unavailable. Please try again.",
      502,
    );
  return result as T;
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
