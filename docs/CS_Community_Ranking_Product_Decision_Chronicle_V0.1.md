**CS COMMUNITY RANKING / CS 野榜**

**从灵感到 V0.1**

**产品决策纪实**

从两个第三方游戏网站出发，经过产品构思、社区热度判断、算法争论、候选池治理、反作弊设计与基础设施取舍，最终形成可交付 Codex 的 Implementation Plan V0.1。

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>两个人。选一个。或者跳过。</strong></p>
<p>核心交互的最终表达</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**版本** V0.1.18

**日期** 2026-08-15

**施工规范复核** 2026-08-10（V0.1.1；未改变冻结的产品决定）

**Owner 流程修订** 2026-08-12（V0.1.2；手动刷新按 Skip 处理并直接进入新 Pair）

**Owner 基础设施修订** 2026-08-13（V0.1.3；Hobby + Logical Backup，初期直连 Railway）

**Owner 灾备落地记录** 2026-08-13（V0.1.4；Private R2 独立第二副本）

**Owner Gate E 批准** 2026-08-14（V0.1.5；Railway Staging 验收完成，进入 M10 边界）

**Owner M10 启动** 2026-08-14（V0.1.6；先完成只读 Launch Gate，不把虚构 Staging 改名为生产）

**Owner M10 数据库与选手资料修订** 2026-08-14（V0.1.7；单 Railway DB 原地重建，Player 可选 HLTV Profile URL）

**Owner M10 真实资料边界** 2026-08-14（V0.1.8；Beta Edition、真实图片优先、Canonical DRAFT Manifest）

**Owner M10 小规模社区修订** 2026-08-14（V0.1.9；移除公开 Privacy/个人邮箱，图片允许 Owner 承担待处理 Rights）

**Owner M10 Canonical 批准** 2026-08-14（V0.1.10；14 Team / 70 Player Manifest 允许空库演练，Asset Source 只作 Dev/Ops 记录）

**Owner M10 本地数据演练** 2026-08-14（V0.1.11；VRS Live + HLTV Reviewed Fallback，14 Team Draft 保持 Pending）

**Owner M10 本地 Pool 批准** 2026-08-14（V0.1.12；14 Core Team / 70 Player，Canonical DRAFT 与 UI Preview 隔离）

**Owner M10 联网复测** 2026-08-14（V0.1.13；GitHub 恢复，HLTV Live Adapter 第三次仍 403）

**Owner M10 图片首轮** 2026-08-14（V0.1.14；14 Team Logo 完成，70 Player 统一保留 Monogram）

**Owner M10 图片记录收敛** 2026-08-14（V0.1.15；详细 Source Record 改为 Git/Docker 忽略的本地证据）

**Owner M10 完整 Portrait Pass** 2026-08-14（V0.1.16；HLTV Lazy-load 分批导出，70 Player 全量完成）

**Owner M10 Stats Rehearsal** 2026-08-15（V0.1.17；Direct 403、Live Parser Drift、Reviewed Stats Fallback）

**Owner M10 Pool Workflow Review** 2026-08-15（V0.1.18；Top-20 边界、Admin Next Action、Clean-room Gate F）

**定位** 产品背景、决策记录与后续 Review Context

*本文件不是逐字聊天记录，也不替代工程规范。它重建每个关键决策的来龙去脉，解释为什么 V0.1 是现在这个样子。*

# **0. 文档定位与使用方法**

这份纪实负责保存“为什么”。它将早期灵感、被否决或后置的方向、关键争论、最终冻结的产品原则，以及工程设计背后的产品原因放在同一个上下文中。未来无论由项目 Owner、外部 Reviewer，还是 Codex、Claude Code、Cursor 等编码代理参与，都可以先通过本文理解边界，再阅读实施规范。

规范效力上，IMPLEMENTATION_PLAN_V0.1.md 仍是 V0.1 的直接施工依据；当本文与最新 Implementation Plan、Migration 或经 Owner 批准的 ADR 冲突时，以后者为准。本文的价值是防止后续参与者只看到“做什么”，却不知道某个看似奇怪的设计实际上是经过取舍后的有意选择。

2026-08-10 的施工前复核补齐了 Pending Import、Admin Audit、数据库约束、
Edition/Ballot 生命周期、跨午夜额度、Skip 撤销、隐私留存和 Mutation Security
的细节。它们属于正确性澄清，不改变本纪实记录的产品性格和冻结规则。

2026-08-12 Owner 修订了刷新语义：投票页的真实浏览器手动刷新代表用户放弃当前判断，
因此当前 OPEN Ballot 必须以 `SKIP` 解决，再自动取得新 Pair。普通 `/next` 网络重试仍返回
同一 Ballot，服务器不能把重复请求猜测成刷新；刷新识别与编排由 M5 UI 完成，幂等 Skip
由 M4 Resolve API 保证。这样既符合用户对“随机刷新”的预期，也不允许免费 fishing。

2026-08-13 Owner 确认首发阶段继续遵循“复杂度必须由真实使用量赢得”：Railway 保持
Hobby，备份采用已经通过恢复演练的 Logical Backup；初期使用 Railway 生成域名，不为了
完成 Cloudflare 测试而提前购买域名。Cloudflare 仍是未来可加入的 WAF、DDoS、Edge Rate
Limit 层，但不是正确性依赖。ADRs 0004、0005 记录操作标准与重新评估触发条件。

同日，首份已验证 Logical Dump 与 Manifest 已保存到关闭公开访问的 Private Cloudflare R2
Bucket，并核对远端文件大小。上传所用的临时 Bucket-scope Token 随后已删除。这里使用 R2
仅代表独立灾备存储，不代表网站启用 Cloudflare Proxy/WAF；初期直连 Railway 的决定不变。

2026-08-14 Owner 批准 Gate E。Web 与 PostgreSQL 的 Singapore 部署、真实 Structured Log
字段、Health、Jobs、Security、Backup/Restore、R2 第二副本、China Mobile 4G/Wi-Fi 与受限
Load Window 均已取得证据。由于当前只有一个 Active Staging Service，且 Web Pre-deploy 由
Repository Config 管理，Owner 明确豁免为了制造 Failed Deployment 而引入临时失败代码或
配置；Railway 的 $10 Usage Alert 也不通过故意产生费用来验证。Failed-job Email 已被实际
证明，$25 Hard Limit 已设置。电信/联通设备与单独标记的晚高峰窗口作为后续观察项，不阻塞
M10。该批准只开放 M10 的审查边界，不代表真实 Candidate Pool 已启用或 Closed Beta 已开始。

同日 Owner 启动 M10。实现复核确认，当前 Railway 数据库虽然 Environment Label 为
`production`，实际保存的是 M9 明确创建的虚构 `2026` Edition、测试选手、SKIP 和不可变审计
历史；它继续作为 Staging，不能通过改名、删历史或复用唯一 Edition Code 伪装成正式数据。
M10 因此先增加只读、Fail-closed 的 Launch Readiness Report 与 Gate F 清单。最初的最低成本建议是
先在独立本地空库演练真实 Pool，再为虚构 Staging 做最终 Backup/R2 副本，并让现有 Railway
Web/Cron/生成域名切换到一个全新空 PostgreSQL；长期保留两套云环境是更方便但重复计费的备选。
真正创建资源或切换前，仍需向 Owner 说明用途、估算成本、回滚边界并取得批准。这个边界是
审计/数据真实性澄清，不改变产品算法或初期直连 Railway 的决定。

随后 Owner 选择了更严格的最低成本方案并批准 ADR 0006：不创建第二个 Railway PostgreSQL。
先在独立本地空库完成真实 Pool 演练；接近切换时暂停 Web/Cron，为现有虚构 Staging 创建最终
Logical Dump、恢复验证与 Private R2 副本，确认精确目标并再次批准破坏性操作后，只清空现有
Railway PostgreSQL 的应用 Schema，再从已提交 Migration 重建。由于当前没有真实用户、真实
Vote 或生产数据，保留经验证的恢复副本后删除虚构 Fixture 不违反“真实历史不可删除”；一旦
写入有意义的真实数据，这个一次性例外立即失效。该方案接受上线前短暂停机与更慢的人工回滚，
换取始终只有一套 Railway DB/Web/Cron 费用。

同次修订中，Owner 要求 Player 增加可空的 HLTV Link。实现将其定义为
`hltv_profile_url`：只允许直接 HTTPS `hltv.org/player/{id}/{slug}`，由 Admin 审计修改，并在
公开 Player 页面存在时显示。它是供人核对的资料链接，不替代 `PlayerExternalIdentity` 中供
Adapter、同步与 Launch Gate 使用的机器身份；公开页面只输出链接，不在请求期间抓取 HLTV。

Owner 同时确认工作标签使用 `2026 Beta Edition`。真实选手照和 Team Logo 优先，
图片使用本地文件与 Attribution Manifest，不在公开页请求期间 Hotlink Provider CDN。为避免手工创建
14 个 Team、70 个 Player、84 个 HLTV Identity 与 70 条 Roster 时发生错配，M10 新增可审查的
Canonical DRAFT Manifest。普通命令仅校验和输出 SHA-256；只有 Owner 把 Manifest 标为批准、
Active Admin 存在、目标产品表为空且两个显式 Apply Flag 同时提供时，才会在单一事务中创建
DRAFT Edition 与完整审计记录。它不等于 Pool 批准，也不会自动 Activate Edition。

同日 Owner 指出 HLTV 已发布 8 月 3 日与 8 月 10 日周榜，并决定所有与 VRS 的当前 Roster
冲突均以 HLTV 为准，但仍保留冲突作为 Review Evidence。Canonical DRAFT 因而改用 8 月 10 日
HLTV 周榜与 8 月 3 日 VRS 的 Top-12 Union：FaZe、Astralis 进入，The MongolZ 不再位于任一
Top 12，PARIVISION 则以 FL1T 替代 HObbit，最终为 14 Team / 70 Player。Beta Edition 的
`starts_at` 同步改为 2026-08-14 00:00（Asia/Shanghai）。

