# 数据库迁移

## 使用方式

在项目根目录执行：

```bash
npm run db:migrate
```

迁移执行器会创建并读取 `schema_migrations`。未登记的 SQL 文件按文件名升序各执行一次，成功后记录文件名、内容校验值和执行时间。

## 新增迁移

在本目录新增文件，命名格式为：

```text
YYYYMMDDHHMMSS_描述.sql
```

例如：

```text
20260730143000_create_handover_daily_settings.sql
```

规则：

- 已在任意环境执行过的迁移文件不得修改；需要修正时新增下一份迁移。
- 一个迁移文件应能在单个数据库事务中执行；不要在其中使用 `CREATE INDEX CONCURRENTLY` 等不能放入事务的语句。
- 生产发布顺序是先执行迁移，再部署依赖新结构的应用代码。
- 启动应用不会自动执行迁移，避免多实例同时改表。
