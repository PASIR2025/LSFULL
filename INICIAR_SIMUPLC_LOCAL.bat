@echo off
setlocal
cd /d "%~dp0"
echo.
echo SimuPLC se abrira en http://localhost:8080
echo No cierres esta ventana mientras uses la conexion USB.
echo.
start "" http://localhost:8080/index.html
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8080 --bind 127.0.0.1
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8080 --bind 127.0.0.1
  goto :eof
)
echo No se encontro Python. Publica la carpeta mediante HTTPS o instala Python para usar localhost.
pause
