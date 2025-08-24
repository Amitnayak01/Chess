// chat.js - Enhanced Chat System with Red Dot Notifications

class ChatNotificationSystem {
    constructor() {
        this.isChatOpen = false;
        this.unreadMessageCount = 0;
        this.currentPlayerId = playerId || 'anonymous'; // Use global playerId
    }

    // Increment unread message count
    incrementMessageCount() {
        this.unreadMessageCount++;
        this.updateNotificationBadge();
    }

    // Update notification badge display
    updateNotificationBadge() {
        const notificationBadge = document.querySelector('.notification-badge');
        if (notificationBadge) {
            if (this.unreadMessageCount > 0) {
                notificationBadge.textContent = this.unreadMessageCount > 99 ? '99+' : this.unreadMessageCount.toString();
                notificationBadge.classList.add('show');
            } else {
                notificationBadge.classList.remove('show');
            }
        }
    }

    // Clear notification badge
    clearNotification() {
        this.unreadMessageCount = 0;
        this.updateNotificationBadge();
    }

    // Set chat open state
    setChatOpen(isOpen) {
        this.isChatOpen = isOpen;
        if (isOpen) {
            this.clearNotification();
        }
    }

    // Check if message is from current player
    isOwnMessage(messagePlayerId) {
        return messagePlayerId === this.currentPlayerId;
    }

    // Update current player ID
    updatePlayerId(newPlayerId) {
        this.currentPlayerId = newPlayerId;
    }

    // Get current unread count
    getUnreadCount() {
        return this.unreadMessageCount;
    }
}

// Initialize notification system
const chatNotifications = new ChatNotificationSystem();

function createChatUI() {
    // Create chat container
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-container';
    chatContainer.style.cssText = `
        position: fixed;
        bottom: 70px;
        right: 20px;
        width: 300px;
        height: 400px;
        background-color: white;
        border: 1px solid #ddd;
        border-radius: 5px;
        display: none;
        flex-direction: column;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;

    // Create chat header
    const chatHeader = document.createElement('div');
    chatHeader.textContent = 'Game Chat';
    chatHeader.style.cssText = `
        padding: 10px;
        background-color: #4CAF50;
        color: white;
        border-top-left-radius: 5px;
        border-top-right-radius: 5px;
        font-weight: bold;
    `;

    // Create chat messages area
    const chatMessages = document.createElement('div');
    chatMessages.id = 'chat-messages';
    chatMessages.style.cssText = `
        flex-grow: 1;
        padding: 10px;
        overflow-y: auto;
        background-color: #f9f9f9;
    `;

    // Create chat input area
    const chatInputArea = document.createElement('div');
    chatInputArea.style.cssText = `
        display: flex;
        padding: 10px;
        border-top: 1px solid #ddd;
        background-color: white;
        border-bottom-left-radius: 5px;
        border-bottom-right-radius: 5px;
    `;

    const chatInput = document.createElement('input');
    chatInput.id = 'chat-input';
    chatInput.type = 'text';
    chatInput.placeholder = 'Type your message...';
    chatInput.style.cssText = `
        flex-grow: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-right: 5px;
    `;

    const sendButton = document.createElement('button');
    sendButton.id = 'send-chat-btn';
    sendButton.textContent = 'Send';
    sendButton.style.cssText = `
        padding: 8px 15px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;

    // Assemble the chat UI
    chatInputArea.appendChild(chatInput);
    chatInputArea.appendChild(sendButton);

    chatContainer.appendChild(chatHeader);
    chatContainer.appendChild(chatMessages);
    chatContainer.appendChild(chatInputArea);

    document.body.appendChild(chatContainer);

    // Add notification badge to existing chat icon if it doesn't exist
    addNotificationBadgeToChatIcon();

    // Add event listeners
    sendButton.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Socket.IO chat message listener with notification logic
    if (typeof socket !== 'undefined') {
        socket.on('chat-message', (data) => {
            addChatMessage(data);
        });
    }
}

