-- v55 题名壁加社交账号（2026-11）。已经在用的数据库跑一次：
--   npx wrangler d1 execute yuyang-guestbook --remote --file migrations/0002_sns.sql
-- 只加两列，旧题名不受影响（账号为空）。重复跑会报 duplicate column name，说明已经加过了，不用管。
ALTER TABLE names ADD COLUMN sns    TEXT NOT NULL DEFAULT '';
ALTER TABLE names ADD COLUMN handle TEXT NOT NULL DEFAULT '';
