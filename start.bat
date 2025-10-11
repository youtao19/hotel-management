@echo off
chcp 65001 >nul
echo.
echo ╔═══════════════════════════════════════╗
echo ║     酒店管理系统 - 快速启动工具      ║
echo ╚═══════════════════════════════════════╝
echo.

REM 检查 Docker 是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    echo.
    pause
    exit /b 1
)

echo [信息] Docker 正在运行
echo.
echo [信息] 启动服务中...
docker compose up -d

if errorlevel 1 (
    echo.
    echo [错误] 启动失败，请查看错误信息
    pause
    exit /b 1
)

echo.
echo [成功] 等待服务就绪...
timeout /t 8 /nobreak >nul

echo.
echo ════════════════════════════════════════
echo 服务状态:
echo ════════════════════════════════════════
docker compose ps

echo.
echo ════════════════════════════════════════
echo [成功] 系统启动完成！
echo.
echo 访问地址:
echo   前端应用: http://localhost:9000
echo   后端 API: http://localhost:3000
echo ════════════════════════════════════════
echo.
echo 按任意键关闭窗口...
pause >nul
