// Config - Updated for deployed server
const API_LOGIN = "https://womtarhonen-board.onrender.com/users/login";
const API_REFRESH = "https://womtarhonen-board.onrender.com/users/refresh";
const WEBSOCKET_URL = "wss://wsserverbrowser.onrender.com";

// State
let accessToken = null;
let refreshToken = null;
let currentUsername = null;
let websocket = null;
let reconnectInterval = null;

console.log("Text sharing app initialized");
console.log("Connecting to WebSocket server:", WEBSOCKET_URL);

// Login
document.getElementById("login-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  
  console.log("Logging in:", username);
  
  try {
    const res = await fetch(API_LOGIN, {
      method: "POST",
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    console.log("Login response:", data);
    
    if (!res.ok || !data.access_token) {
      document.getElementById("result").textContent = "Login failed: " + (data.error?.message || "Check credentials");
      return;
    }
    
    // Store tokens
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    currentUsername = data.user?.username || username;
    
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('username', currentUsername);
    
    // Show app
    showApp();
    connectWebSocket();
    
  } catch (err) {
    console.error("Login error:", err);
    document.getElementById("result").textContent = "Login error: " + err.message;
  }
});

// Show app
function showApp() {
  document.getElementById("login-container").style.display = "none";
  document.getElementById("app-container").style.display = "flex";
  document.getElementById("username-display").textContent = currentUsername;
  setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
  // Send button
  document.getElementById("send-btn").addEventListener("click", sendText);
  
  // Send text area character count
  document.getElementById("send-text").addEventListener("input", updateSendCharCount);
  
  // Clear buttons
  document.getElementById("clear-send-btn").addEventListener("click", () => {
    document.getElementById("send-text").value = "";
    updateSendCharCount();
  });
  
  document.getElementById("clear-received-btn").addEventListener("click", () => {
    document.getElementById("receive-text").value = "";
    updateReceiveCharCount();
    document.getElementById("copy-received-btn").disabled = true;
    document.getElementById("last-received").textContent = "No text received yet";
  });
  
  // Copy received text
  document.getElementById("copy-received-btn").addEventListener("click", async () => {
    const text = document.getElementById("receive-text").value;
    try {
      await navigator.clipboard.writeText(text);
      console.log("Received text copied to clipboard");
      // Show brief feedback
      const btn = document.getElementById("copy-received-btn");
      const originalText = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = originalText, 1000);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy text");
    }
  });
  
  // Enter key to send
  document.getElementById("send-text").addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      sendText();
    }
  });
  
  // Initialize character counts
  updateSendCharCount();
  updateReceiveCharCount();
}

// Send text
function sendText() {
  const sendTextArea = document.getElementById("send-text");
  const text = sendTextArea.value.trim();
  
  if (!text) {
    alert("Please enter some text to send");
    return;
  }
  
  if (!websocket || websocket.readyState !== WebSocket.OPEN) {
    alert("Not connected to server. Please wait for connection or try reconnecting.");
    return;
  }
  
  const messageData = {
    type: 'text-share',
    content: text,
    timestamp: new Date().toISOString()
  };
  
  websocket.send(JSON.stringify(messageData));
  console.log("📤 Text sent:", text.length + " characters");
  
  // Clear send area after sending
  sendTextArea.value = "";
  updateSendCharCount();
  
  // Show brief feedback
  const btn = document.getElementById("send-btn");
  const originalText = btn.textContent;
  btn.textContent = "Sent!";
  setTimeout(() => btn.textContent = originalText, 1000);
}

// Handle incoming text
function handleIncomingText(message) {
  const receiveTextArea = document.getElementById("receive-text");
  const lastReceived = document.getElementById("last-received");
  const copyBtn = document.getElementById("copy-received-btn");
  
  // Update receive area
  receiveTextArea.value = message.content;
  updateReceiveCharCount();
  
  // Update timestamp
  const time = new Date(message.timestamp).toLocaleTimeString();
  lastReceived.textContent = `Received at ${time}`;
  
  // Enable copy button
  copyBtn.disabled = false;
  
  console.log("📥 Text received:", message.content.length + " characters");
  
  // Brief visual feedback
  receiveTextArea.style.borderColor = "#87c93f";
  setTimeout(() => receiveTextArea.style.borderColor = "#d7d6d2", 1000);
}

