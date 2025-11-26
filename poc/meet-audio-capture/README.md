# PoC - Captura de Áudio do Google Meet

## Objetivo

Validar a viabilidade técnica de capturar áudio de uma chamada do Google Meet usando Playwright (navegador headless).

## Abordagens Testadas

1. **RTCPeerConnection Interception** - Intercepta conexões WebRTC para capturar tracks de áudio
2. **getDisplayMedia** - Usa API de compartilhamento de tela com áudio
3. **Virtual Audio Device** - PulseAudio virtual sink (Linux)

## Pré-requisitos

```bash
# Node.js 18+
node --version

# Instalar dependências
cd poc/meet-audio-capture
npm install

# Instalar navegadores do Playwright
npx playwright install chromium
```

## Configuração

Certifique-se de que o arquivo `.env` na raiz do projeto contém:

```env
BOT_GOOGLE_EMAIL=seu-email@gmail.com
BOT_GOOGLE_PASSWORD=sua-senha
```

## Executando os Testes

### 1. Testar Login (primeiro!)

```bash
npm run test:login
```

Isso abre um navegador e tenta fazer login na conta do bot. Se o Google pedir verificação adicional, complete manualmente.

### 2. Testar Captura de Áudio Completa

```bash
npm start https://meet.google.com/xxx-yyyy-zzz
```

Substitua pelo link de uma reunião real. O script vai:
1. Fazer login
2. Entrar na reunião
3. Tentar capturar 30 segundos de áudio
4. Salvar em `output/captured_audio_*.webm`

## Resultados Esperados

### Sucesso ✅
- Arquivo `.webm` salvo em `output/`
- Console mostra "Audio track detected"
- Arquivo tem tamanho > 0 bytes

### Falha ❌
- Nenhum arquivo gerado
- Console mostra "Nenhum áudio capturado"
- Pode precisar de abordagem alternativa

## Troubleshooting

### Google pede verificação
- Complete manualmente no navegador
- Considere desativar 2FA temporariamente para testes
- Use "App Passwords" se disponível

### Áudio não capturado via RTC
- O Meet pode estar usando criptografia que impede interceptação
- Tente a abordagem `getDisplayMedia` (requer interação manual)
- Considere virtual audio device no Linux

### Navegador fecha imediatamente
- Verifique se Playwright está instalado: `npx playwright install`
- Verifique logs de erro no console

## Próximos Passos

Se esta PoC funcionar:
1. Converter áudio webm → PCM 16kHz
2. Implementar streaming de chunks
3. Integrar com pipeline STT

Se falhar:
1. Tentar extensão Chrome com `chrome.tabCapture`
2. Tentar Electron com system audio capture
3. Tentar PulseAudio virtual sink (Linux)
