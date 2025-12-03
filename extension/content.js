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
let isProcessingQueue = false; // Lock to prevent concurrent queue processing
let ttsCooldownUntil = 0; // Timestamp until which we should ignore tab audio
let currentAudioElement = null;
let isCapturing = false;
let ws = null;
let sourceLang = 'en-US';
let targetLang = 'pt-BR';

// UI state
let currentStatus = 'idle'; // idle, capturing, translating, ready
let lastDetectedLang = '';

// TTS Modes: 'full' = normal TTS, 'whisper' = low volume, 'subtitle' = text only
let ttsMode = localStorage.getItem('mgtranslate_ttsMode') || 'full';
let whisperVolume = parseFloat(localStorage.getItem('mgtranslate_whisperVolume')) || 0.25;
let ttsSpeed = parseFloat(localStorage.getItem('mgtranslate_ttsSpeed')) || 1.0;
let preferredVoiceGender = localStorage.getItem('mgtranslate_voiceGender') || 'auto';

// Deduplication - track last played audio to prevent echo
let lastPlayedAudioHash = '';
let lastPlayedTimestamp = 0;
const DEDUP_WINDOW_MS = 5000; // Ignore duplicate within 5 seconds

// Meeting transcript history for summary generation
let meetingTranscripts = [];
let meetingStartTime = null;

// Microphone blocking for Whisper mode (private playback)
let micBlockedUntil = 0; // Timestamp until mic should be blocked

// Tab visibility and focus detection
let isTabVisible = !document.hidden;
let isWindowFocused = document.hasFocus();

// Keyboard typing detection - pause capture while typing to avoid noise
let lastKeyPressTime = 0;
const TYPING_PAUSE_MS = 500; // Pause audio for 500ms after each keystroke

// Unique client ID to prevent duplicate connections
const CLIENT_ID = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const BACKEND_URL = 'wss://mg.falconsoft.dev/ws';

