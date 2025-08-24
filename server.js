// Combined Chess Server with Draw System
// Merged from original server.js and draw system integration

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'img')));

// Static file serving routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// app.get('/announce.js', (req, res) => {
//     res.sendFile(path.join(__dirname, 'announce.js'));
// });

app.get('/chat.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.js'));
});

app.get('/sound.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sound.js'));
});

app.get('/draw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'draw.js'));
});

app.get('/move.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'move.js'));
});

app.get('/move2.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'move2.js'));
});

app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/timer.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'timer.js'));
});

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

// Game storage
const games = new Map();
const players = new Map();
const usedGameIds = new Set();

function generateGameId() {
    let gameId;
    do {
        const first = Math.floor(Math.random() * 90) + 10;
        const second = Math.floor(Math.random() * 90) + 10;
        gameId = `${first}${second}`;
    } while (usedGameIds.has(gameId));
    
    usedGameIds.add(gameId);
    return gameId;
}

// Main ChessGame class with integrated draw system
class ChessGame {
    constructor(gameId) {
        this.gameId = gameId;
        this.players = { white: null, black: null };
        this.currentPlayer = 'white';
        this.gameOver = false;
        this.board = [];
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.spectators = [];
        this.lastActivity = Date.now();
        this.pendingPromotion = null;
        
        // Timer properties (from original server.js)
        this.timerDuration = 0;
        this.timeLeft = { white: 0, black: 0 };
        this.timerActive = false;
        this.timerPaused = false;
        this.timerInterval = null;
        this.gameStarted = false;
        this.gameEndReason = null;
        
        // Draw system properties (from draw system integration)
        this.drawOffer = {
            active: false,
            offeredBy: null,
            offeredTo: null,
            timestamp: null
        };
        
        this.initializeBoard();
    }

