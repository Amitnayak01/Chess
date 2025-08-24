// ========================================
// GAME EXIT & DRAW SYSTEM - FIXED VERSION
// ========================================

// Draw state
let drawOfferState = {
    sentOffer: false,
    receivedOffer: false,
    offerSender: null,
    offerTimestamp: null
};

// ========================================
// DRAW SYSTEM - FIXED
// ========================================

function sendDrawRequest() {
    if (!gameId || !playerId || !playerColor || gameOver) {
        showNotification(gameOver ? 'Cannot offer draw - game is already over' : 'Must be in a game to offer a draw', 'warning');
        return;
    }

    if (playerColor === 'spectator') {
        showNotification('Spectators cannot offer draws', 'warning');
        return;
    }

    if (drawOfferState.sentOffer) {
        showNotification('Draw offer already sent. Waiting for opponent\'s response.', 'info');
        return;
    }

    if (drawOfferState.receivedOffer) {
        acceptDrawOffer();
        return;
    }

    socket.emit('draw-request', { gameId, playerId, playerColor, timestamp: Date.now() });

    drawOfferState.sentOffer = true;
    drawOfferState.offerTimestamp = Date.now();
    
    updateDrawButtonState();
    
    // FIXED: Use custom notification instead of browser alert
    showCustomNotification('Draw offer sent to opponent', 'info');

    setTimeout(() => {
        if (drawOfferState.sentOffer && !gameOver) expireDrawOffer();
    }, 60000);
}

// ========================================
// CUSTOM NOTIFICATION SYSTEM (REPLACES BROWSER ALERTS)
// ========================================

