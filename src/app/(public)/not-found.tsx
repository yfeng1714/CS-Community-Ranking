import Link from "next/link";

export default function NotFound() {
  return (
    <main className="public-page empty-state" id="main-content">
      <span className="eyebrow">404</span>
      <h1>没有找到这个页面</h1>
      <p>选手可能尚未加入当前榜单，或者链接已经改变。</p>
      <Link className="button button--primary" href="/ranking">
        返回社区榜单
      </Link>
    </main>
  );
}
