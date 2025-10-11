# Windows 环境下的 Docker 部署指南

## 🪟 系统要求

### 最低要求
- Windows 10 版本 2004 或更高（Build 19041+）
- Windows 11
- 64 位处理器
- 至少 4GB RAM（推荐 8GB+）
- 启用虚拟化（BIOS 中的 VT-x/AMD-V）

### 检查虚拟化是否启用
```powershell
# 在 PowerShell 中执行
Get-ComputerInfo | Select-Object -Property WindowsProductName, OsHardwareAbstractionLayer
```

如果显示 `Microsoft Windows 10 [Version xxxx]`，虚拟化已启用。

## 🔧 安装 Docker Desktop

### 步骤 1：安装 WSL 2

```powershell
# 以管理员身份运行 PowerShell

# 启用 WSL
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# 启用虚拟机平台
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# 重启电脑
Restart-Computer

# 重启后，设置 WSL 2 为默认版本
wsl --set-default-version 2

# 安装 Ubuntu（可选但推荐）
wsl --install -d Ubuntu
```

### 步骤 2：下载并安装 Docker Desktop

1. 访问：https://www.docker.com/products/docker-desktop
2. 下载 Windows 版本
3. 运行安装程序
4. 安装时勾选 "Use WSL 2 instead of Hyper-V"
5. 完成后重启电脑

### 步骤 3：验证安装

```powershell
# 打开 PowerShell 或 CMD
docker --version
docker compose version

# 应该看到类似输出：
# Docker version 24.x.x
# Docker Compose version v2.x.x
```

## 🚀 部署项目

### 方式一：在 PowerShell 中运行（推荐新手）

```powershell
# 1. 进入项目目录
cd C:\Users\YourName\hotel-management

# 2. 启动所有服务
docker compose up -d

# 3. 查看服务状态
docker compose ps

# 4. 查看日志
docker compose logs -f

# 5. 访问应用
# 前端：http://localhost:9000
# 后端：http://localhost:3000
```

### 方式二：在 WSL 2 中运行（推荐高级用户）

```bash
# 1. 打开 WSL 2 终端
wsl

# 2. 进入项目目录（Windows 路径在 /mnt/c/ 下）
cd /mnt/c/Users/YourName/hotel-management

# 3. 启动服务
docker compose up -d

# 4. 查看状态
docker compose ps
```

## 📋 常用命令（PowerShell）

### 服务管理
```powershell
# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 重启服务
docker compose restart

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend
```

### 数据管理
```powershell
# 重置数据库（删除所有数据）
docker compose down -v
docker compose up -d

# 备份数据库
docker compose exec postgres pg_dump -U peach hotel_db > backup.sql

# 恢复数据库
Get-Content backup.sql | docker compose exec -T postgres psql -U peach -d hotel_db
```

### 调试
```powershell
# 进入容器
docker compose exec backend sh
docker compose exec postgres psql -U peach -d hotel_db

# 查看容器日志
docker compose logs --tail=50 backend

# 重新构建镜像
docker compose build --no-cache
docker compose up -d --build
```

## 🐛 Windows 特有问题解决

### 问题 1：文件监听不工作（热重载失败）

**症状：** 修改代码后容器内的应用不自动重启

**解决方案：**
```yaml
# 在 compose.yaml 的 backend 服务中添加
services:
  backend:
    environment:
      - CHOKIDAR_USEPOLLING=true
    # ...其他配置
```

### 问题 2：路径中的反斜杠问题

**错误示例：**
```powershell
# ❌ 错误
docker compose -f C:\project\compose.yaml up

# ✅ 正确
docker compose -f C:/project/compose.yaml up
# 或者
cd C:\project
docker compose up
```

### 问题 3：权限问题

**症状：** 无法创建文件或访问卷

**解决方案：**
```powershell
# 以管理员身份运行 PowerShell
# 或在 Docker Desktop 设置中授予文件共享权限
```

### 问题 4：WSL 2 磁盘空间占用

**清理 Docker 资源：**
```powershell
# 删除未使用的镜像
docker image prune -a

# 删除未使用的卷
docker volume prune

# 删除所有未使用的资源
docker system prune -a --volumes

# 优化 WSL 2 虚拟磁盘
wsl --shutdown
# 然后在 PowerShell 中：
Optimize-VHD -Path "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx" -Mode Full
```

### 问题 5：端口被占用

