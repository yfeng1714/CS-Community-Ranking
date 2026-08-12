import { AdminConsole } from "@/components/admin/console";
import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin/logout-button";
import { getDatabase } from "@/db/client";
import { getAdminConsoleData } from "@/domain/admin/queries";
import { requireAdminPageSession } from "@/domain/admin/runtime";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireAdminPageSession();
  const data = await getAdminConsoleData(getDatabase());
  return (
    <>
      <header className="admin-header">
        <Link className="admin-brand" href="/admin">
          <span>野榜</span>
          <strong>Admin</strong>
        </Link>
        <nav aria-label="Admin sections">
          <a href="#overview">Overview</a>
          <a href="#people">People</a>
          <a href="#editions">Editions</a>
          <a href="#pool">Pool</a>
          <a href="#imports">Imports</a>
          <a href="#moderation">Votes</a>
          <a href="#audit">Audit</a>
        </nav>
        <div className="admin-header__user">
          <span>{session.username}</span>
          <AdminLogoutButton />
        </div>
      </header>
      <main className="admin-main">
        <AdminConsole data={data} />
      </main>
    </>
  );
}