    initializeBoard() {
        this.board = Array(8).fill().map(() => Array(8).fill(null));
        
        const initialSetup = [
            ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'],
            ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
            ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']
        ];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (initialSetup[row][col]) {
                    this.board[row][col] = {
                        type: initialSetup[row][col],
                        color: row < 2 ? 'black' : 'white',
                        hasMoved: false
                    };
                }
            }
        }
    }

    addPlayer(playerId, playerName, color = null, timerDuration = 300) {
        if (!color) {
            color = !this.players.white ? 'white' : !this.players.black ? 'black' : null;
        }
        
        if (color && !this.players[color]) {
            this.players[color] = { id: playerId, name: playerName };
            
            // Set timer duration if this is the first player
            if (this.timerDuration === 0) {
                this.timerDuration = timerDuration;
                this.timeLeft.white = timerDuration;
                this.timeLeft.black = timerDuration;
            }
            
            // Start the game if both players are present
            if (this.players.white && this.players.black && !this.gameStarted) {
                this.startGame();
            }
            
            return color;
        }
        
        if (!this.spectators.find(s => s.id === playerId)) {
            this.spectators.push({ id: playerId, name: playerName });
        }
        return 'spectator';
    }

    // Modified removePlayer method to handle draw offers (integrated from draw system)
    removePlayer(playerId) {
        let removedColor = null;
        
        if (this.players.white?.id === playerId) {
            this.players.white = null;
            removedColor = 'white';
        } else if (this.players.black?.id === playerId) {
            this.players.black = null;
            removedColor = 'black';
        } else {
            this.spectators = this.spectators.filter(s => s.id !== playerId);
        }
        
        // Cancel any active draw offer involving this player (from draw system)
        const drawCancelled = this.cancelDrawOffer(playerId);
        
        // Pause timer if a player disconnects
        if (removedColor && this.timerActive && !this.gameOver) {
            this.pauseTimer();
        }
        
        return { removedColor, drawCancelled };
    }

    getPlayerColor(playerId) {
        if (this.players.white?.id === playerId) return 'white';
        if (this.players.black?.id === playerId) return 'black';
        return null;
    }

    // Timer methods (from original server.js)
    startGame() {
        if (this.players.white && this.players.black && !this.gameStarted) {
            this.gameStarted = true;
            this.startTimer();
        }
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.timerActive = true;
        this.timerPaused = false;
        
        this.timerInterval = setInterval(() => {
            if (!this.timerActive || this.timerPaused || this.gameOver) return;
            
            this.timeLeft[this.currentPlayer]--;
            
            if (this.timeLeft[this.currentPlayer] <= 0) {
                this.timeLeft[this.currentPlayer] = 0;
                this.handleTimeout();
                return;
            }
            
            // Broadcast time update every second
            this.broadcastTimeUpdate();
        }, 1000);
    }

    pauseTimer() {
        this.timerPaused = true;
    }

    resumeTimer() {
        if (this.players.white && this.players.black) {
            this.timerPaused = false;
        }
    }

    stopTimer() {
        this.timerActive = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    handleTimeout() {
        const winner = this.currentPlayer === 'white' ? 'black' : 'white';
        this.gameOver = true;
        this.gameEndReason = 'timeout';
        this.stopTimer();
        
        // Broadcast timeout event
        const winnerName = this.players[winner]?.name || winner;
        const loserName = this.players[this.currentPlayer]?.name || this.currentPlayer;
        
        io.to(this.gameId).emit('game-timeout', {
            winner,
            winnerName,
            loser: this.currentPlayer,
            loserName,
            gameState: this.getGameState()
        });
    }

    broadcastTimeUpdate() {
        io.to(this.gameId).emit('timer-update', {
            timeLeft: this.timeLeft,
            currentPlayer: this.currentPlayer,
            timerActive: this.timerActive,
            timerPaused: this.timerPaused
        });
    }

    // Draw system methods (from draw system integration)
    /**
     * Handle draw offer from a player
     */
    handleDrawOffer(playerId) {
        // Validate player
        const playerColor = this.getPlayerColor(playerId);
        if (!playerColor || this.gameOver) {
            return { success: false, error: 'Invalid draw offer' };
        }
        
        // Check if there's already an active offer
        if (this.drawOffer.active) {
            return { success: false, error: 'Draw offer already active' };
        }
        
        // Find opponent
        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        const opponent = this.players[opponentColor];
        
        if (!opponent) {
            return { success: false, error: 'No opponent to offer draw to' };
        }
        
        // Set draw offer
        this.drawOffer = {
            active: true,
            offeredBy: playerId,
            offeredTo: opponent.id,
            timestamp: Date.now()
        };
        
        return { 
            success: true, 
            opponent: opponent,
            playerColor: playerColor 
        };
    }

    /**
     * Handle draw response from opponent
     */
    handleDrawResponse(playerId, accepted) {
        // Validate response
        if (!this.drawOffer.active || this.drawOffer.offeredTo !== playerId) {
            return { success: false, error: 'Invalid draw response' };
        }
        
        const result = {
            success: true,
            accepted: accepted,
            offeredBy: this.drawOffer.offeredBy,
            respondedBy: playerId
        };
        
        if (accepted) {
            // End game in draw
            this.gameOver = true;
            this.gameEndReason = 'draw';
            this.stopTimer();
            result.gameState = this.getGameState();
        }
        
        // Clear draw offer
        this.clearDrawOffer();
        
        return result;
    }

    /**
     * Clear active draw offer
     */
    clearDrawOffer() {
        this.drawOffer = {
            active: false,
            offeredBy: null,
            offeredTo: null,
            timestamp: null
        };
    }

    /**
     * Cancel draw offer (when player disconnects)
     */
    cancelDrawOffer(playerId) {
        if (this.drawOffer.active && 
            (this.drawOffer.offeredBy === playerId || this.drawOffer.offeredTo === playerId)) {
            this.clearDrawOffer();
            return true;
        }
        return false;
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.lastActivity = Date.now();
    }

    isValidMove(fromRow, fromCol, toRow, toCol, playerId) {
        const playerColor = this.getPlayerColor(playerId);
        if (playerColor !== this.currentPlayer || this.gameOver) return false;

        const piece = this.board[fromRow][fromCol];
        if (!piece || piece.color !== playerColor) return false;
        
        const targetPiece = this.board[toRow][toCol];
        if (targetPiece?.color === piece.color) return false;
        
        if (!this.isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol)) return false;
        return !this.wouldMoveResultInCheck(fromRow, fromCol, toRow, toCol);
    }

    isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        
        switch (piece.type) {
            case 'pawn':
                return this.isPawnMoveValid(piece, fromRow, fromCol, toRow, toCol);
            case 'rook':
                return (rowDiff === 0 || colDiff === 0) && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'bishop':
                return (rowDiff === colDiff) && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'queen':
                return (rowDiff === 0 || colDiff === 0 || rowDiff === colDiff) && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'king':
                return this.isKingMoveValid(piece, fromRow, fromCol, toRow, toCol);
            case 'knight':
                return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
            default:
                return false;
        }
    }

    isPawnMoveValid(piece, fromRow, fromCol, toRow, toCol) {
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);
        
        // Forward movement
        if (colDiff === 0) {
            if (this.board[toRow][toCol]) return false;
            if (rowDiff === direction) return true;
            if (fromRow === startRow && rowDiff === 2 * direction) {
                return !this.board[fromRow + direction][fromCol];
            }
        }
        
        // Diagonal capture
        if (colDiff === 1 && rowDiff === direction) {
            // Regular capture
            if (this.board[toRow][toCol]?.color !== piece.color && this.board[toRow][toCol]) return true;
            // En passant capture
            if (this.enPassantTarget?.row === toRow && this.enPassantTarget?.col === toCol) return true;
        }
        
        return false;
    }

    isKingMoveValid(piece, fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        
        if (rowDiff <= 1 && colDiff <= 1) return true;
        
        if (rowDiff === 0 && colDiff === 2 && !piece.hasMoved) {
            return this.isCastlingValid(piece, fromRow, fromCol, toRow, toCol);
        }
        
        return false;
    }

    isCastlingValid(piece, fromRow, fromCol, toRow, toCol) {
        const isKingside = toCol > fromCol;
        const rookCol = isKingside ? 7 : 0;
        const rook = this.board[fromRow][rookCol];
        
        if (!rook || rook.type !== 'rook' || rook.hasMoved) return false;
        if (isKingside && !this.castlingRights[piece.color].kingside) return false;
        if (!isKingside && !this.castlingRights[piece.color].queenside) return false;
        if (this.isKingInCheck(piece.color)) return false;
        
        const step = isKingside ? 1 : -1;
        for (let col = fromCol + step; col !== toCol + step; col += step) {
            if (this.board[fromRow][col]) return false;
            if (this.wouldKingBeInCheck(piece.color, fromRow, col)) return false;
        }
        
        return true;
    }

    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowDir = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
        const colDir = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
        
        let row = fromRow + rowDir;
        let col = fromCol + colDir;
        
        while (row !== toRow || col !== toCol) {
            if (this.board[row][col]) return false;
            row += rowDir;
            col += colDir;
        }
        
        return true;
    }

    wouldMoveResultInCheck(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        const inCheck = this.isKingInCheck(piece.color);
        
        this.board[fromRow][fromCol] = piece;
        this.board[toRow][toCol] = capturedPiece;
        
        return inCheck;
    }

    isKingInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;
        return this.wouldKingBeInCheck(color, kingPos.row, kingPos.col);
    }

    wouldKingBeInCheck(color, row, col) {
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece?.color === opponentColor) {
                    if (this.isPieceMovementValid(piece, r, c, row, col)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    findKing(color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece?.type === 'king' && piece.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    hasValidMoves(color) {
        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = this.board[fromRow][fromCol];
                if (piece?.color === color) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol) &&
                                !this.wouldMoveResultInCheck(fromRow, fromCol, toRow, toCol)) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    willMoveResultInPromotion(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        return piece && piece.type === 'pawn' && this.isPromotionRank(toRow, piece.color);
    }

    isPromotionRank(row, color) {
        return (color === 'white' && row === 0) || (color === 'black' && row === 7);
    }

    makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        const moveRecord = {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: { ...piece },
            capturedPiece: capturedPiece ? { ...capturedPiece } : null,
            timestamp: Date.now(),
            enPassantTarget: this.enPassantTarget,
            castlingRights: JSON.parse(JSON.stringify(this.castlingRights)),
            promotion: promotionPiece
        };
        
        this.moveHistory.push(moveRecord);

        // Handle en passant capture
        if (piece.type === 'pawn' && this.enPassantTarget && 
            toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col) {
            const capturedPawnRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
            const capturedPawn = this.board[capturedPawnRow][toCol];
            if (capturedPawn) {
                this.capturedPieces[capturedPawn.color].push(capturedPawn);
                this.board[capturedPawnRow][toCol] = null;
                moveRecord.enPassantCapture = { ...capturedPawn };
            }
        }

        // Handle castling
        if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
            const isKingside = toCol > fromCol;
            const rookFromCol = isKingside ? 7 : 0;
            const rookToCol = isKingside ? 5 : 3;
            const rook = this.board[fromRow][rookFromCol];
            
            this.board[fromRow][rookToCol] = rook;
            this.board[fromRow][rookFromCol] = null;
            rook.hasMoved = true;
            moveRecord.castling = { isKingside, rookFrom: rookFromCol, rookTo: rookToCol };
        }

        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
        }
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        piece.hasMoved = true;

        // Set up en passant target
        this.enPassantTarget = null;
        if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
            this.enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
        }

        this.updateCastlingRights(piece, fromRow, fromCol, toRow, toCol);

        // Handle promotion
        if (piece.type === 'pawn' && this.isPromotionRank(toRow, piece.color)) {
            piece.type = promotionPiece || 'queen';
            moveRecord.promotion = piece.type;
        }

        // Switch players - this also advances the timer
        this.switchPlayer();
        
        return moveRecord;
    }

    updateCastlingRights(piece, fromRow, fromCol, toRow, toCol) {
        if (piece.type === 'king') {
            this.castlingRights[piece.color].kingside = false;
            this.castlingRights[piece.color].queenside = false;
        }
        if (piece.type === 'rook') {
            if (fromCol === 0) this.castlingRights[piece.color].queenside = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingside = false;
        }
        
        // If capturing a rook, update opponent's castling rights
        if (this.board[toRow][toCol] && this.board[toRow][toCol].type === 'rook') {
            const capturedColor = this.board[toRow][toCol].color;
            if (toCol === 0) this.castlingRights[capturedColor].queenside = false;
            if (toCol === 7) this.castlingRights[capturedColor].kingside = false;
        }
    }

    undoMove() {
        if (this.moveHistory.length === 0) return false;
        
        const lastMove = this.moveHistory.pop();
        const piece = lastMove.piece;
        
        // Restore board state
        this.board[lastMove.from.row][lastMove.from.col] = piece;
        this.board[lastMove.to.row][lastMove.to.col] = lastMove.capturedPiece;
        
        // Restore captured pieces
        if (lastMove.capturedPiece) {
            this.capturedPieces[lastMove.capturedPiece.color].pop();
        }
        
        // Handle en passant undo
        if (lastMove.enPassantCapture) {
            const capturedPawnRow = piece.color === 'white' ? lastMove.to.row + 1 : lastMove.to.row - 1;
            this.board[capturedPawnRow][lastMove.to.col] = lastMove.enPassantCapture;
            this.capturedPieces[lastMove.enPassantCapture.color].pop();
        }
        
        // Handle castling undo
        if (lastMove.castling) {
            const { isKingside, rookFrom, rookTo } = lastMove.castling;
            const rook = this.board[lastMove.from.row][rookTo];
            this.board[lastMove.from.row][rookFrom] = rook;
            this.board[lastMove.from.row][rookTo] = null;
            rook.hasMoved = false;
        }
        
        // Restore game state
        this.enPassantTarget = lastMove.enPassantTarget;
        this.castlingRights = lastMove.castlingRights;
        
        // Handle promotion undo
        if (lastMove.promotion) {
            piece.type = 'pawn';
        }
        
        this.switchPlayer();
        this.gameOver = false;
        this.lastActivity = Date.now();
        
        return true;
    }

    updateGameStatus() {
        if (this.gameOver) {
            if (this.gameEndReason === 'timeout') {
                return 'timeout';
            }
            if (this.gameEndReason === 'draw') {
                return 'draw';
            }
        }
        
        if (this.isKingInCheck(this.currentPlayer)) {
            if (!this.hasValidMoves(this.currentPlayer)) {
                this.gameOver = true;
                this.stopTimer();
                return 'checkmate';
            }
            return 'check';
        } else if (!this.hasValidMoves(this.currentPlayer)) {
            this.gameOver = true;
            this.stopTimer();
            return 'stalemate';
        }
        return 'normal';
    }

    // Updated resetGame method to clear draw offers (from draw system integration)
    resetGame() {
        this.currentPlayer = 'white';
        this.gameOver = false;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.pendingPromotion = null;
        this.lastActivity = Date.now();
        this.gameEndReason = null;
        
        // Clear draw offers (from draw system)
        this.clearDrawOffer();
        
        // Reset timer
        this.timeLeft.white = this.timerDuration;
        this.timeLeft.black = this.timerDuration;
        this.stopTimer();
        
        this.initializeBoard();
        
        // Restart the game if both players are present
        if (this.players.white && this.players.black) {
            this.startGame();
        }
        
        return true;
    }

    // Updated getGameState method to include draw offer info (from draw system integration)
    getGameState() {
        return {
            gameId: this.gameId,
            board: this.board,
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            players: this.players,
            spectators: this.spectators,
            moveHistory: this.moveHistory,
            capturedPieces: this.capturedPieces,
            status: this.updateGameStatus(),
            enPassantTarget: this.enPassantTarget,
            castlingRights: this.castlingRights,
            timeLeft: this.timeLeft,
            timerActive: this.timerActive,
            timerPaused: this.timerPaused,
            timerDuration: this.timerDuration,
            gameStarted: this.gameStarted,
            gameEndReason: this.gameEndReason,
            drawOffer: this.drawOffer
        };
    }
}

