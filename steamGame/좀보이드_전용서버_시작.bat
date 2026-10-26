@echo off
rem Starts the Project Zomboid dedicated server with the "Playing Server" save.
rem To stop it, type quit in this window and press Enter. Closing the window may skip the save.
rem Memory: 4 GB minimum, 6 GB maximum (the stock script asks for 16 GB, too much for this PC).
setlocal enableextensions
cd /d "C:\Program Files (x86)\Steam\steamapps\common\Project Zomboid Dedicated Server"
set PZ_CLASSPATH=java/;java/projectzomboid.jar
".\jre64\bin\java.exe" -Djava.awt.headless=true -Dzomboid.steam=1 -Dzomboid.znetlog=1 -XX:+UseZGC -XX:-CreateCoredumpOnCrash -XX:-OmitStackTraceInFastThrow -Xms4g -Xmx6g -Djava.library.path=natives/ -cp %PZ_CLASSPATH% zombie.network.GameServer -statistic 0 -servername "Playing Server"
pause