function showCustomNotification(message, type = 'info', duration = 3000) {
    // Remove any existing notifications of the same type
    const existingNotification = document.querySelector('.custom-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const colors = {
        info: { bg: '#2196F3', icon: 'ℹ️' },
        success: { bg: '#4CAF50', icon: '✅' },
        warning: { bg: '#FF9800', icon: '⚠️' },
        error: { bg: '#F44336', icon: '❌' }
    };
    
    const config = colors[type] || colors.info;
    
    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${config.bg};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        max-width: 300px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease-in-out;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    notification.innerHTML = `
        <span style="font-size: 16px;">${config.icon}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 12px;
            margin-left: auto;
        ">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto remove
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
    
    // Remove on click
    notification.onclick = () => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    };
}

// Override the existing showNotification function to prevent browser alerts
function showNotification(message, type = 'info', duration = 3000) {
    // FIXED: Always use custom notification instead of browser alert
    showCustomNotification(message, type, duration);
}

function handleDrawRequest(data) {
    if (!data || data.playerId === playerId) return;

    drawOfferState.receivedOffer = true;
    drawOfferState.offerSender = data.playerId;
    drawOfferState.offerTimestamp = data.timestamp;

    updateDrawButtonState();
    showDrawRequestDialog(data);
}

function showDrawRequestDialog(data) {
    const modal = createDrawRequestModal();
    modal.querySelector('.draw-message').textContent = `${getSenderName(data.playerId) || 'Opponent'} offers a draw. Do you accept?`;
    modal.style.display = 'flex';
    
    setTimeout(() => {
        if (drawOfferState.receivedOffer && modal.style.display === 'flex') {
            declineDrawOffer();
            modal.style.display = 'none';
        }
    }, 30000);
}

function acceptDrawOffer() {
    if (!drawOfferState.receivedOffer) return;

    socket.emit('draw-response', { gameId, playerId, response: true, offerSender: drawOfferState.offerSender });
    hideDrawRequestModal();
    showCustomNotification('Draw offer accepted', 'success');
}

function declineDrawOffer() {
    if (!drawOfferState.receivedOffer) return;

    socket.emit('draw-response', { gameId, playerId, response: false, offerSender: drawOfferState.offerSender });
    resetDrawState();
    hideDrawRequestModal();
    showCustomNotification('Draw offer declined', 'info');
}

function handleDrawResponse(data) {
    if (!data || data.offerSender !== playerId) return;

    if (data.response === true) {
        handleDrawAccepted();
    } else {
        showCustomNotification('Draw offer declined by opponent', 'info');
        resetDrawState();
    }
}

function handleDrawAccepted() {
    gameOver = true;
    
    if (typeof stopTimer === 'function') stopTimer();
    updateGameStatusForDraw();
    if (typeof clearSelection === 'function') clearSelection();
    disableGameInteraction();
    resetDrawState();
    showGameOutcomePopup('DRAW', 'Game ended in a draw by mutual agreement');
    
    if (typeof handleGameEnd === 'function') handleGameEnd('draw');
}

function updateGameStatusForDraw() {
    const statusElement = document.getElementById('game-status');
    if (statusElement) {
        statusElement.textContent = 'Game ended in a draw by mutual agreement';
        statusElement.className = 'status draw';
    }
}

function disableGameInteraction() {
    document.querySelectorAll('.square').forEach(square => {
        square.style.pointerEvents = 'none';
        square.classList.remove('selected', 'valid-move', 'capture-move');
    });
}

function expireDrawOffer() {
    if (drawOfferState.sentOffer) {
        resetDrawState();
        showCustomNotification('Draw offer expired', 'info');
    }
}

function resetDrawState() {
    drawOfferState = { sentOffer: false, receivedOffer: false, offerSender: null, offerTimestamp: null };
    updateDrawButtonState();
}

function updateDrawButtonState() {
    const drawButton = document.getElementById('draw-button');
    if (!drawButton) return;

    drawButton.classList.remove('sent-offer', 'received-offer', 'disabled');
    
    if (gameOver) {
        drawButton.disabled = true;
        drawButton.classList.add('disabled');
        drawButton.textContent = 'Offer Draw';
        return;
    }

    if (drawOfferState.receivedOffer) {
        drawButton.classList.add('received-offer');
        drawButton.textContent = 'Accept Draw';
        drawButton.disabled = false;
    } else if (drawOfferState.sentOffer) {
        drawButton.classList.add('sent-offer');
        drawButton.textContent = 'Offer Sent...';
        drawButton.disabled = true;
    } else {
        drawButton.textContent = 'Offer Draw';
        drawButton.disabled = !playerColor || playerColor === 'spectator';
    }
}

function getSenderName(senderId) {
    if (!players) return null;
    if (players.white?.id === senderId) return players.white.name;
    if (players.black?.id === senderId) return players.black.name;
    if (spectators) {
        const spectator = spectators.find(s => s.id === senderId);
        return spectator?.name || null;
    }
    return null;
}

function createDrawRequestModal() {
    let modal = document.getElementById('draw-request-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'draw-request-modal';
    modal.style.cssText = 'display: none; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); justify-content: center; align-items: center;';

    modal.innerHTML = `
        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; text-align: center; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); min-width: 300px; max-width: 400px;">
            <p class="draw-message" style="margin-bottom: 20px; font-size: 16px; color: #333;"></p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="acceptDrawOffer()" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">Accept</button>
                <button onclick="declineDrawOffer()" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">Decline</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
}

function hideDrawRequestModal() {
    const modal = document.getElementById('draw-request-modal');
    if (modal) modal.style.display = 'none';
}

// ========================================
// PREVENT BROWSER ALERTS GLOBALLY
// ========================================

// Override window.alert to prevent any accidental browser alerts
const originalAlert = window.alert;
window.alert = function(message) {
    console.log('Alert intercepted:', message);
    showCustomNotification(message, 'info');
};

// Also override console methods that might trigger alerts in some environments
const originalLog = console.log;
console.log = function(...args) {
    // Only show notification for localhost messages
    const message = args.join(' ');
    if (message.includes('localhost') && message.includes('says')) {
        return; // Suppress this specific message
    }
    originalLog.apply(console, args);
};

// ========================================
// INITIALIZATION
// ========================================

function initializeDrawSystem() {
    // Draw button
    const drawButton = document.getElementById('draw-button');
    if (drawButton) {
        drawButton.addEventListener('click', sendDrawRequest);
        updateDrawButtonState();
    }
    
    // Initialize socket listeners for draw system
    if (typeof socket !== 'undefined' && socket) {
        socket.on('draw-request', handleDrawRequest);
        socket.on('draw-response', handleDrawResponse);
        socket.on('draw-accepted', handleDrawAccepted);
        socket.on('draw-cancelled', () => {
            resetDrawState();
            hideDrawRequestModal();
            showCustomNotification('Draw offer cancelled - opponent disconnected', 'info');
        });
    }
    
    console.log('Draw system initialized without browser alerts');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDrawSystem);
} else {
    setTimeout(initializeDrawSystem, 100);
}

