import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "关于与规则",
  description: "CS 野榜的计分、随机配对、候选池和计票规则。",
};

export default function AboutPage() {
  return (
    <main className="public-page reading-page" id="main-content">
      <header className="reading-hero">
        <span className="eyebrow">关于这张野榜</span>
        <h1>数据看专业榜，争论留给社区。</h1>
        <p>这里不定义“更强”是什么。近期状态、生涯成就、巅峰实力、个人喜好——你按自己的标准选。</p>
      </header>

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

      <div className="reading-grid">
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
        <section>
          <span className="eyebrow">计票与节奏</span>
          <h2>结果值得停一下。</h2>
          <p>
            投票后会原位展示是否计榜、社区 H2H
            和双方最新排名。页面不会自动切换，下一组由你主动决定。
          </p>
          <p>
            每日有效机会达到上限后仍可继续玩和看结果，只是不再影响正式榜。异常流量也可能被记录为不计榜。
          </p>
        </section>
      </div>

      <section className="about-cta">
        <div>
          <span className="eyebrow">这不是客观真理</span>
          <h2>它是一张公开、简单、可审计的社区意见榜。</h2>
        </div>
        <div>
          <Link className="button button--primary" href="/">
            开始投票
          </Link>
          <Link className="button button--ghost" href="/privacy">
            查看隐私说明
          </Link>
        </div>
      </section>
    </main>
  );
}
