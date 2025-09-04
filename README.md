# Weex Volume Bot - JavaScript Console Tools

## Introduction

This toolkit provides JavaScript scripts that run in the browser console to automatically generate trading volume on Weex exchange. The scripts work directly with the Weex user interface and do not require API keys.

## Referral Bonus
Join Weex today using my invitation link: https://weex.com/register?vipCode=26pyu
By registering through this link, both you and I can earn up to 260 USDT in futures trading bonuses once you complete simple tasks. It’s a great way to start trading with extra rewards!

## Versions

**weex_console_bot_v3.js** - Latest version with significant reliability improvements

## New Features in v3

- Improved Flash Close button detection
- Better asynchronous handling with Promises and async/await
- Added error checking system and automatic retry mechanism
- Easy configuration with CONFIG object
- Advanced debugging features

## Usage Guide

### 1. Preparation

1. Log in to your Weex account
2. Navigate to the BTC-USDT Futures trading page (https://www.weex.com/futures/BTC-USDT)
3. Make sure you have set the leverage to 50x
4. Make sure to switch to market order type
5. Ensure you have sufficient USDT balance in your account
6. When opening the first order and a popup appears, check the box to not show again and close it

### 2. Running the Bot Script

1. Open Developer Tools (F12 or Right-click > Inspect)
2. Switch to the Console tab
3. Copy the entire content of one of the following files and paste it into the console:
   - `weex_console_bot_v3.js`
4. Press Enter to execute the script

### 3. Controlling the Bot

After the script is loaded, you can use the following commands in the console:

```javascript
// Start the bot
weexBot.start();

// Display current status
weexBot.status();

// Stop the bot (will close any open position before stopping)
weexBot.stop();

// Change configuration (only in v3)
weexBot.config.setAmount(20);     // Set position amount to 20 USDT
weexBot.config.setHoldTime(3);    // Set position hold time to 3 minutes
```


### In weex_console_bot_v3.js

```javascript
const CONFIG = {
    symbol: 'BTC-USDT',
    leverage: 50,           // Leverage (needs to be set manually in the UI)
    positionAmount: 10,     // Amount per order (USD)
    holdTime: 5 * 60 * 1000, // Position hold time (ms)
    volumeTarget: 1000000    // Target volume
};
```

## Important Notes

- This script interacts directly with Weex's UI, so it's sensitive to interface changes
- Always start with small amounts to test before increasing the amount
- Don't log in on multiple tabs/devices simultaneously while running the bot
