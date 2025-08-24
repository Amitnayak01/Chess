// ========================================
// CHESS GAME CLIENT
// ========================================

const socket = io();

// Chess pieces unicode and images
const pieces = {
    'white': { 'king': '♔', 'queen': '♕', 'rook': '♖', 'bishop': '♗', 'knight': '♘', 'pawn': '♙' },
    'black': { 'king': '♚', 'queen': '♛', 'rook': '♜', 'bishop': '♝', 'knight': '♞', 'pawn': '♟' }
};

const pieceImages = {
    'white': {
        'king': 'img/whiteKing.png', 'queen': 'img/whiteQueen.png', 'rook': 'img/whiteRook.png',
        'bishop': 'img/whiteBishop.png', 'knight': 'img/whiteKnight.png', 'pawn': 'img/whitePawn.png'
    },
    'black': {
        'king': 'img/blackKing.png', 'queen': 'img/blackQueen.png', 'rook': 'img/blackRook.png',
        'bishop': 'img/blackBishop.png', 'knight': 'img/blackKnight.png', 'pawn': 'img/blackPawn.png'
    }
};

// Game state
let gameId = null, playerId = null, playerColor = null, playerName = null;
let currentPlayer = 'white', selectedSquare = null, gameOver = false;
let board = [], moveHistory = [], enPassantTarget = null, pendingPromotion = null;
let capturedPieces = { white: [], black: [] };
let castlingRights = { white: { kingside: true, queenside: true }, black: { kingside: true, queenside: true } };
let players = { white: null, black: null }, spectators = [];


// ========================================
// UTILITY FUNCTIONS
// ========================================

function handleError(error, context = '') {
    console.error(`Error ${context}:`, error);
    const errorMsg = error.message || error.error || error || 'Unknown error occurred';
    showNotification(`Error: ${errorMsg}`, 'error');
}

function showNotification(message, type = 'info') {
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 15px; border-radius: 5px;
            z-index: 1000; max-width: 300px; word-wrap: break-word;
        `;
        document.body.appendChild(notification);
    }

    notification.textContent = message;
    const styles = {
        info: 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;',
        success: 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;',
        error: 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;',
        warning: 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;'
    };
    
    notification.style.cssText += styles[type] || styles.info;
    notification.style.display = 'block';

    setTimeout(() => notification.style.display = 'none', 5000);
}

// ========================================
// BOARD MANAGEMENT
// ========================================

function initializeBoard() {
    board = Array(8).fill().map(() => Array(8).fill(null));
    
    const setup = [
        ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'],
        ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
        ...Array(4).fill(Array(8).fill(null)),
        ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
        ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']
    ];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (setup[row][col]) {
                board[row][col] = {
                    type: setup[row][col],
                    color: row < 2 ? 'black' : 'white',
                    hasMoved: false
                };
            }
        }
    }
}

function createBoard() {
    const chessboard = document.getElementById('chessboard');
    if (!chessboard) return;
    
    chessboard.innerHTML = '';
    const isFlipped = playerColor === 'black';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            
            const displayRow = isFlipped ? 7 - row : row;
            const displayCol = isFlipped ? 7 - col : col;
            
            square.dataset.row = displayRow;
            square.dataset.col = displayCol;
            square.addEventListener('click', handleSquareClick);
            
            const piece = board[displayRow]?.[displayCol];
            if (piece) addPieceToSquare(square, piece);
            
            chessboard.appendChild(square);
        }
    }
    
    showLastMove();
}

function addPieceToSquare(square, piece) {
    const img = document.createElement('img');
    img.src = pieceImages[piece.color][piece.type];
    img.className = 'piece-image';
    img.alt = `${piece.color} ${piece.type}`;
    img.draggable = false;
    
    img.onerror = function() {
        this.style.display = 'none';
        const span = document.createElement('span');
        span.className = 'piece-unicode';
        span.textContent = pieces[piece.color][piece.type];
        span.style.cssText = 'font-size: 40px; display: block; text-align: center; line-height: 60px;';
        square.appendChild(span);
    };
    
    square.appendChild(img);
}

// ========================================
// GAME MANAGEMENT
// ========================================

async function createGame() {
    try {
        const nameInput = document.getElementById('player-name');
        if (!nameInput?.value.trim()) {
            showNotification('Please enter your name', 'warning');
            return;
        }
        
        playerName = nameInput.value.trim();
        
        const response = await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            ({ gameId, playerId, playerColor } = data);
            updateGameState(data.gameState);
            joinSocketRoom();
            showGameInterface();
            updatePlayerInfo();
            showNotification(`Game created! ID: ${gameId}`, 'success');
            
            if (typeof resetNavigation === 'function') resetNavigation();
            
            // Schedule empty room cleanup after game creation
            setTimeout(deleteEmptyRooms, 0);
        } else {
            throw new Error(data.error || 'Failed to create game');
        }
    } catch (error) {
        handleError(error, 'creating game');
    }
}

async function joinGame() {
    try {
        const gameIdInput = document.getElementById('game-id-input');
        const nameInput = document.getElementById('player-name');
        
        if (!gameIdInput?.value.trim()) {
            showNotification('Please enter a game ID', 'warning');
            return;
        }
        
        if (!nameInput?.value.trim()) {
            showNotification('Please enter your name', 'warning');
            return;
        }
        
        const targetGameId = gameIdInput.value.trim();
        playerName = nameInput.value.trim();
        
        const response = await fetch(`/api/games/${targetGameId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            ({ gameId, playerId, playerColor } = data);
            updateGameState(data.gameState);
            joinSocketRoom();
            showGameInterface();
            updatePlayerInfo();
            showNotification(`Joined game ${gameId} as ${playerColor || 'spectator'}!`, 'success');
            
            if (typeof resetNavigation === 'function') resetNavigation();
            
            // Schedule empty room cleanup after joining game
            setTimeout(deleteEmptyRooms, 0);
        } else {
            throw new Error(data.error || 'Failed to join game');
        }
    } catch (error) {
        handleError(error, 'joining game');
    }
}

function joinSocketRoom() {
    if (gameId && playerId) {
        socket.emit('join-game', { gameId, playerId });
    }
}

function showGameInterface() {
    const setup = document.getElementById('game-setup');
    const game = document.getElementById('game-interface');
    const roomList = document.getElementById('room-list');
    
    if (setup) setup.style.display = 'none';
    if (roomList) roomList.style.display = 'none';
    if (game) game.style.display = 'block';
    
    const gameIdDisplay = document.getElementById('game-id-display');
    if (gameIdDisplay) gameIdDisplay.textContent = gameId;
}

function updatePlayerInfo() {
    const playersDiv = document.getElementById('players-list');
    if (!playersDiv) return;
    
    let html = '<h3>Players</h3>';
    html += `<p>♔ White: ${players.white?.name || 'Waiting...'}</p>`;
    html += `<p>♛ Black: ${players.black?.name || 'Waiting...'}</p>`;
    
    if (spectators.length > 0) {
        html += '<h4>Spectators:</h4>';
        spectators.forEach(spec => html += `<p>👁 ${spec.name}</p>`);
    }
    
    playersDiv.innerHTML = html;
}

// ========================================
// EMPTY ROOM CLEANUP SYSTEM
// ========================================

