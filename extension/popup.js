// Popup script for MGtranslate extension

const BACKEND_URL = 'ws://localhost:3001/ws';

let isTranslating = false;

// DOM Elements
const mainContent = document.getElementById('main-content');
const notMeet = document.getElementById('not-meet');
const backendStatus = document.getElementById('backend-status');
const meetStatus = document.getElementById('meet-status');
const translationStatus = document.getElementById('translation-status');
const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const swapLangs = document.getElementById('swap-langs');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const transcriptsDiv = document.getElementById('transcripts');

// Initialize
async function init() {
  // Check if we're on a Meet page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url?.includes('meet.google.com')) {
    mainContent.style.display = 'none';
    notMeet.style.display = 'block';
    return;
  }

  // Load saved settings
  const settings = await chrome.storage.local.get(['sourceLang', 'targetLang', 'isTranslating']);
  if (settings.sourceLang) sourceLang.value = settings.sourceLang;
  if (settings.targetLang) targetLang.value = settings.targetLang;
  isTranslating = settings.isTranslating || false;

  // Update UI based on state
  updateUI();

  // Get current status from background
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response) {
      updateStatusDisplay(response);
    }
  });
}

function updateUI() {
  if (isTranslating) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    transcriptsDiv.style.display = 'block';
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
  }
}

function updateStatusDisplay(status) {
  // Backend status
  if (status.backendConnected) {
    backendStatus.textContent = 'Connected';
    backendStatus.className = 'status-value connected';
  } else {
    backendStatus.textContent = 'Disconnected';
    backendStatus.className = 'status-value disconnected';
  }

  // Meet status
  if (status.inCall) {
    meetStatus.textContent = 'In call';
    meetStatus.className = 'status-value connected';
  } else {
    meetStatus.textContent = 'Not in call';
    meetStatus.className = 'status-value disconnected';
  }

  // Translation status
  if (status.isTranslating) {
    translationStatus.textContent = 'Active';
    translationStatus.className = 'status-value translating';
  } else {
    translationStatus.textContent = 'Inactive';
    translationStatus.className = 'status-value disconnected';
  }
}

function addTranscript(original, translated) {
  const div = document.createElement('div');
  div.className = 'transcript';
  div.innerHTML = `
    <div class="original">${original}</div>
    <div class="translated">${translated}</div>
  `;
  transcriptsDiv.insertBefore(div, transcriptsDiv.firstChild);

  // Keep only last 10 transcripts
  while (transcriptsDiv.children.length > 10) {
    transcriptsDiv.removeChild(transcriptsDiv.lastChild);
  }
}

// Event Listeners
swapLangs.addEventListener('click', () => {
  const temp = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = temp;
  saveSettings();
});

sourceLang.addEventListener('change', saveSettings);
targetLang.addEventListener('change', saveSettings);

async function saveSettings() {
  await chrome.storage.local.set({
    sourceLang: sourceLang.value,
    targetLang: targetLang.value
  });
}

startBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Use microphone capture via content script (more reliable than tab capture)
  chrome.tabs.sendMessage(tab.id, {
    type: 'START_MIC_CAPTURE',
    sourceLang: sourceLang.value,
    targetLang: targetLang.value
  }, (response) => {
    if (response?.success) {
      isTranslating = true;
      chrome.storage.local.set({ isTranslating: true });

      // Update status
      translationStatus.textContent = 'Active (Mic)';
      translationStatus.className = 'status-value translating';

      updateUI();
    } else {
      alert('Failed to start: ' + (response?.error || 'Unknown error'));
    }
  });
});

stopBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { type: 'STOP_MIC_CAPTURE' }, (response) => {
    isTranslating = false;
    chrome.storage.local.set({ isTranslating: false });

    translationStatus.textContent = 'Inactive';
    translationStatus.className = 'status-value disconnected';

    updateUI();
  });
});

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STATUS_UPDATE') {
    updateStatusDisplay(message.status);
  } else if (message.type === 'TRANSCRIPT') {
    addTranscript(message.original, message.translated);
  }
});

// Initialize on load
init();
