"use client";

import { useEffect, useState } from "react";

import { clearToken, getStoredToken } from "@/lib/auth";
import { getMe } from "@/lib/api";

export function NavBar() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    getMe()
      .then((user) => setEmail(user.email))
      .catch(() => {
        // Token may be expired; silently ignore
      });
  }, []);

  function handleLogout() {
    clearToken();
    window.location.reload();
  }

  return (
    <nav className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <span className="text-base font-semibold text-primary">SignalLens</span>
        <div className="flex items-center gap-4 text-sm">
          {email ? (
            <>
              <span className="text-muted-foreground">{email}</span>
              <button
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </>
          ) : (
            <a
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              href="/login"
            >
              Login
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