async function deleteEmptyRooms() {
    try {
        // Fetch current games list
        const response = await fetch('/api/games');
        if (!response.ok) {
            console.warn('Failed to fetch games for cleanup');
            return;
        }
        
        const games = await response.json();
        if (!games || !Array.isArray(games)) return;
        
        // Find empty rooms (no players and no spectators)
        const emptyRooms = games.filter(game => {
            const hasPlayers = game.players?.white || game.players?.black;
            const hasSpectators = game.spectators && game.spectators.length > 0;
            return !hasPlayers && !hasSpectators;
        });
        
        console.log(`Found ${emptyRooms.length} empty rooms to delete:`, emptyRooms.map(r => r.gameId));
        
        // Try multiple deletion approaches for each empty room
        for (const room of emptyRooms) {
            let deleted = false;
            const roomId = room.gameId;
            
            // Try different API endpoints
            const endpoints = [
                `/api/games/${roomId}/delete`,
                `/api/games/${roomId}`,
                `/api/rooms/${roomId}/delete`,
                `/api/rooms/${roomId}`,
                `/api/game/${roomId}/delete`,
                `/api/game/${roomId}`
            ];
            
            for (const endpoint of endpoints) {
                if (deleted) break;
                
                try {
                    const deleteResponse = await fetch(endpoint, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (deleteResponse.ok) {
                        console.log(`✅ Successfully deleted empty room: ${roomId} via ${endpoint}`);
                        deleted = true;
                    }
                } catch (error) {
                    // Silent fail, try next endpoint
                }
            }
            
            // If DELETE method didn't work, try POST with action
            if (!deleted) {
                try {
                    const postResponse = await fetch(`/api/games/${roomId}/action`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'delete' })
                    });
                    
                    if (postResponse.ok) {
                        console.log(`✅ Successfully deleted empty room: ${roomId} via POST action`);
                        deleted = true;
                    }
                } catch (error) {
                    // Silent fail
                }
            }
            
            if (!deleted) {
                console.warn(`❌ Failed to delete empty room: ${roomId} - tried all endpoints`);
            }
        }
        
        // Force refresh the games list if we attempted to delete any rooms
        if (emptyRooms.length > 0 && !gameId) {
            setTimeout(() => {
                fetchAvailableGames();
            }, 200);
        }
        
    } catch (error) {
        console.warn('Error in deleteEmptyRooms:', error);
    }
}

// ========================================
// MOVE HANDLING
// ========================================

function handleSquareClick(event) {
    if (gameOver || pendingPromotion) return;
    
    if (typeof isCurrentlyNavigating === 'function' && isCurrentlyNavigating()) {
        showNotification('You are viewing game history. Click "Live" to resume playing.', 'warning');
        return;
    }
    
    const square = event.target.closest('.square');
    if (!square) return;
    
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    
    if (!playerColor || currentPlayer !== playerColor) {
        showNotification('Not your turn!', 'warning');
        return;
    }
    
    if (selectedSquare) {
        if (selectedSquare.row === row && selectedSquare.col === col) {
            clearSelection();
        } else if (isValidMove(selectedSquare.row, selectedSquare.col, row, col)) {
            if (willMoveResultInPromotion(selectedSquare.row, selectedSquare.col, row, col)) {
                pendingPromotion = {
                    from: { row: selectedSquare.row, col: selectedSquare.col },
                    to: { row: row, col: col }
                };
                showPromotionModal();
            } else {
                makeMove(selectedSquare.row, selectedSquare.col, row, col);
            }
        } else {
            const piece = board[row]?.[col];
            if (piece?.color === currentPlayer) {
                selectSquare(row, col);
            } else {
                clearSelection();
            }
        }
    } else {
        const piece = board[row]?.[col];
        if (piece?.color === currentPlayer) {
            selectSquare(row, col);
        }
    }
}

function selectSquare(row, col) {
    selectedSquare = { row, col };
    highlightSquares();
}

function clearSelection() {
    selectedSquare = null;
    clearHighlights();
}

function highlightSquares() {
    clearHighlights();
    if (!selectedSquare) return;
    
    document.querySelectorAll('.square').forEach(square => {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        
        if (row === selectedSquare.row && col === selectedSquare.col) {
            square.classList.add('selected');
        } else if (isValidMove(selectedSquare.row, selectedSquare.col, row, col)) {
            const targetPiece = board[row]?.[col];
            square.classList.add(targetPiece ? 'capture-move' : 'valid-move');
        }
    });
}

function clearHighlights() {
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('selected', 'valid-move', 'capture-move');
    });
}

function showLastMove() {
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('last-move-from', 'last-move-to');
    });
    
    if (moveHistory.length > 0) {
        const lastMove = moveHistory[moveHistory.length - 1];
        if (lastMove?.from && lastMove.to) {
            const fromSquare = document.querySelector(`[data-row="${lastMove.from.row}"][data-col="${lastMove.from.col}"]`);
            const toSquare = document.querySelector(`[data-row="${lastMove.to.row}"][data-col="${lastMove.to.col}"]`);
            
            if (fromSquare) fromSquare.classList.add('last-move-from');
            if (toSquare) toSquare.classList.add('last-move-to');
        }
    }
}

// ========================================
// MOVE VALIDATION
// ========================================

function isValidMove(fromRow, fromCol, toRow, toCol, ignoreCheck = false) {
    // Basic bounds checking
    if (fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7) return false;
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
    
    // Check if there's a piece at the source
    const piece = board[fromRow]?.[fromCol];
    if (!piece) return false;
    
    // Can't move to same square
    if (fromRow === toRow && fromCol === toCol) return false;
    
    // Get target piece
    const targetPiece = board[toRow]?.[toCol];
    
    // Can't capture own pieces
    if (targetPiece && targetPiece.color === piece.color) return false;
    
    // Check piece-specific movement rules
    if (!isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol)) return false;
    
    // Skip check validation if requested (used for check detection itself)
    if (ignoreCheck) return true;
    
    // Simulate the move to see if it leaves king in check
    const originalTarget = targetPiece;
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;
    
    const wouldBeInCheck = isInCheck(piece.color);
    
    // Restore the board
    board[toRow][toCol] = originalTarget;
    board[fromRow][fromCol] = piece;
    
    return !wouldBeInCheck;
}

function isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    switch (piece.type) {
        case 'pawn': return isPawnMoveValid(piece, fromRow, fromCol, toRow, toCol);
        case 'rook': return (rowDiff === 0 || colDiff === 0) && isPathClear(fromRow, fromCol, toRow, toCol);
        case 'bishop': return (rowDiff === colDiff) && isPathClear(fromRow, fromCol, toRow, toCol);
        case 'queen': return (rowDiff === 0 || colDiff === 0 || rowDiff === colDiff) && isPathClear(fromRow, fromCol, toRow, toCol);
        case 'king': return isKingMoveValid(piece, fromRow, fromCol, toRow, toCol);
        case 'knight': return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
        default: return false;
    }
}

function isPawnMoveValid(piece, fromRow, fromCol, toRow, toCol) {
    const direction = piece.color === 'white' ? -1 : 1;
    const startRow = piece.color === 'white' ? 6 : 1;
    const rowDiff = toRow - fromRow;
    const colDiff = Math.abs(toCol - fromCol);
    
    // Forward movement (no capture)
    if (colDiff === 0) {
        const targetPiece = board[toRow]?.[toCol];
        if (targetPiece) return false; // Blocked by piece
        
        // One square forward
        if (rowDiff === direction) return true;
        
        // Two squares forward from starting position
        if (fromRow === startRow && rowDiff === 2 * direction) {
            const intermediateSquare = board[fromRow + direction]?.[fromCol];
            return !intermediateSquare; // Path must be clear
        }
    }
    
    // Diagonal capture
    if (colDiff === 1 && rowDiff === direction) {
        const targetPiece = board[toRow]?.[toCol];
        // Regular capture
        if (targetPiece && targetPiece.color !== piece.color) return true;
        // En passant capture
        if (enPassantTarget && enPassantTarget.row === toRow && enPassantTarget.col === toCol) return true;
    }
    
    return false;
}

function isKingMoveValid(piece, fromRow, fromCol, toRow, toCol) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    if (rowDiff <= 1 && colDiff <= 1) return true;
    
    if (rowDiff === 0 && colDiff === 2 && !piece.hasMoved) {
        return isCastlingValid(piece, fromRow, fromCol, toRow, toCol);
    }
    
    return false;
}

function isCastlingValid(piece, fromRow, fromCol, toRow, toCol) {
    const isKingside = toCol > fromCol;
    const rookCol = isKingside ? 7 : 0;
    const rook = board[fromRow]?.[rookCol];
    
    if (!rook || rook.type !== 'rook' || rook.hasMoved) return false;
    if (isKingside && !castlingRights[piece.color].kingside) return false;
    if (!isKingside && !castlingRights[piece.color].queenside) return false;
    
    const step = isKingside ? 1 : -1;
    for (let col = fromCol + step; col !== toCol + step; col += step) {
        if (board[fromRow]?.[col]) return false;
    }
    
    return true;
}

