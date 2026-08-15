# CS Community Ranking / CS 野榜
## Implementation Plan V0.1 中文审阅摘要

这份摘要用于项目 Owner 快速审阅。真正交给 Codex 执行的完整规范是 `docs/IMPLEMENTATION_PLAN_V0.1.md`。

**2026-08-10 V0.1.1 审阅结论：** 产品方向与冻结规则不变；施工规范已补齐
Pending Import、Admin Session/Audit、关键数据库约束、Edition 冻结行为、跨午夜
Ballot 计数、Skip 撤销、IP 风险键留存和 Mutation Security 的实施时点。现在可以从
Milestone 0 开始，但仍必须在每个 Owner Review Gate 停止。

---

# 1. 已冻结的产品规则

以下规则 Codex 不得擅自“优化”：

- 每名选手进入年度 Edition 时 `Score = 0`。
- 有效投票：胜者 `+1`，败者 `-1`。
- Skip：双方 `0`。
- 不使用 Elo、Bradley–Terry、VRS 式强弱加权或小数票权重。
- Pair 在当前启用的候选池中真随机、等概率生成。
- 不按排名接近程度、曝光次数或热度调整 Pair。
- 左右位置独立随机。
- 用户无需登录即可投票。
- 页面不解释“强”的定义，不出现“谁在 2026 年表现更好”之类问题。
- 投票后停留在结果界面，由用户主动点击 Next。
- 不自动进入下一组。
- Candidate Pool 动态维护，但所有历史 Vote、Score 和快照必须保留。
- Cloudflare 可拔掉；外部数据源宕机也不能影响投票主流程。

---

# 2. Candidate Pool 制度

每个自然年一个 Edition，例如 `2026`。

## Core

最新 HLTV 或 VRS 任一 Top 12 的队伍自动认定为 Core；当前正式首发五人入池。

## Review Auto

满足以下两项：

1. 最新 HLTV 或 VRS 任一 Top 20；
2. 当年 T1 白名单赛事四强，或 Major 八强。

整队当前正式首发入池。

## Review Manual

站方可因为 CNCS 社区相关性、地区代表性、明星阵容、排名滞后等原因人工纳入队伍，并公开理由。

## Special

极少数仍活跃、但所在队伍未入池的明星选手可单独加入，同样公开理由。

## 生命周期

- 入池后原则上留到当年 Edition 结束。
- 转会只修改当前 Team，Player ID 和历史数据不变。
- 新选手中途加入时从 0 分开始；V0.1 接受晚加入劣势。
- 退役或长期停止活动时可 `pairing_enabled = false`，但不删除历史数据。
- 自动导入只生成 Pending Change，管理员明确批准后才生效。

---

# 3. T1 Event Whitelist

- Major 自动属于 T1。
- HLTV Highlight Event 经人工确认后写入本站自己的白名单。
- 站方可以按参赛队伍质量为主、国际性和奖金为辅，人工补充赛事。
- 奖金高但前列强队密度不足的比赛不一定算 T1。
- 白名单是本站数据库中的历史记录，运行时不依赖 HLTV 页面状态。

---

# 4. 技术栈

```text
TypeScript 全栈单体
Next.js App Router，Node.js Runtime
Node.js 24 LTS
React + Tailwind
Zod
PostgreSQL
Drizzle ORM + node-postgres + 必要的显式 SQL
Vitest + 真实 PostgreSQL Integration Test + Playwright
Docker
Railway Singapore
Cloudflare 可选
```

V0.1 明确不使用：

- Redis
- 独立 Express/Fastify Backend
- GraphQL
- 微服务
- Queue/Kafka
- WebSocket
- Kubernetes
- Turnstile

---

# 5. 核心 API

## `POST /api/v1/ballots/next`

- Visitor 第一次访问时生成安全匿名 Cookie。
- 同一个 Visitor、同一个 Edition 同时最多一张 OPEN Ballot。
- 重复调用 Next、网络重试和并发 Tab 都返回同一张 Ballot，避免传输重试误耗机会。
- 投票页的真实手动刷新是明确例外：当前复用 Ballot 按 Skip 解决，然后直接取得新 Ballot。
- 只有投 Left、Right、Skip、手动刷新记为 Skip，或者 Ballot 过期后，才能拿到新 Ballot。
- Ballot 在服务端生成，客户端不能提交想要对决的 Player ID。

## `POST /api/v1/ballots/{id}/resolve`

Body 只能是：

```text
LEFT
RIGHT
SKIP
```

数据库事务必须同时完成：

- 创建 Vote；
- 更新 Ballot；
- 胜者 +1；
- 败者 -1；
- 更新 PairAggregate；
- 更新计数器。

任一步失败，全部 rollback。

