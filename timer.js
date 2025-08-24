// Chess Game Timer Integration - Fixed to always use selected duration

class ChessGameTimer {
    constructor() {
        this.whiteTime = 0;
        this.blackTime = 0;
        this.currentPlayer = 'white';
        this.timerActive = false;
        this.timerPaused = false;
        this.gameStarted = false;
        this.localTimer = null;
        this.isConnected = false;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    initialize() {
        this.initializeElements();
        this.bindEvents();
        this.setupSocketListeners();
        this.updateDisplay();
        this.createGameEndModal(); // Add modal creation
        console.log('Chess timer initialized');
    }
    
    initializeElements() {
        // Timer display elements from your HTML
        this.timerDisplay = document.getElementById('timer-display');
        this.whiteTimerElement = document.getElementById('white-timer');
        this.blackTimerElement = document.getElementById('black-timer');
        
        // Timer selection in setup
        this.timerDurationSelect = document.getElementById('timer-duration');
        
        console.log('Timer elements found:', {
            timerDisplay: !!this.timerDisplay,
            whiteTimer: !!this.whiteTimerElement,
            blackTimer: !!this.blackTimerElement,
            timerSelect: !!this.timerDurationSelect
        });
        
        // Debug: Log the timer select options if available
        if (this.timerDurationSelect) {
            console.log('Timer duration select options:');
            Array.from(this.timerDurationSelect.options).forEach((option, index) => {
                console.log(`  Option ${index}: value="${option.value}", text="${option.text}"`);
            });
            console.log('Currently selected:', this.timerDurationSelect.value);
        }
        
        // Set initial display
        if (this.whiteTimerElement) {
            this.whiteTimerElement.textContent = '--:--';
        }
        if (this.blackTimerElement) {
            this.blackTimerElement.textContent = '--:--';
        }
    }
    
    // Updated CSS for game end modal with close button support
    updateGameEndModalCSS() {
        const existingStyle = document.getElementById('game-end-modal-styles');
        if (existingStyle) {
            // Update existing styles to ensure proper positioning
            const additionalCSS = `
                .game-end-content {
                    position: relative;
                    background: linear-gradient(145deg, #ffffff, #f0f0f0);
                    padding: 40px;
                    border-radius: 20px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    min-width: 300px;
                    max-width: 400px;
                    animation: slideIn 0.4s ease-out;
                }
                
                .close-btn:focus {
                    outline: 2px solid rgba(255, 255, 255, 0.5);
                    outline-offset: 2px;
                }
                
                .close-btn:active {
                    transform: scale(0.95);
                }
            `;
            
            existingStyle.textContent += additionalCSS;
        }
    }
    
    // Create the game end modal
    createGameEndModal() {
        if (document.getElementById('game-end-modal')) return; // Already exists
        
        const modalHTML = `
            <div id="game-end-modal" class="game-end-modal" style="display: none;">
                <div class="game-end-content">
                    <div class="game-end-icon">
                        <span id="game-end-emoji">🎉</span>
                    </div>
                    <h2 id="game-end-title">VICTORY!</h2>
                    <p id="game-end-reason">Game ended</p>
                    <div class="game-end-buttons">
                        <button id='back-to-menu-btn' class='btn-secondary'>Leave Game</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listener for Leave Game button
        const leaveGameBtn = document.getElementById('back-to-menu-btn');
        if (leaveGameBtn) {
            leaveGameBtn.addEventListener('click', () => {
                this.hideGameEndModal();
                showMainMenu();
            });
        }
        
        // Add CSS styles
        if (!document.getElementById('game-end-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'game-end-modal-styles';
            style.textContent = `
                .game-end-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    animation: fadeIn 0.3s ease-out;
                }
                
                .game-end-content {
                    position: relative;
                    background: linear-gradient(145deg, #ffffff, #f0f0f0);
                    padding: 40px;
                    border-radius: 20px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    min-width: 300px;
                    max-width: 400px;
                    animation: slideIn 0.4s ease-out;
                }
                
                .game-end-content.victory {
                    background: linear-gradient(145deg, #4CAF50, #45a049);
                    color: white;
                }
                
                .game-end-content.defeat {
                    background: linear-gradient(145deg, #f44336, #d32f2f);
                    color: white;
                }
                
                .game-end-icon {
                    font-size: 60px;
                    margin-bottom: 20px;
                    animation: bounce 0.6s ease-out;
                }
                
                .game-end-content h2 {
                    font-size: 32px;
                    font-weight: bold;
                    margin: 20px 0;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }
                
                .game-end-content p {
                    font-size: 16px;
                    margin: 15px 0 30px 0;
                    opacity: 0.9;
                }
                
                .game-end-buttons {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                
                .game-end-buttons button {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 25px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    min-width: 120px;
                }
                
                .btn-success {
                    background: #4CAF50;
                    color: white;
                }
                
                .btn-success:hover {
                    background: #45a049;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
                }
                
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }
                
                .btn-secondary:hover {
                    background: #5a6268;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(108, 117, 125, 0.4);
                }
                
                .btn-danger {
                    background: #f44336;
                    color: white;
                }
                
                .btn-danger:hover {
                    background: #d32f2f;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(244, 67, 54, 0.4);
                }
                
                .close-btn:focus {
                    outline: 2px solid rgba(255, 255, 255, 0.5);
                    outline-offset: 2px;
                }
                
                .close-btn:active {
                    transform: scale(0.95);
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideIn {
                    from { 
                        transform: translateY(-50px) scale(0.8);
                        opacity: 0;
                    }
                    to { 
                        transform: translateY(0) scale(1);
                        opacity: 1;
                    }
                }
                
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-10px); }
                    60% { transform: translateY(-5px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Update CSS for close button support
        this.updateGameEndModalCSS();
    }
    
    // Show game end modal - UPDATED WITH CLOSE BUTTON
    showGameEndModal(winner, loser, reason, isVictory = true) {
        const modal = document.getElementById('game-end-modal');
        const content = modal.querySelector('.game-end-content');
        const emoji = document.getElementById('game-end-emoji');
        const title = document.getElementById('game-end-title');
        const reasonElement = document.getElementById('game-end-reason');
        
        if (!modal) {
            console.error('Game end modal not found');
            return;
        }
        
        // Reset classes
        content.classList.remove('victory', 'defeat');
        
        // Remove any existing close button
        const existingCloseBtn = modal.querySelector('.close-btn');
        if (existingCloseBtn) {
            existingCloseBtn.remove();
        }
        
        // Add close button to the modal content
        const closeButton = document.createElement('button');
        closeButton.className = 'close-btn';
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 15px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            border-radius: 50%;
            width: 35px;
            height: 35px;
            cursor: pointer;
            font-size: 20px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            backdrop-filter: blur(5px);
            z-index: 10001;
        `;
        
        // Add hover effects
        closeButton.onmouseover = () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
            closeButton.style.transform = 'scale(1.1)';
        };
        closeButton.onmouseout = () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
            closeButton.style.transform = 'scale(1)';
        };
        
        // Close button functionality
        closeButton.onclick = () => {
            this.hideGameEndModal();
        };
        
        if (isVictory) {
            content.classList.add('victory');
            emoji.textContent = '🎉';
            title.textContent = 'VICTORY!';
            reasonElement.textContent = reason;
        } else {
            content.classList.add('defeat');
            emoji.textContent = '😔';
            title.textContent = 'DEFEAT';
            reasonElement.textContent = reason;
        }
        
        // Insert close button as first child of content
        content.insertBefore(closeButton, content.firstChild);
        
        modal.style.display = 'flex';
        
        // Update the modal click handler to handle close button
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.hideGameEndModal();
            }
        };
        
        // Enhanced keyboard handling
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.hideGameEndModal();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                // If close button is focused, close the modal
                if (document.activeElement === closeButton) {
                    this.hideGameEndModal();
                } else {
                    // Otherwise, trigger the main menu button
                    const menuBtn = modal.querySelector('#back-to-menu-btn');
                    if (menuBtn) {
                        menuBtn.click();
                    }
                }
            }
        };
        
        // Remove any existing keyboard listener
        if (modal._keydownHandler) {
            document.removeEventListener('keydown', modal._keydownHandler);
        }
        
        // Add new keyboard listener
        document.addEventListener('keydown', handleKeydown);
        modal._keydownHandler = handleKeydown;
    }
    
    // Hide game end modal - UPDATED WITH PROPER CLEANUP
    hideGameEndModal() {
        const modal = document.getElementById('game-end-modal');
        if (modal) {
            // Remove keyboard event listener
            if (modal._keydownHandler) {
                document.removeEventListener('keydown', modal._keydownHandler);
                delete modal._keydownHandler;
            }
            
            modal.style.display = 'none';
        }
    }
    
    bindEvents() {
        // Timer duration selection
        if (this.timerDurationSelect) {
            this.timerDurationSelect.addEventListener('change', (e) => {
                const selectedDuration = parseInt(e.target.value) || 0;
                console.log('Timer duration selected:', selectedDuration, 'seconds');
                this.updateTimerForNewDuration(selectedDuration);
            });
        }
    }
    
    // New method to handle duration changes
    updateTimerForNewDuration(duration) {
        console.log('Updating timer for new duration:', duration, 'seconds');
        
        // Reset timer state with new duration
        this.whiteTime = duration;
        this.blackTime = duration;
        this.currentPlayer = 'white';
        this.timerActive = false;
        this.timerPaused = false;
        this.gameStarted = false;
        
        this.stopLocalTimer();
        this.updateDisplay();
        
        // Show/hide timer display
        if (this.timerDisplay) {
            this.timerDisplay.style.display = duration > 0 ? 'block' : 'none';
        }
    }
    
    setupSocketListeners() {
        // Check if socket exists
        if (typeof socket === 'undefined') {
            console.log('Socket not available, timer will work in local mode only');
            return;
        }
        
        // Listen for socket connection status
        socket.on('connect', () => {
            this.isConnected = true;
            console.log('Timer: Connected to server');
        });
        
        socket.on('disconnect', () => {
            this.isConnected = false;
            this.stopLocalTimer();
        });
        
        // Listen for timer updates from server
        socket.on('timer-update', (data) => {
            this.handleServerTimerUpdate(data);
        });
        
        // Listen for game timeout
        socket.on('game-timeout', (data) => {
            this.handleGameTimeout(data);
        });
        
        // Listen for timer pause/resume
        socket.on('timer-paused', (data) => {
            this.timerPaused = true;
        });
        
        socket.on('timer-resumed', (data) => {
            this.timerPaused = false;
        });
        
        // Listen for game state updates
        socket.on('game-state', (gameState) => {
            this.updateFromGameState(gameState);
        });
        
        socket.on('move', (data) => {
            this.updateFromGameState(data.gameState);
        });
        
        socket.on('reset', (data) => {
            this.hideGameEndModal(); // Hide modal on reset
            this.updateFromGameState(data.gameState);
        });
        
        // Listen for game end events
        socket.on('game-over', (data) => {
            this.handleGameOver(data);
        });
    }
    
    // Get selected timer duration from UI - always fresh
    getCurrentSelectedDuration() {
        if (this.timerDurationSelect) {
            const selectedValue = parseInt(this.timerDurationSelect.value) || 0;
            console.log('Getting current selected timer duration:', selectedValue, 'seconds');
            return selectedValue;
        }
        console.log('No timer duration select found, returning 0');
        return 0;
    }
    
    // Initialize timer when game starts - ALWAYS use current selection
    initializeTimer(duration = null, mode = 'local') {
        // ALWAYS get the current selected duration, ignore any passed duration
        const selectedDuration = this.getCurrentSelectedDuration();
        console.log('Initializing timer with CURRENT selected duration:', selectedDuration, 'seconds, mode:', mode);

        this.whiteTime = selectedDuration;
        this.blackTime = selectedDuration;
        this.currentPlayer = 'white';
        this.timerActive = selectedDuration > 0;
        this.timerPaused = false;
        this.gameStarted = false;

        this.updateDisplay();

        // Show/hide timer display
        if (this.timerDisplay) {
            this.timerDisplay.style.display = selectedDuration > 0 ? 'block' : 'none';
        }

        if (mode === 'local' && selectedDuration > 0) {
            this.startTimer();
        }

        console.log('Timer initialized - White:', this.whiteTime, 'Black:', this.blackTime);
    }
    
    // Start the timer
    startTimer() {
        const currentDuration = this.getCurrentSelectedDuration();
        if (currentDuration <= 0) return;
        
        console.log('Starting timer with duration:', currentDuration);
        this.gameStarted = true;
        this.timerActive = true;
        this.timerPaused = false;
        
        // Check if we're in multiplayer mode
        const isMultiplayer = typeof gameMode !== 'undefined' && gameMode === 'multiplayer';
        
        if (isMultiplayer && this.isConnected) {
            return;
        }
        
        // For local games, run client-side timer
        this.startLocalTimer();
    }
    
    startLocalTimer() {
        this.stopLocalTimer(); // Clear any existing timer
        
        console.log('Starting local timer');
        this.localTimer = setInterval(() => {
            if (!this.timerActive || this.timerPaused) return;
            
            if (this.currentPlayer === 'white') {
                this.whiteTime--;
                if (this.whiteTime <= 0) {
                    this.whiteTime = 0;
                    this.handleLocalTimeout('white');
                    return;
                }
            } else {
                this.blackTime--;
                if (this.blackTime <= 0) {
                    this.blackTime = 0;
                    this.handleLocalTimeout('black');
                    return;
                }
            }
            
            this.updateDisplay();
        }, 1000);
        
        this.updateDisplay();
    }
    
    stopLocalTimer() {
        if (this.localTimer) {
            clearInterval(this.localTimer);
            this.localTimer = null;
            console.log('Local timer stopped');
        }
        this.timerActive = false;
    }
    
    // Handle timer updates from server (multiplayer)
    handleServerTimerUpdate(data) {
        console.log('Server timer update:', data);
        this.whiteTime = data.timeLeft.white;
        this.blackTime = data.timeLeft.black;
        this.currentPlayer = data.currentPlayer;
        this.timerActive = data.timerActive;
        this.timerPaused = data.timerPaused;
        
        this.updateDisplay();
    }
    
    // Handle game state updates
    updateFromGameState(gameState) {
        if (!gameState) return;
        
        console.log('Updating from game state:', gameState);
        
        // For multiplayer games, if we receive timer info from server, use it
        const isMultiplayer = typeof gameMode !== 'undefined' && gameMode === 'multiplayer';
        
        if (isMultiplayer && gameState.timeLeft) {
            // Server sent timer state - use it
            console.log('Using server timer state:', gameState.timeLeft);
            this.whiteTime = gameState.timeLeft.white || 0;
            this.blackTime = gameState.timeLeft.black || 0;
            this.currentPlayer = gameState.currentPlayer || 'white';
            this.timerActive = gameState.timerActive || false;
            this.timerPaused = gameState.timerPaused || false;
            this.gameStarted = gameState.gameStarted || false;
            
            const serverDuration = gameState.timerDuration || 0;
            this.updateDisplay();
            
            if (this.timerDisplay) {
                this.timerDisplay.style.display = serverDuration > 0 ? 'block' : 'none';
            }
        } else if (!isMultiplayer) {
            // Local game - initialize with current selection if not already set
            this.currentPlayer = gameState.currentPlayer || 'white';
            
            // If this is a fresh game state (no timer info), reinitialize with current selection
            if (!gameState.timeLeft && !this.gameStarted) {
                console.log('Local game with no timer info - initializing with current selection');
                const currentDuration = this.getCurrentSelectedDuration();
                this.whiteTime = currentDuration;
                this.blackTime = currentDuration;
                this.timerActive = currentDuration > 0;
                this.timerPaused = false;
                this.gameStarted = false;
                
                if (this.timerDisplay) {
                    this.timerDisplay.style.display = currentDuration > 0 ? 'block' : 'none';
                }
            }
            
            this.updateDisplay();
        } else {
            // Multiplayer but no timer info from server - use current selection as fallback
            console.log('Multiplayer game but no server timer info - using current selection');
            const currentDuration = this.getCurrentSelectedDuration();
            
            this.currentPlayer = gameState.currentPlayer || 'white';
            this.whiteTime = currentDuration;
            this.blackTime = currentDuration;
            this.timerActive = currentDuration > 0;
            this.timerPaused = false;
            this.gameStarted = false;
            
            this.updateDisplay();
            
            if (this.timerDisplay) {
                this.timerDisplay.style.display = currentDuration > 0 ? 'block' : 'none';
            }
        }
    }
    
    // Handle timeout events
    handleLocalTimeout(playerWhoTimedOut) {
        console.log('Timeout:', playerWhoTimedOut);
        this.stopLocalTimer();
        const winner = playerWhoTimedOut === 'white' ? 'black' : 'white';
        
        // Trigger game over in the main game
        if (typeof gameOver !== 'undefined') {
            window.gameOver = true;
        }
        
        // Show victory/defeat modal
        const isCurrentPlayerWinner = this.isCurrentPlayerWinner(winner);
        const reason = `${this.capitalizeFirstLetter(playerWhoTimedOut)} ran out of time`;
        this.showGameEndModal(winner, playerWhoTimedOut, reason, isCurrentPlayerWinner);
        
        // Show notification (optional, as modal is now primary)
        if (typeof showNotification === 'function') {
            showNotification(`Time's up! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by timeout!`, 'success');
        }
        
        // Update game status
        const statusElement = document.getElementById('game-status');
        if (statusElement) {
            statusElement.textContent = `Time's up! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`;
            statusElement.className = 'status timeout';
        }
    }
    
    handleGameTimeout(data) {
        console.log('Server timeout:', data);
        this.stopLocalTimer();
        this.timerActive = false;
        
        // Show victory/defeat modal
        const isCurrentPlayerWinner = this.isCurrentPlayerWinner(data.winner);
        const reason = `${data.loserName || data.loser} ran out of time`;
        this.showGameEndModal(data.winner, data.loser, reason, isCurrentPlayerWinner);
        
        if (typeof showNotification === 'function') {
            showNotification(`Time's up! ${data.winnerName || data.winner} wins by timeout!`, 'success');
        }
    }
    
    // Handle general game over events
    handleGameOver(data) {
        console.log('Game over:', data);
        this.stopLocalTimer();
        this.timerActive = false;
        
        const { winner, loser, reason, method } = data;
        const isCurrentPlayerWinner = this.isCurrentPlayerWinner(winner);
        
        let displayReason = reason || 'Game ended';
        if (method === 'timeout') {
            displayReason = `${this.capitalizeFirstLetter(loser)} ran out of time`;
        } else if (method === 'checkmate') {
            displayReason = `${this.capitalizeFirstLetter(loser)} was checkmated`;
        } else if (method === 'resignation') {
            displayReason = `${this.capitalizeFirstLetter(loser)} resigned`;
        } else if (method === 'stalemate') {
            displayReason = 'Stalemate - it\'s a draw!';
        }
        
        this.showGameEndModal(winner, loser, displayReason, isCurrentPlayerWinner);
    }
    
    // Helper function to determine if current player is the winner
    isCurrentPlayerWinner(winner) {
        // For local games, assume current human player perspective
        if (typeof gameMode === 'undefined' || gameMode === 'local') {
            return true; // In local games, show victory for any win
        }
        
        // For multiplayer, check if winner matches player's color
        if (typeof playerColor !== 'undefined') {
            return playerColor === winner;
        }
        
        // Default fallback
        return true;
    }
    
    // Helper function to capitalize first letter
    capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Player made a move - switch timer
    onPlayerMove(newCurrentPlayer) {
        const currentDuration = this.getCurrentSelectedDuration();
        if (currentDuration <= 0) return;
        
        console.log('Player move, switching to:', newCurrentPlayer);
        this.currentPlayer = newCurrentPlayer;
        
        // For local games, we handle the switch ourselves
        const isLocal = typeof gameMode === 'undefined' || gameMode === 'local';
        if (isLocal) {
            this.updateDisplay();
        }
        // For multiplayer games, the server handles the timer switch
    }
    
    // Display update functions
    updateDisplay() {
        if (this.whiteTimerElement) {
            this.whiteTimerElement.textContent = this.formatTime(this.whiteTime);
            
            // Add warning style for low time
            if (this.whiteTime <= 30 && this.whiteTime > 0 && this.timerActive) {
                this.whiteTimerElement.style.color = '#ff6b6b';
                this.whiteTimerElement.style.fontWeight = 'bold';
            } else if (this.whiteTime <= 10 && this.whiteTime > 0 && this.timerActive) {
                this.whiteTimerElement.style.color = '#ff0000';
                this.whiteTimerElement.style.fontWeight = 'bold';
                this.whiteTimerElement.style.animation = 'blink 1s infinite';
            } else {
                this.whiteTimerElement.style.color = '';
                this.whiteTimerElement.style.fontWeight = '';
                this.whiteTimerElement.style.animation = '';
            }
        }
        
        if (this.blackTimerElement) {
            this.blackTimerElement.textContent = this.formatTime(this.blackTime);
            
            // Add warning style for low time
            if (this.blackTime <= 30 && this.blackTime > 0 && this.timerActive) {
                this.blackTimerElement.style.color = '#ff6b6b';
                this.blackTimerElement.style.fontWeight = 'bold';
            } else if (this.blackTime <= 10 && this.blackTime > 0 && this.timerActive) {
                this.blackTimerElement.style.color = '#ff0000';
                this.blackTimerElement.style.fontWeight = 'bold';
                this.blackTimerElement.style.animation = 'blink 1s infinite';
            } else {
                this.blackTimerElement.style.color = '';
                this.blackTimerElement.style.fontWeight = '';
                this.blackTimerElement.style.animation = '';
            }
        }
        
        // Highlight current player's timer
        const whiteTimerSection = document.querySelector('.white-timer');
        const blackTimerSection = document.querySelector('.black-timer');
        
        if (whiteTimerSection) {
            whiteTimerSection.classList.toggle('active-timer', this.currentPlayer === 'white' && this.timerActive && !this.timerPaused);
        }
        if (blackTimerSection) {
            blackTimerSection.classList.toggle('active-timer', this.currentPlayer === 'black' && this.timerActive && !this.timerPaused);
        }
        
        console.log('Display updated:', {
            white: this.formatTime(this.whiteTime),
            black: this.formatTime(this.blackTime),
            current: this.currentPlayer,
            active: this.timerActive
        });
    }
    
    formatTime(seconds) {
        if (seconds < 0) seconds = 0;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Reset timer - ALWAYS use current selection
    resetTimer() {
        console.log('Resetting timer');
        this.stopLocalTimer();
        this.hideGameEndModal(); // Hide modal on reset
        
        // ALWAYS get the current selected duration
        const selectedDuration = this.getCurrentSelectedDuration();
        console.log('Reset timer: using CURRENT selected duration', selectedDuration, 'seconds');
        
        this.whiteTime = selectedDuration;
        this.blackTime = selectedDuration;
        this.currentPlayer = 'white';
        this.timerActive = false;
        this.timerPaused = false;
        this.gameStarted = false;
        
        this.updateDisplay();
        
        // Show/hide timer display
        if (this.timerDisplay) {
            this.timerDisplay.style.display = selectedDuration > 0 ? 'block' : 'none';
        }
    }
    
    // Pause timer
    pauseTimer() {
        console.log('Pausing timer');
        this.timerPaused = true;
        this.updateDisplay();
    }
    
    // Resume timer
    resumeTimer() {
        console.log('Resuming timer');
        this.timerPaused = false;
        this.updateDisplay();
    }
    
    // Stop timer completely
    stopTimer() {
        console.log('Stopping timer');
        this.stopLocalTimer();
        this.timerActive = false;
        this.timerPaused = false;
        this.updateDisplay();
    }
    
    // Get current timer state
    getTimerState() {
        return {
            whiteTime: this.whiteTime,
            blackTime: this.blackTime,
            currentPlayer: this.currentPlayer,
            timerActive: this.timerActive,
            timerPaused: this.timerPaused,
            gameStarted: this.gameStarted
        };
    }
    
    // Set timer state (for restoring from saved state)
    setTimerState(state) {
        if (!state) return;
        
        this.whiteTime = state.whiteTime || 0;
        this.blackTime = state.blackTime || 0;
        this.currentPlayer = state.currentPlayer || 'white';
        this.timerActive = state.timerActive || false;
        this.timerPaused = state.timerPaused || false;
        this.gameStarted = state.gameStarted || false;
        
        this.updateDisplay();
        
        // Restart local timer if needed
        if (this.timerActive && !this.timerPaused && (this.whiteTime > 0 || this.blackTime > 0)) {
            const isLocal = typeof gameMode === 'undefined' || gameMode === 'local';
            if (isLocal) {
                this.startLocalTimer();
            }
        }
    }
}

// Global timer instance
let chessTimer = null;

// Initialize timer
function initializeChessTimer() {
    if (!chessTimer) {
        chessTimer = new ChessGameTimer();
        
        // Add CSS for timer animations if not present
        if (!document.getElementById('timer-animations')) {
            const style = document.createElement('style');
            style.id = 'timer-animations';
            style.textContent = `
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0.3; }
                }
                
                .active-timer {
                    background-color: #e8f5e8;
                    border-left: 4px solid #4CAF50;
                    padding-left: 8px;
                    border-radius: 4px;
                }
                
                .timer-item {
                    margin: 5px 0;
                    padding: 8px;
                    border-radius: 4px;
                    transition: all 0.3s ease;
                }
                
                .timer-value {
                    font-family: 'Courier New', monospace;
                    font-weight: bold;
                    font-size: 16px;
                }
                
                .timer-warning {
                    animation: pulse 1s infinite;
                    color: #ff6b6b !important;
                }
                
                .timer-critical {
                    animation: blink 1s infinite;
                    color: #ff0000 !important;
                    font-weight: bold !important;
                }
                
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    return chessTimer;
}

// Function to show main menu (you may need to implement this based on your app structure)
function showMainMenu() {
    if (chessTimer) {
        chessTimer.hideGameEndModal();
    }
    
    // Hide game interface and show main menu
    const gameInterface = document.getElementById('game-interface');
    const mainMenu = document.getElementById('main-menu');
    
    if (gameInterface) gameInterface.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'block';
    
    // Reset game variables
    if (typeof gameMode !== 'undefined') {
        gameMode = null;
    }
    if (typeof gameId !== 'undefined') {
        gameId = null;
    }
    if (typeof playerId !== 'undefined') {
        playerId = null;
    }
    if (typeof playerColor !== 'undefined') {
        playerColor = null;
    }
    
    // Disconnect from socket room if connected
    if (typeof socket !== 'undefined' && socket.connected) {
        socket.emit('leave-room');
    }
}

// Integration with existing game functions
// Hook into existing functions to add timer support

// Function to hook into game mode changes - ALWAYS use current selection
function onGameModeChange(mode) {
    if (chessTimer) {
        console.log('Game mode changed to:', mode, '- reinitializing timer with current selection');
        chessTimer.initializeTimer(null, mode); // null forces use of current selection
    }
}

// Function to hook into player moves
function onPlayerMoveComplete(newCurrentPlayer) {
    if (chessTimer) {
        chessTimer.onPlayerMove(newCurrentPlayer);
    }
}

// Function to hook into game reset - ALWAYS use current selection
function onGameReset() {
    if (chessTimer) {
        console.log('Game reset - using current selected duration');
        chessTimer.resetTimer(); // This now always uses current selection
        const mode = typeof gameMode !== 'undefined' ? gameMode : 'local';
        console.log('Game reset - reinitializing with mode:', mode);
        chessTimer.initializeTimer(null, mode); // null forces use of current selection
    }
}

// Function to handle game over events from the main game logic
function onGameOver(winner, loser, reason, method = null) {
    if (chessTimer) {
        const gameOverData = {
            winner: winner,
            loser: loser,
            reason: reason,
            method: method
        };
        chessTimer.handleGameOver(gameOverData);
    }
}

// Additional utility functions for timer control
function pauseGameTimer() {
    if (chessTimer) {
        chessTimer.pauseTimer();
    }
}

function resumeGameTimer() {
    if (chessTimer) {
        chessTimer.resumeTimer();
    }
}

function stopGameTimer() {
    if (chessTimer) {
        chessTimer.stopTimer();
    }
}

function getTimerState() {
    if (chessTimer) {
        return chessTimer.getTimerState();
    }
    return null;
}

function restoreTimerState(state) {
    if (chessTimer && state) {
        chessTimer.setTimerState(state);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChessTimer);
} else {
    initializeChessTimer();
}

// Export for global use
window.chessTimer = chessTimer;
window.initializeChessTimer = initializeChessTimer;
window.onGameModeChange = onGameModeChange;
window.onPlayerMoveComplete = onPlayerMoveComplete;
window.onGameReset = onGameReset;
window.onGameOver = onGameOver;
window.showMainMenu = showMainMenu;
window.pauseGameTimer = pauseGameTimer;
window.resumeGameTimer = resumeGameTimer;
window.stopGameTimer = stopGameTimer;
window.getTimerState = getTimerState;
window.restoreTimerState = restoreTimerState;

// Auto-integration: Hook into existing functions if they exist
setTimeout(() => {
    // Hook into local game start
    if (typeof startLocalGame === 'function') {
        const originalStartLocal = startLocalGame;
        window.startLocalGame = function() {
            console.log('Starting local game - will use current timer selection');
            originalStartLocal();
            onGameModeChange('local');
        };
    }
    
    // Hook into game creation - SEND TIMER DURATION TO SERVER
    if (typeof createGame === 'function') {
        const originalCreateGame = createGame;
        window.createGame = async function() {
            console.log('Creating multiplayer game - will use current timer selection');
            
            // Get the current timer duration BEFORE calling original function
            const selectedDuration = chessTimer ? chessTimer.getCurrentSelectedDuration() : 0;
            console.log('Sending timer duration to server:', selectedDuration, 'seconds');
            
            // Modify the original function to include timer duration
            try {
                const nameInput = document.getElementById('player-name');
                if (!nameInput || !nameInput.value.trim()) {
                    if (typeof showNotification === 'function') {
                        showNotification('Please enter your name', 'warning');
                    }
                    return;
                }
                
                playerName = nameInput.value.trim();
                
                const response = await fetch('/api/games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        playerName,
                        timerDuration: selectedDuration  // ADD TIMER DURATION
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    gameId = data.gameId;
                    playerId = data.playerId;
                    playerColor = data.playerColor;
                    gameMode = 'multiplayer';
                    
                    if (typeof updateGameState === 'function') {
                        updateGameState(data.gameState);
                    }
                    if (typeof joinSocketRoom === 'function') {
                        joinSocketRoom();
                    }
                    if (typeof showGameInterface === 'function') {
                        showGameInterface();
                    }
                    if (typeof updatePlayerInfo === 'function') {
                        updatePlayerInfo();
                    }
                    if (typeof showNotification === 'function') {
                        showNotification(`Game created! ID: ${gameId}`, 'success');
                    }
                    
                    // Initialize timer with the duration we sent
                    onGameModeChange('multiplayer');
                } else {
                    throw new Error(data.error || 'Failed to create game');
                }
            } catch (error) {
                if (typeof handleError === 'function') {
                    handleError(error, 'creating game');
                } else {
                    console.error('Error creating game:', error);
                    if (typeof showNotification === 'function') {
                        showNotification(`Error creating game: ${error.message}`, 'error');
                    }
                }
            }
        };
    }
    
    // Hook into game joining - SEND TIMER DURATION TO SERVER
    if (typeof joinGame === 'function') {
        const originalJoinGame = joinGame;
        window.joinGame = async function() {
            console.log('Joining multiplayer game - will use current timer selection');
            
            // Get the current timer duration BEFORE calling original function
            const selectedDuration = chessTimer ? chessTimer.getCurrentSelectedDuration() : 0;
            console.log('Sending timer duration to server when joining:', selectedDuration, 'seconds');
            
            // Modify the original function to include timer duration
            try {
                const gameIdInput = document.getElementById('game-id-input');
                const nameInput = document.getElementById('player-name');
                
                if (!gameIdInput || !gameIdInput.value.trim()) {
                    if (typeof showNotification === 'function') {
                        showNotification('Please enter a game ID', 'warning');
                    }
                    return;
                }
                
                if (!nameInput || !nameInput.value.trim()) {
                    if (typeof showNotification === 'function') {
                        showNotification('Please enter your name', 'warning');
                    }
                    return;
                }
                
                const targetGameId = gameIdInput.value.trim();
                playerName = nameInput.value.trim();
                
                const response = await fetch(`/api/games/${targetGameId}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        playerName,
                        timerDuration: selectedDuration  // ADD TIMER DURATION
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    gameId = data.gameId;
                    playerId = data.playerId;
                    playerColor = data.playerColor;
                    gameMode = 'multiplayer';
                    
                    if (typeof updateGameState === 'function') {
                        updateGameState(data.gameState);
                    }
                    if (typeof joinSocketRoom === 'function') {
                        joinSocketRoom();
                    }
                    if (typeof showGameInterface === 'function') {
                        showGameInterface();
                    }
                    if (typeof updatePlayerInfo === 'function') {
                        updatePlayerInfo();
                    }
                    if (typeof showNotification === 'function') {
                        showNotification(`Joined game ${gameId} as ${playerColor || 'spectator'}!`, 'success');
                    }
                    
                    // Initialize timer
                    onGameModeChange('multiplayer');
                } else {
                    throw new Error(data.error || 'Failed to join game');
                }
            } catch (error) {
                if (typeof handleError === 'function') {
                    handleError(error, 'joining game');
                } else {
                    console.error('Error joining game:', error);
                    if (typeof showNotification === 'function') {
                        showNotification(`Error joining game: ${error.message}`, 'error');
                    }
                }
            }
        };
    }
    
    // Hook into joinSpecificGame function if it exists
    if (typeof joinSpecificGame === 'function') {
        const originalJoinSpecific = joinSpecificGame;
        window.joinSpecificGame = async function(targetGameId) {
            console.log('Joining specific game with current timer selection');
            
            // Get the current timer duration
            const selectedDuration = chessTimer ? chessTimer.getCurrentSelectedDuration() : 0;
            console.log('Sending timer duration to server when joining specific game:', selectedDuration, 'seconds');
            
            try {
                if (!playerName) {
                    playerName = prompt('Enter your name:');
                    if (!playerName || !playerName.trim()) {
                        if (typeof showNotification === 'function') {
                            showNotification('Please enter a valid name', 'warning');
                        }
                        return;
                    }
                    playerName = playerName.trim();
                }
                
                const response = await fetch(`/api/games/${targetGameId}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        playerName,
                        timerDuration: selectedDuration  // ADD TIMER DURATION
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    gameId = data.gameId;
                    playerId = data.playerId;
                    playerColor = data.playerColor;
                    gameMode = 'multiplayer';
                    
                    if (typeof updateGameState === 'function') {
                        updateGameState(data.gameState);
                    }
                    if (typeof joinSocketRoom === 'function') {
                        joinSocketRoom();
                    }
                    if (typeof showGameInterface === 'function') {
                        showGameInterface();
                    }
                    if (typeof updatePlayerInfo === 'function') {
                        updatePlayerInfo();
                    }
                    if (typeof showNotification === 'function') {
                        showNotification(`Joined game ${gameId} as ${playerColor || 'spectator'}!`, 'success');
                    }
                    
                    // Initialize timer
                    onGameModeChange('multiplayer');
                } else {
                    throw new Error(data.error || 'Failed to join game');
                }
            } catch (error) {
                if (typeof handleError === 'function') {
                    handleError(error, 'joining specific game');
                } else {
                    console.error('Error joining specific game:', error);
                    if (typeof showNotification === 'function') {
                        showNotification(`Error joining specific game: ${error.message}`, 'error');
                    }
                }
            }
        };
    }
    
    // Hook into local move execution
    if (typeof executeLocalMove === 'function') {
        const originalExecuteLocal = executeLocalMove;
        window.executeLocalMove = function(fromRow, fromCol, toRow, toCol, promotionPiece) {
            const result = originalExecuteLocal(fromRow, fromCol, toRow, toCol, promotionPiece);
            if (result && typeof currentPlayer !== 'undefined') {
                onPlayerMoveComplete(currentPlayer);
            }
            return result;
        };
    }
    
    // Hook into reset functions
    if (typeof localResetGame === 'function') {
        const originalLocalReset = localResetGame;
        window.localResetGame = function() {
            console.log('Local reset game - will use current timer selection');
            const result = originalLocalReset();
            onGameReset();
            return result;
        };
    }
    
    // Hook into existing game over functions
    if (typeof handleGameEnd === 'function') {
        const originalHandleGameEnd = handleGameEnd;
        window.handleGameEnd = function(winner, reason, method) {
            const loser = winner === 'white' ? 'black' : 'white';
            onGameOver(winner, loser, reason, method);
            return originalHandleGameEnd(winner, reason, method);
        };
    }
    
    // Hook into checkmate detection
    if (typeof handleCheckmate === 'function') {
        const originalHandleCheckmate = handleCheckmate;
        window.handleCheckmate = function(winner) {
            const loser = winner === 'white' ? 'black' : 'white';
            onGameOver(winner, loser, `${loser} was checkmated`, 'checkmate');
            return originalHandleCheckmate(winner);
        };
    }
    
    // Hook into resignation
    if (typeof handleResignation === 'function') {
        const originalHandleResignation = handleResignation;
        window.handleResignation = function(resigningPlayer) {
            const winner = resigningPlayer === 'white' ? 'black' : 'white';
            onGameOver(winner, resigningPlayer, `${resigningPlayer} resigned`, 'resignation');
            return originalHandleResignation(resigningPlayer);
        };
    }
    
    // Hook into stalemate detection
    if (typeof handleStalemate === 'function') {
        const originalHandleStalemate = handleStalemate;
        window.handleStalemate = function() {
            onGameOver(null, null, 'Stalemate - it\'s a draw!', 'stalemate');
            return originalHandleStalemate();
        };
    }
    
    // Hook into game save/load functions if they exist
    if (typeof saveGameState === 'function') {
        const originalSaveGame = saveGameState;
        window.saveGameState = function() {
            const gameState = originalSaveGame();
            if (gameState && chessTimer) {
                gameState.timerState = chessTimer.getTimerState();
            }
            return gameState;
        };
    }
    
    if (typeof loadGameState === 'function') {
        const originalLoadGame = loadGameState;
        window.loadGameState = function(gameState) {
            const result = originalLoadGame(gameState);
            if (gameState && gameState.timerState && chessTimer) {
                chessTimer.setTimerState(gameState.timerState);
            }
            return result;
        };
    }
    
}, 1000);

console.log('Chess timer script loaded with dynamic duration selection, victory/defeat modal with close button, and complete timer functionality');