// Update character counts
function updateSendCharCount() {
  const text = document.getElementById("send-text").value;
  document.getElementById("send-chars").textContent = `${text.length} characters`;
}

function updateReceiveCharCount() {
  const text = document.getElementById("receive-text").value;
  document.getElementById("receive-chars").textContent = `${text.length} characters`;
}

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
  console.log("Logging out");
  
  if (websocket) {
    websocket.close();
  }
  
  // Clear everything
  accessToken = null;
  refreshToken = null;
  currentUsername = null;
  
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('username');
  
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
  
  // Show login and clear fields
  document.getElementById("app-container").style.display = "none";
  document.getElementById("login-container").style.display = "flex";
  document.getElementById("send-text").value = "";
  document.getElementById("receive-text").value = "";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("result").textContent = "";
});

// WebSocket Connection
function connectWebSocket() {
  if (!accessToken) {
    console.log("No access token available");
    return;
  }
  
  console.log("Connecting to WebSocket server:", WEBSOCKET_URL);
  updateConnectionStatus("Connecting...", "connecting");
  
  if (websocket) {
    websocket.close();
  }
  
  websocket = new WebSocket(`${WEBSOCKET_URL}?token=${accessToken}`);
  
  websocket.onopen = function() {
    console.log("✅ WebSocket connected to:", WEBSOCKET_URL);
    updateConnectionStatus("Connected", "connected");
    document.getElementById("send-btn").disabled = false;
    
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  };
  
  websocket.onmessage = function(event) {
    try {
      const message = JSON.parse(event.data);
      console.log("📨 Message received:", message);
      
      if (message.type === 'text-share') {
        handleIncomingText(message);
      } else if (message.type === 'system') {
        console.log("System message:", message.content);
      }
    } catch (err) {
      console.error("Message parse error:", err);
    }
  };
  
  websocket.onclose = function(event) {
    console.log("❌ WebSocket closed. Code:", event.code, "Reason:", event.reason);
    updateConnectionStatus("Disconnected", "disconnected");
    document.getElementById("send-btn").disabled = true;
    
    // Auto-reconnect for unexpected disconnections
    if (event.code !== 1000 && accessToken) {
      console.log("Connection lost unexpectedly, scheduling reconnect...");
      scheduleReconnect();
    }
  };
  
  websocket.onerror = function(error) {
    console.error("❌ WebSocket error:", error);
    updateConnectionStatus("Connection Error", "disconnected");
  };
}

// Connection controls
document.getElementById("reconnect-btn").addEventListener("click", () => {
  console.log("Manual reconnect requested");
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
  connectWebSocket();
});

document.getElementById("disconnect-btn").addEventListener("click", () => {
  console.log("Manual disconnect requested");
  if (websocket) {
    websocket.close(1000, "Manual disconnect");
  }
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
});

function updateConnectionStatus(text, className) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = text;
  statusEl.className = className;
  
  const reconnectBtn = document.getElementById("reconnect-btn");
  const disconnectBtn = document.getElementById("disconnect-btn");
  
  if (className === "connected") {
    reconnectBtn.style.display = "none";
    disconnectBtn.style.display = "inline-block";
  } else {
    reconnectBtn.style.display = "inline-block";
    disconnectBtn.style.display = "none";
  }
}

function scheduleReconnect() {
  if (reconnectInterval) return;
  
  console.log("Scheduling reconnect attempts every 5 seconds...");
  reconnectInterval = setInterval(() => {
    if (accessToken) {
      console.log("Attempting to reconnect...");
      connectWebSocket();
    }
  }, 5000);
}

// Auto-restore login on page load
window.onload = function() {
  console.log("Page loaded, checking for saved session...");
  
  const savedToken = localStorage.getItem('access_token');
  const savedRefresh = localStorage.getItem('refresh_token');
  const savedUsername = localStorage.getItem('username');
  
  if (savedToken && savedRefresh && savedUsername) {
    accessToken = savedToken;
    refreshToken = savedRefresh;
    currentUsername = savedUsername;
    
    console.log("Restored session for:", currentUsername);
    showApp();
    connectWebSocket();
  } else {
    console.log("No saved session found");
  }
};

// page visibility changes
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && accessToken && (!websocket || websocket.readyState !== WebSocket.OPEN)) {
    console.log("Tab became active, checking connection...");
    connectWebSocket();
  }
});