同日 Owner 根据产品仍是小规模兴趣社区的预期，撤回了公开个人联系邮箱与
`/privacy` 页的当前需求。Footer、About、Analytics Type 与文档中的路由全部移除，
HLTV User-Agent 改为识别已部署的项目 URL。这不撤销 Secure Anonymous Cookie、不保存
Raw IP、有界 Analytics 与 Retention Cleanup 等已实现的数据最小化控制。等待自有域名、
用户量明显增长、商业化或外部贡献者出现时再重新考虑公开 Policy/Contact。

图片边界同步改为“真实图片优先、Owner 处理外部 Rights”。每个文件仍必须记录精确
Source，但小规模 Beta 可以使用 `OWNER_ACCEPTED_PENDING_RIGHTS` 状态：它只表示 Owner
接受暂时使用，不伪装成已获授权。Launch Readiness 将其作为 Warning 而非 Blocker。
完整计划按 14 个 Logo 优先、70 个 Portrait 分 Team 导入、本地优化、移动端/双主题复核与
可替换路径执行。

Owner 随后批准了上述 14 Team / 70 Player Canonical Manifest，允许将它应用于独立空白本地库
做 Rehearsal。该批准不等于 Candidate Pool Admission、Railway Reset 或 Edition Activation。Asset
Source Record 被定义为 Dev/Ops Metadata：不放在 `public/`，不由 Public API 返回，也不在公开或
Admin UI 展示 Source URL/Notes。图片首轮完成后，Owner 进一步要求详细 Source Record 不进入 Git：
当前设计仅跟踪 Asset Path 与 Pending-rights 状态供部署后 Launch Gate 使用，精确 URL、Rights Notes
与核验上下文保留在 Git/Docker 忽略的本地文件，并由本地 `assets:check` 强制与 Registry、实际文件
完全对应。该本地文件不是备份，换机或清理 Workspace 前必须进入 Owner 私有运维证据。

同日本地空库演练完成 Canonical Bootstrap：创建 DRAFT Edition、14 Team、70 Player、70 条当前
Roster、84 条 HLTV Identity 与 239 条 Audit，Pool 仍为空。Valve 8 月 3 日官方 VRS Live Sync
成功并经审查批准；HLTV 8 月 10 日低频抓取收到 HTTP 403，Adapter 按设计记录失败且未写入部分
Snapshot。为验证不依赖 Scraper 成功的人工恢复路径，工程新增严格校验、Checksum 固定且需
Admin/Reason/双 Flag 的 Reviewed Top-12 JSON Import，其 Parser Version 明确标为 Manual
Fallback，不能冒充 Live Sync 或 Player Stats。

两份本地 Source 获批后，Pool Draft 生成 14 个无 Conflict 的 `PENDING` Team Proposal，没有自动
Admission。VRS 中与 HLTV 不同的 G2、BetBoom、Legacy、PARIVISION Roster 按 Owner 决定采用
HLTV，并保留 Warning；VRS Rank 13–20 中未进入 Canonical 且没有合格 Event Evidence 的六队只
作为 Warning，不被误判为缺失 Core Identity。该结果仍需单独 Owner Pool Review；Railway Reset、
Production Apply 与 Edition Activation 均未发生。

Owner 随后明确批准这 14 个 Proposal。工程先以新增的 Guarded `pending:review` CLI 对精确 ID
集合做 Dry-run，再逐条调用原有 `PendingImportReviewService`；因此每队仍执行 Expected State、
Source Run、Evidence 与 Conflict 的 Gate D 复核，并写入普通 Pool/Admin Audit，而不是通过 SQL
直接改状态。最终本地 Canonical Rehearsal 包含 14 个 Core Team、70 个 Pairing-enabled Starter、
70 条零分 Ranking、14 条 Proposal Review Audit、14 条 Team Admission Log 和 70 条 Team-player
Admission Log。Launch Check 返回 `blocking: false`，组合数为 2,415，仅保留 84 个 Placeholder 与
70 个可选 HLTV Stats 缺失 Warning。

为避免公开 UI 检查产生 Ballot/SKIP 而污染上述零基线，Canonical DB
`csr_m10_rehearsal_20260814` 继续保持 DRAFT；另建本地 Clone
`csr_m10_ui_preview_20260814`，在同一 Readiness Gate 通过后仅激活该 Clone。该 Active 状态不代表
Production Activation 或 Closed Beta。Owner 同时要求再试一次 HLTV 8 月 10 日 Live Adapter；
第二次 Identified/Bounded Request 仍返回 HTTP 403，而 Owner 普通 Browser 可访问页面。Owner
随后重启出现异常的网络路径并要求复测；第三次请求已正常到达 HLTV，但仍收到 HTTP 403。
三条失败 Run 均保留且没有新增部分 Snapshot；再次执行 Launch Check 仍为 `blocking: false`，
Canonical DRAFT 保持 70 条零分 Ranking，Reviewed Fallback 的身份不变。

Owner 随后批准执行图片 Pass。工程从官方 8 月 10 日 HLTV Ranking Page 的已验证 DOM/Network
资源中取得全部 14 个 Team Logo，保存为本地真实格式，为每个文件在忽略的本地记录中写入精确
Source URL，同时在跟踪的最小 Registry 中写入 `OWNER_ACCEPTED_PENDING_RIGHTS`，并使 Vote、Ranking、Player 的公共 Projection/UI 真正消费
数据库中的 `logoPath`。深浅 Logo 统一置于中性深色容器，Source/Notes 仍只属于 Dev/Ops，未进入
Public API 或 Admin UI。初次检查时页面只有默认展开的 Falcons 五张 Portrait 进入 Asset Inventory，
其余 Accordion 虽有 URL 却未加载；为避免一队真实照片、十三队占位的失衡界面，这五张没有被单独
发布，所有 Player 暂时继续使用一致的 Monogram。原本地 Rehearsal DB 早于本轮 Asset Pass，
因此其历史 Launch Report 不被冒充为新 Manifest 的数据库验证证据。

Owner 要求重新验证 HLTV 并在必要时寻找其他完整来源。新检查逐队展开 Canonical Team Accordion，
确认 14 队各 5 张、共 70 张 HLTV Body Shot 全部正常加载；问题并不是资源缺失或只允许 Falcons，
而是 Lazy-load 与单次 Asset Inventory 仅保留部分已观察 Response。工程因而按 30 + 20 + 20 三批
导出，每批零失败，再以 Player ID、Profile Slug、Team、Nickname、Source URL 与 Bundle Manifest
六层精确对应导入，拒绝 Filename 推断。最终 70 个 WebP、70 个 `photoPath`、70 个 Registry Entry
与 70 个忽略的本地 Source Record 完整对应；加上 Logo 共 84 个 Asset，`assets:check` 全部通过。
HLTV 提供的是一致的原生 200×200 Transform，工程没有为满足名义尺寸而人工放大。每队代表 Crop
已做视觉检查，Monogram 仍作为未来清空/争议图片时的弹性 Fallback。

随后进入 Player Stats Rehearsal。工程没有直接启动 70 人循环，而是先以项目识别 User-Agent 对
一条官方近三月 Stats URL 做有界探测；该请求返回 HTTP 403，因此没有制造 70 组可预见失败，也
没有写入部分 Snapshot。普通 Browser 能加载同一页面并显示 Rating 3.0 与 Maps Played，但 Live
Markup 已不再使用旧 Fixture 中的 `rating_3_0` / `recent_maps` 合成标签，现有 Direct Parser 不能
被冒充为仍然有效。工程因此增加独立的 Reviewed Player Stats JSON 边界：Dry-run 校验 Checksum、
Period、唯一 ID 与精确官方 URL；Apply 还要求 Active Admin、Reason、双 Flag、覆盖全部已配置 HLTV
Player Identity、ID/Slug 一致且 Capture Timestamp 未使用，并在单一事务写入实际观察到的 Metric
与一条 Admin Audit。Recent 与 Career Source 分开；没有 Career Evidence 时继续显示 `—`，绝不把
近三月 Rating 伪装为生涯 Rating。随后从 Canonical Manifest 生成精确 70 Identity/URL 的 Null-first
Template，在隔离 Clone 中只填入并导入一条 Browser 已观察到的 Recent Metric；其余 69 条 Recent
与全部 Career 均保持缺失，证明 Atomic Fallback 可用但不伪造“完整 Stats”。Railway 仍未改动。

同日 Owner 批准长周期 M10 收敛计划。Reviewed HLTV Ranking 边界被扩展为严格区分 Top 12 与
Top 20：两者使用不同 Parser Label，且必须通过官方 Dated URL、Publication Date、连续 Rank、唯一
Team Identity 与五名唯一 Starter 校验；当前 August 10 文件仍只有 Top 12，因此不被冒充为
Review Auto 全量证据。已完成的 IEM Cologne Major Top 8 被整理为 Owner Review Packet，但八队均已
属于 Core，没有自动增加新队。Exact Rank 13–20、Completed-2026 T1 Whitelist、Review Manual 与
Special 仍保留给 Owner 决策。

Admin Overview 新增只读 Pool Update Workflow：根据最新 HLTV/VRS Snapshot、Approval、Pool Draft
与 Pending/Conflict Proposal，显示唯一明确的 Next Action。这里的 “Automatic” 继续只表示规则由
Job 确定计算，不表示自动批准；VRS 周一 Scheduled Sync 只产生待审 Source，HLTV 与 Pool Draft
仍由 Operator 发起，任何 Admission 仍需 Admin 单独批准。第二个全新本地 DB 独立通过 Migration、
Canonical、Reviewed HLTV 与 Stats 边界，但本机 GitHub Transport 对官方 VRS 文件两次 Zero-byte
Timeout，因此按 Fail-closed 停在缺失 Source，而没有复制旧 Snapshot 或制造 Partial Draft。该结果
作为 Resilience 证据，不替代早先完整 396-Team VRS → 14 Core 演练，也不授权 Railway Reset 或
Edition Activation。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>建议阅读路径</strong></p>
<p>产品与社区 Reviewer：先读执行摘要、第一至三部分和决策总表。工程 Reviewer：重点读第四至五部分，再进入 Implementation Plan。未来新增功能时：先读“后置功能与触发条件”“已接受的不完美”和“变更审查清单”。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **状态标记**

