# 阿里云 ECS 部署

## 当前状态

代码和容器配置已准备；只有实际服务器、域名解析、ICP备案和 HTTPS 检查完成后才能称为上线。此说明不会创建或购买云资源。部署前由用户登录阿里云，确认服务器与域名归属。

## 资源选择

- 99 计划 ECS：2 核 2GB、3Mbps、40GB 系统盘，选择 Linux（例如 Ubuntu 24.04 LTS）。活动资格、99元年付与续费权益以实际订单为准。
- 网站和 PostgreSQL 放在同一台 ECS。无需另购云数据库、付费面板或负载均衡。
- 使用自有域名或子域名。中国内地节点通过域名提供服务前需完成对应备案流程。域名费用另计，不直接承诺总费用一定低于 120 元/年。
- 安全组开放网站 TCP 80/443；管理端口仅向管理员所需来源开放。不要开放 3000 或 5432。
- 服务器需安装官方 Docker Engine 与 Compose v2 插件。国内服务器的镜像与 npm 拉取可能受网络影响，应在服务器实测；如需调整镜像源，先确认可信来源，不随意使用第三方镜像。

## 首次部署

确认已有正确的服务器和域名后，使用服务器终端执行：

```sh
git clone --branch feat/nanxi-start https://github.com/ao18181818/workspace.git nanxi-start
cd nanxi-start
node deploy/aliyun/init-config.mjs start.your-domain.cn
docker compose config --quiet
docker compose up -d --build --wait
```

配置生成需要 Node.js 24+，可使用已安装的官方 Node.js，或使用 Docker 中的官方 Node 镜像在当前目录运行该脚本。脚本仅创建缺失的 `.env`，权限为 0600，不输出密钥，拒绝覆盖既有配置。

`APP_DOMAIN` 必须为真实域名，不能填示例域名；DNS A 记录需要指向 ECS 公网 IPv4。不要添加未正确配置的 AAAA 记录。完成域名解析和相关备案后，Caddy 自动申请和续期 HTTPS 证书。启动时若域名/证书条件尚未满足，不能降级为明文 HTTP 登录。

初次创建私人账户时，用户本人在服务器私密终端查看 `.env` 中 `SETUP_KEY`，在 HTTPS 网站填写自己的邮箱、密码和初始化密钥。不要发送密钥到聊天、截图或代码仓库。创建后，其他设备直接使用同一邮箱密码登录。

## 上线验证

```sh
docker compose ps
curl --fail --show-error https://start.your-domain.cn/health
```

随后在网站完成首次账户创建；在 Mac 添加一个收藏、用 iPhone 读取并修改，再回到 Mac 确认同步。核对 HTTPS 正常、账户隔离、修改后显示已同步、重启服务后收藏和卡片仍在。Caddy 会保留 Host，请求来源检查与 Secure 登录 Cookie 在 HTTPS 下工作。

## 持久化与备份

数据库位于 Docker 命名卷 `nanxi-start_pg_data`；Caddy 证书使用独立持久卷。重建应用不清空数据库。不要执行 `docker compose down -v`，该命令会删除持久数据。

手动备份：

```sh
sh deploy/aliyun/backup.sh
```

生成仅当前用户可读的 `backups/nanxi-时间.dump`。备份包含私人内容，需另行安全保存到服务器之外；同机备份不能防止整台服务器丢失。该脚本不会自动上传或自动删除历史备份。

恢复会覆盖数据，需要先停止应用写入并确认具体备份。不得在未核对现有数据和备份的情况下执行清库恢复。

更新应用前先备份，然后拉取已核对的版本，执行 `docker compose up -d --build --wait`。保留原 `.env` 和数据卷；变更环境中的数据库密码并不会自动修改已初始化的 PostgreSQL 密码。

## 成本

99 元/年为服务器活动价，折合 8.25 元/月，需年付；域名及任何另购的快照、备份、存储等额外资源另计。不启用未确认的收费附加产品。
