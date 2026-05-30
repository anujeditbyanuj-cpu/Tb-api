#!/bin/bash

# ==========================================
# 🎌 ANIME BOT - VPS SETUP
# Run this first, then run bot.py
# ==========================================

echo ""
echo "==========================================="
echo "🎌 ANIME AUTO DOWNLOADER - VPS SETUP"
echo "==========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  Running without root. Some commands may need sudo.${NC}"
fi

echo -e "${YELLOW}📦 Step 1: Updating System...${NC}"
sudo apt update -qq
sudo apt upgrade -y -qq
echo -e "${GREEN}✅ System Updated${NC}"

echo ""
echo -e "${YELLOW}📦 Step 2: Installing Basic Dependencies...${NC}"
sudo apt install -y -qq wget curl unzip gnupg2 software-properties-common
echo -e "${GREEN}✅ Basic Dependencies Installed${NC}"

echo ""
echo -e "${YELLOW}📦 Step 3: Installing Python3 & Pip...${NC}"
sudo apt install -y -qq python3 python3-pip python3-venv
echo -e "${GREEN}✅ Python Installed${NC}"

echo ""
echo -e "${YELLOW}📦 Step 4: Installing FFmpeg...${NC}"
sudo apt install -y -qq ffmpeg
echo -e "${GREEN}✅ FFmpeg Installed${NC}"

echo ""
echo -e "${YELLOW}📦 Step 5: Installing Aria2...${NC}"
sudo apt install -y -qq aria2
echo -e "${GREEN}✅ Aria2 Installed${NC}"

echo ""
echo -e "${YELLOW}📦 Step 6: Installing Google Chrome...${NC}"
if ! command -v google-chrome &> /dev/null; then
    wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo apt install -y -qq /tmp/chrome.deb
    rm /tmp/chrome.deb
    echo -e "${GREEN}✅ Chrome Installed${NC}"
else
    echo -e "${GREEN}✅ Chrome Already Installed${NC}"
fi

echo ""
echo -e "${YELLOW}📦 Step 7: Creating Python Virtual Environment...${NC}"
python3 -m venv venv
source venv/bin/activate
echo -e "${GREEN}✅ Virtual Environment Created${NC}"

echo ""
echo -e "${YELLOW}📦 Step 8: Installing Python Packages...${NC}"
pip install --upgrade pip -q
pip install pyrogram tgcrypto -q
pip install selenium webdriver-manager -q
pip install requests beautifulsoup4 -q
pip install psutil nest-asyncio -q
echo -e "${GREEN}✅ Python Packages Installed${NC}"

echo ""
echo -e "${YELLOW}📦 Step 9: Creating Directories...${NC}"
mkdir -p downloads thumbnails database workers
echo -e "${GREEN}✅ Directories Created${NC}"

echo ""
echo "==========================================="
echo -e "${GREEN}🎉 SETUP COMPLETE!${NC}"
echo "==========================================="
echo ""
echo -e "📂 Created Folders:"
echo -e "   • downloads/"
echo -e "   • thumbnails/"
echo -e "   • database/"
echo -e "   • workers/"
echo ""
echo -e "${YELLOW}👉 Next Steps:${NC}"
echo -e "   1. source venv/bin/activate"
echo -e "   2. python3 bot.py"
echo ""
echo "==========================================="