| **状态** | **含义**                                   | **后续处理**                                  |
|----------|--------------------------------------------|-----------------------------------------------|
| **冻结** | 已纳入 V0.1 产品宪法或工程不变量。         | 除非 Owner 明确改版，否则实现者不得擅自优化。 |
| **后置** | 有价值，但不属于首版验证所需。             | 只有达到预设触发条件后再设计。                |
| **拒绝** | 与当前产品性格或正确性目标冲突。           | 不能以“技术更先进”为由偷偷重新引入。          |
| **开放** | 不阻塞早期研发，仍需在上线前或测试后决定。 | 保留配置、适配层或数据接口。                  |

## **本文与其他文件的关系**

| **文件**                        | **回答的问题**                                       | **权威程度**     |
|---------------------------------|------------------------------------------------------|------------------|
| **本文件**                      | 为什么选择这条产品与工程路线？哪些替代方案曾被考虑？ | 背景与决策上下文 |
| **IMPLEMENTATION_PLAN_V0.1.md** | Codex 应按什么顺序、接口、约束和验收标准施工？       | V0.1 施工主规范  |
| **CODEX_START_HERE.md**         | 编码代理第一步具体做什么，并在何处停止等待 Review？  | 首轮执行指令     |
| **REVIEW_SUMMARY_ZH.md**        | Owner 如何快速复核被冻结的规则和实施阶段？           | 中文审阅摘要     |
| **IMPLEMENTATION_READINESS_REVIEW_2026-08-10.md** | 施工前发现并补齐了哪些缺口？当前是否可开工？ | 施工前审阅记录 |

## **执行摘要**

项目最终被定义为一个由玩家通过随机 1 对 1 选择持续生成的 CS 职业选手社区排行榜。页面不解释“强”是什么，不要求用户按年度表现、数据、荣誉或巅峰作答；它只展示两名候选、必要的简要资料，以及“选择左边、选择右边、跳过”三个动作。

榜单并不试图证明自己比 HLTV、VRS 或专业分析更客观。它测量的是社区在某一时期的综合直觉、偏好、叙事、人气和竞技判断。也正因如此，榜单和专业榜单之间的差异会自然成为内容与传播材料。

- 有效投票永远是胜者 +1、败者 -1；Skip 为 0；所有选手从 0 分开始。

- Pair 在当年启用的 Candidate Pool 中真随机、等概率生成，不按排名或热度优化。

- 候选池以队伍为主要准入单位：Core、Review Auto、Review Manual，加极少数个人 Special Inclusion。

- 游客无需登录即可参与，但每个匿名 Visitor 同时只能持有一张未解决 Ballot；手动刷新会把当前 Ballot 记为 Skip 并消耗机会，不能免费寻找指定明星。

- PostgreSQL 事务、唯一约束和行锁保证同一 Ballot 不论提交多少次，最多只影响榜单一次。

- HLTV、VRS 等外部来源只通过后台同步进入本站数据库，绝不成为用户投票请求的实时依赖。

- 首版采用 TypeScript 单体、Next.js、PostgreSQL、Railway Singapore；Cloudflare 只是可拔掉的增强层。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>项目最重要的价值判断</strong></p>
<p>排行榜不是终点，社区围绕排行榜发生的争论、截图、比较和年度回顾才是增长引擎。产品应尽量少解释、少教育、少替用户“纠正”判断，让社区意见真实地显现出来。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**PART I**

**从两个网站到一个产品命题**

这一部分记录项目如何从“有趣的第三方小游戏”出发，经过跨题材案例调研和三款游戏的方向收敛，最终找到 CS 职业选手社区野榜。

## **1. 最初的两个触发案例**

### **1.1 「弗一把」：把职业选手数据库变成可重复游玩的内容**

第一个触发案例是「弗一把」：一个围绕 CS 职业选手的猜人网页游戏。它的启发不只在 Wordle 式属性反馈，而在于它证明了职业 CS 已经存在一套足够丰富的数据资产，可以被重新包装成轻量、高频、可对抗的网页体验。数据库不再只是查询工具，而是玩法引擎。

它还展示了一个重要扩展路径：极简单的核心循环可以通过多人对战、房间、重连、统计、回放和排行榜逐渐成长为长期产品。玩法和内容数据库分离，也意味着同一套职业选手数据能够衍生多个模式。

### **1.2 「明日方舟六星干员强度投票箱」：用户点击，社区生产数据**

第二个触发案例是「明日方舟六星干员强度投票箱」。每次随机拿出两名六星干员，让玩家选择其中一方；大量局部选择最终汇聚成全局强度榜。用户感觉自己只是在做一次很轻的二选一，网站却在持续生产一个社区偏好数据集。

这类产品的运营优势非常明显：题目不需要每天手写，用户本身就是内容生产者；随着票数增加，榜单、争议和对比会越来越有价值。它也直接证明了“简单 +1/-1、随机 Pair、低门槛游客投票”在游戏社区中具有可运行性。

| **拿一个用户已经熟悉的数据对象，再设计一个极轻的重复交互，让“查资料”变成“玩资料”。** |
|--------------------------------------------------------------------------------------|

### **1.3 最初的合成公式**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>CS 职业选手数据与社区讨论热度<br />
+<br />
明日方舟投票箱的随机 1v1 与民间榜单<br />
=<br />
CS 职业选手社区野榜</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

真正决定项目方向的，并不是复制任何一个网站的页面，而是把第一个案例的题材资产与第二个案例的交互机制结合：职业选手本身具有长期讨论价值；Pairwise 投票能把这种讨论压缩成几乎零学习成本的动作；累计结果又会反过来制造新的讨论。

## **2. 早期案例调研留下的产品原语**

在正式收敛之前，调研曾覆盖 LoLdle、CharDle、Gamedle、Framed、Flickchart、All Our Ideas、Arena、UwUFUFU 等不同题材。它们的题材差异很大，但底层可以被归纳为少数几个可复用的产品原语。

| **原语**             | **基本循环**                         | **对本项目的启发**                                   |
|----------------------|--------------------------------------|------------------------------------------------------|
| **Guess it**         | 猜一个对象，根据属性或提示缩小范围。 | 数据库可以直接转化为游戏，但需要内容字段与提示设计。 |
| **Reveal it**        | 逐步展示截图、台词、音频或信息。     | 低运维，但更依赖素材积累和每日题目。                 |
| **Pick one**         | A 与 B 二选一，连续重复。            | 交互成本最低，同时自然生成社区偏好数据。             |
| **Tournament**       | 候选项通过淘汰赛产生最终 Winner。    | 分享性强，但每局较长，且结果更受抽签结构影响。       |
| **Community result** | 选择后展示他人如何选择。             | 结果本身是第二层奖励，也是争论和传播的来源。         |

最终被选中的不是“最花哨”的原语，而是最符合三个约束的那个：已有社区争议足够强、长期不依赖人工出题、首次使用几乎没有理解成本。Pairwise Choice 同时满足这三个条件。

## **3. 从三款常玩游戏中收敛**

项目范围一度限定为 CS、明日方舟和三角洲行动。讨论时采用的筛选标准并不是“代码是否好写”，因为实现工具并不稀缺；真正稀缺的是稳定热度、长期可玩性和低运维成本。

| **方向**                | **最初看点**                         | **讨论后的判断**                                       | **结论**     |
|-------------------------|--------------------------------------|--------------------------------------------------------|--------------|
| **社区预言家**          | 先选自己的答案，再猜社区多数。       | 有趣，但额外的“预测多数”层会稀释最直接的对决体验。     | 后置参考     |
| **Blind Rank**          | 高传播、容易产生梗图。               | 相关游戏中已有相似实现，差异化不足。                   | 不作为主项目 |
| **CS 六度分隔**         | 利用职业选手队友关系图，组合量巨大。 | 独特且长期可玩，但与现阶段最强社区争议并非同一条主线。 | 保留未来可能 |
| **Who’s the Fifth**     | 从历史阵容自动生成题目。             | 低运维、可作为附属小游戏。                             | 后置         |
| **肉鸽招聘室**          | 模拟方舟肉鸽招募抉择。               | 每局情境差异大，社区对统一答案的持续争论可能有限。     | 放弃主方向   |
| **Nicheknights 生成器** | 自动生成自限挑战。                   | 已有同类实现，且需要关卡/规则维护。                    | 不重复建设   |
| **三角洲社区路线**      | 众包玩家实际路线而非静态地图点位。   | 有价值，但地图交互、UGC 审核和冷启动成本更高。         | 独立未来项目 |
| **撤离决策模拟器**      | 情境选择与社区结果。                 | 真实决策过于依赖具体局势，统一题目的复玩热度有限。     | 放弃主方向   |
| **游戏内 GeoGuessr**    | 地图认知、截图猜点位。               | 可玩，但依赖素材生产与地图版本维护。                   | 后置参考     |

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>第一次真正的收敛</strong></p>
<p>用户反馈指出：部分看似有传播性的方向已经被捷足先登；另一些虽然能做，却未必有足够社区热度。由此形成了一个重要原则：不要为了玩法新奇而制造需求，优先把社区已经长期发生的争论压缩成更顺滑的产品。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**PART II**

**“野榜”产品性格的形成**

这一部分记录核心产品如何从一个“职业选手投票箱”成长为具有明确性格、规则和治理边界的社区排行榜。

## **4. 核心产品命题：民间 1v1 PK 排榜**

CS 社区对职业选手“谁更强”的讨论具有长期热度，HLTV 年度 Top 也天然拥有对照价值。因此产品最初被描述为：让社区不断进行随机 1 对 1 PK，用全年累计结果形成一张民间榜，并在年末与专业榜单形成对照。赛事结束后单独投 Community MVP，则被视为未来扩展。

