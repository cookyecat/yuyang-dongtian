-- 题名壁：每行一条游人题名（全新建库用这个文件；已经建过库的，跑 migrations/ 里还没跑过的文件）
CREATE TABLE IF NOT EXISTS names (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT    NOT NULL,          -- 名字（≤12 个汉字或 24 个字母，按字宽算）
  place   TEXT    NOT NULL DEFAULT '', -- 来自（≤10 个汉字或 20 个字母，可空）
  msg     TEXT    NOT NULL DEFAULT '', -- 留一句（≤20 个汉字或 40 个字母，可空）
  sns     TEXT    NOT NULL DEFAULT '', -- 社交平台（weibo / xhs / x / instagram / github，可空），v55
  handle  TEXT    NOT NULL DEFAULT '', -- 该平台的用户名（可空），主页链接由程序拼，v55
  ts      INTEGER NOT NULL,          -- 毫秒时间戳
  iphash  TEXT    NOT NULL DEFAULT '', -- 加盐散列后的 IP，只用来限流，看不出原 IP
  hidden  INTEGER NOT NULL DEFAULT 0 -- 0 = 在墙上，1 = 被你隐藏，2 = 待审（带账号的，或开了先审后刻）
);
CREATE INDEX IF NOT EXISTS idx_names_vis ON names (hidden, id DESC);
CREATE INDEX IF NOT EXISTS idx_names_ip  ON names (iphash, ts);