重复提交同一张 Ballot 最多产生一次排名影响。Ballot ID 就是天然幂等键。

---

# 6. Ballot 额度和防 fishing

默认配置：

```text
每天前 150 张 Ballot 可影响排行榜
按 Asia/Shanghai 切日
Ballot TTL 30 分钟
```

这里按“抽到的新 Ballot 次数”计额度，而不是只按成功投票次数：

- Skip 消耗一次机会。
- 手动刷新按 Skip 留下一条可审计 Vote，原机会不退，新 Ballot 再消耗下一个 Ordinal。
- 抽到后关页面也消耗一次机会。
- 过期不退机会。
- 超过当日额度后仍能继续玩和看结果，但 Vote 状态为 THROTTLED，不影响 Score。公开 Vote UI 不展示剩余额度，也不把 THROTTLED 显示成“不计榜”。

这保证用户不能免费无限刷新 Pair，直到刷出自己想投的明星选手；同时满足用户刷新后想
看到新随机 Pair 的直觉。

---

# 7. 反作弊与隐私

- Visitor Cookie 是主要匿名身份。
- IP 仅作为风险信号，不能作为“每 IP 50 票”的主体。
- 不保存 Raw IP。
- 每天使用 `HMAC(secret, date + normalized_ip)` 生成短期风险键。
- 共享宿舍、校园、公司、网吧和运营商 NAT 不会因为低阈值被整 IP 封禁。
- V0.1 风控先以 Observe Mode 收集数据，避免误伤大陆共享网络。
- Vote 状态：`VALID / THROTTLED / SUSPICIOUS / REVOKED`。
- 没有 `0.01` 权重。
- 异常历史票通过 REVOKE 事务反向修正，不物理删除。
- 每个 Edition 的 `SUM(score)` 必须始终为 0。
- Turnstile 不纳入 V0.1，因为大陆支持不可靠。
- 日 IP HMAC 风险键默认 90 天后从 Ballot/Vote 清空，不随 Raw Vote 永久保留。

---

# 8. 数据库关键对象

主要表：

```text
Team
Player
RosterMembership
Edition
Event
EventTeamResult
PoolTeamEntry
PoolPlayerEntry
PlayerRanking
AnonymousVisitor
VisitorDailyUsage
Ballot
Vote
PairAggregate
DailyRankingSnapshot
ProductEvent
PoolChangeLog
ModerationAuditLog
AdminUser / AdminSession
PlayerExternalIdentity
PlayerStatSnapshot
RankingSourceSnapshot
SyncRun
PendingImportChange
AdminAuditLog
```

数据库层强制：

- Partial Unique Index：同一 Visitor + Edition 只有一张 OPEN Ballot。
- Unique：一张 Ballot 最多一条 Vote。
- Pair 以较小 Player ID 在前的 canonical 顺序保存。
- 投票时两名 PlayerRanking 按 Player ID 升序加锁，降低死锁风险。
- 排名相同 Score 使用相同名次，SQL 使用 `RANK()`。
- 同时最多一个 ACTIVE Edition；每名选手同时最多一条当前 RosterMembership。
- Ballot 持久化上海日期，跨午夜 Resolve 仍更新签发日的计数器。
- Edition 离开 ACTIVE 时，未解决 Ballot 失效；已解决 Ballot 仍可幂等读取原结果。

---

# 9. 数据来源

## HLTV

只用于难以替代的数据，例如：

- HLTV Rating；
- HLTV Team Ranking；
- 部分 Profile 信息；
- Highlight Event 参考。

要求：

- 只能后台低频同步；
- 不在用户请求链路抓取；
- 不绕过访问限制；
- 单并发、延迟、缓存、退避；
- 解析失败时继续使用旧数据；
- CI 只使用保存的 HTML Fixtures。

## Valve VRS

直接读取 Valve 官方 standings 数据。

## 其他来源

Liquipedia、PandaScore、GRID 等只保留 Provider 扩展接口，不作为 V0.1 必需依赖。

## 图片

初版保存在本地 `public/`；不 Hotlink。为每个资产保存来源与授权/归属记录，无法确认时用占位图。

---

# 10. 公共页面

## Vote

默认显示：

- 头像；
- ID；
- 国家；
- 当前队伍；
- 近三个月 Rating 和地图数；
- 可获得且定义稳定时显示 Career Rating；
- 数据更新时间。

详细数据按钮可展开 ADR、KAST 等可用字段。

投票后显示：

- 用户选择；
- 是否计榜；
- 有效 H2H 百分比；
- 有效对决数和 Skip 数；
- 当前 Rank / Score；
- Next。

若该 Pair 尚无计数的非 Skip 对决，百分比返回 `null`，页面显示“暂无有效对决”；
小样本必须同时显示有效对决数和“样本较少”，不加隐藏平滑票，也不展示虚假的小数精度。