function isPathClear(fromRow, fromCol, toRow, toCol) {
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    
    // Calculate direction of movement
    const rowDir = rowDiff === 0 ? 0 : rowDiff > 0 ? 1 : -1;
    const colDir = colDiff === 0 ? 0 : colDiff > 0 ? 1 : -1;
    
    // Start from the next square in the direction
    let currentRow = fromRow + rowDir;
    let currentCol = fromCol + colDir;
    
    // Check each square until we reach the destination (excluding destination)
    while (currentRow !== toRow || currentCol !== toCol) {
        // Check if square is occupied
        if (board[currentRow]?.[currentCol]) {
            return false; // Path is blocked
        }
        
        // Move to next square
        currentRow += rowDir;
        currentCol += colDir;
    }
    
    return true; // Path is clear
}

async function makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    try {
        if (gameId && playerId) {
            const response = await fetch(`/api/games/${gameId}/moves`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, fromRow, fromCol, toRow, toCol, promotionPiece })
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Move failed');
            }
        }
    } catch (error) {
        handleError(error, 'making move');
    }
    
    clearSelection();
}

// ========================================
// PROMOTION SYSTEM
// ========================================

function willMoveResultInPromotion(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow]?.[fromCol];
    return piece?.type === 'pawn' && isPromotionRank(toRow, piece.color);
}

function isPromotionRank(row, color) {
    return (color === 'white' && row === 0) || (color === 'black' && row === 7);
}

function showPromotionModal() {
    const modal = document.getElementById('promotion-modal') || createPromotionModal();
    const options = document.getElementById('promotion-options');
    
    options.innerHTML = '';
    
    ['queen', 'rook', 'bishop', 'knight'].forEach(pieceType => {
        const option = document.createElement('div');
        option.className = 'promotion-piece';
        option.onclick = () => executePromotion(pieceType);
        option.style.cssText = `
            display: inline-block; margin: 10px; padding: 10px; border: 2px solid #333;
            border-radius: 5px; cursor: pointer; background: #f0f0f0;
        `;
        
        const img = document.createElement('img');
        img.src = pieceImages[currentPlayer][pieceType];
        img.alt = `${currentPlayer} ${pieceType}`;
        img.style.cssText = 'width: 60px; height: 60px;';
        img.onerror = function() {
            this.style.display = 'none';
            const span = document.createElement('span');
            span.textContent = pieces[currentPlayer][pieceType];
            span.style.cssText = 'font-size: 40px; display: block; text-align: center; line-height: 60px;';
            option.appendChild(span);
        };
        option.appendChild(img);
        options.appendChild(option);
    });
    
    modal.classList.add('show');
    modal.style.display = 'block';
}

function createPromotionModal() {
    const modal = document.createElement('div');
    modal.id = 'promotion-modal';
    modal.style.cssText = `
        display: none; position: fixed; z-index: 1000; left: 0; top: 0;
        width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background-color: #fefefe; margin: 15% auto; padding: 20px; border: none;
        width: 400px; border-radius: 10px; text-align: center;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Choose promotion piece:';
    content.appendChild(title);
    
    const options = document.createElement('div');
    options.id = 'promotion-options';
    content.appendChild(options);
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    return modal;
}

function executePromotion(pieceType) {
    if (!pendingPromotion) return;
    
    const { from, to } = pendingPromotion;
    makeMove(from.row, from.col, to.row, to.col, pieceType);
    hidePromotionModal();
}

function hidePromotionModal() {
    const modal = document.getElementById('promotion-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    pendingPromotion = null;
}

// ========================================
// GAME STATE MANAGEMENT
// ========================================

function updateGameState(gameState) {
    if (!gameState) return;
    
    const previousMoveCount = moveHistory?.length || 0;
    
    // Update all game state variables
    board = gameState.board || board;
    currentPlayer = gameState.currentPlayer || currentPlayer;
    gameOver = gameState.gameOver || false;
    moveHistory = gameState.moveHistory || [];
    capturedPieces = gameState.capturedPieces || { white: [], black: [] };
    enPassantTarget = gameState.enPassantTarget || null;
    castlingRights = gameState.castlingRights || {
        white: { kingside: true, queenside: true },
        black: { kingside: true, queenside: true }
    };
    players = gameState.players || { white: null, black: null };
    spectators = gameState.spectators || [];
    
    const newMoveCount = moveHistory.length;
    if (newMoveCount > previousMoveCount) {
        if (typeof storeMoveState === 'function') {
            const lastMove = moveHistory[moveHistory.length - 1];
            storeMoveState(gameState, lastMove);
        }
    } else if (typeof updateLiveGameState === 'function') {
        updateLiveGameState(gameState);
    }
    
    updateCurrentPlayerDisplay();
    updateGameStatus(gameState.status);
    updateCapturedPieces();
    updatePlayerInfo();
    createBoard();
    
    if (window.drawSystem?.updateDrawSystemForGameState) {
        window.drawSystem.updateDrawSystemForGameState(gameState);
    }
}

function updateCurrentPlayerDisplay() {
    const element = document.getElementById('current-player');
    if (element) {
        element.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
    }
}

// ========================================
// CHECK AND CHECKMATE DETECTION
// ========================================

function isInCheck(color) {
    const kingPos = findKing(color);
    if (!kingPos) return false;
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row]?.[col];
            if (piece?.color !== color && isValidMove(row, col, kingPos.row, kingPos.col, true)) {
                return true;
            }
        }
    }
    return false;
}

function isCheckmate(color) {
    if (!isInCheck(color)) return false;
    
    const kingPos = findKing(color);
    if (kingPos && kingCanMove(kingPos, color)) return false;
    if (canBlockOrCaptureCheck(color)) return false;
    
    return true;
}

function kingCanMove(kingPos, color) {
    const directions = [
        [-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]
    ];

    for (const [rowDir, colDir] of directions) {
        const newRow = kingPos.row + rowDir;
        const newCol = kingPos.col + colDir;

        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece || targetPiece.color !== color) {
                const king = board[kingPos.row][kingPos.col];
                const originalPiece = targetPiece;
                
                board[newRow][newCol] = king;
                board[kingPos.row][kingPos.col] = null;
                
                const stillInCheck = isInCheck(color);
                
                board[newRow][newCol] = originalPiece;
                board[kingPos.row][kingPos.col] = king;

                if (!stillInCheck) return true;
            }
        }
    }
    return false;
}

function canBlockOrCaptureCheck(color) {
    const kingPos = findKing(color);
    const checkingPieces = findCheckingPieces(color, kingPos);
    
    if (checkingPieces.length > 1) return false;
    
    const checkingPiece = checkingPieces[0];
    
    if (canPieceBeCaptured(checkingPiece, color)) return true;
    
    if (checkingPiece.type !== 'knight' && checkingPiece.type !== 'pawn') {
        const path = getPathBetweenPieces(kingPos, checkingPiece);
        for (const square of path) {
            if (canPieceBeBlocked(square, color)) return true;
        }
    }
    
    return false;
}

function findCheckingPieces(color, kingPos) {
    const checkingPieces = [];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row]?.[col];
            if (piece?.color !== color && isValidMove(row, col, kingPos.row, kingPos.col, true)) {
                checkingPieces.push({ row, col, type: piece.type, color: piece.color });
            }
        }
    }
    
    return checkingPieces;
}

function canPieceBeCaptured(checkingPiece, color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row]?.[col];
            if (piece?.color === color && piece.type !== 'king') {
                if (isValidMove(row, col, checkingPiece.row, checkingPiece.col, true)) {
                    const originalPiece = checkingPiece;
                    board[checkingPiece.row][checkingPiece.col] = piece;
                    board[row][col] = null;

                    const stillInCheck = isInCheck(color);

                    board[checkingPiece.row][checkingPiece.col] = originalPiece;
                    board[row][col] = piece;

                    if (!stillInCheck) return true;
                }
            }
        }
    }
    return false;
}

function getPathBetweenPieces(kingPos, piecePos) {
    const path = [];
    const rowDiff = piecePos.row - kingPos.row;
    const colDiff = piecePos.col - kingPos.col;
    
    if (rowDiff !== 0 && colDiff !== 0 && Math.abs(rowDiff) !== Math.abs(colDiff)) {
        return path;
    }
    
    const rowStep = rowDiff === 0 ? 0 : rowDiff > 0 ? 1 : -1;
    const colStep = colDiff === 0 ? 0 : colDiff > 0 ? 1 : -1;
    
    let row = kingPos.row + rowStep;
    let col = kingPos.col + colStep;
    
    while (row !== piecePos.row || col !== piecePos.col) {
        path.push({row, col});
        row += rowStep;
        col += colStep;
    }
    
    return path;
}

function canPieceBeBlocked(blockSquare, color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row]?.[col];
            if (piece?.color === color && piece.type !== 'king') {
                if (isValidMove(row, col, blockSquare.row, blockSquare.col, true)) {
                    const originalPiece = board[blockSquare.row][blockSquare.col];
                    board[blockSquare.row][blockSquare.col] = piece;
                    board[row][col] = null;

                    const stillInCheck = isInCheck(color);

                    board[blockSquare.row][blockSquare.col] = originalPiece;
                    board[row][col] = piece;

                    if (!stillInCheck) return true;
                }
            }
        }
    }
    return false;
}

function updateGameStatus(status) {
    const statusElement = document.getElementById('game-status');
    const squares = document.querySelectorAll('.square');
    
    squares.forEach(square => square.classList.remove('in-check'));
    
    if (!statusElement) return;
    
    if (isCheckmate(currentPlayer)) {
        const winner = currentPlayer === 'white' ? 'Black' : 'White';
        statusElement.textContent = `Checkmate! ${winner} wins!`;
        statusElement.className = 'status checkmate';
        showNotification(`Checkmate! ${winner} wins!`, 'success');
        return;
    }
    
    switch (status) {
        case 'check':
            if (isInCheck(currentPlayer)) {
                statusElement.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} is in check!`;
                statusElement.className = 'status check';
                
                const kingPos = findKing(currentPlayer);
                if (kingPos) {
                    const kingSquare = document.querySelector(`[data-row="${kingPos.row}"][data-col="${kingPos.col}"]`);
                    kingSquare?.classList.add('in-check');
                }
            }
            break;
        case 'stalemate':
            statusElement.textContent = 'Stalemate! Game is a draw.';
            statusElement.className = 'status stalemate';
            showNotification('Stalemate! Game is a draw.', 'info');
            break;
        case 'draw':
            statusElement.textContent = 'Game ended in a draw by mutual agreement.';
            statusElement.className = 'status draw';
            break;
        default:
            statusElement.textContent = '';
            statusElement.className = 'status';
    }
}

