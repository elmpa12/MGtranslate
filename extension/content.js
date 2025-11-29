// Content script for MGtranslate - runs on Google Meet pages
// Captures audio from tab AND microphone for bidirectional translation

let isInCall = false;
let audioContext = null;
let tabStream = null;      // Audio from other participants (tab capture)
let micStream = null;      // User's microphone
let tabProcessor = null;
let micProcessor = null;
let translationAudioQueue = [];
let isPlayingTranslation = false;
let ttsCooldownUntil = 0; // Timestamp until which we should ignore tab audio
let isCapturing = false;
let ws = null;
let sourceLang = 'en-US';
let targetLang = 'pt-BR';

const BACKEND_URL = 'wss://mg.falconsoft.dev/ws';

// Check if user is in a Meet call
function checkCallStatus() {
  // Look for indicators that user is in a call
  const inCallIndicators = [
    '[data-call-ended]',
    '[data-meeting-title]',
    '.r6xAKc', // Meet toolbar
    '[data-participant-id]',
    '.crqnQb' // End call button
  ];

  const wasInCall = isInCall;
  isInCall = inCallIndicators.some(selector => document.querySelector(selector));

  // Notify background if status changed
  if (wasInCall !== isInCall) {
    chrome.runtime.sendMessage({
      type: 'CALL_STATUS',
      inCall: isInCall
    }).catch(() => {});
  }

  return isInCall;
}

