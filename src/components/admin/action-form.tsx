"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export interface AdminField {
  defaultValue?: string;
  label: string;
  name: string;
  options?: readonly { label: string; value: string }[];
  placeholder?: string;
  required?: boolean;
  type?: "checkbox" | "date" | "datetime-local" | "number" | "select" | "text" | "url";
}

export function AdminActionForm({
  action,
  compact = false,
  fields,
  hidden,
  submitLabel,
}: {
  action: string;
  compact?: boolean;
  fields: readonly AdminField[];
  hidden?: Record<string, boolean | number | string>;
  submitLabel: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = { action, ...hidden };
    for (const field of fields) {
      const value = formData.get(field.name);
      if (field.type === "checkbox") payload[field.name] = value === "on";
      else if (field.type === "number") payload[field.name] = Number(value);
      else if (field.type === "datetime-local" && value !== "") {
        payload[field.name] = new Date(String(value)).toISOString();
      } else payload[field.name] = value === "" ? null : value;
    }

    try {
      const response = await fetch("/api/v1/admin/mutate", {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        if (response.status === 401) router.replace("/admin/login");
        setMessage(body.error?.message ?? "Operation failed");
        return;
      }
      setMessage("Saved and audited.");
      if (!compact) event.currentTarget.reset();
      router.refresh();
    } catch {
      setMessage("Operation is temporarily unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className={compact ? "admin-action admin-action--compact" : "admin-action"}
      onSubmit={submit}
    >
      {fields.map((field) => (
        <label key={field.name}>
          {field.type === "checkbox" ? (
            <span className="admin-checkbox">
              <input
                defaultChecked={field.defaultValue === "true"}
                name={field.name}
                type="checkbox"
              />
              {field.label}
            </span>
          ) : (
            <>
              <span>{field.label}</span>
              {field.type === "select" ? (
                <select
                  defaultValue={field.defaultValue}
                  name={field.name}
                  required={field.required}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  defaultValue={field.defaultValue}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  type={field.type ?? "text"}
                />
              )}
            </>
          )}
        </label>
      ))}
      <button className="admin-button" disabled={pending} type="submit">
        {pending ? "Saving…" : submitLabel}
      </button>
      <span aria-live="polite" className="admin-form__message">
        {message}
      </span>
    </form>
  );
}