function findKing(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row]?.[col];
            if (piece?.type === 'king' && piece.color === color) {
                return { row, col };
            }
        }
    }
    return null;
}

function updateCapturedPieces() {
    const capturedWhite = document.getElementById('captured-white');
    const capturedBlack = document.getElementById('captured-black');
    
    if (capturedWhite) {
        capturedWhite.textContent = capturedPieces.white.map(piece => pieces[piece.color][piece.type]).join(' ');
    }
    if (capturedBlack) {
        capturedBlack.textContent = capturedPieces.black.map(piece => pieces[piece.color][piece.type]).join(' ');
    }
}

// ========================================
// GAME LIST MANAGEMENT
// ========================================

async function fetchAvailableGames() {
    try {
        const response = await fetch('/api/games');
        if (response.ok) {
            const games = await response.json();
            displayAvailableGames(games);
            
            // Clean up empty rooms after fetching games list
            setTimeout(deleteEmptyRooms, 0);
        } else {
            throw new Error('Failed to fetch games list');
        }
    } catch (error) {
        handleError(error, 'fetching available games');
    }
}

function displayAvailableGames(games) {
    const roomListDiv = document.getElementById('room-list');
    if (!roomListDiv) return;
    
    roomListDiv.innerHTML = '';
    
    // Filter out empty games from display while deletion is in progress
    const nonEmptyGames = games.filter(game => {
        const hasPlayers = game.players?.white || game.players?.black;
        const hasSpectators = game.spectators && game.spectators > 0;
        return hasPlayers || hasSpectators;
    });
    
    if (!nonEmptyGames?.length) {
        roomListDiv.innerHTML = '<p>No games available. Create a new game to start playing!</p>';
        return;
    }
    
    const container = document.createElement('div');
    container.className = 'games-container';
    
    nonEmptyGames.forEach(game => {
        const gameDiv = document.createElement('div');
        gameDiv.className = 'game-room';
        gameDiv.style.cssText = `
            border: 1px solid #ddd; padding: 15px; margin: 10px 0;
            border-radius: 5px; background: #f9f9f9;
        `;
        
        const info = document.createElement('div');
        info.innerHTML = `
            <strong>Game: ${game.gameId}</strong><br>
            Players: ${getPlayersInfo(game.players)} (${game.spectators || 0} spectators)<br>
            Status: ${game.gameOver ? 'Finished' : 'Active'}<br>
            Current Turn: ${game.currentPlayer || 'N/A'}<br>
            Last Activity: ${formatTime(game.lastActivity)}
        `;
        
        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'Join';
        joinBtn.style.cssText = `
            background: #4CAF50; color: white; border: none; padding: 8px 16px;
            border-radius: 4px; cursor: pointer; margin-top: 10px;
        `;
        joinBtn.onclick = () => joinSpecificGame(game.gameId);
        
        gameDiv.appendChild(info);
        gameDiv.appendChild(joinBtn);
        container.appendChild(gameDiv);
    });
    
    roomListDiv.appendChild(container);
}

function getPlayersInfo(players) {
    const white = players.white?.name || 'Empty';
    const black = players.black?.name || 'Empty';
    return `${white} vs ${black}`;
}

function formatTime(timestamp) {
    return timestamp ? new Date(timestamp).toLocaleTimeString() : 'Unknown';
}

