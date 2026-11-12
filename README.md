# 我的起点 · 南西

个人启动台：分类收藏、百度/谷歌/必应与自定义搜索、知识卡片、待办、截止日期、设置、浅色/深色、云端同步与 JSON 备份。

## 外部部署

[在 Render 创建启动台](https://dashboard.render.com/blueprint/new?repo=https://github.com/ao18181818/workspace)

1. 选择工作区 `wodaiwangz`，允许 Render 读取此仓库。
2. 审阅 Blueprint：Singapore 区域、常驻 Web `0.5c-512mb`、Postgres `0.1c-256mb`、1 GB 存储。按 2026-11-12 官方价格，基础费用约 $13.30/月（Web $7、数据库 $6、存储 $0.30），税费与超额用量另计。点击 Apply 才会创建付费资源。
3. 部署成功后，打开服务的 Environment，查看自动生成的 `SETUP_KEY`。不要公开此值。
4. 打开服务网址，用密钥、邮箱和至少 12 位密码创建唯一私人账户。创建后初始化入口关闭；其他设备只需邮箱和密码。
5. Mac 和 iPhone 登录同一账户，新增收藏或卡片后查看右上角「已同步」，再到另一设备查看。前台每 12 秒检查变化，返回前台时立即检查。

`render.yaml` 为部署配置的唯一来源。不要把数据库连接串或密钥提交到仓库。数据库仅允许 Render 内网访问。

## 同步与隐私

- 私人 API 需要登录，密码使用 scrypt 加盐散列；会话 HttpOnly、SameSite=Strict，生产启用 Secure。
- 用数据库版本号进行原子条件更新，阻止两台设备静默覆盖。冲突时先导出本机内容，再读取云端；目前不自动合并。
- 离线修改保存在本机 localStorage，恢复连接后重试。设备未首次联网登录时不能离线初始化。浏览器清理数据或隐私模式可能影响本机缓存。
- 退出需先同步或导出未保存内容；退出会清理本机缓存。离线时允许查看该浏览器已有缓存，请只在可信设备使用。
- 修改密码会注销所有设备。暂未提供邮件找回密码；请妥善保存密码，必要时由部署管理员维护数据库恢复账户。
- 备份含私人内容，请保存在可信位置。导入会替换当前内容，有确认提示。

## 启始页和手机

设置中包含 Safari、Chrome/Edge 起始页指引；网页无法直接修改浏览器主页。iPhone Safari 可通过「分享 → 添加到主屏幕」安装。新标签页替换受浏览器限制，部分浏览器需扩展。

## 本地运行和检查

Node.js 24+：

```sh
npm ci
npm start
npm test
```

开发环境默认 SQLite，`http://localhost:3000`，初始化密钥为 `local-development-only`（仅本地）。生产环境必须配置 `NODE_ENV=production`、`DATABASE_URL`、`SETUP_KEY`，缺失将拒绝启动。生产使用 PostgreSQL，不依赖服务器临时磁盘。

浏览器检查：`node test/browser.mjs`，需要可用 Chromium；可设置 `CHROMIUM_PATH`。包括双设备同步、离线恢复、冲突、分类、卡片、搜索平台、深色模式和手机布局。

自动化接口测试覆盖：未登录隔离、初始化密钥、重复建号、跨站写入、版本冲突、不安全网址、第二会话读取、密码变更注销。

## 设计来源

界面设计审查采用 [unslop](https://github.com/heydamir/unslop)，作者 [Damir Sokolovsky (@heydamir)](https://x.com/heydamir)，CC BY 4.0。使用其布局、配色、文字、细节与动效审查方法；本项目 UI 独立实现。未将其作为运行时依赖。

保留原产品名称「我的起点」，纸白界面与墨绿操作色、按目录整理收藏、便签式知识卡片，系统中文字体优先使用 PingFang SC。