// Connect to backend WebSocket with retry logic
async function connectWebSocketAndWait(retryCount = 0) {
  const MAX_RETRIES = 3;

  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return;
  }

  // Close any existing connection attempt
  if (ws) {
    try { ws.close(); } catch (e) {}
    ws = null;
  }

  return new Promise((resolve, reject) => {
    try {
      console.log(`Connecting to WebSocket (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, BACKEND_URL);
      ws = new WebSocket(BACKEND_URL);

      const timeout = setTimeout(() => {
        console.error('WebSocket connection timeout, attempt:', retryCount + 1);
        try { ws.close(); } catch (e) {}

        if (retryCount < MAX_RETRIES) {
          console.log('Retrying WebSocket connection...');
          // Retry with exponential backoff
          setTimeout(() => {
            connectWebSocketAndWait(retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 1000 * (retryCount + 1));
        } else {
          reject(new Error('WebSocket connection timeout after ' + (MAX_RETRIES + 1) + ' attempts'));
        }
      }, 15000); // Increased timeout to 15 seconds

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('Content script WebSocket opened');
        // Longer delay to ensure localtunnel connection is fully ready
        setTimeout(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('Sending content_script registration...');
            try {
              ws.send(JSON.stringify({
                type: 'register',
                clientType: 'content_script'
              }));
              console.log('Content script registered successfully');
              resolve();
            } catch (e) {
              console.error('Failed to send register message:', e);
              reject(e);
            }
          } else {
            console.error('WebSocket closed before registration, state:', ws ? ws.readyState : 'null');
            reject(new Error('WebSocket closed before registration'));
          }
        }, 500);  // Increased from 100ms to 500ms for localtunnel stability
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[MGtranslate] Received WS message type:', message.type);

          if (message.type === 'translation') {
            // IMMEDIATELY block tab audio capture when translation arrives
            // This prevents capturing our own TTS output
            isPlayingTranslation = true;
            console.log('[MGtranslate] Translation received:', message.translatedText?.substring(0, 50));
            console.log('[MGtranslate] Has audioUrl:', !!message.audioUrl, 'Length:', message.audioUrl?.length);

            // Tell backend to clear any buffered audio to prevent loop
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'clearBuffer',
                reason: 'tts_playing'
              }));
            }

            // Show translation and play audio
            if (message.translatedText) {
              showTranslation(message.translatedText);
            }
            if (message.audioUrl) {
              console.log('[MGtranslate] Adding audio to queue, current queue length:', translationAudioQueue.length);
              translationAudioQueue.push({
                audioUrl: message.audioUrl,
                text: message.translatedText
              });
              processAudioQueue();
            } else {
              console.log('[MGtranslate] No audioUrl in translation message');
              // No audio to play, but still need cooldown
              ttsCooldownUntil = Date.now() + 5000;
              isPlayingTranslation = false;
            }
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      };

      ws.onclose = () => {
        console.log('Content script disconnected');
        if (isCapturing) {
          setTimeout(() => connectWebSocketAndWait().catch(console.error), 3000);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error('WebSocket error:', error);
        reject(error);
      };
    } catch (e) {
      console.error('Failed to connect WebSocket:', e);
      reject(e);
    }
  });
}

// Start capturing audio - Tab audio (others) + Microphone (user)
async function startAudioCapture(srcLang, tgtLang) {
  try {
    sourceLang = srcLang || 'en-US';
    targetLang = tgtLang || 'pt-BR';

    console.log('Starting bidirectional audio capture...');
    console.log('Languages:', sourceLang, '↔', targetLang);

    // Connect WebSocket FIRST and wait for it to be ready
    await connectWebSocketAndWait();
    console.log('WebSocket connected, proceeding with audio capture...');

    // Create audio context
    audioContext = new AudioContext();
    console.log('AudioContext sample rate:', audioContext.sampleRate);

    // 1. Capture TAB AUDIO (what others are saying) using getDisplayMedia
    console.log('Requesting tab audio capture...');
    try {
      tabStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },  // Request current tab
        audio: true,  // Capture tab audio
        preferCurrentTab: true,  // Prefer current tab
        selfBrowserSurface: 'include',
        systemAudio: 'include'
      });

      console.log('Got tab stream');
      console.log('Tab audio tracks:', tabStream.getAudioTracks().length);
      console.log('Tab video tracks:', tabStream.getVideoTracks().length);

      // Stop video track immediately (we only need audio)
      tabStream.getVideoTracks().forEach(track => {
        console.log('Stopping video track');
        track.stop();
      });

      if (tabStream.getAudioTracks().length > 0) {
        const tabSource = audioContext.createMediaStreamSource(tabStream);
        tabProcessor = audioContext.createScriptProcessor(4096, 1, 1);

        let tabChunkCount = 0;
        tabProcessor.onaudioprocess = (event) => {
          if (!isCapturing) return;

          const inputData = event.inputBuffer.getChannelData(0);

          tabChunkCount++;
          if (tabChunkCount % 100 === 0) {
            const maxAmp = Math.max(...Array.from(inputData).map(Math.abs));
            console.log(`Tab audio chunk ${tabChunkCount}: maxAmp=${maxAmp.toFixed(4)}`);
          }

          // Skip if too quiet (silence)
          const maxAmp = Math.max(...Array.from(inputData).map(Math.abs));
          if (maxAmp < 0.01) return;

          // Downsample and send
          const downsampled = downsample(inputData, audioContext.sampleRate, 16000);
          const pcmData = convertFloat32ToInt16(downsampled);
          sendAudioToBackend(pcmData, 'tab');
        };

        tabSource.connect(tabProcessor);
        tabProcessor.connect(audioContext.destination);
        console.log('Tab audio capture set up');
      }
    } catch (tabErr) {
      console.log('Tab capture not available or denied:', tabErr.message);
      // Continue with just microphone
    }

    // 2. Capture MICROPHONE (what user is saying)
    console.log('Requesting microphone access...');
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      console.log('Got microphone access');

      const micSource = audioContext.createMediaStreamSource(micStream);
      micProcessor = audioContext.createScriptProcessor(4096, 1, 1);

      let micChunkCount = 0;
      micProcessor.onaudioprocess = (event) => {
        if (!isCapturing) return;

        const inputData = event.inputBuffer.getChannelData(0);

        micChunkCount++;
        if (micChunkCount % 100 === 0) {
          const maxAmp = Math.max(...Array.from(inputData).map(Math.abs));
          console.log(`Mic audio chunk ${micChunkCount}: maxAmp=${maxAmp.toFixed(4)}`);
        }

        // Skip if too quiet
        const maxAmp = Math.max(...Array.from(inputData).map(Math.abs));
        if (maxAmp < 0.01) return;

        // Downsample and send
        const downsampled = downsample(inputData, audioContext.sampleRate, 16000);
        const pcmData = convertFloat32ToInt16(downsampled);
        sendAudioToBackend(pcmData, 'mic');
      };

      micSource.connect(micProcessor);
      micProcessor.connect(audioContext.destination);
      console.log('Microphone capture set up');
    } catch (micErr) {
      console.log('Microphone capture failed:', micErr.message);
    }

    isCapturing = true;

    const hasTab = tabStream && tabStream.getAudioTracks().length > 0;
    const hasMic = micStream && micStream.getAudioTracks().length > 0;

    console.log('Audio capture started:', { tab: hasTab, mic: hasMic });
    return { success: true, tabCapture: hasTab, micCapture: hasMic };

  } catch (e) {
    console.error('Failed to start audio capture:', e);
    return { success: false, error: e.message };
  }
}

// Downsample audio
function downsample(buffer, fromRate, toRate) {
  if (fromRate === toRate) return buffer;

  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    result[i] = buffer[Math.floor(i * ratio)];
  }

  return result;
}

// Stop audio capture
function stopAudioCapture() {
  isCapturing = false;

  if (tabProcessor) {
    tabProcessor.disconnect();
    tabProcessor = null;
  }

  if (micProcessor) {
    micProcessor.disconnect();
    micProcessor = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (tabStream) {
    tabStream.getTracks().forEach(track => track.stop());
    tabStream = null;
  }

  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  console.log('Audio capture stopped');
}

// Convert Float32 to Int16 PCM
function convertFloat32ToInt16(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Send audio to backend
// source: 'tab' = others speaking, 'mic' = user speaking
function sendAudioToBackend(pcmData, source) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  // IMPORTANT: Don't send tab audio while TTS is playing to avoid infinite loop
  // When TTS plays, tab capture picks it up -> translates -> plays TTS -> loop
  // Also add a cooldown period after TTS stops to let audio buffers clear
  if (source === 'tab' && (isPlayingTranslation || Date.now() < ttsCooldownUntil)) {
    return;
  }

  const base64 = arrayBufferToBase64(pcmData.buffer);

  // For tab audio (others): translate from sourceLang to targetLang
  // For mic audio (user): translate from targetLang to sourceLang (reverse)
  const isTabAudio = source === 'tab';

  ws.send(JSON.stringify({
    type: 'audio',
    data: base64,
    sampleRate: 16000,
    channels: 1,
    source: source,
    // Tab audio: others speak sourceLang, translate to targetLang
    // Mic audio: user speaks targetLang, translate to sourceLang
    sourceLang: isTabAudio ? sourceLang : targetLang,
    targetLang: isTabAudio ? targetLang : sourceLang
  }));
}

// Initialize audio context for playback
function initAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Play translated audio
async function playTranslationAudio(audioUrl) {
  try {
    if (!audioUrl) {
      console.log('[MGtranslate] playTranslationAudio: No audioUrl provided');
      return;
    }

    console.log('[MGtranslate] playTranslationAudio: Playing audio, URL length:', audioUrl.length);
    console.log('[MGtranslate] Audio URL prefix:', audioUrl.substring(0, 50));

    // Handle data URLs (base64 audio)
    if (audioUrl.startsWith('data:')) {
      console.log('[MGtranslate] Playing data: URL audio');
      const audio = new Audio(audioUrl);
      audio.volume = 1.0;  // Full volume

      // Add error handling
      audio.onerror = (e) => {
        console.error('[MGtranslate] Audio element error:', e);
        console.error('[MGtranslate] Audio error code:', audio.error?.code, audio.error?.message);
      };

      try {
        await audio.play();
        console.log('[MGtranslate] Audio.play() succeeded');
      } catch (playError) {
        console.error('[MGtranslate] Audio.play() failed:', playError.name, playError.message);
        // Try with user gesture workaround - use Web Audio API instead
        console.log('[MGtranslate] Falling back to Web Audio API...');
        return await playAudioWithWebAudioAPI(audioUrl);
      }

      return new Promise(resolve => {
        audio.onended = () => {
          console.log('[MGtranslate] Audio playback ended');
          resolve();
        };
      });
    }

    // Handle regular URLs
    console.log('[MGtranslate] Playing regular URL audio');
    const ctx = initAudioContext();

    if (ctx.state === 'suspended') {
      console.log('[MGtranslate] AudioContext suspended, resuming...');
      await ctx.resume();
    }

    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);

    return new Promise((resolve) => {
      source.onended = () => {
        console.log('[MGtranslate] Web Audio playback ended');
        resolve();
      };
    });
  } catch (e) {
    console.error('[MGtranslate] Error playing audio:', e);
  }
}

// Fallback: Play audio using Web Audio API (works around autoplay restrictions)
async function playAudioWithWebAudioAPI(dataUrl) {
  try {
    console.log('[MGtranslate] Using Web Audio API fallback');
    const ctx = initAudioContext();

    if (ctx.state === 'suspended') {
      console.log('[MGtranslate] Resuming suspended AudioContext');
      await ctx.resume();
    }

    // Convert data URL to ArrayBuffer
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);

    console.log('[MGtranslate] Web Audio API playback started');

    return new Promise((resolve) => {
      source.onended = () => {
        console.log('[MGtranslate] Web Audio API playback ended');
        resolve();
      };
    });
  } catch (e) {
    console.error('[MGtranslate] Web Audio API fallback failed:', e);
    // Last resort: use browser TTS
    console.log('[MGtranslate] Falling back to browser TTS');
  }
}

// Process audio queue
async function processAudioQueue() {
  if (translationAudioQueue.length === 0) {
    return;
  }

  // isPlayingTranslation should already be true (set when translation received)
  // but set it here too just in case
  isPlayingTranslation = true;
  console.log('[MGtranslate] Starting TTS playback');

  while (translationAudioQueue.length > 0) {
    const item = translationAudioQueue.shift();

    if (item.audioUrl) {
      await playTranslationAudio(item.audioUrl);
    } else if (item.text) {
      // Use browser TTS as fallback
      await speakText(item.text);
    }
  }

  // Add cooldown period after TTS finishes (reduced to 2 seconds)
  ttsCooldownUntil = Date.now() + 2000;
  isPlayingTranslation = false;
  console.log('[MGtranslate] TTS finished, cooldown for 2 seconds');

  // Play ready beep to signal user can speak
  await playReadyBeep();
}

// Text-to-speech fallback
function speakText(text) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = resolve;
    utterance.onerror = resolve;
    speechSynthesis.speak(utterance);
  });
}

// Play a short beep to indicate ready for next speech
function playReadyBeep() {
  return new Promise((resolve) => {
    try {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Create a pleasant two-tone "ding" sound
      const oscillator1 = ctx.createOscillator();
      const oscillator2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // First tone - higher pitch
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(880, ctx.currentTime); // A5

      // Second tone - slightly lower for pleasant sound
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(1320, ctx.currentTime); // E6

      // Volume envelope - quick fade in and out
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator1.start(ctx.currentTime);
      oscillator2.start(ctx.currentTime);
      oscillator1.stop(ctx.currentTime + 0.15);
      oscillator2.stop(ctx.currentTime + 0.15);

      setTimeout(() => {
        console.log('[MGtranslate] Ready beep played');
        resolve();
      }, 150);
    } catch (e) {
      console.error('[MGtranslate] Error playing beep:', e);
      resolve();
    }
  });
}

// Create translation overlay
function createTranslationOverlay() {
  let overlay = document.getElementById('mgtranslate-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mgtranslate-overlay';
    overlay.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: #4ade80;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 999999;
      max-width: 80%;
      text-align: center;
      transition: opacity 0.3s;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);
  }

  return overlay;
}

// Show translation text on screen
function showTranslation(text) {
  const overlay = createTranslationOverlay();
  overlay.textContent = text;
  overlay.style.opacity = '1';

  setTimeout(() => {
    overlay.style.opacity = '0';
  }, 5000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'PLAY_TRANSLATION':
      // IMMEDIATELY block tab audio capture when translation arrives
      isPlayingTranslation = true;
      console.log('[MGtranslate] PLAY_TRANSLATION received, blocking tab capture');

      // Tell backend to clear any buffered audio to prevent loop
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'clearBuffer',
          reason: 'tts_playing_chrome_msg'
        }));
      }

      if (message.text) {
        showTranslation(message.text);
      }
      translationAudioQueue.push({
        text: message.text,
        audioUrl: message.audioUrl
      });
      processAudioQueue();
      break;

    case 'CHECK_CALL_STATUS':
      sendResponse({ inCall: checkCallStatus() });
      break;

    case 'START_MIC_CAPTURE':
      startAudioCapture(message.sourceLang, message.targetLang)
        .then(result => sendResponse(result));
      return true; // Keep channel open for async response

    case 'STOP_MIC_CAPTURE':
      stopAudioCapture();
      sendResponse({ success: true });
      break;
  }
});

// Monitor for call status changes
const observer = new MutationObserver(() => {
  checkCallStatus();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial check
checkCallStatus();

console.log('MGtranslate content script loaded - Audio capture ready');
