import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私说明",
  description: "CS 野榜匿名访客、计票风控、数据来源与保留说明。",
};

export default function PrivacyPage() {
  return (
    <main className="public-page reading-page privacy-page" id="main-content">
      <header className="reading-hero reading-hero--compact">
        <span className="eyebrow">隐私说明 · V0.1</span>
        <h1>不要求登录，也不保存你的原始 IP。</h1>
        <p>这份说明描述当前产品设计；正式上线前会补充最终法律文本与公开联系地址。</p>
      </header>

      <div className="privacy-sections">
        <section>
          <span>01</span>
          <div>
            <h2>匿名访客 Cookie</h2>
            <p>
              首次请求投票时，浏览器会获得一个高强度随机标识，用于维持当前
              Ballot、每日机会和安全重试。 Cookie 为
              Secure、HttpOnly、SameSite=Lax，脚本无法读取。数据库只保存带密钥的不可逆摘要。
            </p>
          </div>
        </section>
        <section>
          <span>02</span>
          <div>
            <h2>额度与风险处理</h2>
            <p>
              每日额度按获得的新 Ballot
              机会计算。超过额度或被高置信度风控标记的选择仍会保存，但不改变公开分数。 IP
              仅作为次要风险信号；系统设计使用每日轮换的 HMAC 风险键，不保存或记录原始 IP。
            </p>
          </div>
        </section>
        <section>
          <span>03</span>
          <div>
            <h2>保留与分析</h2>
            <p>
              Vote
              和排名历史为审计与重算目的长期保留，异常票只撤销、不物理删除。产品事件仅限页面、榜单、选手页、结果和
              Next 等小型类别，初始保留窗口为 90 天；网络风险键同样计划在 90 天后清除。
            </p>
          </div>
        </section>
        <section>
          <span>04</span>
          <div>
            <h2>外部数据与图片</h2>
            <p>
              选手统计来自经后台同步和审核的数据源，页面会标明缺失或陈旧状态。网站不会在你访问时实时请求外部数据站点。
              选手图片和队标采用本地资产并维护来源/授权记录；无法确认时使用中性占位图。
            </p>
          </div>
        </section>
        <section id="contact">
          <span>05</span>
          <div>
            <h2>隐私与图片权利联系</h2>
            <p>
              正式公开测试前，站方将在此公布隐私、数据访问和图片权利/下架请求的专用联系地址。该地址和最终法律文本是上线阻塞项。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
