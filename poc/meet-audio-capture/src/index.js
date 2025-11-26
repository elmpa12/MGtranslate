/**
 * MGtranslate - PoC de Captura de Áudio do Google Meet
 *
 * Este script testa diferentes abordagens para capturar áudio de uma call:
 * 1. getDisplayMedia com audio: true
 * 2. Interceptação de RTCPeerConnection
 * 3. Virtual audio device (Linux pulseaudio)
 */

import { chromium } from 'playwright';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const BOT_EMAIL = process.env.BOT_GOOGLE_EMAIL;
const BOT_PASSWORD = process.env.BOT_GOOGLE_PASSWORD;

// Script injetado para interceptar e gravar áudio WebRTC
const AUDIO_CAPTURE_SCRIPT = `
(function() {
  window.__audioChunks = [];
  window.__isRecording = false;
  window.__mediaRecorder = null;

  // Intercepta RTCPeerConnection para capturar streams de áudio
  const originalRTCPeerConnection = window.RTCPeerConnection;

  window.RTCPeerConnection = function(...args) {
    const pc = new originalRTCPeerConnection(...args);

    pc.addEventListener('track', (event) => {
      if (event.track.kind === 'audio') {
        console.log('[MGtranslate] Audio track detected:', event.track.id);

        // Cria MediaStream com o track de áudio
        const audioStream = new MediaStream([event.track]);

        // Inicia gravação se ainda não estiver gravando
        if (!window.__isRecording) {
          startRecording(audioStream);
        }
      }
    });

    return pc;
  };

  // Copia propriedades estáticas
  Object.assign(window.RTCPeerConnection, originalRTCPeerConnection);
  window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;

  function startRecording(stream) {
    try {
      // Tenta usar MediaRecorder para gravar o áudio
      const options = { mimeType: 'audio/webm;codecs=opus' };
      window.__mediaRecorder = new MediaRecorder(stream, options);

      window.__mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          window.__audioChunks.push(event.data);
          console.log('[MGtranslate] Audio chunk captured, size:', event.data.size);
        }
      };

      window.__mediaRecorder.start(1000); // Chunk a cada 1 segundo
      window.__isRecording = true;
      console.log('[MGtranslate] Recording started');
    } catch (err) {
      console.error('[MGtranslate] Failed to start recording:', err);
    }
  }

  // Função para parar gravação e retornar dados
  window.__stopRecording = async function() {
    if (window.__mediaRecorder && window.__isRecording) {
      window.__mediaRecorder.stop();
      window.__isRecording = false;

      // Aguarda último chunk
      await new Promise(resolve => setTimeout(resolve, 500));

      // Converte chunks para base64
      const blob = new Blob(window.__audioChunks, { type: 'audio/webm' });
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      return {
        format: 'webm',
        chunks: window.__audioChunks.length,
        size: blob.size,
        base64: base64
      };
    }
    return null;
  };

  // Função para obter status
  window.__getRecordingStatus = function() {
    return {
      isRecording: window.__isRecording,
      chunksCount: window.__audioChunks.length,
      totalSize: window.__audioChunks.reduce((acc, chunk) => acc + chunk.size, 0)
    };
  };

  console.log('[MGtranslate] Audio capture script injected successfully');
})();
`;

class MeetAudioCapture {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init() {
    console.log('🚀 Iniciando navegador...');

    this.browser = await chromium.launch({
      headless: false, // Para PoC, usar headed para debug visual
      args: [
        '--use-fake-ui-for-media-stream', // Auto-aceita permissões de mídia
        '--use-fake-device-for-media-stream', // Usa dispositivo fake de mídia
        '--allow-file-access-from-files',
        '--disable-web-security',
        '--autoplay-policy=no-user-gesture-required',
      ]
    });

