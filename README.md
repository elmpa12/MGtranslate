## 1. O que o MVP faz, em termos humanos

**Objetivo:**  
Você tem duas pessoas (ou dois “lados”) que não falam a mesma língua.  
Alguém que tem o app configura os idiomas, o bot entra na call do Google Meet como convidado, o host aceita, e o bot:

- Escuta tudo que é dito.
    
- Descobre em que idioma aquilo foi falado.
    
- Traduz para o outro idioma.
    
- Fala a tradução dentro da mesma call, na vez dele.
    

Sem extensão. Sem overlay. Só um terceiro “participante” que é o intérprete.

### Fluxo de uso (lado do usuário do app)

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
            

Pronto. É isso o “núcleo” do MVP.

---

## 3. Quem manda em quem

Você comentou:

> O host pode ser quem for, ele só precisa aceitar o bot na call que ele vai fazer o que a pessoa q tem o app manda.

Então:

- **“Dono do app”** = o cara que loga, escolhe reunião e aperta Start/Stop.
    
- **Host** da call (no Meet) pode ser qualquer um:
    
    - Pode nem saber o que é seu app.
        
    - Só precisa clicar em “Aceitar” quando o bot pedir entrada.
        
- Depois de aceito:
    
    - O app de controle pode mandar comandos pro bot:
        
        - Start/Stop.
            
        - Pausar tradução.
            
        - Trocar idiomas em runtime (se você quiser suportar).
            

---

## 4. Stack de IA – qual combo faz mais sentido pro MVP

Aqui entra a parte “não é muito a minha área” – então vamos escolher com alguns critérios:  
**latência, qualidade, custo e simplicidade de integrar**.

### 4.1. Opção que eu recomendo pro MVP: 100% Google Cloud

**Por quê?**

- Você já está em cima do ecossistema Google (Meet).
    
- Um provedor só: **Speech-to-Text + Translate + Text-to-Speech** tudo no mesmo lugar.
    
- Todos os idiomas que você quer estão cobertos:
    
    - Speech-to-Text: suporta +100 idiomas, incluindo **pt-BR, en, es, zh, ja, ko**.[Google Cloud+1](https://cloud.google.com/speech-to-text?utm_source=chatgpt.com)
        
    - Translate: cobre mais de 100 idiomas, incluindo todos esses; é estável e barato.[blog.google](https://blog.google/products/translate/language-learning-live-translate/?utm_source=chatgpt.com)
        
    - Text-to-Speech: mais de **75 idiomas/variações** e 380+ vozes, incluindo vozes naturais em **Mandarim, Japonês, Coreano, Espanhol, Português** etc.[Google Cloud+1](https://cloud.google.com/text-to-speech?utm_source=chatgpt.com)
        

**Pipeline ficaria:**

- **STT:** Google Cloud Speech-to-Text (streaming).
    
- **Tradução:** Google Cloud Translation.
    
- **TTS:** Google Cloud Text-to-Speech.
    

Vantagens:

- Tempo de desenvolvimento menor (SDKs prontos).
    
- Um painel só de billing.
    
- Documentação bem decente.
    

Desvantagens:

- Dados passam pela nuvem Google (ponto de atenção de privacidade).
    
- Latência boa, mas não é “local na GPU”; para a maioria dos casos de reunião, é aceitável.
    

### 4.2. Opção “premium de voz”: Google + ElevenLabs

Se você quiser:

- STT + tradução com Google.
    
- **Voz MUITO natural** (quase dublagem de filme) com ElevenLabs.
    

ElevenLabs Multilingual v2 suporta 29+ línguas, incluindo **Português (Brasil e Portugal), Espanhol (Espanha/México), Japonês, Coreano, Chinês, Inglês** etc.[ElevenLabs+2ElevenLabs+2](https://help.elevenlabs.io/hc/en-us/articles/13313366263441-What-languages-do-you-support?utm_source=chatgpt.com)

**Pipeline:**

- STT: Google Speech-to-Text.
    
- Tradução: Google Translate (ou DeepL se quiser melhor nuance em texto). DeepL cobre PT, EN, ES, ZH, JA, KO etc.[DeepL Suporte+2DeepL Documentation+2](https://support.deepl.com/hc/en-us/articles/360019925219-DeepL-Translator-languages?utm_source=chatgpt.com)
    
- TTS: ElevenLabs (voz incrível).
    

Prós:

- Experiência de áudio absurda de boa (voz bem humana).
    
- Ainda fácil de integrar (APIs bem documentadas).[ElevenLabs+1](https://elevenlabs.io/docs/capabilities/text-to-speech?utm_source=chatgpt.com)
    

Contras:

- Custa mais (Google + ElevenLabs).
    
- Mais moving parts (dois provedores, duas faturas).
    

### 4.3. Opção “hardcore dev” / self-host: tudo local

Só pra deixar registrado, se um dia você quiser:

- **Whisper** (local) para STT (roda bem em GPU, suporta dezenas de línguas e é robusto em áudio ruim).[Tomedes](https://www.tomedes.com/translator-hub/whisper-vs-google-speech-to-text?utm_source=chatgpt.com)
    
- Um LLM local ou biblioteca dedicada para tradução (por ex. modelos baseados em Mistral/Qwen treinados para tradução).
    
- TTS local: Coqui / Piper / VITS / outros.
    

Prós:

- Privacidade máxima (tudo on-prem).
    
- Custo de API = zero, só infra.
    

Contras:

- Muito mais trabalho de engenharia.
    
- Tunagem de latência é vergonhosamente trabalhosa (streaming, quantização, etc).
    

**Pra esse MVP seu, eu não iria por aí de cara.**

---

## 5. MVP final em 6 etapas

Pra ficar redondo:

1. **Configuração**
    
    - App: escolher Idioma A / Idioma B, colar link do Meet.
        
2. **Spawn do bot**
    
    - Backend sobe Chromium headless logado na conta do bot.
        
    - Bot entra no Meet → Host aceita.
        
3. **Audio in**
    
    - Bot captura áudio da call em streaming, manda pro backend.
        
4. **Processamento**
    
    - STT (multi-idioma A + B) → detecta idioma.
        
    - Tradução A→B ou B→A.
        
    - TTS no idioma alvo.
        
5. **Audio out**
    
    - Backend manda áudio sintetizado de volta pro bot.
        
    - Bot abre mic, fala, fecha mic.
        
6. **Controle**
    
    - Usuário do app pode:
        
        - Start/Stop sessão.
            
        - Pausar tradução.
            
        - Trocar pares de idioma entre uma reunião e outra.
            

Sem fallback, sem transcript bonito, sem DOM do Meet, sem levantar mão.  
Só um intérprete robô fazendo o trabalho dele: **colar gente que não fala a mesma língua numa call do Meet.**

Mais pra frente, quando esse esqueleto estiver rodando liso, fica trivial você plugar coisas “de luxo” em cima (logs, sumarização com LLM, modo conference, multi-idiomas, etc.).