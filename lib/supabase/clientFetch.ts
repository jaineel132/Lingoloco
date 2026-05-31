export function withSupabaseAuthHeaders(
  accessToken: string | null | undefined,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers || {});

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return {
    ...init,
    headers,
  };
}
