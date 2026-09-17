@echo off
setlocal

set "ORIGEM=C:\Projetos\runescodexgit\apps\mobile\assets\criatures"
set "DESTINO=C:\Projetos\runescodexgit\apps\mobile\assets\runescodex\creatures"

if not exist "%DESTINO%" mkdir "%DESTINO%"

echo.
echo ==========================================
echo   MOVENDO CRIATURAS
echo ==========================================
echo.
echo Origem:
echo %ORIGEM%
echo.
echo Destino:
echo %DESTINO%
echo.

for /r "%ORIGEM%" %%F in (*) do (
    if not exist "%DESTINO%\%%~nxF" (
        echo Movendo: %%~nxF
        move "%%F" "%DESTINO%\" >nul
    ) else (
        echo JA EXISTE: %%~nxF
    )
)

echo.
echo ==========================================
echo   CONCLUIDO
echo ==========================================
echo.
pause