import type { Metadata } from "next";
import { ProductPageView } from "@/components/analytics/page-view";
import { BilibiliIcon, GitHubIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "关于与规则",
  description: "CS 野榜的计分、随机配对、灵感来源和数据支持。",
};

export default function AboutPage() {
  return (
    <main className="public-page reading-page" id="main-content">
      <ProductPageView event={{ eventType: "PAGE_VIEW", metadata: { page: "about" } }} />
      <h1 className="sr-only">关于与规则</h1>

      <div className="reading-grid">
        <section>
          <span className="eyebrow">作者与开源</span>
          <p className="about-chip-row">
            <span>作者</span>
            <a
              className="about-chip"
              href="https://space.bilibili.com/346373856"
              rel="noopener noreferrer"
              target="_blank"
            >
              <BilibiliIcon />
              世界第一可爱睦子米
            </a>
          </p>
          <p className="about-chip-row">
            <span>本项目已开源</span>
            <a
              className="about-chip"
              href="https://github.com/yfeng1714/CS-Community-Ranking"
              rel="noopener noreferrer"
              target="_blank"
            >
              <GitHubIcon />
              GitHub
            </a>
          </p>
        </section>
        <section>
          <span className="eyebrow">灵感与数据</span>
          <p className="about-chip-row">
            <span>灵感来源</span>
            <a
              className="about-chip"
              href="https://vote.ltsc.vip/"
              rel="noopener noreferrer"
              target="_blank"
            >
              明日方舟六星干员强度投票箱
            </a>
            <a
              className="about-chip"
              href="https://shnlfriberg.online/"
              rel="noopener noreferrer"
              target="_blank"
            >
              弗一把
            </a>
          </p>
          <p className="about-chip-row">
            <span>数据支持</span>
            <a
              className="about-chip"
              href="https://www.hltv.org/"
              rel="noopener noreferrer"
              target="_blank"
            >
              HLTV
            </a>
          </p>
        </section>
      </div>

      <section className="rule-strip" aria-label="核心规则">
        <article>
          <span>01</span>
          <h2>两个人</h2>
          <p>服务器从当期候选池中等概率随机抽取，左右位置也独立随机。</p>
        </article>
        <article>
          <span>02</span>
          <h2>选一个</h2>
          <p>有效票让胜者 +1、败者 -1。没有 Elo、权重或隐藏公式。</p>
        </article>
        <article>
          <span>03</span>
          <h2>或者跳过</h2>
          <p>Skip 不改变分数，但会消耗这次随机机会并留下可审计记录。</p>
        </article>
      </section>
    </main>
  );
}
