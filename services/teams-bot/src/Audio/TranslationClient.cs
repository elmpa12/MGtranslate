using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace TranslaTo.TeamsBot.Audio;

/// <summary>
/// WebSocket client that connects to Transla.to orchestrator
/// for real-time translation processing
/// </summary>
public interface ITranslationClient
{
    Task ConnectAsync();
    Task SendAudioAsync(byte[] audioData, string participantId, long timestamp);
    Task DisconnectAsync();
    event EventHandler<TranslationReceivedEventArgs>? OnTranslationReceived;
}

public class TranslationClient : ITranslationClient, IAsyncDisposable
{
    public event EventHandler<TranslationReceivedEventArgs>? OnTranslationReceived;

    private readonly string _orchestratorUrl;
    private readonly ILogger _logger;
    private ClientWebSocket? _webSocket;
    private CancellationTokenSource? _cts;
    private bool _connected;

    public TranslationClient(string orchestratorUrl, ILogger logger)
    {
        _orchestratorUrl = orchestratorUrl;
        _logger = logger;
    }

    public async Task ConnectAsync()
    {
        if (_connected) return;

        try
        {
            _webSocket = new ClientWebSocket();
            _cts = new CancellationTokenSource();

            _logger.LogInformation("Connecting to orchestrator: {Url}", _orchestratorUrl);

            await _webSocket.ConnectAsync(new Uri(_orchestratorUrl), _cts.Token);

            // Register as Teams audio processor
            var registerMessage = JsonSerializer.Serialize(new
            {
                type = "register",
                clientType = "teams_audio_processor",
                platform = "teams"
            });

            await SendMessageAsync(registerMessage);

            _connected = true;
            _logger.LogInformation("Connected to orchestrator");

            // Start receiving messages
            _ = Task.Run(ReceiveMessagesAsync);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to orchestrator");
            throw;
        }
    }

    public async Task SendAudioAsync(byte[] audioData, string participantId, long timestamp)
    {
        if (!_connected || _webSocket == null) return;

        try
        {
            // Convert audio to base64 for JSON transport
            var base64Audio = Convert.ToBase64String(audioData);

            var message = JsonSerializer.Serialize(new
            {
                type = "audio",
                data = base64Audio,
                participantId = participantId,
                timestamp = timestamp,
                format = "pcm16k",
                platform = "teams",
                sourceLang = "auto", // Auto-detect
                targetLang = "en"    // Default target, can be configured
            });

            await SendMessageAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send audio");
        }
    }

    public async Task DisconnectAsync()
    {
        if (!_connected) return;

        _connected = false;
        _cts?.Cancel();

        if (_webSocket != null && _webSocket.State == WebSocketState.Open)
        {
            try
            {
                await _webSocket.CloseAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "Disconnecting",
                    CancellationToken.None
                );
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error closing WebSocket");
            }
        }

        _webSocket?.Dispose();
        _webSocket = null;

        _logger.LogInformation("Disconnected from orchestrator");
    }

    private async Task SendMessageAsync(string message)
    {
        if (_webSocket == null || _webSocket.State != WebSocketState.Open) return;

        var bytes = Encoding.UTF8.GetBytes(message);
        await _webSocket.SendAsync(
            new ArraySegment<byte>(bytes),
            WebSocketMessageType.Text,
            true,
            _cts?.Token ?? CancellationToken.None
        );
    }

    private async Task ReceiveMessagesAsync()
    {
        var buffer = new byte[8192];

        while (_connected && _webSocket?.State == WebSocketState.Open)
        {
            try
            {
                var result = await _webSocket.ReceiveAsync(
                    new ArraySegment<byte>(buffer),
                    _cts?.Token ?? CancellationToken.None
                );

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    _logger.LogInformation("WebSocket closed by server");
                    break;
                }

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    ProcessMessage(message);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error receiving WebSocket message");
            }
        }
    }

    private void ProcessMessage(string message)
    {
        try
        {
            using var doc = JsonDocument.Parse(message);
            var root = doc.RootElement;

            if (!root.TryGetProperty("type", out var typeElement)) return;

            var type = typeElement.GetString();

            if (type == "translation")
            {
                var originalText = root.GetProperty("originalText").GetString() ?? "";
                var translatedText = root.GetProperty("translatedText").GetString() ?? "";
                var audioUrl = root.TryGetProperty("audioUrl", out var audioEl)
                    ? audioEl.GetString()
                    : null;

                _logger.LogInformation("Translation received: {Original} -> {Translated}",
                    originalText, translatedText);

                OnTranslationReceived?.Invoke(this, new TranslationReceivedEventArgs
                {
                    OriginalText = originalText,
                    TranslatedText = translatedText,
                    AudioUrl = audioUrl
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing message");
        }
    }

    public async ValueTask DisposeAsync()
    {
        await DisconnectAsync();
        _cts?.Dispose();
    }
}

public class TranslationReceivedEventArgs : EventArgs
{
    public string OriginalText { get; set; } = "";
    public string TranslatedText { get; set; } = "";
    public string? AudioUrl { get; set; }
}
