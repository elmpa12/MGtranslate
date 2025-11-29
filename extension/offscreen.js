// Offscreen document for audio capture and processing

let mediaStream = null;
let audioContext = null;
let scriptProcessor = null;
let sourceLang = 'en-US';
let targetLang = 'pt-BR';
let isCapturing = false;

// WebSocket connection for sending audio directly
const BACKEND_URL = 'wss://mg.falconsoft.dev/ws';
let ws = null;

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }

  ws = new WebSocket(BACKEND_URL);

  ws.onopen = () => {
    console.log('Offscreen connected to backend');
    ws.send(JSON.stringify({
      type: 'register',
      clientType: 'audio_processor'
    }));
  };

  ws.onclose = () => {
    console.log('Offscreen disconnected from backend');
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (error) => {
    console.error('Offscreen WebSocket error:', error);
  };
}

// Start capturing audio from tab
async function startCapture(streamId) {
  try {
    console.log('Starting capture with streamId:', streamId);

    // Get the media stream using the streamId
    // Try multiple constraint formats for compatibility
    let constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    };

    console.log('Attempting getUserMedia with constraints:', JSON.stringify(constraints));

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e1) {
      console.log('First attempt failed, trying alternative constraints:', e1.message);
      // Try with different constraint format
      constraints = {
        audio: true,
        video: false
      };
      // Apply chrome-specific constraints via deprecated API
      if (navigator.webkitGetUserMedia) {
        await new Promise((resolve, reject) => {
          navigator.webkitGetUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId
              }
            }
          }, (stream) => {
            mediaStream = stream;
            resolve();
          }, reject);
        });
      } else {
        throw e1;
      }
    }

    console.log('Got media stream:', mediaStream);
    console.log('Audio tracks:', mediaStream.getAudioTracks().length);

    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length > 0) {
      console.log('Audio track settings:', JSON.stringify(audioTracks[0].getSettings()));
      console.log('Audio track label:', audioTracks[0].label);
    }

    // Setup audio processing with native sample rate first, then resample
    audioContext = new AudioContext();
    console.log('AudioContext sample rate:', audioContext.sampleRate);

    const source = audioContext.createMediaStreamSource(mediaStream);

    // Create script processor for raw audio access
    // Buffer size 4096 at 48kHz = ~85ms chunks
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    let chunkCount = 0;
    scriptProcessor.onaudioprocess = (event) => {
      if (!isCapturing) return;

      const inputData = event.inputBuffer.getChannelData(0);

      // Debug: Check if we're getting actual audio
      chunkCount++;
      if (chunkCount % 50 === 0) {
        const maxAmp = Math.max(...inputData.map(Math.abs));
        const avgAmp = inputData.reduce((a, b) => a + Math.abs(b), 0) / inputData.length;
        console.log(`Audio chunk ${chunkCount}: maxAmp=${maxAmp.toFixed(6)}, avgAmp=${avgAmp.toFixed(6)}`);
      }

      // Downsample from native rate (usually 48kHz) to 16kHz
      const downsampled = downsample(inputData, audioContext.sampleRate, 16000);

      // Convert to 16-bit PCM
      const pcmData = convertFloat32ToInt16(downsampled);

      // Send to backend
      sendAudioToBackend(pcmData);
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    isCapturing = true;
    console.log('Audio capture started successfully');

  } catch (e) {
    console.error('Failed to start capture:', e);
    throw e;
  }
}

// Downsample audio from source rate to target rate
function downsample(buffer, fromRate, toRate) {
  if (fromRate === toRate) {
    return buffer;
  }

  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    result[i] = buffer[srcIndex];
  }

  return result;
}

// Convert Float32 audio to Int16 PCM
function convertFloat32ToInt16(float32Array) {
  const int16Array = new Int16Array(float32Array.length);

  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  return int16Array;
}

// Send audio data to backend
function sendAudioToBackend(pcmData) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  // Convert to base64 for JSON transport
  const base64 = arrayBufferToBase64(pcmData.buffer);

  ws.send(JSON.stringify({
    type: 'audio',
    data: base64,
    sampleRate: 16000,
    channels: 1,
    sourceLang: sourceLang,
    targetLang: targetLang
  }));
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

// Stop capturing
function stopCapture() {
  isCapturing = false;

  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  console.log('Audio capture stopped');
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return;
  }

  switch (message.type) {
    case 'START_CAPTURE':
      sourceLang = message.sourceLang || 'en-US';
      targetLang = message.targetLang || 'pt-BR';
      connectWebSocket();
      startCapture(message.streamId)
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true;

    case 'STOP_CAPTURE':
      stopCapture();
      sendResponse({ success: true });
      break;
  }
});

// Initial WebSocket connection
connectWebSocket();
