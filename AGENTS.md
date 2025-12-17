## 任务说明
在审查和修改代码时，请同时审查 PostgreSQL 的建表文件（tables / schema.sql / migration 文件），
确保“新建表结构”与时间与时区规范完全一致，避免旧问题再次出现。

【建表文件强制规范】

1️⃣ 时间点字段（精确到秒，表示某一时刻）
- 示例字段名：created_at, updated_at, create_time, changed_at, invite_time
- PostgreSQL 类型：TIMESTAMP WITH TIME ZONE（timestamptz）
- 推荐默认值：
  DEFAULT now()
- 严禁使用：
  TIMESTAMP WITHOUT TIME ZONE

示例（正确）：
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()

示例（错误）：
  created_at TIMESTAMP
  create_time TIMESTAMP WITHOUT TIME ZONE

---

2️⃣ 业务日期字段（只表示“哪一天”）
- 示例字段名：check_in_date, check_out_date, stay_date, memo_date, handover_date
- PostgreSQL 类型：DATE
- 禁止设置默认值为 now()
- 插入时只允许 'YYYY-MM-DD'

示例（正确）：
  check_in_date DATE NOT NULL

示例（错误）：
  stay_date DATE DEFAULT now()
  check_in_date TIMESTAMP

---

3️⃣ updated_at 规范
- 类型必须为 TIMESTAMPTZ
- 通过触发器或应用层更新
- 不使用 TIMESTAMP

---

【迁移与一致性要求】

4️⃣ 如果 tables 文件中仍存在以下任一情况，必须修改：
- timestamp without time zone
- DATE + DEFAULT now()
- 时间字段含义与类型不匹配

5️⃣ tables 文件是“最终权威定义”，
- 数据库现状可以通过迁移修正
- 但 tables 文件必须体现“正确最终状态”

---

【输出要求】

当发现问题时，请你：
- 明确指出哪个表、哪个字段违反规范
- 给出修改后的建表 SQL（CREATE TABLE）
- 如涉及已存在表，额外给出 ALTER TABLE 迁移 SQL
- 确保新建表不会再引入“时间少一天”的隐患


## 目标
1.你需要先给我创建一个Progress.md文件，列出你的修改流程
2.让我确认你的修改流程
3.执行修改后，你需要给我写一个测试样例，并且让我确认。
4.你需要执行这个测试样例，确保测试可以通过。
5.完成测试后，你需要使用中文写好commit message，然后执行git commit，你需要 git add 所有文件，然后git commit -m "commit message"

## 要求
+ 当你完成一个progress的流程后，你需要同步修改progress.md文件，表示这一步已经完成
+ 当你执行修改时，先查看progress的完成进度，然后根据进度继续执行代码修改