// REST API Routes (from original server.js)

// Get all games
app.get('/api/games', (req, res) => {
    const gamesList = Array.from(games.values()).map(game => ({
        gameId: game.gameId,
        players: game.players,
        spectators: game.spectators.length,
        currentPlayer: game.currentPlayer,
        gameOver: game.gameOver,
        lastActivity: game.lastActivity,
        gameStarted: game.gameStarted,
        timerDuration: game.timerDuration
    }));
    res.json(gamesList);
});

// Create new game
app.post('/api/games', (req, res) => {
    const { playerName, timerDuration = 300 } = req.body;
    if (!playerName) {
        return res.status(400).json({ error: 'Player name is required' });
    }
    
    const gameId = generateGameId();
    const playerId = uuidv4();
    
    const game = new ChessGame(gameId);
    const playerColor = game.addPlayer(playerId, playerName, null, timerDuration);
    
    games.set(gameId, game);
    players.set(playerId, { gameId, name: playerName, color: playerColor });
    
    res.json({ 
        gameId, 
        playerId, 
        playerColor, 
        gameState: game.getGameState() 
    });
});

// Join existing game
app.post('/api/games/:gameId/join', (req, res) => {
    const { gameId } = req.params;
    const { playerName } = req.body;
    
    if (!playerName) {
        return res.status(400).json({ error: 'Player name is required' });
    }
    
    const playerId = uuidv4();
    const game = games.get(gameId);
    
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    const playerColor = game.addPlayer(playerId, playerName);
    players.set(playerId, { gameId, name: playerName, color: playerColor });
    
    // Notify other players
    io.to(gameId).emit('player-joined', {
        playerId,
        playerName,
        playerColor,
        players: game.players,
        spectators: game.spectators,
        gameState: game.getGameState()
    });
    
    res.json({ 
        gameId, 
        playerId, 
        playerColor, 
        gameState: game.getGameState() 
    });
});

