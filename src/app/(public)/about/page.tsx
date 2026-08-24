import type { Metadata } from "next";
import { ProductPageView } from "@/components/analytics/page-view";
import { BilibiliIcon, GitHubIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "关于与规则",
  description: "CS 野榜的计分、随机配对、候选池、灵感来源和数据支持。",
};

export default function AboutPage() {
  return (
    <main className="public-page reading-page" id="main-content">
      <ProductPageView event={{ eventType: "PAGE_VIEW", metadata: { page: "about" } }} />
      <h1 className="sr-only">关于与规则</h1>

      <div className="reading-grid">
        <section>
          <span className="eyebrow">作者与开源</span>
          <h2>作者</h2>
          <p className="about-chip-row">
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
          <span className="eyebrow">候选池</span>
          <h2>先决定谁有资格出现，不替社区决定谁更强。</h2>
          <p>
            每个自然年是一届独立 Edition。Core、Review Auto、Review Manual 和极少数 Special
            只说明入池理由，不会改变随机概率或票的权重。
          </p>
          <p>
            选手通常在当届保留到年底；退役或长期不活跃时可以停止进入新对决，但历史排名不会删除。
          </p>
        </section>
        <section className="reading-grid__wide">
          <span className="eyebrow">灵感与数据</span>
          <h2>灵感来源</h2>
          <p className="about-chip-row">
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
