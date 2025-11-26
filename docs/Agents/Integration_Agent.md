Esse é o “cara” que fala com:

- Google Cloud (Speech, Translate, TTS)
    
- OpenAI / GPT
    
- Anthropic
    
- Gemini
    
- LLM local
    
- Qualquer combinação disso
    

Responsabilidades:

1. **Receber stream de áudio da sessão**
    
    - Via Orchestrator: chunks com metadados (id da sessão, sample rate etc.).
        
2. **STT (Speech-to-Text + detecção de idioma)**
    
    - Chamar STT streaming (Google ou outro).
        
    - Devolver texto + idioma:
        
        `{   "session_id": "sess_123",   "text": "We need to deploy by Friday",   "language": "en",   "is_final": true }`
        
3. **Tradução texto → texto**
    
    - Escolher provider conforme config da sessão:
        
        - ex.: `TRANSLATE_PROVIDER = google | gpt | anthropic | gemini | local`.
            
    - Receber idioma detectado (ex.: EN) e aplicar a regra:
        
        - Se texto em Idioma A → traduz pra Idioma B.
            
        - Se texto em Idioma B → traduz pra Idioma A.
            
4. **TTS (texto → áudio)**
    
    - Escolher provider de voz:
        
        - `TTS_PROVIDER = google | elevenlabs | local`.
            
    - Gerar áudio no idioma alvo.
        
5. **Retornar resultado ao Orchestrator**
    
    - Pacotes do tipo:
        
        `{   "session_id": "sess_123",   "direction": "EN_TO_PT",   "translated_text": "A gente precisa fazer o deploy até sexta-feira.",   "audio_format": "pcm_s16le",   "sample_rate": 16000,   "bytes": "<binary>" }`
        

O Integration Agent é totalmente agnóstico de Google Meet. Ele é só **pipeline de fala ↔ texto ↔ fala com tradução**, com vários providers por trás.