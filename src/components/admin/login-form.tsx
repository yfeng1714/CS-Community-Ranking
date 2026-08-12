"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/admin/login", {
        body: JSON.stringify({ password: form.get("password"), username: form.get("username") }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setMessage(body.error?.message ?? "Login failed");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setMessage("Admin Console is temporarily unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="admin-login__form" onSubmit={submit}>
      <label>
        Username
        <input autoComplete="username" name="username" required />
      </label>
      <label>
        Password
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      <button className="admin-button admin-button--primary" disabled={pending} type="submit">
        {pending ? "Checking…" : "Sign in"}
      </button>
      <p aria-live="polite" className="admin-form__message" data-error={Boolean(message)}>
        {message}
      </p>
    </form>
  );
}
