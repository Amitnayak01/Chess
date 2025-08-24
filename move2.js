// Chess Move Navigation Module
// Integrates with the existing chess game to provide move history navigation

// Navigation state variables
let navigationHistory = [];  // Stores game states for each move
let currentNavigationIndex = -1;  // Current position in navigation (-1 = live game)
let liveGameState = null;  // Current live game state
let isNavigating = false;  // Flag to indicate if we're viewing history

/**
 * Initialize the navigation system
 */
function initializeNavigation() {
    try {
        console.log('Initializing chess move navigation system...');
        
        // Get navigation button elements
        const backButton = document.getElementById('back-button');
        const forwardButton = document.getElementById('forward-button');
        const liveButton = document.getElementById('live-button');
        
        // Check if buttons exist
        if (!backButton || !forwardButton) {
            console.warn('Navigation buttons not found - navigation may not work properly');
        }
        
        // Attach event listeners if buttons exist
        if (backButton) {
            backButton.addEventListener('click', () => {
                console.log('Back button clicked');
                goBackOneMove();
            });
        }
        
        if (forwardButton) {
            forwardButton.addEventListener('click', () => {
                console.log('Forward button clicked');
                goForwardOneMove();
            });
        }
        
        if (liveButton) {
            liveButton.addEventListener('click', () => {
                console.log('Live button clicked');
                goToLiveGame();
            });
        }
        
        // Reset navigation state
        resetNavigation();
        
        console.log('Chess move navigation system initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing navigation:', error);
        return false;
    }
}

/**
 * Store a new move state in navigation history
 * This is called when a new move is made
 */
function storeMoveState(gameState, moveData) {
    try {
        if (!gameState) {
            console.warn('No game state provided to storeMoveState');
            return false;
        }
        
        // Create a deep copy of the game state to avoid reference issues
        const stateCopy = {
            board: JSON.parse(JSON.stringify(gameState.board || [])),
            currentPlayer: gameState.currentPlayer,
            moveHistory: [...(gameState.moveHistory || [])],
            capturedPieces: JSON.parse(JSON.stringify(gameState.capturedPieces || { white: [], black: [] })),
            enPassantTarget: gameState.enPassantTarget,
            castlingRights: JSON.parse(JSON.stringify(gameState.castlingRights || {
                white: { kingside: true, queenside: true },
                black: { kingside: true, queenside: true }
            })),
            gameOver: gameState.gameOver,
            status: gameState.status,
            players: gameState.players,
            spectators: gameState.spectators,
            moveData: moveData  // Additional move information
        };
        
        // Add to navigation history
        navigationHistory.push(stateCopy);
        
        // Update live game state
        liveGameState = stateCopy;
        
        // Reset navigation to live position
        currentNavigationIndex = -1;
        isNavigating = false;
        
        // Update button states
        updateNavigationButtons();
        
        console.log(`Stored move state. History now contains ${navigationHistory.length} moves`);
        
        return true;
    } catch (error) {
        console.error('Error storing move state:', error);
        return false;
    }
}

/**
 * Update the live game state without adding to history
 * Used for updates that aren't new moves (like player info changes)
 */
function updateLiveGameState(gameState) {
    try {
        if (!gameState) return false;
        
        // Only update if we're currently viewing the live game
        if (currentNavigationIndex === -1) {
            liveGameState = {
                board: JSON.parse(JSON.stringify(gameState.board || [])),
                currentPlayer: gameState.currentPlayer,
                moveHistory: [...(gameState.moveHistory || [])],
                capturedPieces: JSON.parse(JSON.stringify(gameState.capturedPieces || { white: [], black: [] })),
                enPassantTarget: gameState.enPassantTarget,
                castlingRights: JSON.parse(JSON.stringify(gameState.castlingRights || {
                    white: { kingside: true, queenside: true },
                    black: { kingside: true, queenside: true }
                })),
                gameOver: gameState.gameOver,
                status: gameState.status,
                players: gameState.players,
                spectators: gameState.spectators
            };
        }
        
        return true;
    } catch (error) {
        console.error('Error updating live game state:', error);
        return false;
    }
}

/**
 * Navigate backward one move
 */
