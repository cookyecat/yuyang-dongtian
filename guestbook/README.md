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

打开 `https://<Worker 地址>/admin`（现在是 <https://gb.shenshou.chat/admin>），填 ADMIN_TOKEN，就能看到全部题名。
口令只存在你那台电脑的浏览器里。忘了口令就重设一个：`npx wrangler secret put ADMIN_TOKEN`。

- **待审**（淡黄底，排在最前，页首写着「待审 N 条」）：带社交账号的题名。先点账号链接看一眼对方主页，
  没问题点「通过」，名字连账号一起上墙；账号不妥、名字可以，点「只刻名字」（账号删掉，名字上墙）；都不行点「删除」。
- 已上墙的：「隐藏 / 去掉账号 / 删除」。隐藏的：「显示 / 删除」。

不带账号的题名照旧直接上墙。想改成全部「先审后刻」：把 `wrangler.toml` 里 `MODERATE` 改成 `"1"`，再 `npx wrangler deploy`，之后所有新题名都进「待审」。

## 社交账号（v55）

游人可以在题名时附一个社交账号，只能从下拉里选平台、再填用户名（贴主页链接也行，页面会自动认出用户名），
**不收任意网址**：主页链接由程序按平台的固定格式拼出来，点开只会去这五家：

| 平台 | 收什么 | 链接 |
|---|---|---|
| 微博 | 昵称（汉字、字母、数字、`_`、`-`，2–15 个汉字或 4–30 个字母），或纯数字 ID | `weibo.com/n/昵称`、`weibo.com/u/ID` |
| 小红书 | 主页链接里那串 24 位 ID，或小红书号 | `xiaohongshu.com/user/profile/ID`；小红书号没有网址，卡片上给号码和「复制」 |
| X | 1–15 位字母、数字、`_` | `x.com/用户名` |
| Instagram | 最多 30 位字母、数字、`_`、`.` | `instagram.com/用户名/` |
| GitHub | 最多 39 位字母、数字、`-` | `github.com/用户名` |

- 石屏（3D）和题名框里都只刻名字；点开某个名字，小卡片上才有账号链接（新窗口打开，`rel="noopener nofollow ugc"`）。
  留了账号的名字，落款小字后面有一枚小朱印作记号。
- 带账号的题名进「待审」（数据库里 `hidden = 2`），你在 /admin 里通过后才上墙。
- 想加平台：`src/worker.js` 和 `../js/credit.js` 各有一张 `SNS` 表，两边一起加一行。

### 已经在用的数据库：加两列（只做一次）

v55 给 `names` 表加了 `sns`、`handle` 两列。顺序是**先后端、再合并前端**（反过来的话，中间这段时间游人填的账号会被旧后端悄悄丢掉）：

```bash
cd guestbook
# 1. 给线上数据库加两列（旧题名不受影响，账号为空）
npx wrangler d1 execute yuyang-guestbook --remote --file migrations/0002_sns.sql
# 2. 部署新后端
npx wrangler deploy
# 3. 打开 https://gb.shenshou.chat/admin 看一眼能读出题名（这时还没有待审的）
```

然后再合并前端（GitHub 上的 PR），Pages 自动上线。第 1 步重复跑会报 `duplicate column name`，说明已经加过了，不用管。
全新建库的不用跑迁移，`schema.sql` 里已经有这两列。

## 防刷和过滤（都在 src/worker.js 里）

- 名字 ≤ 12 个汉字，来自 ≤ 10 个汉字，留言 ≤ 20 个汉字；按字宽算，西文字母算半个汉字，所以英文可写 24、20、40 个字母；去掉控制字符、零宽字符，全角半角统一
- 敏感词：`src/words.js`，比对时忽略空格和标点（「傻 逼」也拦）；西文按整词比，不会误伤 Elizabeth
- 名字、来自、留言里：网址、邮箱、5 位以上的数字（电话、QQ）、「微信」一律不收（想让人找到，用社交账号一栏）
- 社交账号：只收白名单平台的用户名，格式不对的不收，也过一遍敏感词；带账号的先审后上
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

本机库是旧表的话，先跑一次 `npx wrangler d1 execute yuyang-guestbook --local --file migrations/0002_sns.sql`。

接口：`GET /api/names?limit=80`（只回已上墙的，带 `sns`、`handle`）、`POST /api/names`（`{name, place, msg, sns, handle}`，带账号的回 `{pending: true}`）。
