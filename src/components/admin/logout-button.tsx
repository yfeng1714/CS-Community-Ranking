"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();
  return (
    <button
      className="admin-button admin-button--ghost"
      onClick={async () => {
        await fetch("/api/v1/admin/logout", {
          body: "{}",
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        router.replace("/admin/login");
        router.refresh();
      }}
      type="button"
    >
      Sign out
    </button>
  );
}