```powershell
# 查看端口占用
netstat -ano | findstr :3000
netstat -ano | findstr :9000
netstat -ano | findstr :5432

# 杀死占用端口的进程
taskkill /PID <进程ID> /F
```

### 问题 6：Docker Desktop 启动失败

**解决步骤：**
1. 确保 WSL 2 已正确安装
2. 重启 Docker Desktop
3. 检查 Windows 更新
4. 重启电脑

```powershell
# 重置 Docker Desktop
# 设置 → Troubleshoot → Reset to factory defaults
```

## ⚙️ 性能优化建议

### 1. 启用 WSL 2 集成
- Docker Desktop → Settings → Resources → WSL Integration
- 启用所需的 WSL 发行版

### 2. 调整资源限制
```powershell
# 编辑 %USERPROFILE%\.wslconfig
notepad $env:USERPROFILE\.wslconfig
```

添加内容：
```ini
[wsl2]
memory=4GB
processors=2
swap=2GB
```

### 3. 将项目放在 WSL 文件系统中（最佳性能）
```bash
# 在 WSL 2 中
cd ~
git clone <your-repo>
cd hotel-management
docker compose up -d
```

## 🔐 防火墙配置

如果遇到网络问题，可能需要配置防火墙：

```powershell
# 允许 Docker 通过防火墙（以管理员身份运行）
New-NetFirewallRule -DisplayName "Docker Desktop" -Direction Inbound -Action Allow
New-NetFirewallRule -DisplayName "Docker Desktop" -Direction Outbound -Action Allow
```

## 📊 监控资源使用

```powershell
# 查看容器资源使用
docker stats

# 查看 WSL 2 资源使用
wsl --list --verbose
```

## 🆘 获取帮助

### Docker Desktop 日志位置
```
C:\Users\<用户名>\AppData\Local\Docker\log.txt
```

### WSL 2 日志
```powershell
# 查看 WSL 状态
wsl --status

# 查看已安装的发行版
wsl --list --verbose
```

### 常见命令对照表

| Linux/Mac | Windows PowerShell | 说明 |
|-----------|-------------------|------|
| `ls` | `dir` 或 `ls` | 列出文件 |
| `cat file.txt` | `Get-Content file.txt` | 查看文件 |
| `rm file.txt` | `Remove-Item file.txt` | 删除文件 |
| `clear` | `cls` | 清屏 |
| `pwd` | `pwd` | 当前目录 |

## 🎯 快速启动脚本

创建 `start.ps1`（PowerShell 脚本）：
```powershell
# start.ps1
Write-Host "启动酒店管理系统..." -ForegroundColor Green

# 检查 Docker 是否运行
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "Docker 未运行，请启动 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 启动服务
docker compose up -d

# 等待服务就绪
Write-Host "等待服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 显示状态
docker compose ps

Write-Host "`n服务已启动！" -ForegroundColor Green
Write-Host "前端: http://localhost:9000" -ForegroundColor Cyan
Write-Host "后端: http://localhost:3000" -ForegroundColor Cyan
```

使用方法：
```powershell
# 右键 → 使用 PowerShell 运行
# 或在 PowerShell 中：
.\start.ps1
```

## 📱 推荐工具

- **Windows Terminal** - 现代化终端（支持标签页）
- **VS Code** - 代码编辑器（内置 Docker 支持）
- **Docker Desktop Dashboard** - 可视化管理容器

## 🎓 学习资源

- [Docker Desktop for Windows 官方文档](https://docs.docker.com/desktop/windows/)
- [WSL 2 文档](https://docs.microsoft.com/zh-cn/windows/wsl/)
- [Docker Compose 文档](https://docs.docker.com/compose/)

## ✅ 检查清单

启动前确保：
- [ ] Docker Desktop 已安装并运行
- [ ] WSL 2 已启用
- [ ] 虚拟化已启用
- [ ] 项目文件中没有 CRLF 行尾符问题
- [ ] 端口 3000, 5432, 6379, 9000 未被占用
- [ ] 有足够的磁盘空间（至少 10GB）

## 🎉 成功标志

如果看到以下输出，说明部署成功：
```
NAME                          STATUS
hotel-management-backend-1    Up (healthy)
hotel-management-frontend-1   Up
hotel-management-postgres-1   Up (healthy)
hotel-management-redis-1      Up
```

然后访问 http://localhost:9000 即可使用系统！