// Check if user is in a Meet call
function checkCallStatus() {
  // Look for indicators that user is in a call
  const inCallIndicators = [
    '[data-meeting-title]',
    '.r6xAKc', // Meet toolbar
    '[data-participant-id]',
    '.crqnQb', // End call button
    '[data-self-name]', // User's own video tile
    '.VfPpkd-T0kwCb' // Call controls bar
  ];

  // Indicators that call has ENDED (should stop capture)
  const callEndedIndicators = [
    '[data-call-ended]',
    '.mYfE8', // "You left the meeting" screen
    '.tPFj1d', // Return to home screen
    '.CRFCdf', // Call ended modal
  ];

  // Check for URL change (left meeting)
  const isOnMeetingPage = window.location.hostname === 'meet.google.com' &&
                          !window.location.pathname.includes('/landing') &&
                          !window.location.pathname.includes('/new') &&
                          window.location.pathname.length > 1; // Has a meeting code

  const wasInCall = isInCall;

  // Check if call ended
  const callEnded = callEndedIndicators.some(selector => document.querySelector(selector));

  // In call if: on meeting page, has call indicators, and call hasn't ended
  isInCall = isOnMeetingPage &&
             inCallIndicators.some(selector => document.querySelector(selector)) &&
             !callEnded;

  // Notify background if status changed
  if (wasInCall !== isInCall) {
    console.log('[MGtranslate] Call status changed:', wasInCall, '->', isInCall);
    chrome.runtime.sendMessage({
      type: 'CALL_STATUS',
      inCall: isInCall
    }).catch(() => {});

    // If user left the call, stop capture and playback to avoid ghost TTS
    if (!isInCall && wasInCall) {
      console.log('[MGtranslate] Meeting ended - stopping all capture');
      stopAudioCapture();
      stopTranslationPlayback();
    }
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
                clientType: 'content_script',
                clientId: CLIENT_ID  // Unique ID to prevent duplicates
              }));
              console.log('Content script registered successfully, ID:', CLIENT_ID);
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

          // Handle summary response
          if (message.type === 'summary') {
            console.log('[MGtranslate] Received meeting summary');
            showMeetingSummary(message.summary);
            return;
          }

          if (message.type === 'translation') {
            // DEDUPLICATION: Create hash from translated text to detect duplicates
            const textHash = message.translatedText ? message.translatedText.trim().toLowerCase() : '';
            const now = Date.now();

            // Skip if this is a duplicate within the dedup window
            if (textHash && textHash === lastPlayedAudioHash && (now - lastPlayedTimestamp) < DEDUP_WINDOW_MS) {
              console.log('[MGtranslate] SKIPPING DUPLICATE translation:', textHash.substring(0, 30));
              return;
            }

            // Skip if no audioUrl (this is just a text notification, not TTS)
            if (!message.audioUrl) {
              console.log('[MGtranslate] Translation text only (no audio), showing text');
              if (message.translatedText) {
                showTranslation(message.translatedText);
              }
              return;
            }

            // IMMEDIATELY block tab audio capture when translation arrives
            // This prevents capturing our own TTS output
            isPlayingTranslation = true;
            updateStatus('translating');
            console.log('[MGtranslate] Translation received:', message.translatedText?.substring(0, 50));
            console.log('[MGtranslate] Has audioUrl:', !!message.audioUrl, 'Duration:', message.duration);

            // Update dedup tracker
            lastPlayedAudioHash = textHash;
            lastPlayedTimestamp = now;

            // Tell backend to clear any buffered audio to prevent loop
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'clearBuffer',
                reason: 'tts_playing'
              }));
            }

            // Show translation text (even if muted)
            if (message.translatedText) {
              showTranslation(message.translatedText);
            }

            // Calculate cooldown from backend-provided duration (+ 200ms buffer)
            const cooldownMs = message.duration ? Math.ceil(message.duration * 1000) + 200 : 2000;

            // Store transcript for meeting summary
            meetingTranscripts.push({
              timestamp: Date.now(),
              original: message.originalText || '',
              translated: message.translatedText || '',
              source: message.source || 'unknown'
            });

            // Handle TTS based on mode
            if (ttsMode === 'subtitle') {
              // Subtitle-only mode: no audio, just text
              console.log('[MGtranslate] Subtitle mode - text only, no TTS');
              ttsCooldownUntil = Date.now() + cooldownMs;
              isPlayingTranslation = false;
              updateStatus('ready');
            } else if (ttsMode === 'full' || ttsMode === 'whisper') {
              // Full or Whisper mode: play audio
              // In Whisper mode: BLOCK MIC to prevent TTS leaking to call
              if (ttsMode === 'whisper') {
                console.log('[MGtranslate] WHISPER MODE - Private playback, blocking mic');
                blockMicrophoneDuringTTS(cooldownMs);
              }

              console.log(`[MGtranslate] ${ttsMode} mode - adding audio to queue`);
              translationAudioQueue.push({
                audioUrl: message.audioUrl,
                text: message.translatedText,
                duration: message.duration,
                volume: ttsMode === 'whisper' ? whisperVolume : 1.0,
                isPrivate: ttsMode === 'whisper'
              });
              processAudioQueue();
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

    // Create and show status overlay
    createStatusOverlay();
    updateStatus('connecting', `${sourceLang} ↔ ${targetLang}`);

    // Connect WebSocket FIRST and wait for it to be ready
    await connectWebSocketAndWait();
    console.log('WebSocket connected, proceeding with audio capture...');
    updateStatus('capturing', `${sourceLang} ↔ ${targetLang}`);

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

        // WHISPER MODE: Block mic during TTS to prevent audio leaking to call
        if (Date.now() < micBlockedUntil) {
          return; // Mic is blocked, don't send audio
        }

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

  // Update and hide status overlay
  updateStatus('idle');
  const statusOverlay = document.getElementById('mgtranslate-status');
  if (statusOverlay) {
    statusOverlay.remove();
  }

  console.log('Audio capture stopped');
}

