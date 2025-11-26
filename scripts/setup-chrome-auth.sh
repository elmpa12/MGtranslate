#!/bin/bash
# MGtranslate Chrome Authentication Setup
# Run this script to authenticate Google account with the correct Chrome flags

PROFILE_DIR="/home/scalp/MGtranslate/poc/meet-audio-capture/session/chrome-profile"

echo "============================================"
echo "  MGtranslate Chrome Authentication Setup"
echo "============================================"
echo ""
echo "This will open Chrome with the same flags used by the bot."
echo "Please log in to Google (mgtranslate58@gmail.com) and then close Chrome."
echo ""
echo "Press Enter to continue..."
read

# Kill any existing Chrome instances using this profile
pkill -9 chrome 2>/dev/null
rm -f "$PROFILE_DIR/SingletonLock" 2>/dev/null

# Launch Chrome with the same flags as the bot
google-chrome \
  --user-data-dir="$PROFILE_DIR" \
  --no-sandbox \
  --disable-setuid-sandbox \
  --use-fake-ui-for-media-stream \
  --use-fake-device-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --disable-blink-features=AutomationControlled \
  --disable-infobars \
  --password-store=basic \
  --disable-features=LockProfileCookieDatabase \
  "https://accounts.google.com"

echo ""
echo "Chrome closed. Testing authentication..."
echo ""

# Check if login was successful
if grep -q "mgtranslate58@gmail.com" "$PROFILE_DIR/Default/Preferences" 2>/dev/null; then
  echo "SUCCESS! Google account is authenticated."
  echo "You can now use the bot."
else
  echo "WARNING: Could not verify authentication."
  echo "Please run this script again and make sure to log in."
fi
