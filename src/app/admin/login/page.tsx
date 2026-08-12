import { redirect } from "next/navigation";
import Link from "next/link";

import { AdminLoginForm } from "@/components/admin/login-form";
import { getCurrentAdminSession } from "@/domain/admin/runtime";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getCurrentAdminSession()) redirect("/admin");
  return (
    <main className="admin-login">
      <section className="admin-login__panel">
        <span className="admin-kicker">CS 野榜 · private operations</span>
        <h1>Admin Console</h1>
        <p>
          No registration or password recovery is exposed here. Accounts are provisioned from the
          trusted CLI.
        </p>
        <AdminLoginForm />
        <Link className="admin-back-link" href="/">
          ← Return to public site
        </Link>
      </section>
    </main>
  );
}
