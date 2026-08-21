"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/", label: "投票" },
  { href: "/ranking", label: "榜单" },
  { event: true, href: "/current-event", label: "当期赛事 - EWC" },
  { href: "/about", label: "关于" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link aria-label="CS 野榜首页" className="brand" href="/">
          <span className="brand__mark">CS</span>
          <span className="brand__name">野榜</span>
        </Link>
        <nav aria-label="主导航" className="site-nav">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  "event" in link ? "site-nav__link site-nav__link--event" : "site-nav__link"
                }
                data-active={active ? "true" : "false"}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
