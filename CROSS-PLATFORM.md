# 🌍 跨平台部署说明

本项目支持在 **macOS**、**Linux** 和 **Windows** 上运行。

## 📦 系统要求

| 操作系统 | 要求 | Docker |
|---------|------|--------|
| **macOS** | macOS 10.15+ | [Docker Desktop for Mac](https://docs.docker.com/desktop/mac/install/) |
| **Linux** | Ubuntu 20.04+, Debian 10+, etc. | [Docker Engine](https://docs.docker.com/engine/install/) |
| **Windows** | Windows 10/11 (Build 19041+) | [Docker Desktop for Windows](https://docs.docker.com/desktop/windows/install/) |

## 🚀 快速启动

### macOS / Linux

```bash
# 启动服务
docker compose up -d

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### Windows

#### 方式 1：双击运行（最简单）
- 双击 `start.bat` 启动服务
- 双击 `stop.bat` 停止服务

#### 方式 2：PowerShell（推荐）
```powershell
# 启动服务
.\start.ps1

# 查看日志
.\start.ps1 -Logs

# 停止服务
.\start.ps1 -Stop

# 重置数据
.\start.ps1 -Reset
```

#### 方式 3：命令行
```powershell
docker compose up -d
docker compose ps
docker compose logs -f
docker compose down
```

## 📚 详细文档

- **通用文档**: [DOCKER.md](./DOCKER.md) - 适用于所有平台
- **Windows 专用**: [DOCKER-WINDOWS.md](./DOCKER-WINDOWS.md) - Windows 特有问题和优化
- **SQL 初始化**: [sql/README.md](./sql/README.md) - 数据库初始化说明

## 🌐 访问地址（所有平台相同）

- 前端应用: http://localhost:9000
- 后端 API: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## ⚙️ 平台特定说明

### macOS
- ✅ 使用 Docker Desktop
- ✅ 性能优异
- ✅ 无需额外配置

### Linux
- ✅ 使用 Docker Engine（更轻量）
- ✅ 性能最佳
- ⚠️ 可能需要配置用户组: `sudo usermod -aG docker $USER`

### Windows
- ✅ 使用 Docker Desktop + WSL 2
- ⚠️ 需要启用 WSL 2 和虚拟化
- ⚠️ 建议将项目放在 WSL 文件系统中以获得最佳性能
- 📖 详见: [DOCKER-WINDOWS.md](./DOCKER-WINDOWS.md)

## 🐛 常见问题

### 所有平台

**问题：端口被占用**
```bash
# 查看端口占用
# macOS/Linux
lsof -i :3000
# Windows
netstat -ano | findstr :3000

# 修改 compose.yaml 中的端口映射
ports:
  - "3001:3000"  # 将宿主机端口改为 3001
```

**问题：数据库初始化失败**
```bash
# 删除数据卷并重新初始化
docker compose down -v
docker compose up -d
```

### Windows 特有

**问题：文件监听不工作**
- 在 `compose.yaml` 中添加 `CHOKIDAR_USEPOLLING=true`

**问题：行尾符错误**
- 确保已添加 `.gitattributes` 文件
- 在 Git 中配置: `git config --global core.autocrlf input`

**问题：性能慢**
- 启用 WSL 2 backend
- 将项目文件放在 WSL 文件系统中（`\\wsl$\Ubuntu\home\...`）

## 📊 性能对比

| 平台 | 启动时间 | 构建速度 | 运行性能 |
|-----|---------|---------|----------|
| Linux | 最快 ⚡ | 最快 ⚡ | 最佳 ⭐⭐⭐ |
| macOS | 快 | 快 | 优秀 ⭐⭐ |
| Windows (WSL 2) | 中等 | 中等 | 良好 ⭐ |

## 🔧 开发建议

### 推荐配置
- **代码编辑器**: VS Code（所有平台）
- **终端**:
  - macOS: iTerm2 或内置 Terminal
  - Linux: GNOME Terminal 或 Terminator
  - Windows: Windows Terminal（推荐）或 PowerShell

### Git 配置（跨平台一致性）
```bash
# 统一行尾符
git config --global core.autocrlf input    # macOS/Linux
git config --global core.autocrlf true     # Windows

# 统一编码
git config --global core.quotepath false
```

## 🎯 最佳实践

### 开发环境
1. 使用 `docker compose up -d` 启动服务
2. 修改代码后容器会自动重载（hot reload）
3. 使用 `docker compose logs -f` 查看实时日志
4. 开发完成后使用 `docker compose down` 停止服务

### 数据管理
```bash
# 保留数据的停止
docker compose down

# 清除数据的停止（重新初始化）
docker compose down -v
docker compose up -d
```

### 调试
```bash
# 进入容器调试
docker compose exec backend sh
docker compose exec frontend sh

# 查看数据库
docker compose exec postgres psql -U peach -d hotel_db

# 查看 Redis
docker compose exec redis redis-cli
```

## 🆘 获取帮助

- **Docker 文档**: https://docs.docker.com/
- **Docker Compose 文档**: https://docs.docker.com/compose/
- **项目 Issues**: [GitHub Issues](https://github.com/youtao19/hotel-management/issues)

## 📝 快速参考

| 操作 | 命令 |
|-----|------|
| 启动服务 | `docker compose up -d` |
| 停止服务 | `docker compose down` |
| 重启服务 | `docker compose restart` |
| 查看状态 | `docker compose ps` |
| 查看日志 | `docker compose logs -f` |
| 重新构建 | `docker compose build --no-cache` |
| 清除数据 | `docker compose down -v` |
| 进入容器 | `docker compose exec <service> sh` |

## ✅ 验证部署

部署成功后，您应该能看到：
```
NAME                          STATUS
hotel-management-backend-1    Up (healthy)
hotel-management-frontend-1   Up
hotel-management-postgres-1   Up (healthy)
hotel-management-redis-1      Up
```

然后访问 http://localhost:9000 使用系统！🎉