// Export functions for global access
if (typeof window !== 'undefined') {
    window.sendDrawRequest = sendDrawRequest;
    window.acceptDrawOffer = acceptDrawOffer;
    window.declineDrawOffer = declineDrawOffer;
    window.showNotification = showNotification;
    window.showCustomNotification = showCustomNotification;
}

// ========================================
// EXIT SYSTEM
// ========================================

function showSetupInterfaceWithConfirmation() {
    if (!gameId || !playerId) {
        navigateToGameMenu();
        return;
    }
    
    let confirmModal = document.getElementById('leave-confirmation-modal');
    if (!confirmModal) {
        confirmModal = createLeaveConfirmationModal();
    }
    
    confirmModal.style.display = 'block';
    setTimeout(() => confirmModal.querySelector('.btn-no')?.focus(), 100);
}

function createLeaveConfirmationModal() {
    const existingModal = document.getElementById('leave-confirmation-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'leave-confirmation-modal';
    modal.style.cssText = 'display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); backdrop-filter: blur(2px);';
    
    modal.innerHTML = `
        <div style="background-color: #ffffff; margin: 15% auto; padding: 30px; width: 90%; max-width: 450px; border-radius: 12px; text-align: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);">
            <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 24px; font-weight: 600;">Leave Game</h3>
            <p style="margin: 0 0 15px 0; color: #666; font-size: 16px;">Are you sure you want to exit the game?</p>
            <p style="margin: 0 0 25px 0; color: #999; font-size: 14px; font-style: italic;">Your opponent will be notified that you left.</p>
            <div style="display: flex; justify-content: center; gap: 15px;">
                <button class="btn-no" onclick="hideLeaveConfirmationModal()" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; min-width: 120px;">No, Stay</button>
                <button class="btn-yes" onclick="confirmLeaveGame()" style="background: #dc3545; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; min-width: 120px;">Yes, Leave</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Keyboard events
    const handleKeydown = (e) => {
        if (modal.style.display === 'block') {
            if (e.key === 'Escape') {
                e.preventDefault();
                hideLeaveConfirmationModal();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (document.activeElement.classList.contains('btn-yes')) {
                    confirmLeaveGame();
                } else {
                    hideLeaveConfirmationModal();
                }
            }
        }
    };
    
    document.addEventListener('keydown', handleKeydown);
    modal._keydownHandler = handleKeydown;
    
    return modal;
}

function hideLeaveConfirmationModal() {
    const modal = document.getElementById('leave-confirmation-modal');
    if (!modal) return;
    
    modal.style.display = 'none';
    
    if (modal._keydownHandler) {
        document.removeEventListener('keydown', modal._keydownHandler);
        delete modal._keydownHandler;
    }
}

function confirmLeaveGame() {
    hideLeaveConfirmationModal();
    
    try {
        if (gameId && playerId && socket && socket.connected) {
            socket.emit('player-leaving', {
                gameId: gameId,
                playerId: playerId,
                playerName: playerName || 'Unknown Player',
                timestamp: new Date().toISOString()
            });
        }
        
        showGameOutcomePopup('LOSS', 'You forfeited the game');
        
    } catch (error) {
        showExitNotification('Error leaving game, but returning to menu', 'warning');
        navigateToGameMenu();
    }
}

function navigateToGameMenu(silent = false) {
    // Clean up game state first
    cleanupGameState();
    
    // Force a page refresh to return to main menu
    try {
        window.location.reload();
    } catch (error) {
        // Fallback to attempting to navigate to root
        try {
            window.location.href = '/';
        } catch (fallbackError) {
            if (!silent) {
                showExitNotification('Unable to return to menu. Please refresh the page manually.', 'error', 10000);
            }
        }
    }
}

function cleanupGameState() {
    if (typeof gameId !== 'undefined') gameId = null;
    if (typeof playerId !== 'undefined') playerId = null;
    if (typeof playerName !== 'undefined') playerName = null;
    
    if (typeof clearSelection === 'function') clearSelection();
    if (typeof hidePromotionModal === 'function') hidePromotionModal();
    
    resetDrawState();
    hideDrawRequestModal();
    
    ['gameTimer', 'moveTimer', 'turnTimer'].forEach(timerName => {
        if (typeof window[timerName] !== 'undefined' && window[timerName]) {
            clearInterval(window[timerName]);
            clearTimeout(window[timerName]);
            window[timerName] = null;
        }
    });
    
    // Don't emit socket events if game is already over to prevent "leaving" messages
    if (socket && socket.connected && !gameOver) {
        try {
            socket.emit('leave-room', { gameId: gameId });
        } catch (error) {
            // Silently handle any socket errors
        }
    }
    
    if (typeof localStorage !== 'undefined') {
        ['currentGameId', 'currentPlayerId', 'gameState'].forEach(item => {
            try {
                localStorage.removeItem(item);
            } catch (error) {
                // Silently handle localStorage errors
            }
        });
    }
}

// ========================================
// GAME OUTCOME POPUP
// ========================================
function showGameOutcomePopup(outcome, reason, onClose) {
    const existingPopup = document.getElementById('game-outcome-popup');
    if (existingPopup) existingPopup.remove();
    
    const isWin = outcome === 'WIN';
    const isDraw = outcome === 'DRAW';
    
    const config = {
        WIN: { gradient: 'linear-gradient(135deg, #4CAF50, #66BB6A)', title: 'VICTORY!', icon: '🎉', color: '#4CAF50' },
        DRAW: { gradient: 'linear-gradient(135deg, #FF9800, #FFB74D)', title: 'DRAW', icon: '🤝', color: '#FF9800' },
        LOSS: { gradient: 'linear-gradient(135deg, #F44336, #EF5350)', title: 'DEFEAT', icon: '😔', color: '#F44336' }
    }[outcome];
    
    const popup = document.createElement('div');
    popup.id = 'game-outcome-popup';
    popup.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center; z-index: 2000; backdrop-filter: blur(3px); opacity: 0; transition: opacity 0.4s ease-in-out;';
    
    popup.innerHTML = `
        <div style="background: ${config.gradient}; color: white; padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); max-width: 400px; width: 90%; transform: scale(0.8); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative;">
            <button class="close-btn" style="position: absolute; top: 15px; right: 20px; background: rgba(255, 255, 255, 0.2); border: none; color: white; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; font-size: 20px; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; backdrop-filter: blur(5px);" onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'; this.style.transform='scale(1)'">×</button>
            <div style="font-size: 80px; margin-bottom: 20px; text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);">${config.icon}</div>
            <h1 style="font-size: 48px; font-weight: 800; margin: 0 0 15px 0; text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3); letter-spacing: 2px;">${config.title}</h1>
            <p style="font-size: 18px; margin: 0 0 30px 0; opacity: 0.9; font-weight: 500; line-height: 1.4;">${reason}</p>
            <div style="display: flex; justify-content: center;">
                <button class="menu-btn" style="background: rgba(255, 255, 255, 0.9); color: ${config.color}; border: 2px solid rgba(255, 255, 255, 0.9); padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px; font-weight: 600; min-width: 120px; transition: all 0.3s ease;">Main Menu</button>
            </div>
        </div>
    `;
    
    const menuBtn = popup.querySelector('.menu-btn');
    const closeBtn = popup.querySelector('.close-btn');
    
    const handleClose = () => {
        // Prevent any leaving notifications by setting game as already ended
        const wasGameOver = gameOver;
        gameOver = true;
        
        closeGameOutcomePopup();
        
        // Clear any existing notifications
        clearAllNotifications();
        
        if (onClose) onClose('close');
    };
    
    const handleMainMenu = () => {
        // Prevent any leaving notifications by setting game as already ended
        const wasGameOver = gameOver;
        gameOver = true;
        
        closeGameOutcomePopup();
        
        // Clear any existing notifications
        clearAllNotifications();
        
        // Navigate to game menu (which now refreshes the page)
        navigateToGameMenu(true); // Pass silent flag
        
        if (onClose) onClose('menu');
    };
    
    closeBtn.onclick = handleClose;
    menuBtn.onclick = handleMainMenu;
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
        popup.style.opacity = '1';
        popup.querySelector('div').style.transform = 'scale(1)';
    }, 50);
    
    setTimeout(() => menuBtn.focus(), 500);
    
    const handleKeydown = (e) => {
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                handleClose();
                break;
            case 'Enter':
                e.preventDefault();
                if (document.activeElement === closeBtn) {
                    handleClose();
                } else {
                    handleMainMenu();
                }
                break;
        }
    };
    
    document.addEventListener('keydown', handleKeydown);
    popup._keydownHandler = handleKeydown;
    
    if (typeof playSound === 'function') {
        playSound(isWin ? 'victory' : isDraw ? 'draw' : 'defeat');
    }
    
    return popup;
}
function closeGameOutcomePopup() {
    const popup = document.getElementById('game-outcome-popup');
    if (!popup) return;
    
    popup.style.opacity = '0';
    popup.querySelector('div').style.transform = 'scale(0.8)';
    
    if (popup._keydownHandler) {
        document.removeEventListener('keydown', popup._keydownHandler);
        delete popup._keydownHandler;
    }
    
    setTimeout(() => {
        if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 400);
}

function showDrawAnnouncementPopup() {
    const modal = document.createElement('div');
    modal.id = 'draw-announcement-modal';
    modal.style.cssText = 'display: flex; position: fixed; z-index: 3000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); justify-content: center; align-items: center;';

    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4); min-width: 350px; max-width: 500px; color: white; position: relative;">
            <button onclick="hideDrawAnnouncementModal()" style="position: absolute; top: 15px; right: 20px; background: none; border: none; color: rgba(255, 255, 255, 0.7); font-size: 28px; cursor: pointer; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
            <div style="font-size: 60px; margin-bottom: 20px;">🤝</div>
            <h2 style="margin: 0 0 15px 0; font-size: 36px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);">DRAW!</h2>
            <p style="margin: 0 0 30px 0; font-size: 18px; opacity: 0.9;">Game ended by mutual agreement</p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="hideDrawAnnouncementModal(); window.location.reload();" style="background: #dc3545; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);">New Game</button>
                <button onclick="hideDrawAnnouncementModal(); window.location.reload();" style="background: rgba(255, 255, 255, 0.2); color: white; border: 2px solid rgba(255, 255, 255, 0.3); padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; backdrop-filter: blur(10px);">Main Menu</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        if (modal && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    }, 5000);
}

function hideDrawAnnouncementModal() {
    const modal = document.getElementById('draw-announcement-modal');
    if (modal) modal.style.display = 'none';
}

// ========================================
// GAME STATUS INTEGRATION
// ========================================

function updateGameStatusWithExitIntegration(status) {
    const statusElement = document.getElementById('game-status');
    document.querySelectorAll('.square').forEach(square => square.classList.remove('in-check'));
    
    if (!statusElement) return;
    
    if (typeof isCheckmate === 'function' && typeof currentPlayer !== 'undefined' && isCheckmate(currentPlayer)) {
        const winner = currentPlayer === 'white' ? 'Black' : 'White';
        const loser = currentPlayer;
        
        statusElement.textContent = `Checkmate! ${winner} wins!`;
        statusElement.className = 'status checkmate';
        
        if (typeof showNotification === 'function') {
            showNotification(`Checkmate! ${winner} wins!`, 'success');
        }
        
        const isCurrentPlayerWinner = (
            (typeof playerColor !== 'undefined' && playerColor === winner.toLowerCase()) ||
            (typeof myColor !== 'undefined' && myColor === winner.toLowerCase()) ||
            (typeof playerSide !== 'undefined' && playerSide === winner.toLowerCase())
        );
        
        setTimeout(() => {
            showGameOutcomePopup(isCurrentPlayerWinner ? 'WIN' : 'LOSS', 
                isCurrentPlayerWinner ? `Checkmate! You won as ${winner}!` : `Checkmate! You lost as ${loser}.`);
        }, 1500);
        
        return;
    }
    
    const statusMap = {
        check: () => {
            if (typeof isInCheck === 'function' && isInCheck(currentPlayer)) {
                statusElement.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} is in check!`;
                statusElement.className = 'status check';
                
                if (typeof findKing === 'function') {
                    const kingPos = findKing(currentPlayer);
                    if (kingPos) {
                        const kingSquare = document.querySelector(`[data-row="${kingPos.row}"][data-col="${kingPos.col}"]`);
                        if (kingSquare) kingSquare.classList.add('in-check');
                    }
                }
            }
        },
        stalemate: () => {
            statusElement.textContent = 'Stalemate! Game is a draw.';
            statusElement.className = 'status stalemate';
            if (typeof showNotification === 'function') showNotification('Stalemate! Game is a draw.', 'info');
            setTimeout(() => showGameOutcomePopup('DRAW', 'Stalemate - No legal moves available'), 1000);
        },
        draw: () => {
            statusElement.textContent = 'Game ended in a draw by mutual agreement.';
            statusElement.className = 'status draw';
            setTimeout(() => showGameOutcomePopup('DRAW', 'Game ended in a draw by mutual agreement'), 1000);
        },
        'insufficient-material': () => {
            statusElement.textContent = 'Draw - Insufficient material to checkmate.';
            statusElement.className = 'status draw';
            if (typeof showNotification === 'function') showNotification('Draw - Insufficient material to checkmate.', 'info');
            setTimeout(() => showGameOutcomePopup('DRAW', 'Insufficient material to checkmate'), 1000);
        },
        'threefold-repetition': () => {
            statusElement.textContent = 'Draw - Threefold repetition.';
            statusElement.className = 'status draw';
            setTimeout(() => showGameOutcomePopup('DRAW', 'Threefold repetition'), 1000);
        },
        'fifty-move-rule': () => {
            statusElement.textContent = 'Draw - Fifty move rule.';
            statusElement.className = 'status draw';
            setTimeout(() => showGameOutcomePopup('DRAW', 'Fifty move rule - No captures or pawn moves'), 1000);
        }
    };
    
    if (statusMap[status]) {
        statusMap[status]();
    } else {
        statusElement.textContent = '';
        statusElement.className = 'status';
    }
}