这个命题之所以成立，是因为它同时拥有三条内容线：投票本身是轻量游戏；排行榜是持续变化的公共结果；专业榜单与社区榜的差异又能产生年度或赛事级内容。网站并不需要持续写文章，数据变化本身就会提供话题。

## **5. 不定义“强”：野榜野在哪里**

早期曾考虑在投票卡上明确写“在 2026 年职业赛场上的综合表现，你认为谁更优秀”。这个表述会让年度累计更容易解释，但最终被明确否决。理由并不是缺少定义能力，而是定义本身会削弱产品性格。

最终界面不出现“donk 和 ZywOo 谁强”“谁在今年表现更好”之类问题。两张卡直接摆在用户面前，用户自己决定按什么标准选择：近期状态、生涯成就、巅峰实力、个人喜好、队伍叙事，甚至纯粹粉丝立场，都属于社区意见的一部分。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>冻结决定</strong></p>
<p>网站测量的不是一个被站方预先定义的“客观实力变量”，而是社区面对两名职业选手时真实作出的选择。人气、叙事和偏好不是数据污染，而是野榜希望观察的对象。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

因此面对“这不就是人气榜吗”的质疑，产品不需要辩解。更诚实的回答是：它当然包含人气；这正是社区榜与数据榜的区别。工作中的品牌语言包括“数据看 HLTV，吵架看我们”“这是一张野榜，请按野榜的方式享用”，但最终品牌名和正式 Slogan 仍属开放项。

## **6. 排名算法争论：为什么最终坚持 +1/-1**

### **6.1 曾被认真考虑的复杂算法**

初步设计曾建议使用 Bradley–Terry、Bayesian Bradley–Terry 或类似 Elo 的模型。它们能够考虑对手强弱，避免“击败强者”和“击败弱者”得到完全相同的价值。从统计建模角度，这类方法更适合不完整的 Pairwise Comparison。

但在 CS 社区语境中，强打强得到更多积分的系统很容易让人联想到 VRS 及其争议。更重要的是，项目的核心并非寻找统计上最优的潜在能力估计，而是建立一张每个人都能一眼理解、每一票都等价的社区野榜。

### **6.2 最终规则**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>新入池选手：Score = 0<br />
有效投票：胜者 +1，败者 -1<br />
Skip：双方 0<br />
THROTTLED / SUSPICIOUS：保存选择，但不改 Score</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

初始分一度使用 1000，但很快被取消。统一加 1000 不改变任何排序，反而会让分数看起来像某种评级。以 0 为中心更直接，也允许榜单自然出现正几千与负几千的极端值。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>额外得到的工程不变量</strong></p>
<p>每张有效票同时产生 +1 和 -1，因此同一 Edition 全体 PlayerRanking 的 Score 总和必须始终等于 0。这个产品规则同时成为数据库完整性检查和撤销异常票时的核对工具。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### **6.3 有意接受的缺点**

- 它不是强度估计模型；分数包含曝光、时间和社区偏好。

- 晚加入选手从 0 分开始，追赶已经累计大量净胜票的选手会更困难。

- 高分选手可能越来越高，低分选手可能跌到很大的负数。

- 同样一票不会因为对手不同而获得不同价值。

这些并非尚未发现的缺陷，而是为了透明度、可解释性和产品性格主动接受的代价。排行榜会同时显示 Win Rate、胜负数和有效对决数，让用户理解“刚入池但胜率很高”和“长期累积高分”之间的差异。

## **7. Pairing：让 Random 真正保持 Random**

曾有建议根据分数接近程度、曝光不足程度或 Pair 历史次数调整匹配，让更多票落在争议更大的对决上。这能提升统计效率，但会把产品从真随机投票箱变成隐性的推荐系统。最终决定是：只要候选池本身足够合理，Pair 就在所有启用选手中等概率随机。

系统只做两项不改变候选概率的处理：同一 Pair 的左右位置独立随机，以减轻左/右按钮偏好；每张 Ballot 由服务器生成，客户端不能指定候选。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>冻结决定</strong></p>
<p>不按排名相邻、热门程度、识别度或历史曝光调整 Pair。#1 对 #2 和 #1 对榜尾都可能出现。Random 不是临时实现，而是产品规则。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

真随机也具有天然的反定向刷票效果：候选池越大，某个指定明星出现在一次抽签中的概率越低。这个优势后来促成了 Ballot 机制，因为如果用户可以无限刷新而不消耗机会，随机防刷会立刻失效。

## **8. Candidate Pool：不是只选人，而是建立治理制度**

### **8.1 从“40–60 名候选”到“按队伍准入”**

最初曾考虑只选约 40–60 名公认强者，以避免出现大量无意义 Pair。随后出现的 MOUZ 新人案例暴露了纯个人机械规则的问题：一支一线队可以在引入从未参加过顶级比赛的新人后立即夺冠；若要求每个选手自己满足比赛场次或履历，反而会漏掉最有时效性的候选。

于是常规准入单位从 Player 改为 Team：先判断一支队伍是否属于候选池认可的一线队，再把其当前正式首发五人全部加入。站方决定谁有资格参选，但不决定他们强不强。

### **8.2 一个 Pool，四种 Admission Reason**

| **类型**          | **准入规则**                                                       | **作用**                                           |
|-------------------|--------------------------------------------------------------------|----------------------------------------------------|
| **CORE**          | 最新 HLTV 或 VRS 任一进入 Top 12。                                 | 无需人工讨论的自动安全区；整队当前首发入池。       |
| **REVIEW_AUTO**   | 任一榜 Top 20，并在当年 T1 白名单赛事四强或 Major 八强。           | 捕捉排名边缘但已有顶级成绩的队伍。                 |
| **REVIEW_MANUAL** | 由站方基于地区代表性、社区热度、明星阵容、排名滞后等公开理由纳入。 | 承认产品首先服务 CNCS 社区，不假装完全中立。       |
| **SPECIAL**       | 极少数仍活跃、但所在队伍未整队入池的高关注选手。                   | 保留 s1mple、device 一类边界案例的趣味和流量价值。 |

这些类型只解释“为什么能进入 Pool”。一旦入池，所有选手在随机概率、计分规则和页面待遇上完全相同。系统不存在 Core 票更重、Special 票更轻之类差别。

### **8.3 为什么必须保留人工入口**

候选池规则被刻意设计成“公开但不僵硬”。例如 TYLOO、Lynn Vision 在国际排名上未必稳定达到严格的自动阈值，但作为首推中文 CS 社区的网站，完全排除中国队会直接损害内容相关性、初期流量和社区认同。拥有高关注选手的 Liquid 也可能因为短期排名滞后而值得人工纳入。

这种人工性不需要伪装成数学公式。更健康的做法是记录加入日期、Admission Type 和简短理由，并在 Pool Changelog 中永久保留。透明主观判断，比为了显得客观而不断修改机械阈值更可信。

### **8.4 年度 Edition 与出池原则**

候选池按自然年形成 Edition。选手一旦进入当年 Pool，原则上保留到年底；所属队伍后来跌出 Top 12 或 Top 20，不会让选手从排行榜突然消失。转会只更新当前 Team，Player ID、历史 Vote、Score 和快照不变。

退役、长期停止职业活动或被明确冻结时，可以将 pairing_enabled 设为 false，使其不再出现在新 Pair 中，但历史排名不会删除。真正的“重评估”放到下一年度 Edition，而不是每天动态踢人。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>候选池原则</strong></p>
<p>入池看资格，出池看状态；历史数据永不因阵容变化被抹掉。Candidate Pool 必须完全数据驱动，添加、停用或改队伍不能要求修改代码和重新部署。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### **8.5 T1 Event Whitelist 的形成**

Review Auto 需要回答“什么比赛算 T1”。调研发现 HLTV Events 页面会突出展示少量重点赛事，但并未公开一套可直接复制的算法。讨论后决定借用其人工判断思路，而不是反向工程一个伪精确公式。

- Major 自动属于 T1。

- HLTV Highlight Event 经站方确认后写入本站自己的年度白名单。

- 未被 Highlight 但强队密度足够的赛事可以 Manual Event Inclusion。

- 判断优先级：参赛队伍质量 \> 国际性与赛事定位 \> 奖金。

- 奖金高但 Top 10/Top 20 队伍密度不足的赛事，不一定算 T1。

XSE Guangzhou 在讨论中被作为负面边界案例：奖金和规模不小，但顶尖队伍密度不足，因此很难自动触发 T1 四强资格。EWC、BLAST Open、StarSeries 等则被用来说明 Highlight 参考的实际作用。无论外部页面后来如何变化，本站 Event 记录一经确认即成为自己的历史事实。

## **9. 投票卡与结果页：信息足够，但不替用户判断**

### **9.1 投票前**

默认卡片应保持克制：头像、Nickname、国籍、当前战队、近三个月 Rating 与地图数；Career Rating 只有在定义稳定且数据可靠时展示。ADR、KAST、Impact 等细节不直接堆在主卡上，以免用户只是对着统计表选较大的数字。

同时保留“详细数据”按钮，让真正难选的 Pair 可以展开查看更多信息。数据是上下文，不是站方暗示正确答案的证据。

### **9.2 投票后**

投票后原位显示用户选择、该票是否计入正式榜、有效 H2H 百分比、有效对决数、Skip 数，以及双方当前 Rank/Score。常规投票不会自动进入下一组；用户主动点击 Next，既避免细看结果时被打断，也让每一次新 Ballot 的发放有清晰边界。2026-08-12 新增的唯一例外是投票页手动刷新：它代表放弃当前 Pair，按 Skip 记录后直接进入新 Pair，不展示结果停留。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>冻结决定</strong></p>
<p>常规投票后不做自动 Next。投票循环的节奏由用户掌握；“结果”本身是产品奖励，不应被快速略过。手动 reload-as-Skip 是唯一明确例外。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### **9.3 双端策略**

早期曾强调 Mobile First，随后修正为 Responsive First。移动端是来自群聊、贴吧、NGA、B站评论和 Discord 链接的重要入口；桌面端同样符合 CS 玩家结束比赛后 Alt-Tab 浏览的场景。两端功能必须一致，但布局可以分别优化。

