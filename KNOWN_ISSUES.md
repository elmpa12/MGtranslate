# MGtranslate Known Issues

## Active Issues

### Issue #1: ScriptProcessorNode Deprecation (Low Priority)

**Status:** Open (Low Priority)

**Description:**
Console shows deprecation warning:
```
[Deprecation] The ScriptProcessorNode is deprecated. Use AudioWorkletNode instead.
```

**Impact:**
Currently none - the code works. However, Chrome may remove ScriptProcessorNode in future versions.

**Solution:**
Migrate to AudioWorkletNode. This requires:
1. Creating a separate AudioWorklet processor file
2. Loading the worklet module
3. Communicating via message ports instead of callbacks

**Priority:** Low - will address when ScriptProcessorNode stops working or shows performance issues.

---

### Issue #2: Tab Audio Capture Requires User Interaction

**Status:** Open (By Design)

**Description:**
To capture audio from other meeting participants, the extension uses `getDisplayMedia()` which requires the user to:
1. See a browser permission dialog
2. Select the current tab
3. Check "Share tab audio"

**Impact:**
- Without this step, only the user's microphone is captured
- Other participants' speech won't be translated
- User may accidentally select the wrong tab

**Workaround:**
Clear instructions in the popup UI explaining the need to share the tab with audio enabled.

**Potential Solutions:**
1. Use `chrome.tabCapture` API (requires different extension permissions)
2. Create an offscreen document for capture
3. Better UI guidance with visual indicators

---

### Issue #3: Chrome Extension Caching

**Status:** Open (Known Chrome Behavior)

**Description:**
When updating extension files, Chrome sometimes loads cached versions instead of the new code.

**Symptoms:**
- Code changes don't take effect
- Line numbers in console don't match the source file
- Old behavior persists after editing

**Solution:**
1. Bump version in `manifest.json`
2. Go to `chrome://extensions`
3. Click reload button on the extension
4. Close and reopen the Google Meet tab
5. Clear browser cache if issues persist

---

### Issue #4: Localtunnel Reliability

**Status:** Open (Development Environment)

**Description:**
The development setup uses localtunnel (`wss://mg.falconsoft.dev/ws`) to expose the local WebSocket server. This can be unreliable.

**Symptoms:**
- Connection drops
- HTTP 503 errors
- Subdomain unavailable
- High latency

**Workarounds:**
1. Restart localtunnel: `npx lt --port 3001 --subdomain mgtranslate`
2. Check tunnel status: `curl https://mg.falconsoft.dev/health`
3. Wait and retry if service is temporarily unavailable

**Production Solution:**
Deploy with proper HTTPS/WSS infrastructure instead of tunneling.

---

### Issue #5: STT Returns Empty Results for Some Audio

**Status:** Open (Under Investigation)

**Description:**
Sometimes Google Speech-to-Text returns no results even for valid speech audio.

**Possible Causes:**
- Audio amplitude too low
- Background noise
- Non-speech sounds
- Language mismatch

**Current Mitigations:**
- Minimum confidence threshold (35%) - lowered for accented speech
- Enhanced STT model (`model="latest_long"`, `use_enhanced=True`)
- Audio amplitude analysis logging
- Silence detection before processing

**Debugging:**
Check integration service logs for:
```
STT returned no results (possibly silence)
Audio analysis: max_amplitude=X, avg_amplitude=Y
```

---

## Resolved Issues

### [RESOLVED] Infinite Translation Loop

**Previous Status:** Critical

**Description:**
The system would enter an infinite loop where TTS output was recaptured and re-translated.

**Resolution:**
Implemented multi-layer loop prevention:
1. **Dynamic pause duration** - Pause based on TTS text length instead of fixed duration
2. **Silence detection** - Process audio immediately when user stops speaking
3. **Client-side blocking** - Block tab capture during TTS playback
4. **Backend pause** - Integration service pauses after sending TTS

**Implementation Details:**
- `estimate_tts_duration()` calculates pause based on ~10 chars/second
- Silence threshold: amplitude < 200
- Min pause: 1.5s, Max pause: 8s

---

### [RESOLVED] Google Translate Quality Issues

**Previous Status:** High

**Description:**
Google Translate API produced literal, unnatural translations that didn't capture context or idioms.

**Resolution:**
Replaced Google Translate with GPT-4o-mini:
- Context memory (last 6 exchanges)
- Business meeting optimized system prompt
- Natural, idiomatic translations
- Maintains consistency across the conversation

---

### [RESOLVED] Fixed Pause Duration Too Long

**Previous Status:** Medium

**Description:**
The fixed 8-second pause after TTS made conversations feel sluggish. Users reported 5-10 second delays between speaking turns.

**Resolution:**
Aggressive timing optimizations across the stack:

1. **Backend TTS pause estimation** (`main.py`):
```python
def estimate_tts_duration(text: str) -> float:
    chars = len(text)
    duration = chars / 15.0  # ~15 chars/sec
    return max(0.5, min(duration, 3.0))  # 0.5s-3s range
```

2. **Silence detection** - Reduced from 1.5s to 1.0s consecutive silence before processing

3. **Client-side cooldown** - Reduced from 5s to 2s after TTS playback

4. **Ready beep notification** - Added audio "ding" when system is ready for next speech

**Result:** Response time reduced from 5-10 seconds to ~2-3 seconds

---

### [RESOLVED] TTS Speaking Too Fast

**Previous Status:** Low

**Description:**
Default TTS speaking rate was too fast for non-native listeners.

**Resolution:**
Added `speaking_rate=0.9` to Google TTS configuration for slightly slower, clearer speech.

---

## Debug Commands

```bash
# Check integration service logs
tail -f /tmp/integration.log

# Check orchestrator logs
tail -f /tmp/orchestrator.log

# Test localtunnel connection
curl -s -w "%{http_code}" https://mg.falconsoft.dev/health

# Kill and restart integration service
pkill -f "python.*main.py"
cd services/integration && source .venv/bin/activate && python src/main.py

# Restart localtunnel
pkill -f "lt --port"
npx lt --port 3001 --subdomain mgtranslate
```

---

*Last updated: 2025-11-29*