// Add notification badge to existing chat icon
function addNotificationBadgeToChatIcon() {
    const chatIcon = document.querySelector('.chat-icon');
    if (chatIcon && !chatIcon.querySelector('.notification-badge')) {
        // Add relative positioning to chat icon if not already set
        const currentPosition = window.getComputedStyle(chatIcon).position;
        if (currentPosition === 'static') {
            chatIcon.style.position = 'relative';
        }

        // Create notification badge
        const notificationBadge = document.createElement('div');
        notificationBadge.className = 'notification-badge';
        notificationBadge.textContent = '0';
        notificationBadge.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            min-width: 18px;
            height: 18px;
            background-color: #ff4444;
            border-radius: 9px;
            border: 2px solid white;
            display: none;
            animation: pulse 2s infinite;
            color: white;
            font-size: 11px;
            font-weight: bold;
            align-items: center;
            justify-content: center;
            padding: 0 4px;
            box-sizing: border-box;
            z-index: 1002;
        `;

        // Add CSS animation if not already present
        if (!document.querySelector('#notification-animation-style')) {
            const style = document.createElement('style');
            style.id = 'notification-animation-style';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .notification-badge.show {
                    display: flex !important;
                }
            `;
            document.head.appendChild(style);
        }

        chatIcon.appendChild(notificationBadge);
    }
}

// Enhanced toggle chat function
function toggleChat() {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        const isCurrentlyOpen = chatContainer.style.display === 'flex';
        const newState = !isCurrentlyOpen;
        
        chatContainer.style.display = newState ? 'flex' : 'none';
        
        // Update notification system
        chatNotifications.setChatOpen(newState);
        
        // Alternative method for class-based chat containers
        const chatSection = document.querySelector('.chat-section');
        if (chatSection) {
            if (newState) {
                chatSection.classList.add('show');
            } else {
                chatSection.classList.remove('show');
            }
        }
    }
}

// Enhanced send chat message function
function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput || !chatInput.value.trim()) return;

    const messageData = {
        playerId: playerId || 'anonymous',
        playerName: getPlayerName() || playerId || 'Anonymous',
        message: chatInput.value.trim(),
        timestamp: Date.now()
    };

    if (gameMode === 'multiplayer' && gameId && typeof socket !== 'undefined') {
        // Send to server
        socket.emit('chat-message', {
            gameId: gameId,
            ...messageData
        });
    } else {
        // Local message for single player or testing
        addChatMessage(messageData);
    }

    chatInput.value = '';
}

// Enhanced add message to chat function with notification logic
function addChatMessage(data) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    // Determine if this is own message
    const isOwnMessage = chatNotifications.isOwnMessage(data.playerId);
    
    // Add different styling for own vs other messages
    const messageClass = isOwnMessage ? 'own-message' : 'other-message';
    messageDiv.classList.add(messageClass);
    
    messageDiv.style.cssText = `
        margin: 5px 0;
        padding: 8px 12px;
        border-radius: 8px;
        word-break: break-word;
        animation: slideIn 0.3s ease;
        ${isOwnMessage ? 
            'background-color: #e3f2fd; margin-left: 20px;' : 
            'background-color: #f1f8e9; margin-right: 20px;'
        }
    `;

    const time = new Date(data.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <span class="chat-time" style="color: #666; font-size: 0.8em; margin-right: 8px;">[${time}]</span>
        <span class="chat-name" style="font-weight: bold; margin-right: 8px; color: ${isOwnMessage ? '#1976d2' : '#2e7d32'};">${escapeHtml(data.playerName || 'Anonymous')}:</span>
        <span class="chat-text" style="color: #333;">${escapeHtml(data.message)}</span>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Show notification if message is from another player and chat is closed
    if (!isOwnMessage && !chatNotifications.isChatOpen) {
        chatNotifications.incrementMessageCount();
        
        // Optional: Play notification sound
        playNotificationSound();
    }
}

// Helper function to escape HTML and prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Helper function to get player name
function getPlayerName() {
    // Try to get player name from various possible sources
    if (typeof playerName !== 'undefined') return playerName;
    if (typeof window.playerName !== 'undefined') return window.playerName;
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('playerName') || localStorage.getItem('username');
    }
    return null;
}

// Optional: Play notification sound
function playNotificationSound() {
    try {
        // Create a subtle notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        // Silently fail if audio context is not supported
        console.log('Notification sound not supported');
    }
}

// Update player ID when it changes
function updateChatPlayerId(newPlayerId) {
    chatNotifications.updatePlayerId(newPlayerId);
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    createChatUI();
    
    // Update player ID if it's available
    if (typeof playerId !== 'undefined') {
        chatNotifications.updatePlayerId(playerId);
    }
});

// CSS for message animations (add to your stylesheet)
const chatStyles = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .chat-message.own-message {
        background-color: #e3f2fd !important;
        margin-left: 20px !important;
    }
    
    .chat-message.other-message {
        background-color: #f1f8e9 !important;
        margin-right: 20px !important;
    }
`;

// Add styles to document
if (!document.querySelector('#chat-message-styles')) {
    const style = document.createElement('style');
    style.id = 'chat-message-styles';
    style.textContent = chatStyles;
    document.head.appendChild(style);
}