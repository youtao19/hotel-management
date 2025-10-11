# 酒店管理系统 - Windows 启动脚本
# PowerShell 脚本

param(
    [switch]$Reset,
    [switch]$Stop,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# 检查 Docker 是否运行
function Test-Docker {
    Write-ColorOutput "检查 Docker 状态..." "Yellow"
    try {
        $null = docker info 2>&1
        Write-ColorOutput "✓ Docker 正在运行" "Green"
        return $true
    }
    catch {
        Write-ColorOutput "✗ Docker 未运行，请启动 Docker Desktop" "Red"
        Write-ColorOutput "  下载地址: https://www.docker.com/products/docker-desktop" "Cyan"
        return $false
    }
}

# 停止服务
function Stop-Services {
    Write-ColorOutput "`n停止所有服务..." "Yellow"
    docker compose down
    Write-ColorOutput "✓ 服务已停止" "Green"
}

# 重置服务（删除数据）
function Reset-Services {
    Write-ColorOutput "`n⚠️  警告: 这将删除所有数据!" "Red"
    $confirm = Read-Host "确定要继续吗? (yes/no)"
    if ($confirm -eq "yes") {
        Write-ColorOutput "停止服务并删除数据卷..." "Yellow"
        docker compose down -v
        Write-ColorOutput "✓ 数据已清除" "Green"
    }
    else {
        Write-ColorOutput "操作已取消" "Yellow"
        exit 0
    }
}

# 启动服务
function Start-Services {
    Write-ColorOutput "`n启动酒店管理系统..." "Green"
    Write-ColorOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"
    
    # 启动服务
    docker compose up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "`n✗ 启动失败，请检查错误信息" "Red"
        exit 1
    }
    
    # 等待服务就绪
    Write-ColorOutput "`n等待服务就绪..." "Yellow"
    Start-Sleep -Seconds 8
    
    # 显示服务状态
    Write-ColorOutput "`n服务状态:" "Cyan"
    docker compose ps
    
    # 显示访问地址
    Write-ColorOutput "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"
    Write-ColorOutput "✓ 服务启动成功!" "Green"
    Write-ColorOutput "`n访问地址:" "Cyan"
    Write-ColorOutput "  前端应用: http://localhost:9000" "White"
    Write-ColorOutput "  后端 API: http://localhost:3000" "White"
    Write-ColorOutput "  数据库:   localhost:5432" "White"
    Write-ColorOutput "  Redis:    localhost:6379" "White"
    Write-ColorOutput "`n常用命令:" "Cyan"
    Write-ColorOutput "  查看日志: .\start.ps1 -Logs" "White"
    Write-ColorOutput "  停止服务: .\start.ps1 -Stop" "White"
    Write-ColorOutput "  重置数据: .\start.ps1 -Reset" "White"
    Write-ColorOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Gray"
}

# 查看日志
function Show-Logs {
    Write-ColorOutput "查看服务日志 (Ctrl+C 退出)..." "Yellow"
    docker compose logs -f
}

# 主逻辑
Write-ColorOutput @"
╔═══════════════════════════════════════╗
║     酒店管理系统 - Docker 管理工具    ║
╚═══════════════════════════════════════╝
"@ "Cyan"

# 检查 Docker
if (-not (Test-Docker)) {
    exit 1
}

# 根据参数执行操作
if ($Stop) {
    Stop-Services
}
elseif ($Reset) {
    Reset-Services
    Start-Services
}
elseif ($Logs) {
    Show-Logs
}
else {
    Start-Services
}
