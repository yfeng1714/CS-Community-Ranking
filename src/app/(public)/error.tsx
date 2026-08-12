"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PublicError({ error, reset }: { error: Error; reset(): void }) {
  useEffect(() => {
    console.error("Public page render failed", { name: error.name });
  }, [error]);

  return (
    <main className="public-page public-error" id="main-content">
      <section className="vote-state-panel" role="alert">
        <span className="eyebrow">暂时无法加载</span>
        <h1>页面刚刚遇到一点问题。</h1>
        <p>你的选择没有因此自动重试。可以重新加载当前页面，或先回到投票。</p>
        <div className="vote-state-panel__actions">
          <button className="button button--primary" onClick={reset} type="button">
            重新加载
          </button>
          <Link className="button button--ghost" href="/">
            回到投票
          </Link>
        </div>
      </section>
    </main>
  );
}
