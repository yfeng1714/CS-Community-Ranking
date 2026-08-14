import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>社区意见，不是客观真理。</p>
        <div className="site-footer__links">
          <Link href="/about">规则与候选池</Link>
        </div>
      </div>
    </footer>
  );
}