function checkAndUpdateGameEnd() {
    if (typeof currentPlayer === 'undefined') return false;
    
    if (typeof isCheckmate === 'function' && isCheckmate(currentPlayer)) {
        updateGameStatusWithExitIntegration('checkmate');
        return true;
    }
    
    if (typeof isStalemate === 'function' && isStalemate(currentPlayer)) {
        updateGameStatusWithExitIntegration('stalemate');
        return true;
    }
    
    if (typeof isInsufficientMaterial === 'function' && isInsufficientMaterial()) {
        updateGameStatusWithExitIntegration('insufficient-material');
        return true;
    }
    
    if (typeof isInCheck === 'function' && isInCheck(currentPlayer)) {
        updateGameStatusWithExitIntegration('check');
        return false;
    }
    
    return false;
}

// ========================================
// NOTIFICATION SYSTEM
// ========================================

function clearAllNotifications() {
    // Clear any existing notifications
    const notificationContainer = document.getElementById('exit-notification-container');
    if (notificationContainer) {
        notificationContainer.innerHTML = '';
    }
    
    // Also clear any other notification systems if they exist
    const otherContainers = document.querySelectorAll('[id*="notification"], [class*="notification"]');
    otherContainers.forEach(container => {
        if (container.id !== 'exit-notification-container') {
            container.innerHTML = '';
        }
    });
}