function goBackOneMove() {
    try {
        // Check if we have moves to go back to
        if (navigationHistory.length === 0) {
            console.log('No moves in history to go back to');
            showNavigationMessage('No moves to go back to');
            return false;
        }
        
        // If we're at live game, go to the last move
        if (currentNavigationIndex === -1) {
            currentNavigationIndex = navigationHistory.length - 1;
        } else if (currentNavigationIndex > 0) {
            currentNavigationIndex--;
        } else {
            console.log('Already at the first move');
            showNavigationMessage('Already at the first move');
            return false;
        }
        
        // Set navigation flag
        isNavigating = true;
        
        // Load the game state at this position
        const targetState = navigationHistory[currentNavigationIndex];
        loadNavigationState(targetState);
        
        // Update button states
        updateNavigationButtons();
        
        const moveNumber = currentNavigationIndex + 1;
        console.log(`Navigated back to move ${moveNumber}`);
        showNavigationMessage(`Viewing move ${moveNumber} of ${navigationHistory.length}`);
        
        return true;
    } catch (error) {
        console.error('Error in goBackOneMove:', error);
        return false;
    }
}

/**
 * Navigate forward one move
 */
function goForwardOneMove() {
    try {
        // Check if we can go forward
        if (currentNavigationIndex === -1) {
            console.log('Already at live game');
            showNavigationMessage('Already at live game');
            return false;
        }
        
        if (currentNavigationIndex >= navigationHistory.length - 1) {
            // Go to live game
            goToLiveGame();
            return true;
        }
        
        // Move forward in history
        currentNavigationIndex++;
        
        // Set navigation flag
        isNavigating = true;
        
        // Load the game state at this position
        const targetState = navigationHistory[currentNavigationIndex];
        loadNavigationState(targetState);
        
        // Update button states
        updateNavigationButtons();
        
        const moveNumber = currentNavigationIndex + 1;
        console.log(`Navigated forward to move ${moveNumber}`);
        showNavigationMessage(`Viewing move ${moveNumber} of ${navigationHistory.length}`);
        
        return true;
    } catch (error) {
        console.error('Error in goForwardOneMove:', error);
        return false;
    }
}

/**
 * Go to live game (exit navigation mode)
 */
function goToLiveGame() {
    try {
        if (currentNavigationIndex === -1) {
            console.log('Already at live game');
            return true;
        }
        
        // Reset to live game
        currentNavigationIndex = -1;
        isNavigating = false;
        
        // Load live game state
        if (liveGameState) {
            loadNavigationState(liveGameState);
        }
        
        // Update button states
        updateNavigationButtons();
        
        console.log('Returned to live game');
        showNavigationMessage('Viewing live game');
        
        return true;
    } catch (error) {
        console.error('Error going to live game:', error);
        return false;
    }
}

/**
 * Load a specific game state (used for navigation)
 */
