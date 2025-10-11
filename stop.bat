@echo off
chcp 65001 >nul
echo.
echo ╔═══════════════════════════════════════╗
echo ║     酒店管理系统 - 停止服务          ║
echo ╚═══════════════════════════════════════╝
echo.

echo [信息] 停止所有服务...
docker compose down

if errorlevel 1 (
    echo.
    echo [错误] 停止失败
    pause
    exit /b 1
)

echo.
echo [成功] 所有服务已停止
echo.
pause
