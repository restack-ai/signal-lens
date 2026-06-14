export type AuthState = {
  token: string | null;
  user: { email: string; role: string; tenant: string } | null;
};

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("signallens_token");
}

export function storeToken(token: string): void {
  localStorage.setItem("signallens_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("signallens_token");
}