function showExitNotification(message, type = 'info', duration = 5000) {
    if (typeof showNotification === 'function') {
        showNotification(message, type);
        return;
    }
    
    let container = document.getElementById('exit-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'exit-notification-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1001; max-width: 350px; pointer-events: none;';
        document.body.appendChild(container);
    }
    
    const colors = {
        info: { bg: '#e3f2fd', text: '#1565c0', border: '#2196f3' },
        success: { bg: '#e8f5e8', text: '#2e7d32', border: '#4caf50' },
        error: { bg: '#ffebee', text: '#c62828', border: '#f44336' },
        warning: { bg: '#fff3e0', text: '#ef6c00', border: '#ff9800' }
    };
    const color = colors[type] || colors.info;
    
    const notification = document.createElement('div');
    notification.style.cssText = `background: ${color.bg}; color: ${color.text}; padding: 15px 20px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); font-size: 14px; font-weight: 500; opacity: 0; transform: translateX(100%); transition: all 0.3s ease-in-out; border-left: 4px solid ${color.border}; pointer-events: auto; cursor: pointer;`;
    
    notification.textContent = message;
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    notification.onclick = () => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 300);
    };
    
    setTimeout(() => {
        if (notification.parentNode) notification.onclick();
    }, duration);
}

// ========================================
// SOCKET EVENT HANDLERS
// ========================================

