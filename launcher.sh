#!/bin/bash
# launcher.sh
# 
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd /
cd $DIR
echo "DeadLast Server is running. Press CTL+C on this window to stop server"
python LCD.py