// Stop all queued/ongoing translation audio
function stopTranslationPlayback() {
  translationAudioQueue = [];
  isPlayingTranslation = false;
  ttsCooldownUntil = Date.now();

  try {
    if (currentAudioElement) {
      currentAudioElement.pause();
      currentAudioElement.src = '';
    }
  } catch (e) {
    console.log('Error stopping current audio element', e);
  }
  currentAudioElement = null;
  console.log('[MGtranslate] Translation playback stopped and queue cleared');
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

  // DON'T send audio when tab is hidden (prevents hallucinations from wrong audio)
  if (!isTabVisible) {
    return;
  }

  // DON'T send MIC audio while user is typing (keyboard noise causes hallucinations)
  if (source === 'mic' && (Date.now() - lastKeyPressTime) < TYPING_PAUSE_MS) {
    return;
  }

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

// Block microphone during TTS playback (for Whisper/Private mode)
// This prevents the TTS audio from being picked up by the mic and sent to the call
function blockMicrophoneDuringTTS(durationMs) {
  micBlockedUntil = Date.now() + durationMs + 500; // Extra 500ms buffer
  console.log(`[MGtranslate] Mic blocked for ${durationMs + 500}ms (Whisper mode)`);
}

// Initialize audio context for playback
function initAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Play translated audio with volume control
async function playTranslationAudio(audioUrl, volume = 1.0) {
  try {
    if (!audioUrl) {
      console.log('[MGtranslate] playTranslationAudio: No audioUrl provided');
      return;
    }

    console.log('[MGtranslate] playTranslationAudio: Playing audio, volume:', volume);

    // Handle data URLs (base64 audio)
    if (audioUrl.startsWith('data:')) {
      console.log('[MGtranslate] Playing data: URL audio');
      const audio = new Audio(audioUrl);
      currentAudioElement = audio;
      audio.volume = volume;  // Apply volume (whisper mode uses lower value)
      audio.playbackRate = ttsSpeed; // Apply speed setting

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
        return await playAudioWithWebAudioAPI(audioUrl, volume);
      }

      return new Promise(resolve => {
        audio.onended = () => {
          console.log('[MGtranslate] Audio playback ended');
          currentAudioElement = null;
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
    source.playbackRate.value = ttsSpeed; // Apply speed setting

    // Apply volume via gain node
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);

    return new Promise((resolve) => {
      source.onended = () => {
        console.log('[MGtranslate] Web Audio playback ended');
        resolve();
      };
    });
  } catch (e) {
    console.error('[MGtranslate] Error playing audio:', e);
    currentAudioElement = null;
  }
}

// Fallback: Play audio using Web Audio API (works around autoplay restrictions)
async function playAudioWithWebAudioAPI(dataUrl, volume = 1.0) {
  try {
    console.log('[MGtranslate] Using Web Audio API fallback, volume:', volume);
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
    source.playbackRate.value = ttsSpeed; // Apply speed setting

    // Apply volume via gain node
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
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

// Process audio queue with concurrency lock
async function processAudioQueue() {
  // CRITICAL: Prevent concurrent queue processing (causes echo/duplicate playback)
  if (isProcessingQueue) {
    console.log('[MGtranslate] Queue already being processed, skipping');
    return;
  }

  if (translationAudioQueue.length === 0) {
    return;
  }

  // Acquire lock
  isProcessingQueue = true;
  isPlayingTranslation = true;
  updateStatus('playing');
  console.log('[MGtranslate] Starting TTS playback, queue size:', translationAudioQueue.length);

  let lastDuration = 2; // Default 2 seconds

  try {
    while (translationAudioQueue.length > 0) {
      const item = translationAudioQueue.shift();
      lastDuration = item.duration || 2;
      const itemVolume = item.volume || 1.0;
      console.log('[MGtranslate] Playing item from queue, volume:', itemVolume, 'remaining:', translationAudioQueue.length);

      if (item.audioUrl) {
        await playTranslationAudio(item.audioUrl, itemVolume);
      } else if (item.text) {
        // Use browser TTS as fallback
        await speakText(item.text);
      }
    }
  } catch (err) {
    console.error('[MGtranslate] Error during queue processing:', err);
  } finally {
    // Release lock
    isProcessingQueue = false;
  }

  // Use dynamic cooldown from backend (+ 200ms buffer)
  const cooldownMs = Math.ceil(lastDuration * 1000) + 200;
  ttsCooldownUntil = Date.now() + cooldownMs;
  isPlayingTranslation = false;
  console.log(`[MGtranslate] TTS finished, cooldown for ${cooldownMs}ms`);

  // Play ready beep to signal user can speak
  await playReadyBeep();
  updateStatus('ready');
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

// Create status overlay (persistent, bottom-right corner)
function createStatusOverlay() {
  let statusOverlay = document.getElementById('mgtranslate-status');

  if (!statusOverlay) {
    statusOverlay = document.createElement('div');
    statusOverlay.id = 'mgtranslate-status';
    statusOverlay.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 999998;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 200px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    `;

    // Status line
    const statusLine = document.createElement('div');
    statusLine.id = 'mgtranslate-status-text';
    statusLine.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    statusLine.innerHTML = '<span>🔄</span><span>Conectando...</span>';

    // Language line
    const langLine = document.createElement('div');
    langLine.id = 'mgtranslate-lang-text';
    langLine.style.cssText = 'font-size: 11px; color: #aaa;';
    langLine.textContent = '';

    // Mode selector buttons
    const modeContainer = document.createElement('div');
    modeContainer.id = 'mgtranslate-mode-container';
    modeContainer.style.cssText = 'display: flex; gap: 4px; margin-top: 4px;';

    const modes = [
      { id: 'full', icon: '🔊', label: 'Full', desc: 'Todos ouvem' },
      { id: 'whisper', icon: '🎧', label: 'Só Você', desc: 'Privado' },
      { id: 'subtitle', icon: '📝', label: 'Legenda', desc: 'Sem áudio' }
    ];

    modes.forEach(mode => {
      const btn = document.createElement('button');
      btn.id = `mgtranslate-mode-${mode.id}`;
      btn.className = 'mgtranslate-mode-btn';
      btn.dataset.mode = mode.id;
      btn.title = mode.desc; // Tooltip
      btn.style.cssText = `
        background: ${ttsMode === mode.id ? '#3b82f6' : '#374151'};
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        transition: background 0.2s;
        flex: 1;
      `;
      btn.innerHTML = `${mode.icon} ${mode.label}`;
      btn.onclick = () => setTTSMode(mode.id);
      modeContainer.appendChild(btn);
    });

    // Shortcuts hint
    const shortcutsHint = document.createElement('div');
    shortcutsHint.id = 'mgtranslate-shortcuts';
    shortcutsHint.style.cssText = 'font-size: 10px; color: #666; margin-top: 4px; text-align: center;';
    shortcutsHint.textContent = 'Alt+M: modo | Alt+S: parar | Alt+R: resumo';

    statusOverlay.appendChild(statusLine);
    statusOverlay.appendChild(langLine);
    statusOverlay.appendChild(modeContainer);
    statusOverlay.appendChild(shortcutsHint);
    document.body.appendChild(statusOverlay);
  }

  return statusOverlay;
}

// Update status overlay
function updateStatus(status, langInfo = null) {
  currentStatus = status;
  const statusEl = document.getElementById('mgtranslate-status-text');
  const langEl = document.getElementById('mgtranslate-lang-text');

  if (!statusEl) {
    createStatusOverlay();
    return updateStatus(status, langInfo);
  }

  const statusMap = {
    'idle': { icon: '⏸️', text: 'Pausado' },
    'connecting': { icon: '🔄', text: 'Conectando...' },
    'capturing': { icon: '🎤', text: 'Captando...' },
    'translating': { icon: '🔄', text: 'Traduzindo...' },
    'ready': { icon: '✅', text: 'Pronto' },
    'playing': { icon: '🔊', text: 'Tocando TTS...' }
  };

  const info = statusMap[status] || statusMap['idle'];

  // Show special indicator for Whisper (private) mode
  if (ttsMode === 'whisper') {
    statusEl.innerHTML = `<span>${info.icon}</span><span>${info.text}</span><span style="margin-left:8px;background:#7c3aed;padding:2px 6px;border-radius:4px;font-size:10px;">🔒 Privado</span>`;
  } else {
    statusEl.innerHTML = `<span>${info.icon}</span><span>${info.text}</span>`;
  }

  if (langInfo && langEl) {
    langEl.textContent = langInfo;
  }
}

// Set TTS mode
function setTTSMode(mode) {
  ttsMode = mode;
  localStorage.setItem('mgtranslate_ttsMode', mode);
  updateModeButtons();
  console.log('[MGtranslate] TTS mode changed to:', mode);
}

// Cycle through TTS modes
function cycleTTSMode() {
  const modes = ['full', 'whisper', 'subtitle'];
  const currentIndex = modes.indexOf(ttsMode);
  const nextMode = modes[(currentIndex + 1) % modes.length];
  setTTSMode(nextMode);
}

// Update mode button styles
function updateModeButtons() {
  const modes = ['full', 'whisper', 'subtitle'];
  modes.forEach(mode => {
    const btn = document.getElementById(`mgtranslate-mode-${mode}`);
    if (btn) {
      btn.style.background = ttsMode === mode ? '#3b82f6' : '#374151';
    }
  });
}

// Generate meeting summary using GPT
async function generateMeetingSummary() {
  if (meetingTranscripts.length === 0) {
    showTranslation('Nenhuma transcrição disponível para resumir');
    return;
  }

  showTranslation('⏳ Gerando resumo da reunião...');

  // Format transcripts for summary
  const transcriptText = meetingTranscripts.map((t, i) => {
    const time = new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const speaker = t.source === 'mic' ? 'Você' : 'Participante';
    return `[${time}] ${speaker}: ${t.original || t.translated}`;
  }).join('\n');

  // Send to backend for summarization
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'generateSummary',
      transcripts: meetingTranscripts,
      transcriptText: transcriptText
    }));
  } else {
    showTranslation('❌ Não conectado ao servidor');
  }
}

// Keyboard shortcuts handler
function handleKeyboardShortcuts(e) {
  // Only handle Alt+key combinations
  if (!e.altKey) return;

  switch (e.key.toLowerCase()) {
    case 'm': // Alt+M: Cycle TTS mode
      e.preventDefault();
      cycleTTSMode();
      const modeLabels = {
        'full': '🔊 Full (todos ouvem)',
        'whisper': '🎧 Só Você (privado)',
        'subtitle': '📝 Legenda (sem áudio)'
      };
      showTranslation(`Modo: ${modeLabels[ttsMode]}`);
      break;

    case 's': // Alt+S: Stop/Start capture
      e.preventDefault();
      if (isCapturing) {
        stopAudioCapture();
        showTranslation('⏹️ Captura parada');
      } else {
        startAudioCapture(sourceLang, targetLang);
        showTranslation('▶️ Captura iniciada');
      }
      break;

    case 'r': // Alt+R: Generate summary
      e.preventDefault();
      generateMeetingSummary();
      break;
  }
}

// Initialize keyboard shortcuts
document.addEventListener('keydown', handleKeyboardShortcuts);

// Create translation overlay (centered, for showing translation text)
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

// Show meeting summary in a modal
function showMeetingSummary(summary) {
  // Remove existing modal if any
  const existing = document.getElementById('mgtranslate-summary-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'mgtranslate-summary-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: #1f2937;
    color: white;
    padding: 24px;
    border-radius: 12px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  `;

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
  header.innerHTML = `
    <h2 style="margin: 0; font-size: 20px;">📋 Resumo da Reunião</h2>
    <button id="mgtranslate-close-summary" style="background: #374151; border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer;">✕ Fechar</button>
  `;

  const body = document.createElement('div');
  body.style.cssText = 'white-space: pre-wrap; line-height: 1.6; font-size: 14px;';
  body.textContent = summary;

  const actions = document.createElement('div');
  actions.style.cssText = 'margin-top: 20px; display: flex; gap: 12px;';
  actions.innerHTML = `
    <button id="mgtranslate-copy-summary" style="background: #3b82f6; border: none; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; flex: 1;">📋 Copiar</button>
    <button id="mgtranslate-download-summary" style="background: #22c55e; border: none; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; flex: 1;">⬇️ Download</button>
  `;

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(actions);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // Event handlers
  document.getElementById('mgtranslate-close-summary').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  document.getElementById('mgtranslate-copy-summary').onclick = () => {
    navigator.clipboard.writeText(summary);
    showTranslation('✅ Resumo copiado!');
  };

  document.getElementById('mgtranslate-download-summary').onclick = () => {
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo-reuniao-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showTranslation('✅ Resumo baixado!');
  };
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
const observer = new MutationObserver((mutations) => {
  // Check if any mutation indicates call ended
  for (const mutation of mutations) {
    // If nodes were removed (UI elements disappearing)
    if (mutation.removedNodes.length > 0) {
      checkCallStatus();
      break;
    }
    // If nodes were added (might be "call ended" screen)
    if (mutation.addedNodes.length > 0) {
      checkCallStatus();
      break;
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Also check call status periodically as backup (every 2 seconds)
setInterval(() => {
  if (isCapturing) {
    const stillInCall = checkCallStatus();
    if (!stillInCall) {
      console.log('[MGtranslate] Periodic check: Not in call anymore, stopping');
      stopAudioCapture();
      stopTranslationPlayback();
    }
  }
}, 2000);

// Initial check
checkCallStatus();

// ============================================
// Tab Visibility & Focus Detection
// ============================================

// Pause capture when tab is not visible (prevents hallucinations from wrong audio)
document.addEventListener('visibilitychange', () => {
  isTabVisible = !document.hidden;
  console.log('[MGtranslate] Tab visibility changed:', isTabVisible ? 'visible' : 'hidden');

  if (!isTabVisible && isCapturing) {
    // Tab hidden - pause audio processing to prevent hallucinations
    console.log('[MGtranslate] Tab hidden - pausing audio to prevent hallucinations');
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'clearBuffer',
        reason: 'tab_hidden'
      }));
    }
  }
});

window.addEventListener('focus', () => {
  isWindowFocused = true;
  console.log('[MGtranslate] Window focused');
});

window.addEventListener('blur', () => {
  isWindowFocused = false;
  console.log('[MGtranslate] Window blurred');
});

// Detect keyboard typing to pause mic capture (prevents keyboard noise)
document.addEventListener('keydown', (e) => {
  // Ignore modifier keys alone
  if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) return;
  lastKeyPressTime = Date.now();
}, true);

// Detect click on "Leave call" button to immediately stop capture
document.addEventListener('click', (e) => {
  const target = e.target;
  // Check if clicked on leave call button (red phone icon)
  if (target.closest('[data-tooltip*="Leave"]') ||
      target.closest('[aria-label*="Leave"]') ||
      target.closest('[aria-label*="Sair"]') ||
      target.closest('.crqnQb')) {
    console.log('[MGtranslate] Leave call button clicked - stopping capture');
    setTimeout(() => {
      stopAudioCapture();
      stopTranslationPlayback();
    }, 100);
  }
}, true);

// ============================================
// Cleanup on Page Unload
// ============================================

// CRITICAL: Clean up WebSocket when page closes to prevent ghost connections
window.addEventListener('beforeunload', () => {
  console.log('[MGtranslate] Page unloading - cleaning up');
  stopAudioCapture();
  if (ws) {
    ws.close(1000, 'Page unload');
    ws = null;
  }
});

// Also clean up when navigating away
window.addEventListener('pagehide', () => {
  console.log('[MGtranslate] Page hiding - cleaning up');
  stopAudioCapture();
  if (ws) {
    ws.close(1000, 'Page hide');
    ws = null;
  }
});

console.log('[MGtranslate] Content script loaded - Client ID:', CLIENT_ID);
