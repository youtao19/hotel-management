# 本地开发 vs Docker 开发环境配置

## 🔧 两种开发模式

本项目支持两种开发模式：
1. **本地开发** - 直接在宿主机上运行前后端
2. **Docker 开发** - 在 Docker 容器中运行

## 📊 环境对比

| 特性 | 本地开发 | Docker 开发 |
|-----|---------|------------|
| **数据库** | 本地安装的 PostgreSQL | Docker 容器 |
| **Redis** | 本地安装的 Redis | Docker 容器 |
| **后端地址** | `localhost:3000` | `backend:3000` (服务名) |
| **前端地址** | `localhost:9000` | `frontend:9000` (服务名) |
| **启动命令** | `npm start` | `docker compose up -d` |
| **热重载** | ✅ 快 | ✅ 稍慢 |
| **环境隔离** | ❌ | ✅ |

## 🚀 本地开发环境设置

### 1. 安装依赖

#### macOS
```bash
# 安装 PostgreSQL
brew install postgresql@17
brew services start postgresql@17

# 安装 Redis
brew install redis
brew services start redis

# 创建数据库
createdb hotel_db
```

#### Windows (使用 WSL 或原生)
```powershell
# 下载并安装 PostgreSQL
# https://www.postgresql.org/download/windows/

# 下载并安装 Redis
# https://github.com/microsoftarchive/redis/releases
```

### 2. 配置环境变量

复制模板并填写配置：
```bash
cp dev.env.template dev.env
```

编辑 `dev.env`：
```env
# Node 环境
NODE_ENV=dev
NODE_PORT=3000

# PostgreSQL 数据库配置（本地）
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=peach
POSTGRES_PASSWORD=1219
POSTGRES_DB=hotel_db

# Redis 配置（本地）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PW=

# 邮件服务配置
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=465
EMAIL_USER=your-email@qq.com
EMAIL_PW=your-auth-code
ADMIN_EMAIL=your-email@qq.com

# 应用配置
APP_NAME=hotelManagement
APP_URL=http://localhost:9000
SERVER_URL=http://localhost:3000
```

### 3. 初始化数据库

```bash
# 执行数据库初始化脚本
psql -U peach -d hotel_db -f sql/init/00-init-schema.sql
psql -U peach -d hotel_db -f sql/init/01-init-room-types.sql
psql -U peach -d hotel_db -f sql/init/02-init-rooms.sql
```

### 4. 启动服务

```bash
# 安装依赖
npm install

# 启动前后端（在项目根目录）
npm start

# 或者分别启动
npm --workspace backend run dev    # 后端: http://localhost:3000
npm --workspace frontend run dev   # 前端: http://localhost:9000
```

## 🐳 Docker 开发环境设置

### 1. 配置环境变量

编辑 `docker.dev.env`（已配置好）：
```env
# PostgreSQL 数据库配置（Docker 服务名）
POSTGRES_HOST=postgres
REDIS_HOST=redis

# 前端 API 配置（Docker 服务名）
VITE_API_BASE=http://backend:3000
```

### 2. 启动服务

```bash
# 启动所有服务（自动初始化数据库）
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

## 🔄 在两种模式间切换

### 从 Docker 切换到本地开发

```bash
# 1. 停止 Docker 服务
docker compose down

# 2. 确保本地数据库和 Redis 正在运行
brew services list

# 3. 使用本地环境变量
export $(cat dev.env | xargs)

# 4. 启动本地服务
npm start
```

### 从本地开发切换到 Docker

```bash
# 1. 停止本地服务
# Ctrl+C 或 npm stop

# 2. 启动 Docker 服务
docker compose up -d
```

## ⚙️ 前端 Proxy 配置说明

`frontend/quasar.config.js` 中的 proxy 配置会自动适配环境：

```javascript
devServer: {
  proxy: {
    '/api': {
      // 环境变量优先，否则默认 localhost（本地开发）
      target: process.env.VITE_API_BASE || 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

**工作原理：**
- **本地开发**：`VITE_API_BASE` 未设置 → 使用 `http://localhost:3000`
- **Docker 开发**：`VITE_API_BASE=http://backend:3000` → 使用 Docker 服务名

## 🐛 常见问题

### 1. 本地开发时前端报错 "ENOTFOUND backend"

**原因**：前端正在尝试连接 Docker 服务名 `backend`

**解决方案**：
```bash
# 确保没有设置 VITE_API_BASE 环境变量
unset VITE_API_BASE

# 重启前端开发服务器
npm --workspace frontend run dev
```

### 2. Docker 环境无法连接数据库

**原因**：配置使用了 `localhost` 而不是服务名

**解决方案**：检查 `docker.dev.env`
```env
# ❌ 错误
POSTGRES_HOST=localhost

# ✅ 正确
POSTGRES_HOST=postgres
```

### 3. 数据库连接错误

**本地开发**：
```bash
# 检查 PostgreSQL 是否运行
brew services list

# 检查数据库是否存在
psql -l | grep hotel_db

# 如果不存在，创建数据库
createdb hotel_db
```

**Docker 开发**：
```bash
# 查看数据库日志
docker compose logs postgres

# 重置数据库
docker compose down -v
docker compose up -d
```

### 4. Redis 连接错误

**本地开发**：
```bash
# 检查 Redis 是否运行
brew services list

# 测试连接
redis-cli ping
# 应该返回 PONG
```

**Docker 开发**：
```bash
# 查看 Redis 日志
docker compose logs redis

# 进入 Redis 容器测试
docker compose exec redis redis-cli ping
```

## 📝 推荐实践

### 日常开发推荐

**本地开发** ✅ 推荐
- 启动快
- 热重载快
- 方便调试
- 资源占用少

**使用场景**：
- 快速迭代开发
- 调试代码
- 运行测试

### 测试和部署推荐

**Docker 开发** ✅ 推荐
- 环境一致性
- 隔离性好
- 接近生产环境
- 团队协作方便

**使用场景**：
- 集成测试
- 环境验证
- 团队协作
- CI/CD 流程

## 🎯 最佳实践

1. **开发时使用本地环境**
   ```bash
   npm start
   ```

2. **提交前测试 Docker 环境**
   ```bash
   docker compose up -d
   # 运行测试...
   docker compose down
   ```

3. **使用 .env 文件管理配置**
   - `dev.env` - 本地开发
   - `docker.dev.env` - Docker 开发
   - `.env` - 不要提交到 Git（包含敏感信息）

4. **数据库迁移**
   ```bash
   # 本地开发
   npm --workspace backend run migrate

   # Docker 环境
   docker compose exec backend npm run migrate
   ```

## 📚 相关文档

- [Docker 部署指南](./DOCKER.md)
- [Windows Docker 指南](./DOCKER-WINDOWS.md)
- [跨平台说明](./CROSS-PLATFORM.md)

## ✅ 快速检查清单

### 本地开发
- [ ] PostgreSQL 正在运行 (`brew services list`)
- [ ] Redis 正在运行 (`brew services list`)
- [ ] 数据库已创建 (`psql -l | grep hotel_db`)
- [ ] 环境变量已配置 (`dev.env`)
- [ ] 依赖已安装 (`npm install`)
- [ ] **未设置** `VITE_API_BASE` 环境变量

### Docker 开发
- [ ] Docker Desktop 正在运行
- [ ] 环境变量已配置 (`docker.dev.env`)
- [ ] 镜像已构建 (`docker compose build`)
- [ ] 服务正在运行 (`docker compose ps`)
- [ ] `VITE_API_BASE=http://backend:3000` 已设置