**PART III**

**数据、历史与长期内容资产**

这一部分解释为什么一个看似只有“点左或点右”的网站，仍需要认真保留原始票、Pair 聚合、快照和外部数据来源。

## **10. Raw Vote、PairAggregate 与历史快照**

### **10.1 是否只存 Score 和胜率**

曾考虑像简单投票箱一样只维护每名选手的 Score、胜负和 1v1 胜率，以减少存储。最终决定从第一天保留 Raw Vote。现代 PostgreSQL 存储数百万条结构简单的投票记录并不困难，而原始数据对反作弊、事务审计、撤销异常票、重算聚合和未来趋势分析都不可替代。

同时维护 PairAggregate，按 canonical player_1/player_2 聚合双方有效胜场、Skip 和总量，使 H2H 页面不需要扫描整张 Vote 表。Raw Vote 是证据，Aggregate 是高效读取视图。

### **10.2 每日快照为什么从第一天开始**

每天保存每名选手的 Rank、Score、Wins、Losses 和有效对决数，可以让未来直接回答“某场 Major 前后排名发生了什么”“某新人如何从榜尾上升”“年内谁的社区风评变化最大”。快照开发成本很低，但如果开服时没有保存，历史无法事后补回。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>长期内容价值</strong></p>
<p>一个静态 Top 20 只能被看一次；一条完整的排名时间线可以持续生成“暴涨、暴跌、宿敌、最大分歧、年度故事”等内容。项目真正积累的不是一个当前分数，而是一整年的社区舆论轨迹。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### **10.3 Vote 不删除，异常票只撤销**

若后续发现一批刷票，系统不能物理删除 Vote。正确做法是把状态从 VALID 改为 REVOKED，并在同一个事务中反向修正赢家、输家和 PairAggregate，同时写入 ModerationAuditLog。这样任何排名变化都能追溯，SUM(score)=0 也继续成立。

## **11. 数据来源策略：HLTV 不可替代，但不能成为运行时依赖**

### **11.1 HLTV 的角色**

HLTV 提供很难找到完全等价替代品的 Rating、选手 Profile、战队排名和赛事展示语义，因此不可避免地会成为重要来源。与此同时，它没有适合项目直接依赖的公开官方 API，非官方库本质上是 Scraper，且存在 Cloudflare、页面结构变化和访问限制风险。

最终策略是建立一个很薄的 HLTVAdapter：后台低频抓取、解析、归一化并写入本站数据库；解析失败时继续使用最后一份有效快照。任何用户打开选手页或请求 Ballot 时，都只读取本站 PostgreSQL，绝不现场访问 HLTV。

### **11.2 其他来源的分工**

| **来源**       | **主要职责**                        | **V0.1 定位**                          |
|----------------|-------------------------------------|----------------------------------------|
| **Valve VRS**  | 官方排名与 roster standings。       | 直接读取官方仓库；Core T1 的重要输入。 |
| **Liquipedia** | 队伍、转会、赛事与 roster 验证。    | 人工核对/备用来源，不作为运行时依赖。  |
| **PandaScore** | 正规商业 API、比赛与统计。          | 未来付费替代方案，首版不必接入。       |
| **GRID**       | 赛事官方 telemetry 与高级比赛数据。 | 未来 Event MVP 或高级统计可能使用。    |
| **BO3.gg 等**  | 交叉验证和不同评分体系。            | 研究参考，不与 HLTV Rating 混用。      |

### **11.3 多源数据模型**

Player、Team 与外部身份必须分离。PlayerExternalIdentity 保存 HLTV、Liquipedia、PandaScore 等 provider 的 external_id/slug；PlayerStatSnapshot 保存 provider、metric、period、maps 和 captured_at。这样未来可以同时保存 HLTV Rating、其他评分与本站 Community Score，而不会互相污染。M10 追加的 Player `hltv_profile_url` 只是可空的人类参考链接，不能被同步任务当作已验证 provider identity，也不能让公开请求实时依赖 HLTV。

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>Player = 人本身<br />
RosterMembership = 某段时间属于哪支队<br />
PoolPlayerEntry = 参加哪个 Edition 的野榜<br />
PlayerExternalIdentity = 在各外部数据源中的身份<br />
PlayerStatSnapshot = 某来源、某指标、某时间窗口的快照</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### **11.4 图片与授权**

初版选手图和队标优先作为本地静态资产管理，不 Hotlink 外部站点。每个资产保存来源与许可/归属记录；无法确认授权时使用占位图。候选池只有百人规模，本地 public/ 足以支撑 V0.1，真正需要频繁动态更新时再考虑 R2。

## **12. 年度榜与 Event MVP：为什么保留概念但不塞进首版**

### **12.1 年度累计**

年度榜自然来源于常驻投票，不需要十二月临时再办一次活动。年底锁定 Edition 后，可以与 HLTV Top 20 对照最大排名差、社区高估/低估和 \#1 分歧。不过项目讨论发生在 2026 年 8 月，首版剩余年度有限，因此 V0.1 不围绕年终编辑内容展开。底层保留 Edition 和快照即可。

### **12.2 Event MVP**

赛事单独投 MVP 看起来非常适合复用同一套 Voting Engine，但它有尚未解决的产品问题：投票窗口有限，真随机能否让所有候选获得足够曝光；候选池应包含所有参赛选手还是赛后筛选；早早淘汰但个人数据出色的选手如何处理；+1/-1 在短期小样本中是否足够稳定。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>后置决定</strong></p>
<p>Event MVP 不是被否定，而是被明确当作独立 Season Mode。只有常驻榜验证核心循环、积累足够用户与投票速度后，才值得单独设计。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**PART IV**

**从“能投票”到“每票只生效一次”**

这一部分记录反作弊方案如何从简单的 IP 限额演化为 Ballot、匿名 Visitor、事务与可审计 Vote 状态。

## **13. 反作弊的第一次设想与修正**

### **13.1 原始提议：每 IP 前 50 票正常，之后 0.01 权重**

这个方案的优点是 soft cap：不把高频用户直接赶走，同时限制一台机器的刷票价值。但进一步审查后发现两个问题。第一，学校、宿舍、公司、网吧和运营商 CGNAT 可能让大量真实用户共享公网 IP；按 IP 计 50 票会误伤整个群体。第二，0.01 权重破坏了“有效票永远 +1/-1”的透明规则。

### **13.2 最终身份与状态模型**

浏览器首次访问获得一个高熵匿名 Visitor Cookie，Visitor 是日额度的主要主体；IP 只作为风险信号，不作为用户身份。数据库不长期保存 Raw IP，而是按日使用 HMAC(secret, date + normalized_ip) 生成短期风险键。

| **Vote 状态**  | **是否保存** | **是否修改 Score**     | **用途**                                     |
|----------------|--------------|------------------------|----------------------------------------------|
| **VALID**      | 是           | 是，完整 +1/-1         | 正常有效票。                                 |
| **THROTTLED**  | 是           | 否                     | 正常用户超过当日有效 Ballot 额度后继续游玩。 |
| **SUSPICIOUS** | 是           | 否                     | 风控认为异常，但仍保留证据和行为数据。       |
| **REVOKED**    | 是           | 原影响被事务化反向撤销 | 管理员确认历史有效票异常。                   |

反作弊系统不再决定“一票值多少”，只决定“这是不是一张正式有效票”。这保住了产品最易理解的规则。

## **14. 真随机最大的漏洞：无限刷新寻找指定选手**

如果 API 只是 GET /pair，用户可以不断刷新，直到随机出自己想刷的明星，再只在出现该选手时投票。候选池带来的随机稀释会因此失效。这个问题促成了整个系统最重要的新对象：Ballot。

| **服务器发一张只能解决一次的选票；选择、Skip 或手动刷新记为 Skip 后，才能获得下一张。** |
|------------------------------------------------------------------------------------------|

### **14.1 一人同时只有一张 OPEN Ballot**

同一 Visitor、同一 Edition 同时最多存在一张 OPEN Ballot。普通重复调用 Next、网络重试和并发请求都返回同一张，这是传输幂等与数据库正确性，不再等同于产品层的刷新语义。

在投票页发生真实浏览器手动刷新时，用户预期看到新的随机 Pair。M5 UI 应识别 reload navigation，先取得当前 OPEN Ballot；若响应表明它是复用 Ballot，则通过 M4 的幂等 Resolve API 将其解决为 `SKIP`，随后请求下一张。若原 Ballot 已过期或已解决，`/next` 直接返回新 Ballot，不应再 Skip 这张刚签发的新票。服务器不能仅凭第二次 `/next` 猜测“这是刷新”，否则网络重试也会意外消耗 Vote。

刷新产生的 Skip 与点击 Skip 同样保留 Raw Vote、更新 Skip 计数且不改变 Score；原 Ballot 的 Opportunity 不退，新 Ballot 再消耗一个新 Ordinal。刷新路径直接显示新 Pair，不停留在结果页，是“不自动 Next”规则的明确且唯一的 reload 例外。数据库仍使用 Partial Unique Index 保证任意时刻最多一张 OPEN Ballot。

### **14.2 日额度按 Ballot Opportunity 计算**

额度不是“前 50 个成功投票”，而是“前 50 次获得新随机 Ballot 的机会”。Skip、拿到后关页面、等待过期都消耗机会，否则用户仍可通过连续跳过或等待过期来 fishing。第 51 张以后网站继续正常可玩，但产生 THROTTLED Vote，不影响正式榜。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>默认而非定论</strong></p>
<p>50 和 30 分钟 TTL 都是可配置的启动值。Closed Beta 后应根据 Votes per Visitor、真实高频玩家分布和误伤情况调整，不能散落在代码里写死。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **15. Voting API 与原子性设计**

### **15.1 两个核心 Endpoint**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>POST /api/v1/ballots/next<br />
返回当前 OPEN Ballot；若没有，则服务器随机创建一张。<br />
<br />
POST /api/v1/ballots/{publicId}/resolve<br />
Body 只能是 LEFT、RIGHT 或 SKIP。</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Ballot 在服务端保存 player_a、player_b 和左右展示顺序。客户端只能解决已经发出的那一张，不能提交任意 Player ID。Ballot ID 同时是天然幂等键。