function loadNavigationState(gameState) {
    try {
        if (!gameState) {
            console.error('No game state provided to loadNavigationState');
            return false;
        }
        
        // Update global game variables
        board = gameState.board || [];
        currentPlayer = gameState.currentPlayer || 'white';
        capturedPieces = gameState.capturedPieces || { white: [], black: [] };
        enPassantTarget = gameState.enPassantTarget || null;
        castlingRights = gameState.castlingRights || {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        gameOver = gameState.gameOver || false;
        
        // Update the visual display
        if (typeof createBoard === 'function') {
            createBoard();
        }
        
        if (typeof updateCurrentPlayerDisplay === 'function') {
            updateCurrentPlayerDisplay();
        }
        
        if (typeof updateGameStatus === 'function') {
            updateGameStatus(gameState.status);
        }
        
        if (typeof updateCapturedPieces === 'function') {
            updateCapturedPieces();
        }
        
        // Clear any selections
        if (typeof clearSelection === 'function') {
            clearSelection();
        }
        
        return true;
    } catch (error) {
        console.error('Error loading navigation state:', error);
        return false;
    }
}

/**
 * Update navigation button states
 */
function updateNavigationButtons() {
    try {
        const backButton = document.getElementById('back-button');
        const forwardButton = document.getElementById('forward-button');
        const liveButton = document.getElementById('live-button');
        
        if (backButton) {
            // Can go back if we have history and we're not at the first move
            backButton.disabled = navigationHistory.length === 0 || 
                                 (currentNavigationIndex === 0 && navigationHistory.length === 1);
        }
        
        if (forwardButton) {
            // Can go forward if we're not at live game
            forwardButton.disabled = currentNavigationIndex === -1;
        }
        
        if (liveButton) {
            // Live button is enabled when we're navigating
            liveButton.disabled = currentNavigationIndex === -1;
            
            // Add visual indication when not at live game
            if (currentNavigationIndex === -1) {
                liveButton.classList.remove('active');
            } else {
                liveButton.classList.add('active');
            }
        }
        
        // Update navigation status display
        updateNavigationStatus();
        
    } catch (error) {
        console.error('Error updating navigation buttons:', error);
    }
}

/**
 * Update navigation status display
 */
function updateNavigationStatus() {
    try {
        const statusElement = document.getElementById('navigation-status');
        if (statusElement) {
            if (currentNavigationIndex === -1) {
                statusElement.textContent = 'Live Game';
                statusElement.className = 'navigation-status live';
            } else {
                const moveNumber = currentNavigationIndex + 1;
                statusElement.textContent = `Move ${moveNumber} of ${navigationHistory.length}`;
                statusElement.className = 'navigation-status history';
            }
        }
    } catch (error) {
        console.error('Error updating navigation status:', error);
    }
}

/**
 * Show navigation message to user
 */
function showNavigationMessage(message) {
    try {
        // Use existing notification system if available
        if (typeof showNotification === 'function') {
            showNotification(message, 'info');
        } else {
            console.log('Navigation: ' + message);
        }
    } catch (error) {
        console.error('Error showing navigation message:', error);
    }
}

/**
 * Reset navigation system
 */
function resetNavigation() {
    try {
        navigationHistory = [];
        currentNavigationIndex = -1;
        liveGameState = null;
        isNavigating = false;
        
        // Update button states
        updateNavigationButtons();
        
        console.log('Navigation system reset');
        return true;
    } catch (error) {
        console.error('Error resetting navigation:', error);
        return false;
    }
}

/**
 * Check if currently navigating through history
 */
function isCurrentlyNavigating() {
    return isNavigating && currentNavigationIndex !== -1;
}

/**
 * Jump to a specific move in history
 */
function jumpToMove(moveIndex) {
    try {
        if (moveIndex < 0 || moveIndex >= navigationHistory.length) {
            console.log(`Cannot jump to move ${moveIndex + 1} - out of bounds`);
            showNavigationMessage(`Move ${moveIndex + 1} does not exist`);
            return false;
        }
        
        currentNavigationIndex = moveIndex;
        isNavigating = true;
        
        // Load the game state at this position
        const targetState = navigationHistory[currentNavigationIndex];
        loadNavigationState(targetState);
        
        // Update button states
        updateNavigationButtons();
        
        const moveNumber = currentNavigationIndex + 1;
        console.log(`Jumped to move ${moveNumber}`);
        showNavigationMessage(`Viewing move ${moveNumber} of ${navigationHistory.length}`);
        
        return true;
    } catch (error) {
        console.error('Error jumping to move:', error);
        return false;
    }
}

/**
 * Get current navigation information
 */
function getNavigationInfo() {
    return {
        totalMoves: navigationHistory.length,
        currentIndex: currentNavigationIndex,
        isNavigating: isNavigating,
        isAtLive: currentNavigationIndex === -1,
        canGoBack: navigationHistory.length > 0 && !(currentNavigationIndex === 0 && navigationHistory.length === 1),
        canGoForward: currentNavigationIndex !== -1
    };
}

/**
 * Get move history for display
 */
function getMoveHistoryForDisplay() {
    try {
        return navigationHistory.map((state, index) => {
            const moveData = state.moveData;
            let notation = `${index + 1}.`;
            
            if (moveData && moveData.notation) {
                notation += ` ${moveData.notation}`;
            } else if (moveData && moveData.from && moveData.to) {
                notation += ` ${String.fromCharCode(97 + moveData.from.col)}${8 - moveData.from.row}`;
                notation += `-${String.fromCharCode(97 + moveData.to.col)}${8 - moveData.to.row}`;
            }
            
            return {
                index: index,
                notation: notation,
                isActive: index === currentNavigationIndex
            };
        });
    } catch (error) {
        console.error('Error getting move history for display:', error);
        return [];
    }
}

// Export functions for global access
window.initializeNavigation = initializeNavigation;
window.storeMoveState = storeMoveState;
window.updateLiveGameState = updateLiveGameState;
window.resetNavigation = resetNavigation;
window.isCurrentlyNavigating = isCurrentlyNavigating;
window.goBackOneMove = goBackOneMove;
window.goForwardOneMove = goForwardOneMove;
window.goToLiveGame = goToLiveGame;
window.jumpToMove = jumpToMove;
window.getNavigationInfo = getNavigationInfo;
window.getMoveHistoryForDisplay = getMoveHistoryForDisplay;

console.log('Chess move navigation module loaded');