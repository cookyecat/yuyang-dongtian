-- 题名壁：每行一条游人题名
CREATE TABLE IF NOT EXISTS names (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT    NOT NULL,          -- 名字（≤12 字）
  place   TEXT    NOT NULL DEFAULT '', -- 来自（≤10 字，可空）
  msg     TEXT    NOT NULL DEFAULT '', -- 留一句（≤20 字，可空）
  ts      INTEGER NOT NULL,          -- 毫秒时间戳
  iphash  TEXT    NOT NULL DEFAULT '', -- 加盐散列后的 IP，只用来限流，看不出原 IP
  hidden  INTEGER NOT NULL DEFAULT 0 -- 1 = 不显示（被你隐藏，或开了先审后刻）
);
CREATE INDEX IF NOT EXISTS idx_names_vis ON names (hidden, id DESC);
CREATE INDEX IF NOT EXISTS idx_names_ip  ON names (iphash, ts);
