# Docker 部署指南

## 📋 概述

本项目已完全 Docker 化，包含以下服务：
- **PostgreSQL 17.6** - 数据库服务
- **Redis 7** - 缓存服务
- **Backend (Node.js 22)** - 后端 API 服务
- **Frontend (Quasar/Vue.js)** - 前端 Web 应用

## 🚀 快速开始

### 1. 环境准备

确保已安装：
- Docker Desktop 或 Docker Engine
- Docker Compose V2

```bash
# 检查版本
docker --version
docker compose version
```

### 2. 配置环境变量

环境变量配置文件：`docker.dev.env`

```env
# 数据库配置
POSTGRES_HOST=postgres      # 使用服务名，不是 localhost
POSTGRES_PORT=5432
POSTGRES_USER=peach
POSTGRES_PASSWORD=1219
POSTGRES_DB=hotel_db

# Redis 配置
REDIS_HOST=redis            # 使用服务名，不是 localhost
REDIS_PORT=6379

# 其他配置...
```

⚠️ **重要**：容器内通过服务名通信，不要使用 `localhost`

### 3. 启动服务

```bash
# 首次启动（会自动初始化数据库并导入数据）
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### 4. 访问服务

- 前端应用：http://localhost:9000
- 后端 API：http://localhost:3000
- PostgreSQL：localhost:5432
- Redis：localhost:6379

## 🗄️ 数据库初始化

### 自动初始化流程

PostgreSQL 容器首次启动时会**自动执行**以下操作：

1. **创建数据库表结构** (`00-init-schema.sql`)
   - 创建所有表（account, room_types, rooms, orders, bills 等）
   - 创建索引和约束
   - 启用必要的扩展（ltree, pg_trgm）

2. **导入房间类型数据** (`01-init-room-types.sql`)
   - 9 种房间类型（声声慢、忆江南、云居云端等）

3. **导入房间数据** (`02-init-rooms.sql`)
   - 40 间房间的详细信息

### 初始化脚本位置

```
sql/
└── init/
    ├── 00-init-schema.sql        # 表结构
    ├── 01-init-room-types.sql    # 房间类型数据
    └── 02-init-rooms.sql         # 房间数据
```

### 重新初始化数据库

```bash
# ⚠️ 警告：此操作会删除所有数据！
docker compose down -v          # 停止服务并删除数据卷
docker compose up -d            # 重新启动（自动执行初始化脚本）
```

### 验证数据导入

```bash
# 连接到数据库
docker compose exec postgres psql -U peach -d hotel_db

# 查询房间类型
SELECT * FROM room_types;

# 查询房间统计
SELECT type_code, COUNT(*) FROM rooms GROUP BY type_code;

# 退出
\q
```

## 🛠️ 常用命令

### 服务管理

```bash
# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 停止并删除数据卷（会清空数据库）
docker compose down -v

# 重启特定服务
docker compose restart backend

# 重启所有服务
docker compose restart
```

### 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看后端日志（最近 50 行）
docker compose logs --tail=50 backend

# 查看前端实时日志
docker compose logs -f frontend

# 查看 PostgreSQL 日志
docker compose logs postgres | grep ERROR
```

### 重新构建镜像

```bash
# 重新构建所有服务
docker compose build --no-cache

# 重新构建特定服务
docker compose build --no-cache backend

# 重新构建并启动
docker compose up -d --build
```

### 进入容器

```bash
# 进入后端容器
docker compose exec backend sh

# 进入数据库容器
docker compose exec postgres psql -U peach -d hotel_db

# 进入 Redis 容器
docker compose exec redis redis-cli
```

## 🔧 开发调试

### 查看容器状态

```bash
# 查看所有容器
docker compose ps

# 查看容器资源使用
docker stats

# 查看容器详细信息
docker compose exec backend env
```

### 数据库操作

```bash
# 执行 SQL 查询
docker compose exec postgres psql -U peach -d hotel_db -c "SELECT COUNT(*) FROM rooms;"

# 备份数据库
docker compose exec postgres pg_dump -U peach hotel_db > backup.sql

# 恢复数据库
docker compose exec -T postgres psql -U peach -d hotel_db < backup.sql
```

### 清理资源

```bash
# 删除停止的容器
docker compose rm

# 清理未使用的镜像
docker image prune

# 清理所有未使用的资源
docker system prune -a --volumes
```

## 📦 项目结构

```
hotel-management/
├── backend/
│   ├── Dockerfile              # 后端镜像配置
│   ├── .dockerignore          # Docker 忽略文件
│   └── ...
├── frontend/
│   ├── Dockerfile              # 前端镜像配置
│   ├── .dockerignore          # Docker 忽略文件
│   └── ...
├── sql/
│   ├── init/                   # 数据库初始化脚本
│   │   ├── 00-init-schema.sql
│   │   ├── 01-init-room-types.sql
│   │   └── 02-init-rooms.sql
│   └── README.md
├── compose.yaml                # Docker Compose 配置
└── docker.dev.env             # 环境变量配置
```

## 🐛 故障排查

### PostgreSQL 启动失败

```bash
# 查看详细日志
docker compose logs postgres

# 常见问题：
# 1. 端口被占用 → 修改 compose.yaml 中的端口映射
# 2. 数据卷权限问题 → docker compose down -v 后重试
```

### Backend 连接数据库失败

```bash
# 检查环境变量
docker compose exec backend env | grep POSTGRES

# 确保使用服务名而不是 localhost
# POSTGRES_HOST=postgres ✅
# POSTGRES_HOST=localhost ❌
```

### Frontend 无法访问 Backend

```bash
# 检查 backend 是否运行
docker compose ps backend

# 检查 backend 日志
docker compose logs backend --tail=50

# 检查网络连接
docker compose exec frontend ping backend
```

### 数据没有初始化

```bash
# 初始化脚本只在首次启动时执行
# 如需重新初始化，必须删除数据卷：
docker compose down -v
docker compose up -d
```

## 🔐 生产环境部署建议

1. **修改默认密码**
   - 更改 `docker.dev.env` 中的数据库密码
   - 使用强密码策略

2. **使用生产环境配置**
   ```bash
   # 创建 docker.prod.env
   NODE_ENV=production
   ```

3. **数据持久化**
   - 确保数据卷使用外部存储
   - 定期备份数据库

4. **资源限制**
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 512M
   ```

5. **使用反向代理**
   - 添加 Nginx 作为反向代理
   - 配置 SSL/TLS 证书

## 📝 注意事项

1. **首次启动时间较长**
   - 需要下载镜像、初始化数据库等
   - 大约需要 1-2 分钟

2. **数据持久化**
   - 数据存储在 Docker 卷中
   - `docker compose down` 不会删除数据
   - `docker compose down -v` 会删除所有数据

3. **修改初始化脚本**
   - 修改 `sql/init/*.sql` 后需要重建数据卷
   - `docker compose down -v && docker compose up -d`

4. **网络通信**
   - 容器之间使用服务名通信
   - 宿主机访问使用 localhost

## 🆘 获取帮助

```bash
# 查看 Docker Compose 帮助
docker compose --help

# 查看特定命令帮助
docker compose up --help
docker compose logs --help
```

## 📚 相关文档

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