function initializeSocketListeners() {
    if (!socket) return;
    
    // Draw system listeners
    socket.on('draw-request', handleDrawRequest);
    socket.on('draw-response', handleDrawResponse);
    socket.on('draw-accepted', handleDrawAccepted);
    socket.on('draw-cancelled', () => {
        resetDrawState();
        hideDrawRequestModal();
        showNotification('Draw offer cancelled - opponent disconnected', 'info');
    });
    
    // Exit system listeners
    socket.on('opponent-left', (data) => {
        showGameOutcomePopup('WIN', `${data.playerName || 'Your opponent'} left the game`);
    });
    
    socket.on('exit-error', (data) => {
        showExitNotification(data.message || 'Error during exit process', 'error');
    });
    
    socket.on('game-ended', (data) => {
        if (data.reason === 'checkmate') {
            const isWinner = (
                (typeof playerColor !== 'undefined' && playerColor === data.winner) ||
                (typeof myColor !== 'undefined' && myColor === data.winner) ||
                (typeof playerSide !== 'undefined' && playerSide === data.winner)
            );
            
            setTimeout(() => {
                showGameOutcomePopup(isWinner ? 'WIN' : 'LOSS', 
                    isWinner ? 'Checkmate! You won!' : `Checkmate! ${data.winner} wins.`);
            }, 1500);
        } else if (data.reason === 'stalemate' || data.reason === 'draw') {
            setTimeout(() => {
                showGameOutcomePopup('DRAW', data.message || 'Game ended in a draw');
            }, 1000);
        }
    });
}

