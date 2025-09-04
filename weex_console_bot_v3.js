// Weex Console Volume Bot - Simplified Version
// Focus on reliability of number parsing and button detection

(function() {
    // --- CONFIGURATION ---
    const CONFIG = {
        symbol: 'BTC-USDT',
        leverage: 50,           // This needs to be set manually on the UI
        positionAmount: 15000,     // Starting with a small Volume for testing
        holdTime: 0,            // Will be set randomly each time a position is opened
        holdTimeMin: 6 * 60 * 1000, // Minimum 6 minutes
        holdTimeMax: 7 * 60 * 1000, // Maximum 7 minutes
        volumeTarget: 50000000,    // Target volume
        orderType: 'long_only',  // Can be: 'long_only', 'short_only', 'long_and_short'
        lastOrderType: null      // To track the last order type placed
    };

    // --- STATE ---
    const STATE = {
        running: false,
        totalVolume: 0,
        currentPosition: null,
        intervalId: null,
        errors: {
            balanceErrors: 0,
            buttonErrors: 0
        }
    };

    // --- SELECTORS ---
    const SELECTORS = {
        // Market order controls
        marketOrderButton: '[data-test-id="operation-order-type-lightning"]', 
        amountInput: '[data-test-id="operation-input-amount"]',
        openLongButton: '[data-test-id="operation-button-do-order-buy"]',
        openShortButton: '[data-test-id="operation-button-do-order-sell"]', // Added selector for short button
        
        // Position management
        flashCloseButton: '.position-block__input-block-pro .btns.el-tooltip',
        positionStatus: '.position-info', // For checking if position exists
        positionAmount: '.position-block__key-value .key-wrapper:contains("Amount") + .value', // Selector for Amount in position
        
        // Balance and account info
        availableBalance: '.value.align-center .text-secondary'
    };

    // --- HELPER FUNCTIONS ---
    const log = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        let color = 'white';
        if (type === 'info') color = 'lightblue';
        if (type === 'success') color = 'lightgreen';
        if (type === 'warn') color = 'yellow';
        if (type === 'error') color = 'red';
        console.log(`%c[${timestamp}] ${message}`, `color: ${color}; font-weight: bold;`);
    };

    // Find element with better error handling and logging
    const findElement = (selector, textContent = null, timeout = 2000) => {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            // Function to attempt finding the element
            const attemptFind = () => {
                try {
                    // First try direct selector
                    const elements = document.querySelectorAll(selector);
                    
                    // If no text content requirement, return first match
                    if (!textContent && elements.length > 0) {
                        log(`Found element using selector: ${selector}`, 'success');
                        return resolve(elements[0]);
                    }
                    
                    // If text content required, check each element
                    for (const el of elements) {
                        if (el.textContent && el.textContent.trim().includes(textContent)) {
                            log(`Found element with text "${textContent}"`, 'success');
                            return resolve(el);
                        }
                    }
                    
                    // If we haven't found a match and haven't timed out, try again
                    if (Date.now() - startTime < timeout) {
                        setTimeout(attemptFind, 100);
                    } else {
                        log(`Element not found: ${selector} ${textContent ? `with text "${textContent}"` : ''}`, 'warn');
                        resolve(null);
                    }
                } catch (error) {
                    log(`Error finding element: ${error.message}`, 'error');
                    resolve(null);
                }
            };
            
            // Start the search
            attemptFind();
        });
    };

    // Parse number with US format support
    const parseNumberValue = (text) => {
        if (!text) return null;
        
        // Clean up the text - remove currency symbols and whitespace
        let cleanText = text.replace(/[^\d.,]/g, '').trim();
        log(`Parsing number from: "${text}" -> cleaned: "${cleanText}"`, 'info');
        
        try {
            let usFormatted = cleanText.replace(/,/g, '');
            let value = parseFloat(usFormatted);
            
            if (!isNaN(value)) {
                log(`Successfully parsed as US format: ${value}`, 'success');
                return value;
            } else {
                log(`Failed to parse "${cleanText}" as number`, 'error');
                return null;
            }
        } catch (e) {
            log(`Error parsing number: ${e.message}`, 'error');
            return null;
        }
    };

    // Get available balance with error retry
    const getAvailableBalance = async (retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const balanceElement = await findElement(SELECTORS.availableBalance);
                if (!balanceElement) {
                    log(`Balance element not found (attempt ${attempt}/${retries})`, 'warn');
                    if (attempt === retries) {
                        STATE.errors.balanceErrors++;
                    }
                    continue;
                }

                const balanceText = balanceElement.innerText || balanceElement.textContent;
                log(`Raw balance text: "${balanceText}"`, 'info');
                
                const balance = parseNumberValue(balanceText);
                if (balance !== null) {
                    return balance;
                }
                
                log(`Could not parse balance from "${balanceText}" (attempt ${attempt}/${retries})`, 'warn');
            } catch (e) {
                log(`Error getting balance (attempt ${attempt}/${retries}): ${e.message}`, 'error');
            }
            
            // Wait before next retry
            await new Promise(r => setTimeout(r, 500));
        }
        
        log(`Failed to get available balance after ${retries} attempts`, 'error');
        return null;
    };

    // Find Flash close button with multiple strategies
    const findFlashCloseButton = async () => {
        log('Looking for Flash close button...', 'info');
        
        // Strategy 1: Try primary selector with text
        let button = await findElement(SELECTORS.flashCloseButton, 'Flash close');
        if (button) return button;
        
        // Strategy 2: Try various selectors that might contain the Flash close button
        const alternativeSelectors = [
            '[data-v-24630492][data-v-70047c39].btns.el-tooltip[tabindex="0"]',
            '.position-block__input-block-pro .btns.el-tooltip',
            '.el-tooltip.black.btn32',
            '.btns',
            '.btn32'
        ];
        
        for (const selector of alternativeSelectors) {
            button = await findElement(selector, 'Flash close');
            if (button) return button;
        }
        
        // Strategy 3: Find any button with exact text "Flash close"
        const allButtons = document.querySelectorAll('button, [role="button"], .btn, .btns, .button, .el-tooltip');
        for (const btn of allButtons) {
            if (btn.textContent && btn.textContent.trim() === 'Flash close') {
                log('Found button with exact text "Flash close"', 'success');
                return btn;
            }
        }
        
        log('Could not find Flash close button', 'error');
        STATE.errors.buttonErrors++;
        return null;
    };

    // Select next order type (long or short) based on configuration and previous order
    const getNextOrderType = () => {
        if (CONFIG.orderType === 'long_only') {
            return 'open_long';
        } else if (CONFIG.orderType === 'short_only') {
            return 'open_short';
        } else {
            // If long_and_short, alternate from previous order
            if (CONFIG.lastOrderType === 'open_long') {
                return 'open_short';
            } else if (CONFIG.lastOrderType === 'open_short') {
                return 'open_long';
            } else {
                // If it's the first order, start with long
                return 'open_long';
            }
        }
    };

    // Place order (open or close) with improved reliability
    const placeOrder = async (type) => {
        log(`Attempting to place ${type} order...`, 'info');
        
        try {
            // For open orders (long or short), check balance first
            if (type === 'open_long' || type === 'open_short') {
                const availableBalance = await getAvailableBalance();
                if (availableBalance === null) {
                    log('Could not determine available balance', 'error');
                    return false;
                }
                
                const requiredMargin = CONFIG.positionAmount / CONFIG.leverage;
                
                if (availableBalance < requiredMargin) {
                    log(`Insufficient balance: ${availableBalance} USDT < ${requiredMargin.toFixed(2)} USDT required (${CONFIG.positionAmount} USDT with leverage ${CONFIG.leverage}x)`, 'error');
                    stopBot();
                    return false;
                }
                
                log(`Available Balance: ${availableBalance} USDT (required: ${requiredMargin.toFixed(2)} USDT with leverage ${CONFIG.leverage}x)`, 'success');
                
                // 1. Click Market Order type
                const marketOrderButton = await findElement(SELECTORS.marketOrderButton);
                if (!marketOrderButton) {
                    log('Market order button not found', 'error');
                    return false;
                }
                marketOrderButton.click();
                log('Clicked market order button', 'info');
                
                // 2. Set amount in USDT
                const amountInput = await findElement(SELECTORS.amountInput);
                if (!amountInput) {
                    log('Amount input not found', 'error');
                    return false;
                }
                
                amountInput.value = CONFIG.positionAmount.toString();
                amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                amountInput.dispatchEvent(new Event('change', { bubbles: true }));
                log(`Set amount: ${CONFIG.positionAmount} USDT`, 'info');
                
                // 3. Click Open Long or Open Short button depending on type
                let orderButton;
                if (type === 'open_long') {
                    orderButton = await findElement(SELECTORS.openLongButton);
                    if (!orderButton) {
                        log('Open Long button not found', 'error');
                        return false;
                    }
                    log('Clicked Open Long button', 'success');
                } else { // open_short
                    orderButton = await findElement(SELECTORS.openShortButton);
                    if (!orderButton) {
                        log('Open Short button not found', 'error');
                        return false;
                    }
                    log('Clicked Open Short button', 'success');
                }
                
                orderButton.click();
                
                // Generate random hold time for position
                const randomHoldTime = Math.floor(
                    CONFIG.holdTimeMin + Math.random() * (CONFIG.holdTimeMax - CONFIG.holdTimeMin)
                );
                const holdTimeMinutes = (randomHoldTime / (60 * 1000)).toFixed(1);
                
                // Calculate volume with new formula: volume = 2 * amount
                const positionVolume = CONFIG.positionAmount * 2;
                
                // Update state
                STATE.currentPosition = {
                    orderId: `ORDER_${Date.now()}`,
                    openTime: Date.now(),
                    amount: CONFIG.positionAmount,
                    volume: positionVolume,
                    holdTime: randomHoldTime,
                    orderType: type // Save order type (long/short)
                };
                
                CONFIG.lastOrderType = type;
                
                STATE.totalVolume += STATE.currentPosition.volume;
                log(`Position opened (${type.replace('open_', '')}). Volume: ${STATE.currentPosition.volume} USD, will hold for ${holdTimeMinutes} minutes`, 'success');
                return true;
                
            } else if (type === 'close_position' || type === 'close_long') {
                // Find and click Flash close button
                const flashCloseButton = await findFlashCloseButton();
                if (!flashCloseButton) {
                    log('Flash close button not found', 'error');
                    return false;
                }
                
                flashCloseButton.click();
                log('Clicked Flash close button', 'success');
                
                // Update volume (position was closed)
                if (STATE.currentPosition) {
                    const positionType = STATE.currentPosition.orderType ? STATE.currentPosition.orderType.replace('open_', '') : 'unknown';
                    STATE.totalVolume += STATE.currentPosition.volume;
                    log(`Position closed (${positionType}). Total Volume: $${STATE.totalVolume.toLocaleString()} / $${CONFIG.volumeTarget.toLocaleString()}`, 'success');
                    STATE.currentPosition = null;
                    return true;
                } else {
                    log('Warning: No current position data found while closing', 'warn');
                    return false;
                }
            }
            
        } catch (error) {
            log(`Error during ${type} order: ${error.message}`, 'error');
            return false;
        }
    };

    // Main bot cycle with improved error handling
    const botCycle = async () => {
        try {
            
            if (!STATE.currentPosition) {
                // No open position, open a new one based on configured strategy
                const nextOrderType = getNextOrderType();
                log(`No open position. Opening new ${nextOrderType.replace('open_', '')} position...`);
                await placeOrder(nextOrderType);
            } else {
                // Position is open, check hold time
                const elapsedTime = Date.now() - STATE.currentPosition.openTime;
                const positionHoldTime = STATE.currentPosition.holdTime || CONFIG.holdTimeMin; 
                const positionType = STATE.currentPosition.orderType ? STATE.currentPosition.orderType.replace('open_', '') : 'unknown';
                
                if (elapsedTime >= positionHoldTime) {
                    log(`Hold time reached (${(positionHoldTime/60000).toFixed(1)} minutes). Closing ${positionType} position...`);
                    
                    const closed = await placeOrder('close_position');
                    if (closed) {
                        // Wait for position to close then open new one
                        setTimeout(async () => {
                            const nextOrderType = getNextOrderType();
                            log(`Opening new ${nextOrderType.replace('open_', '')} position after successful close`, 'info');
                            await placeOrder(nextOrderType);
                        }, 1000);
                    } else {
                        log('Failed to close position. Will retry in next cycle.', 'error');
                    }
                } else {
                    const remainingSeconds = Math.round((positionHoldTime - elapsedTime) / 1000);
                    log(`${positionType.toUpperCase()} position open. Remaining hold time: ${remainingSeconds}s. Current Volume: $${STATE.totalVolume.toLocaleString()}`);
                }
            }
        } catch (error) {
            log(`Error in bot cycle: ${error.message}`, 'error');
        }
    };

    // Start the bot
    const startBot = async () => {
        if (STATE.running) {
            log('Bot is already running', 'warn');
            return;
        }
        
        log('Starting Weex Volume Bot...', 'info');
        
        // Check balance before starting
        const availableBalance = await getAvailableBalance();
        if (availableBalance === null) {
            log('Could not determine available balance. Check if you are on the correct page.', 'error');
            return;
        }
        
        // Tính toán margin thực sự cần thiết (positionAmount / leverage)
        const requiredMargin = CONFIG.positionAmount / CONFIG.leverage;
        
        if (availableBalance < requiredMargin) {
            log(`Insufficient balance: ${availableBalance} USDT < ${requiredMargin.toFixed(2)} Required USDT (${CONFIG.positionAmount} USDT with leverage ${CONFIG.leverage}x)`, 'error');
            return;
        }
        
        // Reset state
        STATE.running = true;
        STATE.errors = { balanceErrors: 0, buttonErrors: 0 };
        
        log(`Starting bot with available balance: ${availableBalance} USDT`, 'success');
        log(`Configuration: ${CONFIG.symbol}, leverage: ${CONFIG.leverage}x, amount: ${CONFIG.positionAmount} USDT`);
        log(`Hold time: ${CONFIG.holdTime / 1000} seconds, Target volume: $${CONFIG.volumeTarget.toLocaleString()}`);
        
        // Run the cycle every 2 seconds
        STATE.intervalId = setInterval(botCycle, 2000);
    };

    // Stop the bot
    const stopBot = async () => {
        if (!STATE.running) {
            log('Bot is not running', 'warn');
            return;
        }
        
        log('Stopping bot...', 'info');
        clearInterval(STATE.intervalId);
        STATE.running = false;
        
        // Try to close any open position
        if (STATE.currentPosition) {
            const positionType = STATE.currentPosition.orderType ? STATE.currentPosition.orderType.replace('open_', '') : 'unknown';
            log(`Attempting to close final ${positionType} position...`, 'warn');
            await placeOrder('close_position');
        }
        
        log(`Bot stopped. Final stats:`, 'info');
        log(`Total volume: $${STATE.totalVolume.toLocaleString()}`, 'success');
        log(`Balance errors: ${STATE.errors.balanceErrors}, Button errors: ${STATE.errors.buttonErrors}`, 'info');
    };

    // Debug function to manually test Flash close button
    const testFlashCloseButton = async () => {
        log('Testing Flash close button detection...', 'warn');
        const button = await findFlashCloseButton();
        
        if (button) {
            log(`Found Flash close button: ${button.outerHTML}`, 'success');
            return true;
        } else {
            // Scan all buttons for debugging
            const allButtons = document.querySelectorAll('button, [role="button"], .btn, .btns, .button');
            log(`Scanning ${allButtons.length} potential buttons...`, 'info');
            
            let foundRelevantButtons = false;
            for (const btn of allButtons) {
                if (btn.textContent && (
                    btn.textContent.toLowerCase().includes('close') || 
                    btn.textContent.toLowerCase().includes('flash')
                )) {
                    foundRelevantButtons = true;
                    log(`Potential button: "${btn.textContent.trim()}" | HTML: ${btn.outerHTML}`, 'info');
                }
            }
            
            if (!foundRelevantButtons) {
                log('No relevant buttons found with "close" or "flash" text', 'error');
            }
            
            return false;
        }
    };

    // Expose bot controls to global scope
    window.weexBot = {
        start: startBot,
        stop: stopBot,
        status: () => {
            log(`Bot running: ${STATE.running}`, 'info');
            log(`Total volume: $${STATE.totalVolume.toLocaleString()} USDT (${((STATE.totalVolume/CONFIG.volumeTarget)*100).toFixed(2)}% của target)`, 'info');
            
            if (STATE.currentPosition) {
                const elapsedTime = Date.now() - STATE.currentPosition.openTime;
                const positionHoldTime = STATE.currentPosition.holdTime || CONFIG.holdTimeMin;
                const remainingSeconds = Math.round((positionHoldTime - elapsedTime) / 1000);
                const totalHoldMins = (positionHoldTime / 60000).toFixed(1);
                
                log(`Current position: ${STATE.currentPosition.amount} USDT, opened ${Math.round(elapsedTime/1000)}s ago`, 'info');
                log(`Holding position for: ${totalHoldMins} minutes, remaining: ${remainingSeconds}s`, 'info');
            } else {
                log('No current position', 'info');
            }
            
            getAvailableBalance().then(balance => {
                if (balance !== null) {
                    log(`Available balance: ${balance} USDT`, 'success');
                }
            });
        },
        config: {
            setAmount: (amount) => {
                CONFIG.positionAmount = amount;
                log(`Position amount set to ${amount} USDT`, 'info');
            },
            setHoldTime: (minMinutes, maxMinutes) => {
                if (maxMinutes === undefined) {
                    CONFIG.holdTimeMin = minMinutes * 60 * 1000;
                    CONFIG.holdTimeMax = minMinutes * 60 * 1000;
                    log(`Hold time set to fixed ${minMinutes} minutes`, 'info');
                } else {
                    CONFIG.holdTimeMin = minMinutes * 60 * 1000;
                    CONFIG.holdTimeMax = maxMinutes * 60 * 1000;
                    log(`Hold time set to random ${minMinutes}-${maxMinutes} minutes`, 'info');
                }
            },
            setOrderType: (type) => {
                if (['long_only', 'short_only', 'long_and_short'].includes(type)) {
                    CONFIG.orderType = type;
                    log(`Order type set to: ${type}`, 'success');
                } else {
                    log(`Invalid order type. Valid options are: long_only, short_only, long_and_short`, 'error');
                }
            }
        },
        debug: {
            testCloseButton: testFlashCloseButton,
            getBalance: getAvailableBalance
        }
    };

    // Display welcome message
    log('Weex Volume Bot v3.0 loaded', 'success');
    log('Use weexBot.start() to begin trading', 'info');
    log('Use weexBot.stop() to stop the bot', 'info');
    log('Use weexBot.status() to check current status', 'info');
})();
