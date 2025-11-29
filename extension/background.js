// Background service worker for MGtranslate extension

const BACKEND_URL = 'wss://mg.falconsoft.dev/ws';

let ws = null;
let isConnected = false;
let isTranslating = false;
let activeTabId = null;
let mediaStreamId = null;
let offscreenDocumentCreated = false;

// Status object
let status = {
  backendConnected: false,
  inCall: false,
  isTranslating: false
};

// Connect to backend WebSocket
function connectToBackend() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    ws = new WebSocket(BACKEND_URL);

    ws.onopen = () => {
      console.log('Connected to backend');
      isConnected = true;
      status.backendConnected = true;
      broadcastStatus();

      // Register as extension client
      ws.send(JSON.stringify({
        type: 'register',
        clientType: 'extension',
        capabilities: ['audio_capture', 'audio_playback']
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleBackendMessage(message);
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from backend');
      isConnected = false;
      status.backendConnected = false;
      broadcastStatus();

      // Reconnect after delay
      setTimeout(connectToBackend, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  } catch (e) {
    console.error('Failed to connect:', e);
    setTimeout(connectToBackend, 3000);
  }
}

// Handle messages from backend
function handleBackendMessage(message) {
  switch (message.type) {
    case 'translation':
      // Send translation to content script for audio playback
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, {
          type: 'PLAY_TRANSLATION',
          text: message.translatedText,
          audioUrl: message.audioUrl
        });

        // Also send to popup for display
        chrome.runtime.sendMessage({
          type: 'TRANSCRIPT',
          original: message.originalText,
          translated: message.translatedText
        }).catch(() => {}); // Popup might be closed
      }
      break;

    case 'status':
      // Update status from backend
      if (message.inCall !== undefined) {
        status.inCall = message.inCall;
      }
      broadcastStatus();
      break;

    case 'error':
      console.error('Backend error:', message.error);
      break;
  }
}

// Broadcast status to popup
function broadcastStatus() {
  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    status: status
  }).catch(() => {}); // Popup might be closed
}

// Start audio capture
async function startCapture(tabId, sourceLang, targetLang) {
  try {
    activeTabId = tabId;

    console.log('Starting capture for tab:', tabId);

    // Create offscreen document FIRST (before getting stream ID)
    await setupOffscreenDocument();

    // Get tab capture stream ID
    // The offscreen document will consume this stream
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId
    });

    console.log('Got stream ID:', streamId);
    mediaStreamId = streamId;

    // Send capture command to offscreen document
    const response = await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      target: 'offscreen',
      streamId: streamId,
      sourceLang: sourceLang,
      targetLang: targetLang
    });

    console.log('Offscreen response:', response);

    isTranslating = true;
    status.isTranslating = true;
    status.inCall = true;
    broadcastStatus();

    // Notify backend
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'startTranslation',
        sourceLang: sourceLang,
        targetLang: targetLang,
        tabId: tabId
      }));
    }

    return { success: true };
  } catch (e) {
    console.error('Failed to start capture:', e);
    return { success: false, error: e.message };
  }
}

// Stop audio capture
async function stopCapture() {
  try {
    // Send stop command to offscreen document
    chrome.runtime.sendMessage({
      type: 'STOP_CAPTURE',
      target: 'offscreen'
    });

    isTranslating = false;
    status.isTranslating = false;
    broadcastStatus();

    // Notify backend
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'stopTranslation'
      }));
    }

    activeTabId = null;
    mediaStreamId = null;

    return { success: true };
  } catch (e) {
    console.error('Failed to stop capture:', e);
    return { success: false, error: e.message };
  }
}

// Setup offscreen document for audio processing
async function setupOffscreenDocument() {
  if (offscreenDocumentCreated) {
    return;
  }

  try {
    // Check if document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
      console.log('Offscreen document already exists');
      offscreenDocumentCreated = true;
      return;
    }

    console.log('Creating offscreen document...');
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [
        chrome.offscreen.Reason.USER_MEDIA,
        chrome.offscreen.Reason.AUDIO_PLAYBACK
      ],
      justification: 'Audio capture from tab and playback for real-time translation'
    });
    offscreenDocumentCreated = true;
    console.log('Offscreen document created');
  } catch (e) {
    console.error('Error creating offscreen document:', e);
    if (!e.message.includes('already exists')) {
      throw e;
    }
    offscreenDocumentCreated = true;
  }
}

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ignore messages meant for offscreen document
  if (message.target === 'offscreen') {
    return;
  }

  switch (message.type) {
    case 'GET_STATUS':
      sendResponse(status);
      break;

    case 'START_TRANSLATION':
      startCapture(message.tabId, message.sourceLang, message.targetLang)
        .then(sendResponse);
      return true; // Keep channel open for async response

    case 'STOP_TRANSLATION':
      stopCapture().then(sendResponse);
      return true;

    case 'AUDIO_DATA':
      // Forward audio data to backend
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'audio',
          data: message.data,
          sourceLang: message.sourceLang,
          targetLang: message.targetLang
        }));
      }
      break;

    case 'CALL_STATUS':
      // Content script reporting call status
      status.inCall = message.inCall;
      broadcastStatus();
      break;
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    // Tab navigated away from Meet
    if (!changeInfo.url.includes('meet.google.com')) {
      stopCapture();
    }
  }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    stopCapture();
  }
});

// Initialize
connectToBackend();
