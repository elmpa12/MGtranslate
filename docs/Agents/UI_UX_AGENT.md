### 🖥️ UI Agent – interface gráfica top de linha

Responsável por:

- Tela de login com Google (OAuth).
    
- Tela de configuração da sessão:
    
    - Selecionar `Idioma A` e `Idioma B`.
        
    - Colar ou escolher o link do Google Meet.
        
    - Botões: **Start**, **Pause/Resume**, **Stop**.
        
- Exibir status vindo do Orchestrator:
    
    - “Bot esperando aceitação na call”
        
    - “Traduzindo EN → PT”
        
    - Erros básicos (ex.: “não conseguiu entrar no Meet”, “API de voz caiu”).
        
- No futuro: mostrar métricas (latência média, quantidade de frases traduzidas, etc.).
    

Comunicação:

- Fala **apenas** com o Orchestrator (HTTP/WebSocket/gRPC).
    

Exemplos:

- `POST /sessions` → cria sessão
    
- `POST /sessions/{id}/pause` → pausa
    
- `POST /sessions/{id}/stop` → encerra
    
- `GET /sessions/{id}/status` ou WebSocket de status.