// Get game state
app.get('/api/games/:gameId', (req, res) => {
    const game = games.get(req.params.gameId);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game.getGameState());
});

// Make a move
app.post('/api/games/:gameId/moves', (req, res) => {
    const { gameId } = req.params;
    const { playerId, fromRow, fromCol, toRow, toCol, promotionPiece } = req.body;
    
    const game = games.get(gameId);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    if (!game.isValidMove(fromRow, fromCol, toRow, toCol, playerId)) {
        return res.json({ 
            success: false, 
            error: 'Invalid move',
            gameState: game.getGameState() 
        });
    }
    
    const moveRecord = game.makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
    const gameState = game.getGameState();
    
    // Broadcast move to all players in the game
    io.to(gameId).emit('move', { moveRecord, gameState });
    
    res.json({ 
        success: true, 
        moveRecord, 
        gameState 
    });
});

// Undo last move
app.post('/api/games/:gameId/undo', (req, res) => {
    const { gameId } = req.params;
    const { playerId } = req.body;
    
    const game = games.get(gameId);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    const playerColor = game.getPlayerColor(playerId);
    if (!playerColor) {
        return res.json({ 
            success: false, 
            error: 'Only players can undo moves',
            gameState: game.getGameState() 
        });
    }
    
    const success = game.undoMove();
    if (success) {
        const gameState = game.getGameState();
        io.to(gameId).emit('undo', { gameState });
        res.json({ success: true, gameState });
    } else {
        res.json({ 
            success: false, 
            error: 'No moves to undo',
            gameState: game.getGameState() 
        });
    }
});

