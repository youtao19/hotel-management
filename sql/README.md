# SQL 初始化脚本说明

## 目录结构

```
sql/
├── init/                          # Docker 容器启动时自动执行的初始化脚本
│   ├── 01-init-room-types.sql    # 初始化房间类型数据
│   └── 02-init-rooms.sql         # 初始化房间数据
├── room_types.sql                 # 原始房间类型数据（参考）
└── rooms.sql                      # 原始房间数据（参考）
```

## 工作原理

PostgreSQL 官方镜像会在**首次启动**时自动执行 `/docker-entrypoint-initdb.d/` 目录下的所有 `.sql` 和 `.sh` 文件。

- 文件按**字母顺序**执行
- 只在**数据库初始化时**执行一次
- 如果数据卷已存在，则不会重新执行

## 使用方法

### 全新启动（首次初始化）

```bash
# 1. 停止并删除所有容器和数据卷
docker compose down -v

# 2. 重新启动服务（PostgreSQL 会自动执行初始化脚本）
docker compose up -d

# 3. 查看 PostgreSQL 日志确认数据导入
docker compose logs postgres
```

### 验证数据是否导入成功

```bash
# 连接到 PostgreSQL 容器
docker compose exec postgres psql -U peach -d hotel_db

# 查询房间类型
SELECT * FROM room_types;

# 查询房间数据
SELECT * FROM rooms;

# 退出
\q
```

## 注意事项

1. **初始化脚本只在首次启动时执行**
   - 如果需要重新执行，必须先删除数据卷：`docker compose down -v`

2. **文件命名规范**
   - 使用数字前缀（01, 02）确保执行顺序
   - 先执行房间类型，再执行房间数据（外键依赖）

3. **幂等性处理**
   - 使用 `ON CONFLICT ... DO NOTHING` 避免重复插入错误
   - 适用于手动重新执行脚本的场景

4. **修改初始化脚本**
   - 修改脚本后需要重建数据卷才能生效
   - 生产环境建议使用数据库迁移工具

## 添加新的初始化脚本

如需添加其他初始化数据：

1. 在 `sql/init/` 目录下创建新的 SQL 文件
2. 使用递增的数字前缀（如 `03-init-xxx.sql`）
3. 重新启动容器：`docker compose down -v && docker compose up -d`