## Ranking

字段：Rank、Player、Team、Score、W、L、Win Rate、有效对决数，可选 Skip Rate。

相同 Score 显示相同 Rank。

## Player

当前排名、Score、胜负、Skip、当前 Team、国家、近期数据、更新时间和后续趋势数据接口。

## About / Privacy

简短解释规则、候选池、反作弊计票和数据来源。

---

# 11. Admin

初版有单独的内部 Admin Surface：

- 无公开注册；
- Argon2id 密码；
- 独立严格 Session Cookie；
- Team/Player/Roster 管理；
- Edition/Event Whitelist 管理；
- Team/Player 入池；
- pairing 开关；
- Pending Import 审批；
- Vote Revoke；
- Sync/Integrity 状态；
- 每次修改写审计日志。

增加、停用选手不需要改代码或重新部署。

---

# 12. 部署和 Backup Plan

Railway Singapore：

```text
Web
PostgreSQL
Cron Jobs
```

- Web 与 DB 通过私网连接。
- Docker 部署。
- Migration 失败则阻止发布。
- V0.1.3 初期使用 Railway 生成域名直连；Cloudflare 只是按真实流量、攻击、成本、品牌或
  线路指标触发的可选 Edge Layer。
- 一旦 Cloudflare 进入范围，再用 Proxy ON 和 DNS-only 测试域名对大陆三网实测；表现差时
  可关闭橙云，业务正确性不变。
- Hobby 阶段使用定时 Logical Backup：本机可保存工作副本，真实公开上线前必须有独立第二
  副本，并至少完成一次真实 Restore Drill。

---

# 13. 实施里程碑和审阅点

## Milestone 0 — Repo 和运行时基础

Next、TypeScript、Docker、Postgres、CI、环境校验、日志、Health。

**Owner Review Gate A**

## Milestone 1 — 数据库 Schema 和约束

所有表、Migration、Partial Unique、Vote Unique、测试 Seed。

**Owner Review Gate B**

## Milestone 2 — Candidate Pool Domain

Edition、队伍、选手、Roster、Rule Engine、动态增减、Change Log。

## Milestone 3 — Visitor 和 Ballot Issuance

匿名 Cookie、每日 Ordinal、一张 OPEN Ballot、随机 Pair、TTL。

## Milestone 4 — Vote Transaction 和 Ranking

Resolve、幂等、+1/-1、PairAggregate、Skip、Revoke、并发测试。

**Owner Review Gate C**

## Milestone 5 — 公共 UI

Vote、Result、Next、Ranking、Player、About、双端和无障碍。

## Milestone 6 — Admin

登录、Pool 管理、Pending Change、Event Whitelist、Revoke。

**Owner Review Gate D**

## Milestone 7 — External Data 和 Cron

VRS、HLTV Adapter、Fixture Test、同步、Pool Draft Generator。

## Milestone 8 — Anti-abuse / Analytics / Integrity

IP HMAC、Rate Limit、Observe Mode、第一方指标、快照和 Integrity Job。

## Milestone 9 — Railway Staging

部署、Migration、Backup/Restore、选定线路与大陆测试、Runbook；Cloudflare 仅在启用时 A/B。

**Owner Review Gate E**

## Milestone 10 — Candidate Pool V1 / Closed Beta / Launch

生成真实名单、解决冲突、审核资产、内测、调阈值、正式上线。

---

# 14. Codex 执行纪律

Codex 每个 Milestone 都必须：

1. 更新 `docs/PROGRESS.md`；
2. 提交代码和 Migration；
3. 运行并报告测试；
4. 说明依赖和偏差；
5. 到 Owner Review Gate 后停止，不擅自继续。

禁止擅自决定：

- 换算法；
- 换随机规则；
- 强制登录；
- 自动删人；
- 自动审批 Candidate Pool；
- 加 Redis/微服务/GraphQL；
- 让 Cloudflare 或 CAPTCHA 成为必需；
- 删除 Vote；
- 把额度从 Ballot 改回只按已投 Vote；
- 常规投票后自动 Next（手动刷新按 Skip 后直接换 Pair 是唯一例外）；
- 把 Event MVP 塞入 V0.1。

---

# 15. 当前仍可后置的 Owner 决策

早期开发无需阻塞于：

- 最终网站名和域名；
- 视觉风格；
- Candidate Pool 最终名单；
- Manual Review 和 Special 最终人员；
- 2026 已结束赛事的完整白名单；
- Closed Beta 后最终的每日有效额度；
- 选手图片授权方案；
- ADR 0005 触发后是否引入 Cloudflare，以及是否保持代理。

完整工程规范、API JSON、表字段、测试矩阵和每个 Milestone 的 Acceptance Criteria 均在主计划中。