`/next` 保持传输层幂等：重复请求本身不代表刷新。投票页 reload 由客户端明确编排为“读取复用 Ballot -> Resolve SKIP -> 再请求 Next”，复用现有两个 Endpoint，不增加一个能绕过 Resolve 原子性的特殊换题接口。

### **15.2 Resolve Transaction**

> **1.** 在 PostgreSQL 事务中 SELECT Ballot FOR UPDATE。
>
> **2.** 确认 Ballot 属于当前 Visitor、状态为 OPEN、选择只可能是 Left/Right/Skip。
>
> **3.** 若已经 RESOLVED，直接返回原结果，不再修改任何排名。
>
> **4.** 插入 Vote；Vote.ballot_id 具有 UNIQUE 约束。
>
> **5.** 若 Vote 为 VALID 且不是 Skip，按 Player ID 升序锁定两条 PlayerRanking，胜者 +1、败者 -1。
>
> **6.** 原子更新 PairAggregate。
>
> **7.** 将 Ballot 标记为 RESOLVED，并在全部步骤成功后 COMMIT。

网络重试、双击、前端重复提交、恶意 Replay 或多个并发请求，都只能产生一次排名影响。严格意义上的网络 exactly-once delivery 不存在，但系统能够保证 exactly-once effect。

### **15.3 为什么核心状态放 PostgreSQL，而不是 Redis**

Visitor 当日是第几张 Ballot、某 Ballot 是否已解决、Vote 是否有效，以及 Score 是否修改，都是业务正确性而非缓存。它们必须由 PostgreSQL 事务和约束管理。Redis 未来可以用于缓存或基础设施限流，但不能成为“重启后额度丢了也没关系”的排名真相来源。

### **15.4 CSRF、代理与大陆环境**

前端和 API 保持 same-origin，匿名 Visitor Cookie 使用 Secure、HttpOnly、SameSite=Lax；所有状态变更使用 POST，并检查 Origin / Fetch Metadata。若使用 Cloudflare，只有在源站确认请求确实来自 Cloudflare 时才信任 CF-Connecting-IP；DNS-only 或直接 Railway 模式则使用对应受信代理头。

Turnstile 最终没有纳入 V0.1。原因不是验证码无效，而是 Cloudflare 官方明确指出其在中国大陆不受支持；项目首先面向 CNCS 社区，不能把一个可能无法加载的挑战放在关键路径上。V0.1 先以 Observe Mode、Ballot 限额和 Suspicious 不计榜来降低风险。

## **16. 第一方指标：不仅看 DAU**

| **指标**                        | **它回答的问题**                                 | **可能触发的行动**                            |
|---------------------------------|--------------------------------------------------|-----------------------------------------------|
| **Votes / Visitor**             | 核心循环是否让人愿意连续点下去？                 | 低于 2–3 说明 Loop 弱；15–30 表示有明显粘性。 |
| **Skip Rate**                   | 候选是否太冷门、数据是否不足、用户是否无法判断？ | 调整 Candidate Pool 或默认展示信息。          |
| **Return Rate**                 | 用户是否会第二天回来，而不是只看一次榜？         | 决定是否强化日更、趋势或提醒。                |
| **Ranking Page CTR**            | 用户是否真的在乎公共结果？                       | 决定排行榜信息密度与入口。                    |
| **Share / External Traffic**    | 榜单变化是否产生自然传播？                       | 决定是否优先做结果卡和年度对比。              |
| **Throttled / Suspicious 比例** | 额度和风险规则是否合理？                         | 调配额、速率限制和 Observe Mode 阈值。        |
| **SUM(score) / 聚合一致性**     | 事务与撤销是否保持完整性？                       | 非 0 或不一致立即报警。                       |

**PART V**

**工程架构与部署取舍**

这一部分记录为什么选择一个传统、可移植的 TypeScript 单体，而不是更复杂的服务拆分；以及 Railway 与 Cloudflare 在中国大陆访问语境下如何被定位。

## **17. 技术栈：让复杂度集中在正确性，而不是基础设施**

| **层**             | **选择**                                        | **理由**                                                          |
|--------------------|-------------------------------------------------|-------------------------------------------------------------------|
| **语言与 Runtime** | TypeScript；Node.js 24 LTS                      | 前后端、导入器和测试统一语言，适合多编码代理协作。                |
| **Web**            | Next.js App Router，Node Runtime                | 页面与 same-origin API 在一个应用中，减少 CORS/Cookie 复杂度。    |
| **验证**           | Zod                                             | TypeScript 不能验证恶意 HTTP 或外部数据，所有边界必须运行时校验。 |
| **数据库**         | PostgreSQL                                      | 事务、行锁、Partial Unique Index、UPSERT 和审计需求高度匹配。     |
| **数据访问**       | Drizzle + node-postgres + 关键显式 SQL          | 普通 CRUD 有类型，关键事务不被 ORM 抽象限制。                     |
| **前端样式**       | React + Tailwind                                | 足够完成双端投票卡、排行榜和 Admin，不先引入大型 UI 框架。        |
| **测试**           | Vitest + 真实 Postgres Integration + Playwright | 真正验证并发、约束、事务回滚和完整用户流程。                      |
| **封装与部署**     | Docker                                          | 本地、Railway 和未来其他 Provider 保持可移植。                    |

### **17.1 为什么是单体**

项目只有一个公共网站、一个 Admin、几个定时任务和一个 PostgreSQL。独立 API 服务、GraphQL、消息队列、Kafka、Kubernetes 和微服务不会提高核心投票正确性，只会增加部署、Cookie、网络和调试面。V0.1 的原则是：把工程复杂度花在 Ballot 幂等、数据约束、候选池动态管理和测试上。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>V0.1 明确不使用</strong></p>
<p>Redis、独立 Express/Fastify Backend、GraphQL、WebSocket、Queue/Kafka、Kubernetes、Elasticsearch、微服务和 serverless-first 数据架构。未来只有在真实指标证明需要时再引入。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **18. Railway：默认 Hosting 与初步成本模型**

部署选择 Railway Singapore：Web 与 PostgreSQL 同区域，通过私网通信；同一仓库的 Cron Service 负责排名快照、HLTV/VRS 同步和完整性检查。它适合需要正常 PostgreSQL session/transaction semantics 的长期运行 Node 应用，也能用 Docker 保持迁移空间。

| **阶段**            | **讨论时的粗略月成本** | **说明**                                                           |
|---------------------|------------------------|--------------------------------------------------------------------|
| **刚上线 / 小流量** | 约 7–15 美元           | 一个 Web、一个小型 Postgres、少量 egress；预算目标不超过 15 美元。 |
| **稳定早期用户**    | 约 15–30 美元          | 更高 RAM、CPU、存储与网络，但 Vote 本身很轻。                      |
| **社区传播后**      | 可能 30 美元以上       | 应同时检查真实流量、Crawler、Bot、图片 egress 和 Preview 部署。    |

这些数字是规划阶段的预算模型，而非供应商承诺。正式上线后必须依赖 Railway Metrics 校准，并设置分级告警和较宽松的 Hard Cap，避免同步任务失控造成意外账单。

## **19. Cloudflare：可试用、可拔掉，绝不成为架构依赖**

普通 Cloudflare Global Network 不能被当作中国大陆加速方案。大陆用户访问境外节点可能出现延迟和稳定性差异；真正的 China Network 属于企业级方案且涉及 ICP。于是 Cloudflare 在本项目中的角色被重新定义为可选 Edge Layer：DNS、CDN、WAF、DDoS 与基础设施 Rate Limit，而不是业务正确性的组成部分。

上线前准备 Proxy ON 与 DNS-only 两个测试域名，分别从大陆电信、联通、移动测试页面 TTFB、Ballot API p50/p95、失败率和晚高峰表现。如果 Cloudflare 线路表现差，关闭代理即可直连 Railway Singapore，应用代码和投票反作弊不改变。

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Backup Plan</strong></p>
<p>Cloudflare 不好用：关橙云。Railway Singapore 路由仍不理想：把同一 Docker 应用与 PostgreSQL 迁移到更适合 CN routing 的香港或亚洲 Provider。真正进入大陆部署则等产品证明规模后再考虑 ICP 与国内云。</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

### **19.1 V0.1.3 初期直连决定**

新产品尚无流量基线，因此 Owner 决定先使用 Railway 生成的 HTTPS 地址，不购买域名，
也不在 M9 强行引入 Cloudflare。这个决定不需要重做应用安全：Origin / Fetch Metadata、
Secure Cookie、Admin 鉴权、Schema Validation、Ballot 幂等、PostgreSQL 日额度、风险观察和
进程内 Rate Limit 都在源站完成。

被推迟的是 Edge 层的应用级 DDoS、WAF、Bot 与分布式 Rate Limit。Railway 直连仍有网络层
保护，但不能假装等价于 Cloudflare 的应用层防护。若 Bot/爬虫使 CPU、Egress、错误率或费用
异常，触发 Spend Alert，发生应用层可用性事故，需要正式品牌域名，或用户量要求多实例，
就重新评估域名与 Cloudflare。若未来为了安全启用 Cloudflare，还必须决定是否关闭可绕过
Edge Rule 的直连源站；“公开直连作为后备”与“完全隐藏源站”是需要明确取舍的目标。

备份同样按最低成本原则执行：Hobby 阶段保留 PostgreSQL Logical Dump，在真实 Vote 开始后
至少每日执行，并保留独立第二份副本。Owner 本机空间足够，但单一设备不能作为唯一灾备。
技术恢复演练已通过。2026-08-13 已创建并保留首份本机 Logical Dump，随后在独立的本机
PostgreSQL 18 临时实例中完整恢复，14 张关键表计数全部一致。每周 Fictional Staging、重要
变更前备份，以及真实 Vote 开始后的每日备份和 7 Daily + 4 Weekly 留存已经确定；Private
Cloudflare R2 独立第二副本已完成：Bucket 关闭公开访问，远端 Dump 与 Manifest 大小
均与本机一致，临时上传 Token 随后删除。R2 只承担独立灾备存储，不把 Cloudflare Proxy/WAF
放进网站请求路径。Gate E 已于 2026-08-14 经 Owner 明确批准；下一步进入真实 Candidate
Pool 的审查与 Closed Beta 准备，但仍需遵守 M10 的逐项 Owner Approval。