    this.context = await this.browser.newContext({
      permissions: ['microphone', 'camera'],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();

    // Injeta script de captura antes de qualquer navegação
    await this.page.addInitScript(AUDIO_CAPTURE_SCRIPT);

    // Log de console do navegador
    this.page.on('console', msg => {
      if (msg.text().includes('[MGtranslate]')) {
        console.log('🎤', msg.text());
      }
    });
  }

  async loginGoogle() {
    console.log('🔐 Fazendo login no Google...');

    await this.page.goto('https://accounts.google.com/signin');
    await this.page.waitForLoadState('networkidle');

    // Preenche email
    await this.page.fill('input[type="email"]', BOT_EMAIL);
    await this.page.click('#identifierNext');
    await this.page.waitForTimeout(2000);

    // Preenche senha
    await this.page.waitForSelector('input[type="password"]', { state: 'visible' });
    await this.page.fill('input[type="password"]', BOT_PASSWORD);
    await this.page.click('#passwordNext');

    // Aguarda login completar
    await this.page.waitForTimeout(5000);

    const url = this.page.url();
    if (url.includes('myaccount.google.com') || url.includes('google.com')) {
      console.log('✅ Login realizado com sucesso!');
      return true;
    } else {
      console.log('⚠️ Pode haver verificação adicional necessária. URL atual:', url);
      return false;
    }
  }

  async joinMeet(meetLink) {
    console.log('📹 Entrando na reunião:', meetLink);

    await this.page.goto(meetLink);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(3000);

    // Tenta desligar câmera e microfone antes de entrar
    try {
      // Botão de câmera (geralmente o primeiro)
      const cameraButton = await this.page.$('[data-is-muted]');
      if (cameraButton) {
        await cameraButton.click();
        console.log('📷 Câmera desligada');
      }
    } catch (e) {
      console.log('⚠️ Não foi possível desligar câmera');
    }

    // Tenta encontrar e clicar no botão de entrar
    const joinSelectors = [
      'button:has-text("Participar agora")',
      'button:has-text("Join now")',
      'button:has-text("Ask to join")',
      'button:has-text("Pedir para participar")',
      '[data-idom-class*="join"]',
    ];

    for (const selector of joinSelectors) {
      try {
        const button = await this.page.$(selector);
        if (button) {
          await button.click();
          console.log('✅ Clicou em botão de entrar:', selector);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Aguarda entrar na call
    await this.page.waitForTimeout(5000);
    console.log('📍 Status: Aguardando aceitação ou já na call');
  }

  async captureAudio(durationSeconds = 10) {
    console.log(`🎙️ Capturando áudio por ${durationSeconds} segundos...`);

    // Aguarda o tempo especificado
    await this.page.waitForTimeout(durationSeconds * 1000);

    // Verifica status da gravação
    const status = await this.page.evaluate(() => {
      return window.__getRecordingStatus ? window.__getRecordingStatus() : null;
    });

    console.log('📊 Status da gravação:', status);

    if (status && status.chunksCount > 0) {
      // Para gravação e obtém dados
      const audioData = await this.page.evaluate(() => {
        return window.__stopRecording ? window.__stopRecording() : null;
      });

      if (audioData && audioData.base64) {
        // Salva arquivo de áudio
        const outputPath = path.resolve(__dirname, '../output');
        if (!fs.existsSync(outputPath)) {
          fs.mkdirSync(outputPath, { recursive: true });
        }

        const filename = `captured_audio_${Date.now()}.webm`;
        const filepath = path.join(outputPath, filename);

        const buffer = Buffer.from(audioData.base64, 'base64');
        fs.writeFileSync(filepath, buffer);

        console.log('✅ Áudio salvo em:', filepath);
        console.log('📁 Tamanho:', audioData.size, 'bytes');
        console.log('🎵 Chunks:', audioData.chunks);

        return filepath;
      }
    }

    console.log('⚠️ Nenhum áudio capturado via RTCPeerConnection');
    return null;
  }

  async testDisplayMediaCapture(durationSeconds = 10) {
    console.log('🖥️ Testando captura via getDisplayMedia...');

    // Tenta capturar via getDisplayMedia (screen/tab capture com áudio)
    const result = await this.page.evaluate(async (duration) => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          return { success: false, error: 'No audio tracks in getDisplayMedia' };
        }

        // Grava áudio
        const audioStream = new MediaStream(audioTracks);
        const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
        const chunks = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);

        return new Promise((resolve) => {
          recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const buffer = await blob.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

            stream.getTracks().forEach(t => t.stop());

            resolve({
              success: true,
              size: blob.size,
              chunks: chunks.length,
              base64: base64
            });
          };

          recorder.start(1000);
          setTimeout(() => recorder.stop(), duration * 1000);
        });
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, durationSeconds);

    console.log('📊 Resultado getDisplayMedia:', result);
    return result;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('👋 Navegador fechado');
    }
  }
}

// Execução principal
async function main() {
  const meetLink = process.argv[2];

  if (!meetLink) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║        MGtranslate - PoC Captura de Áudio do Meet            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Uso: node src/index.js <MEET_LINK>                          ║
║                                                              ║
║  Exemplo:                                                    ║
║  node src/index.js https://meet.google.com/abc-defg-hij      ║
║                                                              ║
║  O script vai:                                               ║
║  1. Fazer login na conta do bot                              ║
║  2. Entrar na reunião                                        ║
║  3. Tentar capturar áudio por 30 segundos                    ║
║  4. Salvar em poc/meet-audio-capture/output/                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
    process.exit(1);
  }

  const capture = new MeetAudioCapture();

  try {
    await capture.init();

    const loginSuccess = await capture.loginGoogle();
    if (!loginSuccess) {
      console.log('⚠️ Login pode requerer verificação manual. Continuando...');
    }

    await capture.joinMeet(meetLink);

    // Tenta captura via RTCPeerConnection interceptado
    const audioFile = await capture.captureAudio(30);

    if (audioFile) {
      console.log('\n✅ PoC SUCESSO! Áudio capturado via RTCPeerConnection');
    } else {
      console.log('\n⚠️ RTCPeerConnection não capturou áudio.');
      console.log('Tentando getDisplayMedia...');

      // Fallback: tenta getDisplayMedia
      const displayResult = await capture.testDisplayMediaCapture(10);

      if (displayResult.success) {
        console.log('\n✅ PoC SUCESSO via getDisplayMedia!');
      } else {
        console.log('\n❌ PoC falhou em todas as abordagens');
        console.log('Considerar: extensão Chrome ou virtual audio device');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    // Mantém navegador aberto para debug
    console.log('\n🔍 Navegador mantido aberto para inspeção.');
    console.log('Pressione Ctrl+C para encerrar.');
  }
}

main();
