@echo off
:: ============================================================
:: dev-reset.cmd — ActivoPOS Dev Cache Reset
:: Doble click desde Windows Explorer o llamar desde cualquier terminal
:: ============================================================

title ActivoPOS — Dev Reset

powershell -ExecutionPolicy Bypass -File "%~dp0dev-reset.ps1"

:: Si PowerShell terminó con error, pausar para ver el mensaje
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Ocurrió un error. Revisa el mensaje arriba.
    pause
)