## **20. Implementation Plan 如何吸收这些决定**

完整 Implementation Plan 把讨论结果拆成 10 个 Milestone，并在基础设施、数据库、核心投票事务、Admin 和 Staging 五处设置 Owner Review Gate。Codex 必须在 Gate 停止，提交测试、Migration、偏差和进度报告，不能一路自动“优化”到上线。

| **阶段**   | **主要交付**                                              | **为什么需要 Review**                         |
|------------|-----------------------------------------------------------|-----------------------------------------------|
| **Gate A** | Repo、Runtime、Docker、CI、Health。                       | 先确认工程基础没有偏离单体与可移植方向。      |
| **Gate B** | 完整 Schema、Migration、数据库约束。                      | 一旦核心表和约束错了，后续返工成本最高。      |
| **Gate C** | Ballot Issuance、Resolve、Ranking、Revoke 与并发测试。    | 这是产品正确性核心，必须由 Owner 亲自审。     |
| **Gate D** | Admin、Pool Change、Pending Import 与审计。               | 避免自动数据同步偷偷变成候选池决策者。        |
| **Gate E** | Railway Staging、备份恢复、选定线路与大陆测试；Cloudflare 仅在启用时 A/B。 | 在正式名单和 Closed Beta 前验证真实运行环境。 |

**PART VI**

**决策登记册：冻结、后置、拒绝与开放**

这一部分是未来 Review 最实用的索引。它把散落在讨论中的结论变成可快速查询的 Decision Register。

## **21. V0.1 冻结决定**

| **主题**           | **决定**                                         | **核心理由**                             | **状态** |
|--------------------|--------------------------------------------------|------------------------------------------|----------|
| **产品提问**       | 页面不定义“强”，直接展示两名选手。               | 保留野榜的开放含义。                     | 冻结     |
| **计分**           | 从 0 开始；VALID 胜 +1、负 -1；Skip 0。          | 简单透明，用户无需理解模型。             | 冻结     |
| **Pair**           | 在启用 Pool 中等概率真随机；左右独立随机。       | 不偷偷推荐、不追求统计效率。             | 冻结     |
| **游客**           | 无需登录即可投票。                               | 初期流量与首次转化优先。                 | 冻结     |
| **结果节奏**       | 投票后停留结果，用户手动 Next。                  | 结果是奖励，也明确下一张 Ballot 的边界。 | 冻结     |
| **手动刷新**       | 当前 OPEN Ballot 按 Skip 解决并直接显示新 Pair。 | 符合随机体验预期，同时让刷新消耗机会。   | 冻结     |
| **候选池**         | 按年度 Edition，Team 为常规准入单位。            | 兼容新人、转会与历史保留。               | 冻结     |
| **Core**           | HLTV 或 VRS 任一 Top 12。                        | 清晰的自动安全区。                       | 冻结     |
| **Review Auto**    | 任一 Top 20 + T1 四强/Major 八强。               | 补足有战绩的边缘队。                     | 冻结     |
| **Manual/Special** | 允许公开理由的人工整队与极少数个人纳入。         | 服务 CNCS 现实语境。                     | 冻结     |
| **Ballot**         | 同 Visitor 同 Edition 同时最多一张 OPEN。        | 防无限刷新 fishing。                     | 冻结     |
| **额度**           | 按新 Ballot Opportunity 计；超额继续玩但不计榜。 | 保留随机防刷与用户体验。                 | 冻结     |
| **Vote 历史**      | Raw Vote 永不物理删除；异常票 Revoke。           | 审计、恢复和未来分析。                   | 冻结     |
| **数据运行时**     | 用户请求只读本站 DB，不实时抓外部站点。          | 外部数据故障不影响核心投票。             | 冻结     |
| **部署**           | Docker 单体 + PostgreSQL；初期直连 Railway，Cloudflare 可拔掉。 | 低运维、可迁移，复杂度由真实流量触发。 | 冻结     |

## **22. 明确后置的功能与触发条件**

| **功能**                     | **为什么不进 V0.1**                         | **何时重启讨论**                                                          |
|------------------------------|---------------------------------------------|---------------------------------------------------------------------------|
| **Event MVP**                | 短期窗口下真随机和 +1/-1 是否稳定尚未验证。 | 常驻榜已有稳定用户，单赛事能在窗口内获得足够有效 Ballot。                 |
| **年度编辑专题**             | 2026 开始较晚，首版不应为年终内容过度建设。 | 完整 Edition 累积、快照和 HLTV 年榜发布后。                               |
| **个人 Top 20**              | 需要足够个人投票数据与排序推导规则。        | 大量用户单次完成 20–50 票，并出现分享需求。                               |
| **Steam 登录 / Verified 榜** | 提高门槛，且游客是初期核心。                | 刷票真实发生且匿名风控不足，或社区强烈需要双榜。                          |
| **评论与社交**               | 审核与社区治理成本远高于核心价值。          | 已有稳定回访和明确的站内讨论需求。                                        |
| **趋势与故事页**             | 需要先积累快照和足够时间序列。              | 至少数周/数月数据后。                                                     |
| **结果分享卡**               | 不是验证投票 Loop 的必要条件。              | 外部流量与截图传播已显示价值。                                            |
| **CS 六度分隔 / 阵容猜谜**   | 有潜力但会分散首版定位。                    | 野榜成功并需要同品牌附属玩法。                                            |
| **Redis**                    | 当前没有需要独立缓存/分布式限流的规模。     | 排行榜读取或多实例基础设施压力由指标证明。                                |
| **R2/Object Storage**        | 百人图片本地静态资源足够。                  | 候选频繁更新、资产数量和 egress 增长。                                    |
| **Turnstile/CAPTCHA**        | 大陆支持不可靠且会增加摩擦。                | 存在无法通过现有 Ballot/Observe Mode 控制的真实攻击，并找到可用挑战方案。 |
| **多游戏 Arcade**            | 会稀释 CS 野榜的首发品牌与运营重点。        | 单一产品跑通后再评估。                                                    |

## **23. 已拒绝或主动放弃的方案**

| **方案**                             | **拒绝原因**                                                     |
|--------------------------------------|------------------------------------------------------------------|
| **Bradley–Terry / Elo / VRS 式加权** | 统计上更精细，但与“每票等价、野榜直接”冲突。                     |
| **按排名接近或曝光不足推荐 Pair**    | 会把真随机变成隐性匹配算法。                                     |
| **初始 Score = 1000**                | 纯平移，没有排序意义，还让分数像评级系统。                       |
| **每 IP 前 50 票**                   | 共享网络误伤严重，IP 不等于用户。                                |
| **第 51 票按 0.01 计入**             | 破坏 +1/-1 的透明规则。                                          |
| **免费刷新 Random Pair**             | 允许脚本 fishing 指定明星；刷新必须记录 Skip 并消耗 Opportunity。 |
| **常规投票后自动 Next**              | 会打断结果阅读；仅手动 reload-as-Skip 是明确例外。                 |
| **退役传奇大量混入主榜**             | 跨时代比较有趣，但会削弱活跃职业池；只保留极少数仍活跃 Special。 |
| **只保存 Score/胜率，不存 Raw Vote** | 失去审计、撤销、重算和历史研究能力。                             |
| **用户请求时实时抓 HLTV**            | 外部站点延迟或封锁会直接拖垮投票体验。                           |
| **完全机械化 Candidate Pool**        | 会漏掉新人、地区代表队和排名滞后阵容。                           |
| **Cloudflare/Turnstile 成为强依赖**  | 大陆线路与可用性不确定，必须可拔掉。                             |
| **V0.1 微服务/Queue/Kubernetes**     | 增加运维面，但不提高核心事务正确性。                             |

## **24. 已知并接受的不完美**

- 社区榜一定混合竞技判断、人气、叙事、地区偏好和粉丝行为；它不是纯实力统计。

- 晚加入选手从 0 分开始，存在累计时间劣势；首版接受，并用 Win Rate 和票数提供上下文。

- 真随机会产生一些明显一边倒或低趣味 Pair；这是随机性代价，不用隐性匹配修正。

- Manual Review 带有站方主观性；通过公开理由和 Changelog 管理，而不是假装不存在。

- 候选池中的新人可能有高 Skip Rate；这既是问题也是对“社区识别度”的有价值测量。

- 2026 Edition 若在年中上线，不具备完整年度可比性；先验证 Loop，不包装成严肃全年结论。

- HLTV Parser 可能失效；允许数据暂时陈旧，但核心投票不能中断。

- 匿名系统无法绝对阻止有资源的攻击者；目标是让定向刷票昂贵、可观察、可撤销。

## **25. 当前开放决策**

| **开放项**                               | **处理方式**                                                  |
|------------------------------------------|---------------------------------------------------------------|
| **品牌名、域名与正式 Slogan**            | 不阻塞 Milestone 0–4；在 Public UI 前冻结。                   |
| **首发 Candidate Pool V1 具体名单**      | 由 Importer 生成 Draft，Owner 审批冲突、Manual 与 Special。   |
| **首批 T1 Event Whitelist 完整历史**     | 先覆盖影响 Candidate Pool 的赛事；可持续补录。                |
| **每日 Full-weight Ballot 配额**         | 默认 50，Closed Beta 根据分布调整。                           |
| **Ballot TTL**                           | 默认 30 分钟，观察用户回访与 fishing 风险。                   |
| **Cloudflare 最终保持代理还是 DNS-only** | 初期直连 Railway；达到 ADR 0005 触发条件后再做大陆三网 A/B。 |
| **选手头像和队标授权方案**               | 上线前完成来源记录；无法确认时使用占位图。                    |
| **Career Rating 是否默认展示**           | 取决于定义稳定性和数据可得性。                                |
| **Ranking Tie 的视觉表达**               | Implementation Plan 使用 RANK()；UI 仍可在 Closed Beta 微调。 |

