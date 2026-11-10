# 题名壁后端（Cloudflare Worker + D1）

GitHub Pages 只能放静态文件，存不了游人的题名，所以题名放在 Cloudflare 上：
一个 Worker（小段服务器代码）收题名、做检查，一个 D1 数据库（SQLite）存下来。
两样都在免费额度内：每天 10 万次请求、5 GB 存储，一个个人作品用不完。

游园页面通过 `index.html` 里这一行找到它：

```html
<meta name="yy-guestbook" content="">
```

留空时，题名壁显示「不日开放」，其余一切照常。

## 一次性设置（约 15 分钟）

需要：一个 Cloudflare 账号（免费）、本机装好 Node.js（你已经有了）。

```bash
# 0. 进到这个文件夹
cd guestbook

# 1. 登录 Cloudflare（会打开浏览器，点同意）
npx wrangler login

# 2. 建数据库，把输出里的 database_id 贴进 wrangler.toml 最后一行
npx wrangler d1 create yuyang-guestbook

# 3. 建表
npx wrangler d1 execute yuyang-guestbook --remote --file schema.sql

# 4. 两个密钥（各自随便打一长串字母数字，自己记好 ADMIN_TOKEN）
npx wrangler secret put ADMIN_TOKEN     # 管理页的口令
npx wrangler secret put IP_SALT         # 给 IP 加盐散列用，不用记

# 5. 部署，最后会打印出地址，形如 https://yuyang-guestbook.<你的名字>.workers.dev
npx wrangler deploy
```

然后把打印出的地址填进 `index.html` 的 `yy-guestbook`，推送到 GitHub 即可：

```html
<meta name="yy-guestbook" content="https://yuyang-guestbook.<你的名字>.workers.dev">
```

### 国内访问：绑一个 Cloudflare 上的子域名

`*.workers.dev` 在中国大陆经常连不上，最好给 Worker 绑一个自己的子域名。这个子域名所在的域名要托管在 Cloudflare 上。
`starverse.chat` 在阿里云，而 `shenshou.chat` 在 Cloudflare，所以用 `gb.shenshou.chat`。主站打不开也没关系，子域名单独生效，题名壁和游园页面不必同域。

做法（二选一）：
- 打开 `wrangler.toml` 里 `routes` 那一行的注释，再 `npx wrangler deploy`；
- 或者在 Cloudflare 控制台 → Workers & Pages → yuyang-guestbook → Settings → Domains & Routes → Add → Custom domain，填 `gb.shenshou.chat`。

Cloudflare 会自动建好 DNS 记录和证书，几分钟后 `https://gb.shenshou.chat/` 显示 `yuyang-guestbook ok` 就成了。
然后把 `index.html` 里的 `yy-guestbook` 填成 `https://gb.shenshou.chat`。

## 管理

打开 `https://<Worker 地址>/admin`，填 ADMIN_TOKEN，就能看到全部题名，逐条「隐藏 / 显示 / 删除」。
口令只存在你那台电脑的浏览器里。

想改成「先审后刻」（新题名先藏起来，你点了「显示」才上墙）：把 `wrangler.toml` 里 `MODERATE` 改成 `"1"`，再 `npx wrangler deploy`。

## 防刷和过滤（都在 src/worker.js 里）

- 名字 ≤ 12 字，来自 ≤ 10 字，留言 ≤ 20 字；去掉控制字符、零宽字符，全角半角统一
- 敏感词：`src/words.js`，比对时忽略空格和标点（「傻 逼」也拦）；西文按整词比，不会误伤 Elizabeth
- 网址、邮箱、5 位以上的数字（电话、QQ）、「微信」一律不收
- 同一 IP 两次题名至少隔 1 分钟，一天最多 5 条；全站一天最多 500 条（`DAILY_CAP`）
- 页面上有一个人看不见的输入框（蜜罐），脚本填了就假装成功、实际不存
- 打开题名框不到 2.5 秒就提交的，当作脚本
- 只收 `ALLOWED_ORIGINS` 里的网页发来的题名（默认 art.starverse.chat 和 cookyecat.github.io）
- IP 只存加盐散列，看不出原 IP

## 本机试运行

```bash
npx wrangler d1 execute yuyang-guestbook --local --file schema.sql
npx wrangler dev --local --var ADMIN_TOKEN:test
# 网站用 ?gb=http://localhost:8787 打开，就会连这个本机后端，例如
# http://localhost:8000/?gb=http://localhost:8787
```

接口：`GET /api/names?limit=80`、`POST /api/names`（`{name, place, msg}`）。
