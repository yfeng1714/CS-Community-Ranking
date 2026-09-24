# CS 野榜 / CS Community Ranking

[English](README.md) · 简体中文

> 两个人，选一个，或者跳过。

CS 野榜是一项面向职业 Counter-Strike 选手的社区投票。每一次选择都会参与
塑造赛季榜单。榜单反映的是社区投票结果，不代表对选手实力的客观评定。

## 可以做什么

- **二选一投票：**系统从候选池随机给出两名选手，可以选其中一人，也可以
  跳过。计入榜单的投票让被选中者 **+1**、另一人 **−1**；跳过不改变分数。
  如果刷新尚未完成的对决，该对决会按跳过处理，然后出现新的一组。
- **查看社区榜单：**搜索选手、比较社区分数，并进入选手页面查看战队、
  胜负与跳过次数，以及已有的选手资料。
- **参与赛事 MVP：**赛事投票与赛季总榜分开。每位访客每天可按上海时间为
  一名选手投 **+1** 票，不影响赛季榜分数。往期赛事的结果仍可查看，
  但不能继续投票。

投票无需注册账号，以匿名访客身份进行。候选池依据经过审核的阵容和排名
资料维护，新选手不会自动入池。选手数据和赛事资料来自审核后的快照，
因此可能晚于来源网站的最新页面。

## 当前开放状态

截至 2026-09-24，公开 Beta 已结束。网站正在有意暂停开放，以便收集和
整理反馈；目前没有运行中的公开演示。项目仍可在本地运行。

## 在本地运行

需要 Node.js `24.14.0`、pnpm `11.16.0` 和 Docker。

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。本地种子使用的是虚构
开发数据，不会复制此前 Beta 的数据库或赛事 MVP 快照。如需本地管理员账号，
运行 `pnpm admin:create -- --username=owner`，然后按命令行提示设置密码。

如果 `5432` 端口已被占用，请在 `.env` 中同时修改 `POSTGRES_PORT`
和对应的 `DATABASE_URL`。用 `docker compose stop postgres` 停止本地
数据库。在 macOS 上，不再使用 Docker 时可退出 Docker Desktop，释放
CPU 和内存。

## 项目文档

- [产品决策纪实](docs/CS_Community_Ranking_Product_Decision_Chronicle_V0.1.md)
  说明产品选择及其背景。
- [公开页面](docs/PUBLIC_UI.md)、[候选池](docs/CANDIDATE_POOL.md)和
  [赛事 MVP](docs/EVENT_MVP.md)说明功能与规则。
- [实现进度](docs/PROGRESS.md)和[现有限制](docs/CURRENT_LIMITATIONS.md)
  记录 Beta 的实现情况及已知问题。
- [运行手册](docs/RUNBOOK.md)涵盖本地设置、数据导入、运维和备份；
  可用命令以 [package.json](package.json) 为准。
- [图片来源方案](docs/IMAGE_SOURCING.md)记录素材审核流程。

如果文档对产品意图的描述有冲突，以产品决策纪实为主要参考，并记录
重要变更。

## 技术概览

项目使用 Next.js、React、TypeScript、PostgreSQL、Drizzle ORM 和
Tailwind CSS，并使用 Vitest 与 Playwright 测试。由于来源站点返回
HTTP 403，HLTV 自动获取仍未启用；目前通过本地采集、审核和导入更新数据。
历史上的公开上线及 Railway 备份配置见
[Gate F 记录](docs/LAUNCH_GATE_F.md)和[运行手册](docs/RUNBOOK.md)。

## 许可证与素材

项目原创源代码和文档采用 [MIT 许可证](LICENSE)。该许可证**不授予**
选手肖像、照片、战队标志、商标或外部来源数据的使用权。仓库中的部分图片
曾获项目所有者同意用于临时 Beta 展示，但不代表其再利用权利已经确认；
详见[图片来源方案](docs/IMAGE_SOURCING.md)和
[素材记录说明](assets/README.md)。仓库所附国旗素材保留其
[单独的 MIT 声明](public/flags/LICENSE)。