// ========================================
// RESET FUNCTIONS
// ========================================

function resetDrawSystem() {
    resetDrawState();
    hideDrawRequestModal();
    document.querySelectorAll('.square').forEach(square => {
        square.style.pointerEvents = 'auto';
    });
}

function updateDrawSystemForGameState(gameState) {
    if (!gameState) return;

    if (gameState.gameOver) {
        resetDrawState();
        hideDrawRequestModal();
    }

    updateDrawButtonState();
}

// ========================================
// INITIALIZATION
// ========================================

function initializeGameSystem() {
    // Initialize socket listeners
    initializeSocketListeners();
    
    // Draw button
    const drawButton = document.getElementById('draw-button');
    if (drawButton) {
        drawButton.addEventListener('click', sendDrawRequest);
        updateDrawButtonState();
    }
    
    // Update leave buttons
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    if (backToMenuBtn) {
        backToMenuBtn.onclick = (e) => {
            e.preventDefault();
            showSetupInterfaceWithConfirmation();
        };
    }
    
    // Update buttons with showSetupInterface onclick
    document.querySelectorAll('button[onclick*="showSetupInterface"]').forEach(button => {
        button.onclick = (e) => {
            e.preventDefault();
            showSetupInterfaceWithConfirmation();
        };
    });
    
    // Override updateGameStatus function
    if (typeof window.originalUpdateGameStatus === 'undefined' && typeof updateGameStatus === 'function') {
        window.originalUpdateGameStatus = updateGameStatus;
    }
    
    if (typeof window !== 'undefined') {
        window.updateGameStatus = updateGameStatusWithExitIntegration;
    }
    
    // Keyboard shortcut for exit (Ctrl+Alt+Q)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'q') {
            e.preventDefault();
            if (gameId && playerId) showSetupInterfaceWithConfirmation();
        }
    });
}

// ========================================
// PUBLIC API
// ========================================

if (typeof window !== 'undefined') {
    window.drawSystem = {
        sendDrawRequest,
        handleDrawRequest,
        handleDrawResponse,
        handleDrawAccepted,
        resetDrawSystem,
        updateDrawSystemForGameState,
        showDrawAnnouncementPopup,
        hideDrawAnnouncementModal
    };
    
    window.exitSystem = {
        showSetupInterfaceWithConfirmation,
        confirmLeaveGame,
        initializeGameSystem,
        showExitNotification,
        navigateToGameMenu,
        showGameOutcomePopup,
        closeGameOutcomePopup,
        updateGameStatusWithExitIntegration,
        checkAndUpdateGameEnd
    };
    
    // Global functions
    window.showGameOutcomePopup = showGameOutcomePopup;
    window.updateGameStatusWithExit = updateGameStatusWithExitIntegration;
    window.checkGameEnd = checkAndUpdateGameEnd;
}

// ========================================
// AUTO-INITIALIZATION
// ========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGameSystem);
} else {
    setTimeout(initializeGameSystem, 100);
}