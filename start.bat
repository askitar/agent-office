@echo off
title Oficina de Agentes
cd /d "%~dp0"
start "" "http://localhost:4780"
node server.js
