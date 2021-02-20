#!/usr/bin/env python
"""first please add python library via this command: python -m easy_install --user https://github.com/pl31/python-liquidcrystal_i2c/archive/master.zip """
import socket
import os.path
import sys
import struct
import fcntl
import os
import time
import liquidcrystal_i2c
import requests
import subprocess

time.sleep(10)
efg = "0"
wfg = "0"
lcd = liquidcrystal_i2c.LiquidCrystal_I2C(0x27, 1, numlines=4)
lcd.clear()
PATH1="/sys/class/net/eth0/carrier"
PATH2 = "/sys/class/net/wlan0/carrier"
def getip(ifname):
    tt=0
    while tt<100:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            return socket.inet_ntoa(fcntl.ioctl(s.fileno(),0x8915,struct.pack('256s',ifname[:15]))[20:24])
        except:
            tt+=1
            time.sleep(1)
            if(tt>99):
                return('ERROR')
def getPublicIP():
    try:
        public_IP = requests.get("https://www.wikipedia.org").headers["X-Client-IP"]
        return public_IP
    except:
        return('ERROR')
        
attempts = 0
gotIP = 0
while attempts<999:
    attempts+=1
    public_IP = getPublicIP()
    if(public_IP == 'ERROR'):
        lcd.printline(0,'Failed to get')
        lcd.printline(1,'Public IP')
        lcd.printline(2,'Retrying now')
        lcd.printline(3,'Retry Attempts: '+str(attempts))
    else:
        attempts = 1000
        gotIP = 1
        lcd.clear()
        pstr = 'PIP:'+ public_IP
        lcd.printline(1,pstr)
        if os.path.isfile(PATH1) and os.access(PATH1, os.R_OK):
            efg = open(PATH1).read()
            if efg[0]=="1":
                pstr='LIP:'+str(getip('eth0'))
                lcd.printline(0,pstr)
            elif os.path.isfile(PATH2) and os.access(PATH2, os.R_OK):
                wfg = open(PATH2).read()
                if wfg[0]=="1":
                    pstr="LIP:"+str(getip('wlan0'))
                    lcd.printline(0,pstr)
        cwd = os.path.realpath(os.path.dirname(sys.argv[0]))
        cmd_line = "node "+cwd+"/main.js"
        p = subprocess.Popen(cmd_line, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        print p.communicate()
if(gotIP == 0):
    lcd.clear()
    lcd.printline(0,'Failed to get IP')
    lcd.printline(1,'After '+str(attempts) +' attempts')
    lcd.printline(2,"Check Pi's ")
    lcd.printline(3,'internet connection')