**PART VII**

**未来 Review 的判断框架**

最后一部分将本次讨论提炼成可复用的审查问题，避免后续功能在不知不觉中改变产品本质。

## **26. 产品宪法：发生分歧时先回到这八条**

| **条目** | **原则**                     | **含义**                                       |
|----------|------------------------------|------------------------------------------------|
| **1**    | 能不解释，就不解释           | 投票界面首先是直觉选择，不是考试说明书。       |
| **2**    | 每张有效票完全等价           | 有效就完整 +1/-1；无小数权重和隐性加权。       |
| **3**    | Random 就是真 Random         | 候选池治理负责质量，匹配算法不偷偷“优化”。     |
| **4**    | Guest First                  | 首次投票不能被账号、验证码或复杂教程阻挡。     |
| **5**    | 数据提供上下文，不替用户决定 | 默认少量近期数据，详细项按需展开。             |
| **6**    | 外部来源不是运行时依赖       | 用户请求只依赖自己的数据库。                   |
| **7**    | 所有重要变化可审计、可恢复   | 候选池、Vote 撤销、同步和 Admin 操作均留痕。   |
| **8**    | 复杂度必须由真实使用量赢得   | 没有指标证明，就不加 Redis、微服务或社交系统。 |

## **27. Feature / PR Review 清单**

任何会改变用户流程、计分、候选池、数据来源或部署依赖的改动，在进入 Plan 或 Merge 前都应回答以下问题。若答案含糊，优先不做或放入实验分支。

> □ 它是否改变了一张 VALID Vote 的 +1/-1 含义？
>
> □ 它是否让 Pair 不再等概率真随机，哪怕只是“提升体验”的隐性权重？
>
> □ 它是否提高了游客第一次投票的摩擦？
>
> □ 它是否让外部网站、Cloudflare 或某个第三方 API 成为投票关键路径？
>
> □ 它是否破坏一人一张 OPEN Ballot、Ballot 幂等或 SUM(score)=0？
>
> □ 它产生的数据能否审计、撤销和重算？
>
> □ 它是否把 Candidate Pool 的决定权从 Owner/Admin 偷偷交给 Importer？
>
> □ 它是否对中国大陆共享网络、线路或浏览器环境造成额外误伤？
>
> □ 它解决的是已经观察到的问题，还是想象中的未来规模？
>
> □ 它属于 V0.1 核心验证，还是应该等待真实指标达到触发条件？

## **28. 从 Review 到研发的推荐工作流**

> **1.** 新参与者先读本文执行摘要、产品宪法和相关决策章节。
>
> **2.** 再读 REVIEW_SUMMARY_ZH.md，确认当前被冻结的规则。
>
> **3.** 执行 Milestone 时以 IMPLEMENTATION_PLAN_V0.1.md 的 Schema、API Contract 和 Acceptance Criteria 为准。
>
> **4.** Codex 到 Owner Review Gate 必须停止；Reviewer 核对不仅是代码正确，还要确认没有改变产品含义。
>
> **5.** 任何超出 Plan 的“顺手优化”先写 ADR：问题、选项、取舍、是否触发 V0.2。
>
> **6.** Closed Beta 后用真实指标修正配置和开放项，但不默认重开已冻结的产品原则。

## **29. 决策演化时间线**

| **阶段**    | **转折**                   | **最终留下的结论**                                                  |
|-------------|----------------------------|---------------------------------------------------------------------|
| **阶段 1**  | 观察「弗一把」与方舟投票箱 | 发现“游戏数据 + 极轻交互 + 社区结果”的共同结构。                    |
| **阶段 2**  | 跨题材案例调研             | 将网站归纳为 Guess、Reveal、Pick、Tournament、Community Result。    |
| **阶段 3**  | 限制到 CS / 方舟 / 三角洲  | 以社区热度、长期可玩、低运维筛选。                                  |
| **阶段 4**  | 排除已有或低热方向         | Blind Rank、Nicheknights 等不再作为主方向；决策模拟器热度存疑。     |
| **阶段 5**  | 形成 CS 职业选手投票箱     | 目标是民间 1v1 排榜并与专业榜形成对照。                             |
| **阶段 6**  | 冻结“野”的产品性格         | 不定义强、不教育用户、不假装客观。                                  |
| **阶段 7**  | 算法与 Candidate Pool 成形 | 拒绝复杂加权；采用 0 起点 +1/-1；Team-based Pool 与公开人工入口。   |
| **阶段 8**  | Ballot 与反作弊重构        | 从 IP 50 + 0.01，演化为 Visitor、Opportunity Quota、状态化 Vote。   |
| **阶段 9**  | 原子 API 与数据策略        | 一张 OPEN Ballot、Exactly-once effect、Raw Vote、Adapter 与快照。   |
| **阶段 10** | 架构与部署冻结             | TypeScript 单体、PostgreSQL、Railway Singapore、Cloudflare 可拔掉。 |
| **阶段 11** | Implementation Plan V0.1   | 将产品决定转化为 Schema、API、测试、Milestone 与 Owner Gates。      |
| **阶段 12** | Owner 修订刷新语义         | 手动 reload 记为 Skip 并直接取得新 Pair；普通 API 重试继续幂等。     |
| **阶段 13** | Owner 冻结初期成本基线     | Hobby + Logical Backup；Railway 生成域名直连，Cloudflare 按指标后置。 |

## **30. 术语表**

| **术语**                | **定义**                                                               |
|-------------------------|------------------------------------------------------------------------|
| **Edition**             | 某一自然年的独立榜单与 Candidate Pool，例如 2026。                     |
| **Candidate Pool**      | 当前 Edition 中允许被服务器随机抽取的职业选手集合。                    |
| **Admission Reason**    | 某队/选手进入 Pool 的原因：CORE、REVIEW_AUTO、REVIEW_MANUAL、SPECIAL。 |
| **Ballot**              | 服务器签发给某匿名 Visitor 的一次随机 1v1 选择机会。                   |
| **Vote**                | Ballot 被 Left/Right/Skip 解决后产生的记录。                           |
| **VALID**               | 正式影响 Score 的票。                                                  |
| **THROTTLED**           | 超过日额度但仍保留的选择，不影响 Score。                               |
| **SUSPICIOUS**          | 风控标记的异常票，不影响 Score。                                       |
| **REVOKED**             | 曾计榜、后经审计撤销并反向修正的票。                                   |
| **PairAggregate**       | 某两名选手历史有效胜负与 Skip 的聚合记录。                             |
| **T1 Event Whitelist**  | 本站确认、可触发 Review Auto 成绩资格的年度赛事清单。                  |
| **Exactly-once effect** | 同一 Ballot 即使请求重试多次，也最多产生一次排名影响。                 |

## **31. 外部参考与项目入口**

以下链接用于保存最初灵感和后续技术调研入口。它们不是运行时依赖，实际开发仍应遵守 Implementation Plan 中的 Provider、缓存、访问频率和合规要求。

> **弗一把：**[<u>https://shnlfriberg.online/</u>](https://shnlfriberg.online/)
>
> **弗一把 GitHub：**[<u>https://github.com/shnlfriberg/csgofriberg</u>](https://github.com/shnlfriberg/csgofriberg)
>
> **明日方舟六星干员强度投票箱：**[<u>https://vote.ltsc.vip/</u>](https://vote.ltsc.vip/)
>
> **ArknightsVote GitHub：**[<u>https://github.com/ArknightsVote/ArknightsVote</u>](https://github.com/ArknightsVote/ArknightsVote)
>
> **HLTV：**[<u>https://www.hltv.org/</u>](https://www.hltv.org/)
>
> **Valve Counter-Strike Regional Standings：**[<u>https://github.com/ValveSoftware/counter-strike_regional_standings</u>](https://github.com/ValveSoftware/counter-strike_regional_standings)
>
> **Liquipedia Counter-Strike：**[<u>https://liquipedia.net/counterstrike/Main_Page</u>](https://liquipedia.net/counterstrike/Main_Page)
>
> **PandaScore Developer Docs：**[<u>https://developers.pandascore.co/</u>](https://developers.pandascore.co/)
>
> **GRID Open Access：**[<u>https://grid.gg/open-access/</u>](https://grid.gg/open-access/)
>
> **Cloudflare China Network Docs：**[<u>https://developers.cloudflare.com/china-network/</u>](https://developers.cloudflare.com/china-network/)
>
> **Railway Docs：**[<u>https://docs.railway.com/</u>](https://docs.railway.com/)
>
> **PostgreSQL Docs：**[<u>https://www.postgresql.org/docs/</u>](https://www.postgresql.org/docs/)

## **32. 结语：V0.1 不是缩减版愿景，而是最小可验证承诺**

从最初两个有趣网站到完整 Implementation Plan，项目最重要的进展不是“想到了更多功能”，而是越来越明确地知道哪些东西不应该进入首版。真正的 V0.1 只需要验证一个问题：CS 玩家是否愿意面对随机出现的两名职业选手，不断作出自己的选择，并在投票后在乎这张社区榜发生了什么。

为了让这个问题被干净地验证，产品选择了最简单的计分、最开放的判断标准、最直接的游客入口和最严格的投票原子性；同时把 Event MVP、个人榜、社交、复杂算法和多游戏平台全部放到真实需求出现之后。

这份纪实应在后续 Review 中持续发挥一个作用：当某个新方案看起来“更专业”“更智能”或“更完整”时，先问它是否让社区意见更真实、核心循环更顺滑、数据更可审计；若没有，就允许 V0.1 继续保持简单，直到用户用真实行为赢得下一层复杂度。

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>数据看 HLTV，吵架看我们。</strong></p>
<p>工作中的产品语言，最终品牌文案仍待确定</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

— 文档结束 —
