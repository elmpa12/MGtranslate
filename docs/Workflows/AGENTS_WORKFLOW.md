## 2. Comunicação entre os 4 agentes (visão macro)

- **UI Agent ⇄ Orchestrator Agent**  
    Controle e status da sessão (REST/WebSocket).
    
- **Orchestrator Agent ⇄ Meet Bot Agent**  
    Comandos de join/leave/play e streaming de áudio da call.
    
- **Orchestrator Agent ⇄ Integration Agent**  
    Streaming de áudio para reconhecimento/tradução/TTS e recebimento do áudio traduzido.
    

O Orchestrator é o “hub”: ninguém mais fala direto com ninguém, tudo cruza por ele.

---

## 3. Fluxo ponta-a-ponta com esses 4 agentes

### Fase 1 – Criação e configuração da sessão

1. **UI Agent → Orchestrator**
    
    - `POST /sessions` com:
        
        `{   "meet_link": "https://meet.google.com/abc-defg-hij",   "language_a": "pt-BR",   "language_b": "en-US",   "mode": "audio"  // primeiro MVP }`
        
2. **Orchestrator**
    
    - Cria `session_id`.
        
    - Salva config em memória/DB.
        
    - Muda estado para `CREATED`.
        
    - Chama **Meet Bot Agent**:
        
        - `JOIN_MEET(session_id, meet_link)`
            
3. **Meet Bot Agent**
    
    - Abre navegador headless, loga na conta do bot.
        
    - Entra no link do Meet.
        
    - Se estiver no lobby aguardando aceitação:
        
        - `BOT_STATUS(session_id, WAITING_ACCEPT)` → Orchestrator.
            
    - Quando for aceito:
        
        - `BOT_STATUS(session_id, JOINED)` → Orchestrator.
            
4. **Orchestrator**
    
    - Atualiza estado da sessão: `ACTIVE`.
        
    - Notifica UI (via WebSocket ou polling):  
        “Sessão ativa, tradutor funcionando”.
        

---

### Fase 2 – Tradução em tempo real

1. **Meet Bot Agent** escuta a reunião:
    
    - Captura áudio e corta em chunks:
        
        - ex: 200 ms, 16kHz, mono.
            
    - Envia ao Orchestrator:
        
        `{   "type": "AUDIO_FROM_MEET",   "session_id": "sess_123",   "chunk_id": 42,   "bytes": "<binary>",   "sample_rate": 16000,   "timestamp_ms": 123456789 }`
        
2. **Orchestrator → Integration Agent**
    
    - Stream de chunks de áudio para o Integration:
        
        - `STREAM_AUDIO(session_id, chunk)`.
            
3. **Integration Agent**
    
    - Alimenta o STT streaming com os chunks.
        
    - Conforme o motor de STT publica resultados:
        
        - `text`, `language`, `is_final`.
            
    - Quando tem uma frase “decente” (ponto final ou pausa):
        
        1. Decide direção:
            
            - `language == language_a` → destino = `language_b`
                
            - `language == language_b` → destino = `language_a`
                
        2. Chama provider de **tradução**.
            
        3. Chama provider de **TTS**.
            
    - Devolve pro Orchestrator:
        
        `{   "type": "TRANSLATED_AUDIO",   "session_id": "sess_123",   "direction": "EN_TO_PT",   "original_text": "We need to deploy by Friday.",   "translated_text": "A gente precisa fazer o deploy até sexta-feira.",   "bytes": "<binary>",   "audio_format": "pcm_s16le",   "sample_rate": 16000 }`
        
4. **Orchestrator → Meet Bot Agent**
    
    - Encaminha:
        
        - `PLAY_TTS(session_id, audio_chunk)`
            
5. **Meet Bot Agent**
    
    - Abre o mic do bot no Meet.
        
    - Reproduz o áudio traduzido.
        
    - Fecha o mic.
        

Enquanto isso, a UI pode opcionalmente mostrar só alguns trechos de status:

- última frase traduzida,
    
- direção (PT→EN ou EN→PT),
    
- latência média.
    

Mas o MVP pode começar sem isso.

---

### Fase 3 – Pausar e encerrar

- **Pause**
    
    - UI: `POST /sessions/{id}/pause`
        
    - Orchestrator:
        
        - Marca sessão como `PAUSED`.
            
        - Para de mandar novos chunks pro Integration (ou só ignora respostas).
            
        - Keep-alive com Meet Bot (bot continua dentro da call, mas mudo).
            
- **Stop**
    
    - UI: `POST /sessions/{id}/stop`
        
    - Orchestrator:
        
        - Manda `LEAVE_MEET(session_id)` pro Meet Bot.
            
        - Fecha stream com Integration.
            
        - Marca sessão como `ENDED`.
            

---

## 4. Como o Integration Agent escolhe provedor (plugável)

Dentro do Integration Agent, você pode ter algo assim (conceito):

- Config global ou por sessão:
    

`{   "stt_provider": "google",   "translate_provider": "google",   "tts_provider": "google" }`

Ou, mais pra frente:

`{   "stt_provider": "google",   "translate_provider": "gpt",   "tts_provider": "elevenlabs" }`

Ele implementa interfaces tipo:

`interface STTEngine {   stream(audio_chunk) -> partial_text_events }  interface TranslateEngine {   translate(text, source_lang, target_lang) -> translated_text }  interface TTSEngine {   synthesize(text, lang) -> audio_bytes }`

A graça: o **Orchestrator, o Meet Bot e a UI não precisam saber** se por trás é Google, GPT, Anthropic, Gemini ou um frankenstein de todos.

---

Com isso você tem um workflow coerente, quadradinho nos 4 agentes que você definiu:

- UI cuida da experiência humana.
    
- Orchestrator manda no jogo.
    
- Meet Bot vive dentro do Meet.
    
- Integration Agent é a “central de IA” que conversa com qualquer provedor que você plugar.
    

A partir daqui, o próximo nível natural seria desenhar os **contratos de API** desses quatro (rotas, payloads, eventos) ou já começar pelo que você prefere implementar primeiro (provavelmente Orchestrator + Meet Bot).