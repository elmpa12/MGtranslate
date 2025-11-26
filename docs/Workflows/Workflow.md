.

Fluxo de uso (lado do usuário do app)

1. Pessoa abre o app (desktop ou web).
    
2. Faz login com Google (OAuth) só para:
    
    - Ler reuniões do Calendar ou colar o link da call.
        
3. Configura:
    
    - **Idioma A** (ex.: Português).
        
    - **Idioma B** (ex.: Inglês).
        
    - Se o bot vai **falar na call** (áudio) ou só **mandar texto no chat** (pra versão 1 eu focaria em áudio).
        
4. Escolhe a reunião (ou cola o link do Meet).
    
5. Clica em **“Iniciar Intérprete”**.
    

### Fluxo na reunião (do ponto de vista dos participantes)

1. Aparece um convidado na call: **“Falcom Translator”**.
    
2. O host (qualquer pessoa) aceita o bot.
    
3. A partir daí:
    
    - Quando alguém fala em **Idioma A**, o bot entra depois de ~1s falando a versão em **Idioma B**.
        
    - Quando alguém fala em **Idioma B**, o bot faz o inverso: fala em **Idioma A**.
        
4. Todo mundo continua usando o Meet normal, sem precisar instalar nada.
    

---

## 2. Pipeline técnico do MVP (simplificado mesmo)

Sem diarização complicada, sem “quem levantou a mão”. Vamos no **mínimo viável que funciona bem**.

### 2.1. Componentes

- **App de Controle (Client)**
    
    - Onde o usuário escolhe idiomas, cola link da call, clica em Start/Stop.
        
- **Bot de Reunião (Headless)**
    
    - Navegador headless (Playwright/Puppeteer) logado numa conta `bot@seuservico.com`.
        
    - Entra no link do Meet, abre áudio e microfone (sob seu controle).
        
- **Motor de Tradução (Backend)**
    
    - Recebe áudio do bot.
        
    - Faz:
        
        1. STT (Speech-to-Text).
            
        2. Detecção de idioma.
            
        3. Tradução para o outro idioma.
            
        4. TTS (Text-to-Speech).
            
    - Devolve áudio pronto pro bot falar.
        

### 2.2. Passo a passo do áudio

Loop contínuo:

1. **Bot escuta áudio da call**
    
    - No navegador headless você pega o track de áudio WebRTC e manda chunks (por ex. 200–500ms) para o backend.
        
2. **STT + detecção de idioma**
    
    - Backend chama um **Speech-to-Text de streaming** com **idioma principal + alternativos** (ex.: `pt-BR` com alternativos `en`, `es`, `ja`, `ko`, `zh`).
        
    - Google Cloud Speech-to-Text permite configurar `alternativeLanguageCodes` para reconhecer mais de um idioma na mesma sessão.[Google Cloud](https://cloud.google.com/speech-to-text/docs/enable-language-recognition-speech-to-text?authuser=0&hl=pt-br&utm_source=chatgpt.com)
        
    - Sai algo assim:
        
        `{   "text": "We need to ship by Friday",   "language": "en" }`
        
3. **Regra de roteamento super simples**
    
    - Se língua detectada = Idioma A → traduz para Idioma B.
        
    - Se língua detectada = Idioma B → traduz para Idioma A.
        
    - Se for alguma outra língua (alguém aleatório entrou falando alemão), você pode:
        
        - Ignorar, ou
            
        - Só traduzir para um dos lados (decisão de produto).
            
4. **Tradução**
    
    - Chama a API de tradução:
        
        - `"We need to ship by Friday"` → `"A gente precisa entregar isso até sexta-feira."`
            
5. **TTS**
    
    - Texto traduzido → TTS no idioma alvo:
        
        - Saída = áudio pronto, por ex. em `pt-BR` com voz natural.
            
6. **Bot fala na call**
    
    - Bot segura o microfone dele fechado.
        
    - Quando recebe um áudio TTS:
        
        - Abre o mic.
            
        - Toca o áudio (como se fosse uma pessoa falando).
            
        - Fecha o mic de novo.