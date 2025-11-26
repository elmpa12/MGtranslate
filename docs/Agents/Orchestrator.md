### Orchestrator Agent – cérebro das sessões

Responsável por:

- Gerenciar **ciclo de vida da sessão**:
    
    - `CREATED → BOT_JOINING → WAITING_ACCEPT → ACTIVE → PAUSED → ENDED`
        
- Guardar as configs principais:
    
    - `language_a`, `language_b`
        
    - `meet_link`
        
    - dono da sessão (quem iniciou no app)
        
- Coordenar os outros agentes:
    
    - Pedir pro **Meet Bot Agent** entrar/sair da call.
        
    - Enviar e receber áudio entre Meet Bot e Integration.
        
- Fazer o roteamento de dados:
    
    - Áudio cru vindo da reunião → Integration Agent.
        
    - Áudio TTS pronto → Meet Bot (pra ele falar).
        

Ele é tipo o “control tower”.