// Reset game
app.post('/api/games/:gameId/reset', (req, res) => {
    const { gameId } = req.params;
    const { playerId } = req.body;
    
    const game = games.get(gameId);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    const playerColor = game.getPlayerColor(playerId);
    if (!playerColor) {
        return res.json({ 
            success: false, 
            error: 'Only players can reset the game',
            gameState: game.getGameState() 
        });
    }
    
    const success = game.resetGame();
    if (success) {
        const gameState = game.getGameState();
        io.to(gameId).emit('reset', { gameState });
        res.json({ success: true, gameState });
    } else {
        res.json({ 
            success: false, 
            gameState: game.getGameState() 
        });
    }
});

// Socket.IO Connection Handling (original + draw system integration)

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    socket.on('join-game', ({ gameId, playerId }) => {
        const game = games.get(gameId);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        
        socket.join(gameId);
        socket.gameId = gameId;
        socket.playerId = playerId;
        
        // Resume timer if player reconnects
        const playerColor = game.getPlayerColor(playerId);
        if (playerColor && game.timerPaused && game.players.white && game.players.black) {
            game.resumeTimer();
        }
        
        // Send current game state to the joining player
        socket.emit('game-state', game.getGameState());
        
        // Notify other players
        socket.to(gameId).emit('player-joined', {
            playerId,
            players: game.players,
            spectators: game.spectators,
            gameState: game.getGameState()
        });
    });
    
    socket.on('make-move', ({ fromRow, fromCol, toRow, toCol, promotionPiece }) => {
        const game = games.get(socket.gameId);
        if (!game || !game.isValidMove(fromRow, fromCol, toRow, toCol, socket.playerId)) {
            socket.emit('invalid-move', { message: 'Invalid move' });
            return;
        }
        
        const moveRecord = game.makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
        const gameState = game.getGameState();
        
        io.to(socket.gameId).emit('move', { moveRecord, gameState });
    });
    
    socket.on('request-undo', () => {
        const game = games.get(socket.gameId);
        if (!game || !game.getPlayerColor(socket.playerId)) {
            socket.emit('error', { message: 'Cannot undo move' });
            return;
        }
        
        const success = game.undoMove();
        if (success) {
            const gameState = game.getGameState();
            io.to(socket.gameId).emit('undo', { gameState });
        }
    });
    
    socket.on('request-reset', () => {
        const game = games.get(socket.gameId);
        if (!game || !game.getPlayerColor(socket.playerId)) {
            socket.emit('error', { message: 'Cannot reset game' });
            return;
        }
        
        const success = game.resetGame();
        if (success) {
            const gameState = game.getGameState();
            io.to(socket.gameId).emit('reset', { gameState });
        }
    });
    

    socket.on('player-leaving', (data) => {
    const { gameId, playerId, playerName } = data;
    
    // Leave the game room
    socket.leave(gameId);
    
    // Notify other players in the same room
    socket.to(gameId).emit('opponent-left', {
        playerName: playerName,
        playerId: playerId,
        message: `${playerName} has left the game`,
        timestamp: data.timestamp
    });
    
    // Update your game state as needed
    // removePlayerFromGame(gameId, playerId);
});

    // Timer control events (from original server.js)
    socket.on('pause-timer', () => {
        const game = games.get(socket.gameId);
        if (!game || !game.getPlayerColor(socket.playerId)) {
            socket.emit('error', { message: 'Cannot pause timer' });
            return;
        }
        
        game.pauseTimer();
        io.to(socket.gameId).emit('timer-paused', { gameState: game.getGameState() });
    });
    
    socket.on('resume-timer', () => {
        const game = games.get(socket.gameId);
        if (!game || !game.getPlayerColor(socket.playerId)) {
            socket.emit('error', { message: 'Cannot resume timer' });
            return;
        }
        
        game.resumeTimer();
        io.to(socket.gameId).emit('timer-resumed', { gameState: game.getGameState() });
    });
    
    // Draw system socket events (from draw system integration)
    socket.on('draw-request', (data) => {
        console.log(`Draw request from ${data.playerId} in game ${data.gameId}`);
        
        const game = games.get(data.gameId);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        
        const result = game.handleDrawOffer(data.playerId);
        
        if (!result.success) {
            socket.emit('error', { message: result.error });
            return;
        }
        
        // Send draw request to opponent
        const opponentSocket = [...io.sockets.sockets.values()]
            .find(s => s.playerId === result.opponent.id && s.gameId === data.gameId);
        
        if (opponentSocket) {
            opponentSocket.emit('draw-request', {
                playerId: data.playerId,
                playerColor: result.playerColor,
                timestamp: data.timestamp,
                gameId: data.gameId
            });
        }
        
        // Confirm to requester
        socket.emit('draw-offer-sent', {
            opponent: result.opponent.name,
            timestamp: data.timestamp
        });
    });

    socket.on('draw-response', (data) => {
        console.log(`Draw response from ${data.playerId}: ${data.response}`);
        
        const game = games.get(data.gameId || socket.gameId);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        
        const result = game.handleDrawResponse(data.playerId, data.response);
        
        if (!result.success) {
            socket.emit('error', { message: result.error });
            return;
        }
        
        if (result.accepted) {
            // Notify both players that draw was accepted
            io.to(game.gameId).emit('draw-accepted', {
                gameState: result.gameState,
                message: 'Game ended in a draw by mutual agreement'
            });
        } else {
            // Notify the original requester that draw was declined
            const requesterSocket = [...io.sockets.sockets.values()]
                .find(s => s.playerId === result.offeredBy && s.gameId === game.gameId);
            
            if (requesterSocket) {
                requesterSocket.emit('draw-response', {
                    response: false,
                    offerSender: result.offeredBy,
                    message: 'Draw offer declined'
                });
            }
        }
    });
    
    // Chat functionality (from original server.js)
    socket.on('chat-message', ({ message }) => {
        const game = games.get(socket.gameId);
        if (game && message.trim()) {
            const player = players.get(socket.playerId);
            io.to(socket.gameId).emit('chat-message', {
                playerId: socket.playerId,
                playerName: player?.name || 'Anonymous',
                message: message.trim(),
                timestamp: Date.now()
            });
        }
    });
    
    // Modified disconnect handler to include draw offer cancellation (integrated from draw system)
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        if (socket.gameId && socket.playerId) {
            const game = games.get(socket.gameId);
            if (game) {
                const result = game.removePlayer(socket.playerId);
                players.delete(socket.playerId);
                
                // If draw was cancelled, notify the other player (from draw system)
                if (result.drawCancelled) {
                    socket.to(socket.gameId).emit('draw-cancelled', {
                        message: 'Draw offer cancelled - player disconnected'
                    });
                }
                
                socket.to(socket.gameId).emit('player-left', {
                    playerId: socket.playerId,
                    playerColor: result.removedColor,
                    players: game.players,
                    spectators: game.spectators,
                    gameState: game.getGameState()
                });

                // Schedule cleanup for empty games
                if (!game.players.white && !game.players.black && game.spectators.length === 0) {
                    setTimeout(() => {
                        const currentGame = games.get(socket.gameId);
                        if (currentGame && !currentGame.players.white && !currentGame.players.black && currentGame.spectators.length === 0) {
                            games.delete(socket.gameId);
                            usedGameIds.delete(socket.gameId);
                            console.log(`Cleaned up empty game: ${socket.gameId}`);
                        }
                    }, 5 * 60 * 1000); // 5 minutes delay
                }
            }
        }
    });
});

// Periodic cleanup of inactive games (from original server.js)
setInterval(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const [gameId, game] of games.entries()) {
        if (now - game.lastActivity > oneHour) {
            game.stopTimer();
            games.delete(gameId);
            usedGameIds.delete(gameId);
            console.log(`Cleaned up inactive game: ${gameId}`);
        }
    }
}, 60 * 60 * 1000); // Run every hour

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chess server running on port ${PORT}`);
    console.log(`Access the game at: http://localhost:${PORT}`);
});

// Graceful shutdown (from original server.js)
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    // Stop all game timers
    for (const game of games.values()) {
        game.stopTimer();
    }
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    // Stop all game timers
    for (const game of games.values()) {
        game.stopTimer();
    }
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io, ChessGame };