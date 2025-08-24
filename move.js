// Move History Display Module - Logic Only (HTML-Free)
// This module provides horizontal move history functionality for chess games
// Requires the corresponding HTML structure to be present in the DOM

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        maxVisibleMoves: 100000,
        autoScroll: true,
        showMoveNumbers: true,
        enableMoveNavigation: true, // Enable navigation highlighting
        movesPerRow: 8 // Number of move pairs per row for wrapping
    };
    
    // Chess notation mappings - Using Unicode symbols
    const PIECE_NOTATION = {
        'king': 'K',
        'queen': 'Q',
        'rook': 'R',
        'bishop': 'B',
        'knight': 'N', // Will be converted to ♘ in display
        'pawn': ''
    };

    // Unicode chess symbols for better display
    const PIECE_SYMBOLS = {
        'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙'
    };
    
    const COLUMN_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    // Move history state
    let moveHistoryContainer = null;
    let displayedMoves = [];
    let lastMoveCount = 0;
    let currentHighlightedMove = -1; // Track currently highlighted move
    
    // Initialize move history display
    function initializeMoveHistory() {
        // Wait for DOM to be ready and game interface to be available
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(initializeMoveHistory, 100);
            });
            return;
        }
        
        // Get reference to existing container
        moveHistoryContainer = document.getElementById('move-history-container');
        
        if (!moveHistoryContainer) {
            console.warn('Move History: Container element #move-history-container not found in DOM');
            return;
        }
        
        setupEventListeners();
        
        // Initial display
        updateMoveHistoryDisplay();
        
        // Setup navigation integration
        setupNavigationIntegration();
    }
    
    // Setup event listeners
    function setupEventListeners() {
        // Monitor move history changes more frequently
        setInterval(checkForMoveUpdates, 500);
        
        // Also listen for DOM mutations that might indicate game state changes
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(() => {
                setTimeout(checkForMoveUpdates, 100);
            });
            
            const chessboard = document.getElementById('chessboard');
            if (chessboard) {
                observer.observe(chessboard, { childList: true, subtree: true });
            }
        }
        
        // Force check immediately
        setTimeout(checkForMoveUpdates, 1000);
    }
    
    // Setup navigation integration
    function setupNavigationIntegration() {
        // Check for navigation functions and add event listeners
        const backButton = document.getElementById('back-button');
        const forwardButton = document.getElementById('forward-button');
        
        if (backButton) {
            backButton.addEventListener('click', () => {
                setTimeout(() => {
                    updateNavigationHighlight();
                }, 50);
            });
        }
        
        if (forwardButton) {
            forwardButton.addEventListener('click', () => {
                setTimeout(() => {
                    updateNavigationHighlight();
                }, 50);
            });
        }
        
        // Monitor navigation state changes
        setInterval(checkNavigationState, 200);
    }
    
    // Check navigation state and update highlight if needed
    function checkNavigationState() {
        if (typeof getNavigationInfo === 'function') {
            const navInfo = getNavigationInfo();
            const targetHighlight = navInfo.isAtLive ? -1 : navInfo.currentIndex;
            
            if (targetHighlight !== currentHighlightedMove) {
                highlightMove(targetHighlight);
            }
        }
    }
    
    // Check for move updates
    function checkForMoveUpdates() {
        // Check multiple possible sources for move history
        let currentMoves = [];
        
        // Try window.moveHistory first
        if (typeof window.moveHistory !== 'undefined' && Array.isArray(window.moveHistory)) {
            currentMoves = window.moveHistory;
        }
        // Try accessing moveHistory from global scope (without window)
        else if (typeof moveHistory !== 'undefined' && Array.isArray(moveHistory)) {
            currentMoves = moveHistory;
        }
        
        if (currentMoves.length !== lastMoveCount) {
            lastMoveCount = currentMoves.length;
            updateMoveHistoryDisplay();
        }
    }
    
    // Update the move history display - Horizontal Layout
    function updateMoveHistoryDisplay() {
        const moveList = document.getElementById('move-list');
        if (!moveList) {
            console.warn('Move History: #move-list element not found');
            return;
        }
        
        // Get moves from multiple possible sources
        let moves = [];
        if (typeof window.moveHistory !== 'undefined' && Array.isArray(window.moveHistory)) {
            moves = window.moveHistory;
        } else if (typeof moveHistory !== 'undefined' && Array.isArray(moveHistory)) {
            moves = moveHistory;
        }
        
        displayedMoves = [...moves];
        
        if (moves.length === 0) {
            moveList.innerHTML = '<div class="move-empty">No moves yet</div>';
            return;
        }
        
        moveList.innerHTML = '';
        
        // Create horizontal layout: 1. e4 e5 2. Nf3 Nc6 etc.
        for (let i = 0; i < moves.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = moves[i];
            const blackMove = moves[i + 1];
            
            // Create move pair container
            const movePair = document.createElement('div');
            movePair.className = 'move-pair';
            
            // Move number
            if (CONFIG.showMoveNumbers) {
                const numberEl = document.createElement('span');
                numberEl.className = 'move-number';
                numberEl.textContent = `${moveNumber}.`;
                movePair.appendChild(numberEl);
            }
            
            // White move
            const whiteMoveEl = document.createElement('span');
            whiteMoveEl.className = 'move-item white-move';
            whiteMoveEl.setAttribute('data-move-index', i);
            
            if (i === moves.length - 1) {
                whiteMoveEl.classList.add('latest');
            }
            
            whiteMoveEl.textContent = formatMoveNotation(whiteMove);
            whiteMoveEl.title = `${whiteMove.piece?.color || 'white'} ${whiteMove.piece?.type || 'piece'} from ${getSquareName(whiteMove.from)} to ${getSquareName(whiteMove.to)}`;
            
            // Add click handler for navigation
            if (CONFIG.enableMoveNavigation) {
                whiteMoveEl.addEventListener('click', () => jumpToMoveHandler(i));
            }
            
            movePair.appendChild(whiteMoveEl);
            
            // Black move (if exists)
            if (blackMove) {
                const blackMoveEl = document.createElement('span');
                blackMoveEl.className = 'move-item black-move';
                blackMoveEl.setAttribute('data-move-index', i + 1);
                
                if (i + 1 === moves.length - 1) {
                    blackMoveEl.classList.add('latest');
                }
                
                blackMoveEl.textContent = formatMoveNotation(blackMove);
                blackMoveEl.title = `${blackMove.piece?.color || 'black'} ${blackMove.piece?.type || 'piece'} from ${getSquareName(blackMove.from)} to ${getSquareName(blackMove.to)}`;
                
                // Add click handler for navigation
                if (CONFIG.enableMoveNavigation) {
                    blackMoveEl.addEventListener('click', () => jumpToMoveHandler(i + 1));
                }
                
                movePair.appendChild(blackMoveEl);
            }
            
            moveList.appendChild(movePair);
            
            // Add row break every CONFIG.movesPerRow pairs for better organization
            if (CONFIG.movesPerRow && (moveNumber % CONFIG.movesPerRow) === 0 && i + 2 < moves.length) {
                const rowBreak = document.createElement('div');
                rowBreak.className = 'move-row-break';
                moveList.appendChild(rowBreak);
            }
        }
        
        // Restore current highlight after re-render
        if (currentHighlightedMove >= 0) {
            highlightMove(currentHighlightedMove);
        }
        
        if (CONFIG.autoScroll) {
            scrollToLatestMove();
        }
    }
    
    // Highlight a specific move by index
    function highlightMove(moveIndex) {
        // Clear previous highlight
        clearMoveHighlight();
        
        // Set new highlight
        currentHighlightedMove = moveIndex;
        
        if (moveIndex >= 0) {
            const moveElement = document.querySelector(`.move-item[data-move-index="${moveIndex}"]`);
            if (moveElement) {
                moveElement.classList.add('navigation-highlight');
                
                // Scroll to highlighted move
                scrollToMove(moveElement);
            }
        }
    }
    
    // Clear move highlight
    function clearMoveHighlight() {
        const highlightedElements = document.querySelectorAll('.move-item.navigation-highlight');
        highlightedElements.forEach(el => {
            el.classList.remove('navigation-highlight');
        });
        currentHighlightedMove = -1;
    }
    
    // Update navigation highlight based on current navigation state
    function updateNavigationHighlight() {
        if (typeof getNavigationInfo === 'function') {
            const navInfo = getNavigationInfo();
            
            if (navInfo.isAtLive) {
                // At live game - clear highlight
                highlightMove(-1);
            } else {
                // Viewing history - highlight current move
                highlightMove(navInfo.currentIndex);
            }
        }
    }
    
    // Handle move click for navigation
    function jumpToMoveHandler(moveIndex) {
        if (typeof jumpToMove === 'function') {
            jumpToMove(moveIndex);
            // Highlight will be updated by checkNavigationState
        }
    }
    
    // Scroll to a specific move element
    function scrollToMove(moveElement) {
        if (moveElement && CONFIG.autoScroll) {
            const container = document.querySelector('.move-history-content');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const elementRect = moveElement.getBoundingClientRect();
                
                if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
                    moveElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center'
                    });
                }
            }
        }
    }
    
    // Convert coordinates to square name (e.g., {row: 0, col: 4} -> "e8")
    function getSquareName(coords) {
        if (!coords || typeof coords.row === 'undefined' || typeof coords.col === 'undefined') {
            return '??';
        }
        return COLUMN_LETTERS[coords.col] + (8 - coords.row);
    }
    
    // Format move notation with Unicode symbols
    function formatMoveNotation(move) {
        if (!move) return '';
        
        // Handle different move object structures
        const piece = move.piece || {};
        const from = move.from || {};
        const to = move.to || {};
        const capture = move.capture || move.captured;
        const check = move.check;
        const checkmate = move.checkmate || move.mate;
        const castling = move.castling || move.castle;
        const promotion = move.promotion || move.promoteTo;
        
        // Handle castling
        if (castling) {
            if (castling === 'kingside' || castling === 'short') {
                return 'O-O';
            } else if (castling === 'queenside' || castling === 'long') {
                return 'O-O-O';
            }
        }
        
        let notation = '';
        
        // Piece notation with Unicode symbols (empty for pawns)
        const pieceSymbol = PIECE_NOTATION[piece.type] || '';
        if (pieceSymbol && PIECE_SYMBOLS[pieceSymbol]) {
            notation += PIECE_SYMBOLS[pieceSymbol];
        } else if (pieceSymbol) {
            notation += pieceSymbol;
        }
        
        // From square (for disambiguation or pawn captures)
        if (capture && piece.type === 'pawn') {
            notation += COLUMN_LETTERS[from.col] || '';
        }
        
        // Capture indicator
        if (capture) {
            notation += 'x';
        }
        
        // Destination square
        const toSquare = getSquareName(to);
        notation += toSquare;
        
        // Promotion
        if (promotion) {
            const promotionSymbol = PIECE_NOTATION[promotion] || promotion.toUpperCase();
            const promotionUnicode = PIECE_SYMBOLS[promotionSymbol] || promotionSymbol;
            notation += '=' + promotionUnicode;
        }
        
        // Check/Checkmate
        if (checkmate) {
            notation += '#';
        } else if (check) {
            notation += '+';
        }
        
        return notation || toSquare; // Fallback to destination square
    }
    
    // Scroll to latest move
    function scrollToLatestMove() {
        const latestMoveEl = document.querySelector('.move-item.latest');
        if (latestMoveEl) {
            latestMoveEl.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest',
                inline: 'center'
            });
        } else {
            // Fallback: scroll to end
            const moveHistoryContent = document.querySelector('.move-history-content');
            if (moveHistoryContent) {
                moveHistoryContent.scrollLeft = moveHistoryContent.scrollWidth;
            }
        }
    }
    
    // Public API
    window.MoveHistory = {
        init: initializeMoveHistory,
        update: updateMoveHistoryDisplay,
        highlightMove: highlightMove,
        clearHighlight: clearMoveHighlight,
        updateNavigationHighlight: updateNavigationHighlight,
        show: () => {
            if (moveHistoryContainer) {
                moveHistoryContainer.style.display = 'block';
            }
        },
        hide: () => {
            if (moveHistoryContainer) {
                moveHistoryContainer.style.display = 'none';
            }
        },
        getTotalMoves: () => displayedMoves.length,
        getCurrentHighlightedMove: () => currentHighlightedMove
    };
    
    // Auto-initialize
    initializeMoveHistory();
    
})();