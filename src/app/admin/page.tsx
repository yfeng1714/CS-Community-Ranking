import { AdminConsole } from "@/components/admin/console";
import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin/logout-button";
import { getDatabase } from "@/db/client";
import { getAdminConsoleData } from "@/domain/admin/queries";
import { requireAdminPageSession } from "@/domain/admin/runtime";
import { getEnv } from "@/config/env";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ voteId?: string | string[] }>;
}) {
  const session = await requireAdminPageSession();
  const query = await searchParams;
  const voteId = Array.isArray(query.voteId) ? query.voteId[0] : query.voteId;
  const env = getEnv();
  const data = await getAdminConsoleData(getDatabase(), voteId ? { voteId } : {});
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
        <AdminConsole
          data={data}
          defaults={{
            ballotTtlMinutes: env.DEFAULT_BALLOT_TTL_MINUTES,
            fullWeightBallotsPerDay: env.DEFAULT_FULL_WEIGHT_BALLOTS_PER_DAY,
          }}
        />
      </main>
    </>
  );
}
