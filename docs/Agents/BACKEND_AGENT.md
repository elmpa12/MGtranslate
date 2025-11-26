### backend + real-time 

 ele é o **especialista em backend e sistemas de tradução simultânea** do ponto de vista de áudio/rede.

Responsável por:

- Rodar um **browser headless** (Playwright/Puppeteer) com a conta do bot:
    
    - Entrar no link do Google Meet.
        
    - Monitorar se está no lobby ou já dentro da call.
        
- Notificar o Orchestrator:
    
    - `BOT_STATUS = LOBBY`, `JOINED`, `DISCONNECTED`, etc.
        
- Cuidar do áudio:
    
    - **Receber áudio da call** (track WebRTC).
        
    - Fragmentar em chunks (200–300 ms).
        
    - Enviar chunks pro Orchestrator (`AUDIO_FROM_MEET`).
        
- Falar na reunião:
    
    - Receber do Orchestrator chunks de áudio TTS (`AUDIO_TO_MEET`).
        
    - Abrir e fechar o microfone do bot conforme tem ou não áudio pra tocar.
        

Pensar nele como dois módulos internos:

- **Meet Connector**
    
    - Lida com Playwright/Puppeteer, login Google, join/leave.
        
- **Audio Bridge**
    
    - Faz streaming de áudio (WebRTC ↔ backend).
        

Comunicação:

- Recebe comandos do Orchestrator:
    
    - `JOIN_MEET(session_id, meet_link)`
        
    - `LEAVE_MEET(session_id)`
        
    - `PLAY_TTS(session_id, audio_chunk)`
        
- Envia eventos:
    
    - `BOT_STATUS(session_id, status)`
        
    - `AUDIO_CHUNK(session_id, bytes, timestamp)`