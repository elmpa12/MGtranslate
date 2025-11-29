# MGtranslate

Real-time bidirectional translation for Google Meet calls. Enables seamless communication between participants speaking different languages.

## Features

- **Bidirectional Translation** - Automatically detects and translates between two languages (e.g., Portuguese ↔ English)
- **Real-time Processing** - Translates speech as it happens with minimal delay
- **Context-Aware Translation** - Uses GPT-4o-mini with conversation memory for natural, idiomatic translations
- **Business Meeting Optimized** - System prompt designed for professional communication clarity
- **Chrome Extension** - Easy-to-use interface integrated with Google Meet

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Chrome Extension│────►│   Orchestrator  │────►│   Integration   │
│ (Audio Capture) │◄────│   (Node.js)     │◄────│   (Python)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    ▼                   ▼                   ▼
                              Google STT          OpenAI GPT          Google TTS
                            (Speech→Text)        (Translation)       (Text→Speech)
```

1. **Capture** - Extension captures audio from your microphone and other meeting participants
2. **Transcribe** - Google Speech-to-Text converts audio to text and detects language
3. **Translate** - GPT-4o-mini translates with context from previous exchanges
4. **Speak** - Google Text-to-Speech generates natural audio output

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Google Cloud account with APIs enabled:
  - Speech-to-Text API
  - Text-to-Speech API
- OpenAI API key
- Chrome browser

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/MGtranslate.git
cd MGtranslate

# Install Orchestrator dependencies
cd services/orchestrator
npm install

# Install Integration Service dependencies
cd ../integration
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Configuration

1. **Google Cloud Credentials**
   ```bash
   # Download your service account JSON and set the path
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/credentials.json"
   ```

2. **OpenAI API Key**
   ```bash
   # Create .env file in services/integration/
   echo "OPENAI_API_KEY=sk-your-key-here" > services/integration/.env
   ```

### Running the Services

```bash
# Terminal 1: Start Orchestrator
cd services/orchestrator
node src/index.js

# Terminal 2: Start Integration Service
cd services/integration
source .venv/bin/activate
python src/main.py

# Terminal 3: Start localtunnel (for Chrome extension access)
npx lt --port 3001 --subdomain mgtranslate
```

### Installing the Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. The MGtranslate icon should appear in your toolbar

### Using the Extension

1. Join a Google Meet call
2. Click the MGtranslate extension icon
3. Select your languages (e.g., Portuguese ↔ English)
4. Click **Start Translation**
5. When prompted, share the current tab with **audio enabled**
6. Start speaking - translations will play automatically!

## Project Structure

```
MGtranslate/
├── extension/               # Chrome Extension
│   ├── manifest.json       # Extension configuration
│   ├── content.js          # Audio capture & playback
│   ├── popup.html/js       # User interface
│   └── background.js       # Service worker
│
├── services/
│   ├── orchestrator/       # Message routing (Node.js)
│   │   └── src/index.js    # WebSocket server
│   │
│   └── integration/        # STT/Translation/TTS (Python)
│       ├── src/main.py     # Main service
│       └── requirements.txt
│
├── docs/                   # Additional documentation
├── ARCHITECTURE.md         # Detailed architecture docs
├── KNOWN_ISSUES.md         # Known issues & solutions
└── README.md               # This file
```

## Configuration Options

### Integration Service (`services/integration/src/main.py`)

| Setting | Default | Description |
|---------|---------|-------------|
| `MIN_BUFFER_SIZE` | 64000 (~2s) | Minimum audio before processing |
| `MAX_BUFFER_SIZE` | 960000 (~30s) | Maximum buffer for long speeches |
| `BUFFER_TIMEOUT` | 5.0s | Process after this silence duration |
| `MAX_CONTEXT_SIZE` | 6 | Number of exchanges to remember |
| `MIN_CONFIDENCE` | 0.5 | STT confidence threshold |

### Supported Languages

Currently optimized for:
- Portuguese (Brazil) ↔ English (US)

The system can be extended to support additional languages by modifying the STT configuration.

## Troubleshooting

### Extension not connecting
```bash
# Check if localtunnel is running
curl https://mg.falconsoft.dev/health
# Should return: {"status":"ok"}
```

### No translation output
```bash
# Check integration service logs
tail -f /tmp/integration.log
```

### Audio not being captured
- Make sure you selected "Share tab audio" when prompted
- Check Chrome console (F12) for error messages
- Reload the extension in `chrome://extensions`

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for more detailed troubleshooting.

## API Costs

| Service | Provider | Approximate Cost |
|---------|----------|------------------|
| Speech-to-Text | Google Cloud | ~$0.006 per 15 seconds |
| Translation | OpenAI GPT-4o-mini | ~$0.15 per 1M tokens |
| Text-to-Speech | Google Cloud | ~$4 per 1M characters |

For a typical 1-hour meeting with moderate conversation, expect costs around $1-3.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Add your license here]

## Acknowledgments

- Google Cloud Speech & Text-to-Speech APIs
- OpenAI GPT-4o-mini for natural translations
- The localtunnel project for development tunneling

---

For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).
