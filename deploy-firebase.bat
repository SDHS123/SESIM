@echo off
chcp 65001 > nul
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"

echo ========================================================
echo  2026-2027 세심제 (SESIM) - 파이어베이스 호스팅 배포
echo  프로젝트: sesim-70a8b
echo ========================================================
echo.

echo [1/2] 파이어베이스 로그인 상태 확인 중...
call firebase.cmd login

echo.
echo [2/2] 세심제 웹사이트 호스팅 배포 시작...
call firebase.cmd deploy --only hosting

echo.
echo ========================================================
echo  배포 완료! 브라우저에서 https://sesim-70a8b.web.app 로 접속해보세요.
echo ========================================================
pause