async function joinSpecificGame(targetGameId) {
    try {
        if (!playerName) {
            playerName = prompt('Enter your name:');
            if (!playerName?.trim()) {
                showNotification('Please enter a valid name', 'warning');
                return;
            }
            playerName = playerName.trim();
        }
        
        const response = await fetch(`/api/games/${targetGameId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            ({ gameId, playerId, playerColor } = data);
            updateGameState(data.gameState);
            joinSocketRoom();
            showGameInterface();
            updatePlayerInfo();
            showNotification(`Joined game ${gameId} as ${playerColor || 'spectator'}!`, 'success');
            
            if (typeof resetNavigation === 'function') resetNavigation();
            
            // Schedule empty room cleanup after joining specific game
            setTimeout(deleteEmptyRooms, 0);
        } else {
            throw new Error(data.error || 'Failed to join game');
        }
    } catch (error) {
        handleError(error, 'joining specific game');
    }
}

function updateDrawButtonState() {
    if (window.drawSystem?.updateDrawButtonState) {
        window.drawSystem.updateDrawButtonState();
    }
}

// ========================================
// SOCKET EVENT LISTENERS
// ========================================

socket.on('game-state', updateGameState);
socket.on('move', (data) => {
    updateGameState(data.gameState);
    clearSelection();
});

socket.on('player-joined', (data) => {
    players = data.players || players;
    spectators = data.spectators || spectators;
    updatePlayerInfo();
    showNotification(`Player joined: ${data.playerName}`, 'info');
});

socket.on('player-left', (data) => {
    players = data.players || players;
    spectators = data.spectators || spectators;
    updatePlayerInfo();
    showNotification('A player left the game', 'info');
    
    // Schedule empty room cleanup after player disconnection
    setTimeout(deleteEmptyRooms, 0);
});

socket.on('invalid-move', (data) => {
    handleError(data, 'move validation');
    clearSelection();
});

socket.on('error', (data) => handleError(data, 'socket'));

socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
    fetchAvailableGames();
    
    // Clean up empty rooms on initial connection
    setTimeout(deleteEmptyRooms, 100);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    showNotification('Disconnected from server', 'warning');
});

socket.on('connect_error', (error) => handleError(error, 'connection'));

// Draw system events
socket.on('draw-offer-sent', (data) => {
    showNotification(`Draw offer sent to ${data.opponent}`, 'info');
    updateDrawButtonState();
});

socket.on('draw-accepted', (data) => {
    updateGameState(data.gameState);
    if (window.drawSystem?.handleDrawAccepted) {
        window.drawSystem.handleDrawAccepted();
    }
});

socket.on('draw-cancelled', (data) => {
    if (window.drawSystem?.resetDrawSystem) {
        window.drawSystem.resetDrawSystem();
    }
    showNotification(data.message || 'Draw offer cancelled', 'info');
});

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    createBoard();
    updateCurrentPlayerDisplay();
    updateCapturedPieces();
    fetchAvailableGames();
    
    // Event listeners
    document.getElementById('create-game-btn')?.addEventListener('click', createGame);
    document.getElementById('join-game-btn')?.addEventListener('click', joinGame);
    
    // Initialize navigation system
    setTimeout(() => {
        if (typeof initializeNavigation === 'function') {
            initializeNavigation();
        }
    }, 1500);
});

// Auto-refresh games list every 30 seconds when not in a game
setInterval(() => {
    if (!gameId) {
        fetchAvailableGames();
        // Also clean up empty rooms periodically
        setTimeout(deleteEmptyRooms, 500);
    }
}, 30000);

// Aggressive empty room cleanup every 2 seconds
setInterval(() => {
    deleteEmptyRooms();
}, 2000);










// sound
{

// ========================================
// ENHANCED CHESS GAME SOUND SYSTEM
// ========================================

class ChessSoundManager {
    constructor() {
        this.sounds = {};
        this.isEnabled = true;
        this.volume = 0.7;
        this.audioContext = null;
        this.preloadedSounds = new Map();
        this.isInitialized = false;
        
        this.initializeAudioContext();
        this.loadSounds();
        this.setupVolumeControl();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume audio context on first user interaction
            document.addEventListener('click', () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
            }, { once: true });
            
        } catch (error) {
            console.warn('Web Audio API not supported, using HTML5 audio only');
            this.audioContext = null;
        }
    }

    loadSounds() {
        // Generate all sounds using Web Audio API for better reliability
        this.generateAllSounds();
        this.isInitialized = true;
    }

    generateAllSounds() {
        // Sound definitions with frequencies and durations
        const soundConfigs = {
            // Basic move sounds
            move: { frequency: 800, duration: 0.08, type: 'sine', envelope: 'soft' },
            capture: { frequency: 600, duration: 0.12, type: 'sawtooth', envelope: 'sharp' },
            
            // Special moves
            castle: { frequency: 750, duration: 0.15, type: 'triangle', envelope: 'bounce' },
            promotion: { frequency: 1200, duration: 0.25, type: 'sine', envelope: 'rise' },
            enPassant: { frequency: 900, duration: 0.10, type: 'square', envelope: 'quick' },
            
            // Game states
            check: { frequency: 400, duration: 0.2, type: 'sawtooth', envelope: 'urgent' },
            checkmate: { frequency: 300, duration: 0.5, type: 'sine', envelope: 'dramatic' },
            stalemate: { frequency: 500, duration: 0.4, type: 'triangle', envelope: 'fade' },
            draw: { frequency: 650, duration: 0.3, type: 'sine', envelope: 'neutral' },
            
            // UI sounds
            select: { frequency: 1000, duration: 0.05, type: 'sine', envelope: 'click' },
            deselect: { frequency: 800, duration: 0.04, type: 'sine', envelope: 'click' },
            invalidMove: { frequency: 200, duration: 0.15, type: 'sawtooth', envelope: 'error' },
            
            // Player events
            playerJoin: { frequency: 900, duration: 0.12, type: 'sine', envelope: 'welcome' },
            playerLeave: { frequency: 400, duration: 0.1, type: 'triangle', envelope: 'goodbye' },
            spectatorJoin: { frequency: 700, duration: 0.08, type: 'sine', envelope: 'soft' },
            
            // Draw system
            drawOffer: { frequency: 800, duration: 0.2, type: 'triangle', envelope: 'question' },
            drawAccepted: { frequency: 650, duration: 0.3, type: 'sine', envelope: 'agreement' },
            drawDeclined: { frequency: 450, duration: 0.15, type: 'sawtooth', envelope: 'decline' },
            
            // Timer sounds
            timerTick: { frequency: 1000, duration: 0.03, type: 'sine', envelope: 'tick' },
            timerWarning: { frequency: 1200, duration: 0.08, type: 'sine', envelope: 'urgent' },
            timeUp: { frequency: 300, duration: 0.4, type: 'sawtooth', envelope: 'alarm' },
            
            // System sounds
            gameStart: { frequency: 800, duration: 0.2, type: 'sine', envelope: 'fanfare' },
            gameEnd: { frequency: 600, duration: 0.3, type: 'triangle', envelope: 'conclusion' },
            undo: { frequency: 700, duration: 0.1, type: 'triangle', envelope: 'reverse' },
            reset: { frequency: 500, duration: 0.25, type: 'sine', envelope: 'reset' },
            
            // New enhanced sounds
            kingInDanger: { frequency: 350, duration: 0.18, type: 'sawtooth', envelope: 'danger' },
            pieceBlocked: { frequency: 250, duration: 0.1, type: 'square', envelope: 'blocked' },
            goodMove: { frequency: 1100, duration: 0.12, type: 'sine', envelope: 'positive' },
            brilliant: { frequency: 1400, duration: 0.3, type: 'sine', envelope: 'brilliant' },
            mistake: { frequency: 180, duration: 0.2, type: 'sawtooth', envelope: 'negative' },
            
            // Piece-specific sounds
            pawnMove: { frequency: 650, duration: 0.06, type: 'sine', envelope: 'light' },
            rookMove: { frequency: 450, duration: 0.1, type: 'square', envelope: 'heavy' },
            bishopMove: { frequency: 950, duration: 0.08, type: 'triangle', envelope: 'swift' },
            knightMove: { frequency: 750, duration: 0.09, type: 'sawtooth', envelope: 'jump' },
            queenMove: { frequency: 850, duration: 0.11, type: 'sine', envelope: 'royal' },
            kingMove: { frequency: 550, duration: 0.13, type: 'triangle', envelope: 'majestic' }
        };

        Object.entries(soundConfigs).forEach(([name, config]) => {
            this.sounds[name] = this.generateAdvancedTone(config);
        });
    }

    // ========================================
    // ENHANCED SOUND GENERATION
    // ========================================

    generateAdvancedTone(config) {
        if (!this.audioContext) {
            // Fallback to simple beep for browsers without Web Audio API
            return this.createFallbackBeep(config.frequency, config.duration);
        }

        const { frequency, duration, type = 'sine', envelope = 'soft' } = config;
        const sampleRate = this.audioContext.sampleRate;
        const numSamples = Math.floor(duration * sampleRate);
        const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const progress = t / duration;
            
            // Generate base waveform
            let sample = this.generateWaveform(type, frequency, t);
            
            // Apply envelope
            sample *= this.applyEnvelope(envelope, progress, t, duration);
            
            // Apply volume and prevent clipping
            data[i] = Math.max(-1, Math.min(1, sample * 0.3));
        }

        return buffer;
    }

    generateWaveform(type, frequency, time) {
        const omega = 2 * Math.PI * frequency * time;
        
        switch (type) {
            case 'sine':
                return Math.sin(omega);
            case 'sawtooth':
                return 2 * (omega / (2 * Math.PI) - Math.floor(0.5 + omega / (2 * Math.PI)));
            case 'triangle':
                return 2 * Math.abs(2 * (omega / (2 * Math.PI) - Math.floor(0.5 + omega / (2 * Math.PI)))) - 1;
            case 'square':
                return Math.sin(omega) > 0 ? 1 : -1;
            default:
                return Math.sin(omega);
        }
    }

    applyEnvelope(envelope, progress, time, duration) {
        switch (envelope) {
            case 'soft':
                return Math.sin(progress * Math.PI);
            
            case 'sharp':
                return progress < 0.1 ? progress * 10 : Math.pow(1 - progress, 2);
            
            case 'bounce':
                const bounce = Math.abs(Math.sin(progress * Math.PI * 3));
                return bounce * Math.sin(progress * Math.PI);
            
            case 'rise':
                return Math.pow(progress, 0.3) * Math.sin((1 - progress) * Math.PI);
            
            case 'quick':
                return Math.exp(-progress * 8) * Math.sin(progress * Math.PI * 2);
            
            case 'urgent':
                const tremolo = 1 + 0.3 * Math.sin(time * 20);
                return tremolo * Math.sin(progress * Math.PI);
            
            case 'dramatic':
                return Math.sin(progress * Math.PI) * (1 - 0.5 * Math.sin(progress * Math.PI * 4));
            
            case 'fade':
                return Math.exp(-progress * 3) * Math.sin(progress * Math.PI);
            
            case 'neutral':
                return Math.sin(progress * Math.PI) * 0.8;
            
            case 'click':
                return Math.exp(-progress * 15);
            
            case 'error':
                const buzz = 1 + 0.5 * Math.sin(time * 40);
                return buzz * Math.exp(-progress * 5);
            
            case 'welcome':
                return Math.sin(progress * Math.PI) * (1 + 0.2 * Math.sin(progress * Math.PI * 8));
            
            case 'goodbye':
                return Math.sin(progress * Math.PI) * Math.exp(-progress * 2);
            
            case 'question':
                return Math.sin(progress * Math.PI) * (1 + 0.1 * Math.sin(progress * Math.PI * 12));
            
            case 'agreement':
                return Math.sin(progress * Math.PI) * (1 + 0.3 * Math.sin(progress * Math.PI * 6));
            
            case 'decline':
                return Math.sin(progress * Math.PI) * Math.exp(-progress * 4);
            
            case 'tick':
                return Math.exp(-progress * 20);
            
            case 'alarm':
                const alarm = Math.sin(time * 15);
                return alarm * Math.sin(progress * Math.PI);
            
            case 'fanfare':
                return Math.sin(progress * Math.PI) * (1 + 0.5 * Math.sin(progress * Math.PI * 6));
            
            case 'conclusion':
                return Math.sin(progress * Math.PI) * (1 - progress * 0.5);
            
            case 'reverse':
                return Math.sin((1 - progress) * Math.PI);
            
            case 'reset':
                return Math.sin(progress * Math.PI) * Math.exp(-progress * 2);
            
            case 'danger':
                const danger = 1 + 0.4 * Math.sin(time * 25);
                return danger * Math.sin(progress * Math.PI);
            
            case 'blocked':
                return Math.exp(-progress * 10) * (1 + Math.sin(time * 50));
            
            case 'positive':
                return Math.sin(progress * Math.PI) * (1 + 0.3 * Math.sin(progress * Math.PI * 10));
            
            case 'brilliant':
                const sparkle = 1 + 0.2 * Math.sin(progress * Math.PI * 16);
                return sparkle * Math.sin(progress * Math.PI);
            
            case 'negative':
                const dissonance = 1 + 0.6 * Math.sin(time * 13);
                return dissonance * Math.exp(-progress * 3);
            
            case 'light':
                return Math.sin(progress * Math.PI) * 0.6;
            
            case 'heavy':
                return Math.sin(progress * Math.PI) * (1 + 0.2 * Math.exp(-progress * 5));
            
            case 'swift':
                return Math.sin(progress * Math.PI) * (1 + 0.4 * Math.sin(progress * Math.PI * 3));
            
            case 'jump':
                const hop = progress < 0.3 ? Math.sin(progress * Math.PI / 0.3) : 
                           progress < 0.6 ? 0.5 : Math.sin((progress - 0.6) * Math.PI / 0.4);
                return hop;
            
            case 'royal':
                return Math.sin(progress * Math.PI) * (1 + 0.15 * Math.sin(progress * Math.PI * 8));
            
            case 'majestic':
                return Math.sin(progress * Math.PI) * (1 + 0.1 * Math.sin(progress * Math.PI * 4));
            
            default:
                return Math.sin(progress * Math.PI);
        }
    }

    createFallbackBeep(frequency, duration) {
        // Create a simple oscillator-based sound for fallback
        return { frequency, duration, type: 'fallback' };
    }

    setupVolumeControl() {
        // Create sound control panel if it doesn't exist
        if (!document.getElementById('sound-controls')) {
            this.createSoundControls();
        }
    }

    createSoundControls() {
        const soundControls = document.createElement('div');
        soundControls.id = 'sound-controls';
        soundControls.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 14px;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
        `;

        soundControls.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <button id="sound-toggle" style="
                    padding: 8px 12px; border: none; border-radius: 6px; cursor: pointer;
                    background: #4CAF50; color: white; font-weight: bold;
                    transition: all 0.3s ease;
                ">🔊 ON</button>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 12px;">Volume:</span>
                    <input id="volume-slider" type="range" min="0" max="100" value="${this.volume * 100}" 
                           style="width: 90px;" title="Volume">
                    <span id="volume-display" style="font-size: 11px; min-width: 25px;">${Math.round(this.volume * 100)}%</span>
                </div>
                <button id="test-sound" style="
                    padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;
                    background: #2196F3; color: white; font-size: 12px;
                ">Test</button>
            </div>
        `;

        document.body.appendChild(soundControls);

        // Event listeners
        document.getElementById('sound-toggle').addEventListener('click', () => {
            this.toggleSound();
        });

        document.getElementById('volume-slider').addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.setVolume(volume);
            document.getElementById('volume-display').textContent = `${Math.round(volume * 100)}%`;
        });

        document.getElementById('test-sound').addEventListener('click', () => {
            this.playSound('move');
        });
    }

    // ========================================
    // SOUND CONTROL METHODS
    // ========================================

    toggleSound() {
        this.isEnabled = !this.isEnabled;
        const button = document.getElementById('sound-toggle');
        if (button) {
            button.textContent = this.isEnabled ? '🔊 ON' : '🔇 OFF';
            button.style.background = this.isEnabled ? '#4CAF50' : '#f44336';
        }
        
        if (this.isEnabled) {
            // Resume audio context if suspended
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.playSound('select');
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    // ========================================
    // CORE SOUND PLAYING METHODS
    // ========================================

    playSound(soundName, options = {}) {
        if (!this.isEnabled || !this.isInitialized) return;
        
        try {
            // Resume audio context if suspended
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const sound = this.sounds[soundName];
            if (!sound) {
                console.warn(`Sound not found: ${soundName}`);
                return;
            }

            if (sound.type === 'fallback') {
                this.playFallbackSound(sound, options);
            } else {
                this.playWebAudioSound(sound, options);
            }
        } catch (error) {
            console.warn(`Error playing sound ${soundName}:`, error);
        }
    }

    playWebAudioSound(buffer, options = {}) {
        if (!this.audioContext || !buffer) return;

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        gainNode.gain.value = (options.volume || this.volume) * (options.volumeMultiplier || 1);
        
        source.start();
    }

    playFallbackSound(config, options = {}) {
        // Simple oscillator fallback
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = config.frequency;
        oscillator.type = 'sine';
        
        const volume = (options.volume || this.volume) * 0.1;
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + config.duration);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + config.duration);
    }

    // ========================================
    // ENHANCED GAME-SPECIFIC SOUND METHODS
    // ========================================

    playMoveSound(moveData = {}) {
        // Intelligent sound selection based on move data
        if (moveData.isCapture) {
            this.playSound('capture');
        } else if (moveData.isCastle) {
            this.playSound('castle');
        } else if (moveData.isPromotion) {
            this.playSound('promotion');
        } else if (moveData.isEnPassant) {
            this.playSound('enPassant');
        } else if (moveData.piece) {
            // Play piece-specific sound
            const pieceSound = moveData.piece.type + 'Move';
            if (this.sounds[pieceSound]) {
                this.playSound(pieceSound);
            } else {
                this.playSound('move');
            }
        } else {
            this.playSound('move');
        }
    }

    playGameStateSound(gameState) {
        if (gameState.isCheckmate) {
            this.playSound('checkmate');
        } else if (gameState.isStalemate) {
            this.playSound('stalemate');
        } else if (gameState.isCheck) {
            this.playSound('check');
        } else if (gameState.isDraw) {
            this.playSound('draw');
        }
    }

    playPieceSelectSound(piece) {
        this.playSound('select');
        // Add subtle piece-specific overtone
        if (piece && this.sounds[piece.type + 'Move']) {
            setTimeout(() => {
                this.playSound(piece.type + 'Move', { volume: 0.3, volumeMultiplier: 0.5 });
            }, 50);
        }
    }

    playInvalidMoveSound() {
        this.playSound('invalidMove');
        // Add emphasis with a second error sound
        setTimeout(() => {
            this.playSound('pieceBlocked', { volume: 0.5 });
        }, 100);
    }

    // Standard sound methods
    playCaptureSound() { this.playSound('capture'); }
    playCheckSound() { this.playSound('check'); }
    playCheckmateSound() { this.playSound('checkmate'); }
    playDrawSound() { this.playSound('draw'); }
    playDrawOfferSound() { this.playSound('drawOffer'); }
    playPlayerJoinSound() { this.playSound('playerJoin'); }
    playPlayerLeaveSound() { this.playSound('playerLeave'); }
    playTimerWarningSound() { this.playSound('timerWarning'); }
    playUndoSound() { this.playSound('undo'); }
    playResetSound() { this.playSound('reset'); }
    playCastleSound() { this.playSound('castle'); }
    playPromotionSound() { this.playSound('promotion'); }

    // New enhanced sound methods
    playKingInDangerSound() { this.playSound('kingInDanger'); }
    playGoodMoveSound() { this.playSound('goodMove'); }
    playBrilliantSound() { this.playSound('brilliant'); }
    playMistakeSound() { this.playSound('mistake'); }
    playGameStartSound() { this.playSound('gameStart'); }
    playGameEndSound() { this.playSound('gameEnd'); }
    playSpectatorJoinSound() { this.playSound('spectatorJoin'); }

    // ========================================
    // ADVANCED FEATURES
    // ========================================

    playSequence(sounds, interval = 150) {
        if (!this.isEnabled) return;
        
        sounds.forEach((soundName, index) => {
            setTimeout(() => this.playSound(soundName), index * interval);
        });
    }

    playTimerTick(secondsLeft) {
        if (secondsLeft <= 10 && secondsLeft > 0) {
            this.playSound('timerTick');
            if (secondsLeft <= 3) {
                this.playSound('timerWarning', { volume: 0.8 });
            }
        }
    }

    playRandomVariation(baseSoundName, variations = ['', '2', '3']) {
        const variation = variations[Math.floor(Math.random() * variations.length)];
        const soundName = baseSoundName + variation;
        if (this.sounds[soundName]) {
            this.playSound(soundName);
        } else {
            this.playSound(baseSoundName);
        }
    }

    // Enhanced move analysis
    analyzeMoveForSound(moveData, gameState = {}) {
        if (!moveData) return this.playMoveSound();

        // Determine move significance
        if (gameState.isCheckmate) {
            this.playSound('checkmate');
            return;
        }

        if (gameState.isCheck) {
            this.playSound('check');
            return;
        }

        // Analyze move quality (simplified)
        if (moveData.capturedPiece) {
            if (moveData.capturedPiece.type === 'queen') {
                this.playSound('brilliant');
                return;
            } else if (moveData.capturedPiece.type === 'rook') {
                this.playSound('goodMove');
                return;
            }
        }

        // Play appropriate move sound
        this.playMoveSound({
            isCapture: moveData.capturedPiece !== null,
            isCastle: moveData.castle || moveData.isCastle,
            isPromotion: moveData.promotion || moveData.promotionPiece,
            isEnPassant: moveData.enPassant,
            piece: moveData.piece
        });
    }

    // Cleanup method
    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        const soundControls = document.getElementById('sound-controls');
        if (soundControls) {
            soundControls.remove();
        }
    }
}

// ========================================
// GLOBAL SOUND MANAGER INSTANCE
// ========================================

// Create global instance
const chessSounds = new ChessSoundManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = chessSounds;
} else if (typeof window !== 'undefined') {
    window.chessSounds = chessSounds;
}

// ========================================
// ENHANCED INTEGRATION WITH CHESS GAME
// ========================================

function integrateSoundsWithChessGame() {
    if (typeof window !== 'undefined') {
        
        // Enhanced integration with existing game functions
        const originalHandleSquareClick = window.handleSquareClick;
        const originalSelectSquare = window.selectSquare;
        const originalClearSelection = window.clearSelection;
        const originalMakeMove = window.makeMove;
        const originalUpdateGameState = window.updateGameState;
        const originalIsValidMove = window.isValidMove;
        
        // Override square selection to add sounds
        if (originalSelectSquare) {
            window.selectSquare = function(row, col) {
                const piece = board[row]?.[col];
                chessSounds.playPieceSelectSound(piece);
                return originalSelectSquare.apply(this, arguments);
            };
        }

        // Override clear selection to add sound
        if (originalClearSelection) {
            window.clearSelection = function() {
                chessSounds.playSound('deselect', { volume: 0.5 });
                return originalClearSelection.apply(this, arguments);
            };
        }

        // Enhanced move validation with sound feedback
        if (originalIsValidMove) {
            window.isValidMove = function(fromRow, fromCol, toRow, toCol, ignoreCheck) {
                const result = originalIsValidMove.apply(this, arguments);
                
                // Only play invalid sound during actual move attempts, not during validation checks
                if (!result && !ignoreCheck && selectedSquare && 
                    selectedSquare.row === fromRow && selectedSquare.col === fromCol) {
                    // Only if this is likely a user move attempt
                    setTimeout(() => chessSounds.playInvalidMoveSound(), 50);
                }
                
                return result;
            };
        }

        // Enhanced move execution with detailed sound analysis
        if (originalMakeMove) {
            window.makeMove = function(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
                // Capture move data before making the move
                const piece = board[fromRow]?.[fromCol];
                const targetPiece = board[toRow]?.[toCol];
                
                const moveData = {
                    piece: piece,
                    capturedPiece: targetPiece,
                    promotionPiece: promotionPiece,
                    isCastle: piece?.type === 'king' && Math.abs(toCol - fromCol) === 2,
                    isEnPassant: piece?.type === 'pawn' && targetPiece === null && 
                                fromCol !== toCol && enPassantTarget &&
                                enPassantTarget.row === toRow && enPassantTarget.col === toCol
                };
                
                // Call original function
                const result = originalMakeMove.apply(this, arguments);
                
                // Play sound after successful move
                chessSounds.analyzeMoveForSound(moveData, {
                    isCheck: typeof isInCheck === 'function' ? isInCheck(currentPlayer) : false
                });
                
                return result;
            };
        }

        // Enhanced game state updates with comprehensive sound handling
        if (originalUpdateGameState) {
            let previousGameState = null;
            
            window.updateGameState = function(gameState) {
                const result = originalUpdateGameState.apply(this, arguments);
                
                if (gameState && previousGameState) {
                    // Detect and handle game state changes
                    if (gameState.gameOver && !previousGameState.gameOver) {
                        if (gameState.status === 'checkmate') {
                            chessSounds.playCheckmateSound();
                        } else if (gameState.status === 'draw' || gameState.status === 'stalemate') {
                            chessSounds.playDrawSound();
                        }
                    } else if (gameState.status === 'check' && previousGameState.status !== 'check') {
                        chessSounds.playCheckSound();
                    }

                    // Detect player changes
                    if (gameState.players && previousGameState.players) {
                        // Check for new players
                        ['white', 'black'].forEach(color => {
                            if (gameState.players[color] && !previousGameState.players[color]) {
                                chessSounds.playPlayerJoinSound();
                            } else if (!gameState.players[color] && previousGameState.players[color]) {
                                chessSounds.playPlayerLeaveSound();
                            }
                        });
                    }

                    // Detect spectator changes
                    if (gameState.spectators && previousGameState.spectators) {
                        if (gameState.spectators.length > previousGameState.spectators.length) {
                            chessSounds.playSpectatorJoinSound();
                        }
                    }
                }
                
                previousGameState = gameState ? { ...gameState } : null;
                return result;
            };
        }

        // Integrate with draw system
        const originalSocket = window.socket;
        if (originalSocket) {
            originalSocket.on('draw-offer-received', () => {
                chessSounds.playDrawOfferSound();
            });

            originalSocket.on('draw-accepted', () => {
                chessSounds.playSound('drawAccepted');
            });

            originalSocket.on('draw-declined', () => {
                chessSounds.playSound('drawDeclined');
            });
        }

        // Integrate with timer system if it exists
        if (typeof window.updateTimer === 'function') {
            const originalUpdateTimer = window.updateTimer;
            window.updateTimer = function(timeLeft, player) {
                const result = originalUpdateTimer.apply(this, arguments);
                
                // Play timer tick sounds
                if (player === playerColor && timeLeft <= 10) {
                    chessSounds.playTimerTick(timeLeft);
                }
                
                if (timeLeft === 0) {
                    chessSounds.playSound('timeUp');
                }
                
                return result;
            };
        }

        // Integrate with promotion modal
        if (typeof window.showPromotionModal === 'function') {
            const originalShowPromotionModal = window.showPromotionModal;
            window.showPromotionModal = function() {
                chessSounds.playPromotionSound();
                return originalShowPromotionModal.apply(this, arguments);
            };
        }

        // Integrate with game creation/joining
        if (typeof window.createGame === 'function') {
            const originalCreateGame = window.createGame;
            window.createGame = function() {
                chessSounds.playGameStartSound();
                return originalCreateGame.apply(this, arguments);
            };
        }

        if (typeof window.joinGame === 'function') {
            const originalJoinGame = window.joinGame;
            window.joinGame = function() {
                chessSounds.playGameStartSound();
                return originalJoinGame.apply(this, arguments);
            };
        }

        // Add sound to navigation system if it exists
        if (typeof window.goToMove === 'function') {
            const originalGoToMove = window.goToMove;
            window.goToMove = function(moveIndex) {
                chessSounds.playSound('select', { volume: 0.4 });
                return originalGoToMove.apply(this, arguments);
            };
        }

        if (typeof window.goToStart === 'function') {
            const originalGoToStart = window.goToStart;
            window.goToStart = function() {
                chessSounds.playResetSound();
                return originalGoToStart.apply(this, arguments);
            };
        }

        if (typeof window.goToEnd === 'function') {
            const originalGoToEnd = window.goToEnd;
            window.goToEnd = function() {
                chessSounds.playGameEndSound();
                return originalGoToEnd.apply(this, arguments);
            };
        }

        // Override error handling to add sound feedback
        if (typeof window.handleError === 'function') {
            const originalHandleError = window.handleError;
            window.handleError = function(error, context) {
                chessSounds.playMistakeSound();
                return originalHandleError.apply(this, arguments);
            };
        }

        // Override notification system to add sounds
        if (typeof window.showNotification === 'function') {
            const originalShowNotification = window.showNotification;
            window.showNotification = function(message, type = 'info') {
                // Play appropriate sound based on notification type
                switch (type) {
                    case 'success':
                        chessSounds.playGoodMoveSound();
                        break;
                    case 'error':
                        chessSounds.playMistakeSound();
                        break;
                    case 'warning':
                        chessSounds.playSound('invalidMove', { volume: 0.6 });
                        break;
                    case 'info':
                    default:
                        chessSounds.playSound('select', { volume: 0.5 });
                        break;
                }
                
                return originalShowNotification.apply(this, arguments);
            };
        }
    }
}

// ========================================
// ENHANCED SOUND EFFECTS SYSTEM
// ========================================

// Additional sound effect utilities
chessSounds.playComboSound = function(sounds, delays = []) {
    sounds.forEach((sound, index) => {
        const delay = delays[index] || index * 100;
        setTimeout(() => this.playSound(sound), delay);
    });
};

chessSounds.playRandomizedSound = function(baseName, count = 3) {
    const variation = Math.floor(Math.random() * count) + 1;
    const soundName = count > 1 ? `${baseName}${variation}` : baseName;
    this.playSound(soundName);
};

// Advanced move analysis with contextual sounds
chessSounds.analyzeAndPlayMoveSound = function(moveData, gameContext = {}) {
    if (!moveData) return;

    const { piece, capturedPiece, isCheck, isCheckmate, isStalemate } = moveData;
    
    // Priority order for sounds
    if (isCheckmate) {
        this.playComboSound(['capture', 'checkmate'], [0, 200]);
        return;
    }
    
    if (isCheck) {
        this.playComboSound(['move', 'check'], [0, 150]);
        return;
    }
    
    if (isStalemate) {
        this.playSound('stalemate');
        return;
    }
    
    // Capture analysis
    if (capturedPiece) {
        if (capturedPiece.type === 'queen') {
            this.playComboSound(['capture', 'brilliant'], [0, 300]);
            return;
        } else if (['rook', 'bishop', 'knight'].includes(capturedPiece.type)) {
            this.playComboSound(['capture', 'goodMove'], [0, 200]);
            return;
        } else {
            this.playSound('capture');
            return;
        }
    }
    
    // Special moves
    if (moveData.isCastle) {
        this.playSound('castle');
        return;
    }
    
    if (moveData.isPromotion) {
        this.playComboSound(['promotion', 'goodMove'], [0, 400]);
        return;
    }
    
    if (moveData.isEnPassant) {
        this.playComboSound(['enPassant', 'goodMove'], [0, 200]);
        return;
    }
    
    // Regular piece movement with piece-specific sounds
    if (piece && this.sounds[piece.type + 'Move']) {
        this.playSound(piece.type + 'Move');
    } else {
        this.playSound('move');
    }
};

// Dynamic volume adjustment based on game state
chessSounds.adjustVolumeForGameState = function(gameState) {
    if (gameState.isEndgame) {
        // Quieter sounds in endgame for concentration
        this.setVolume(this.volume * 0.7);
    } else if (gameState.isTense) {
        // Slightly louder for tense positions
        this.setVolume(Math.min(1, this.volume * 1.2));
    }
};

// Accessibility features
chessSounds.enableAccessibilityMode = function() {
    // More distinct sounds for visually impaired users
    this.accessibilityMode = true;
    
    // Override some sounds with more distinctive alternatives
    this.sounds.select = this.generateAdvancedTone({
        frequency: 1200, duration: 0.1, type: 'sine', envelope: 'sharp'
    });
    
    this.sounds.validMove = this.generateAdvancedTone({
        frequency: 900, duration: 0.08, type: 'triangle', envelope: 'soft'
    });
    
    this.sounds.invalidMove = this.generateAdvancedTone({
        frequency: 200, duration: 0.2, type: 'sawtooth', envelope: 'error'
    });
};

// Performance monitoring
chessSounds.getPerformanceStats = function() {
    return {
        isInitialized: this.isInitialized,
        soundCount: Object.keys(this.sounds).length,
        isEnabled: this.isEnabled,
        volume: this.volume,
        audioContextState: this.audioContext?.state || 'unavailable'
    };
};

// Auto-integrate when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', integrateSoundsWithChessGame);
} else {
    integrateSoundsWithChessGame();
}

// Export the integration function
if (typeof window !== 'undefined') {
    window.integrateSoundsWithChessGame = integrateSoundsWithChessGame;
    window.chessSounds = chessSounds;
}

}