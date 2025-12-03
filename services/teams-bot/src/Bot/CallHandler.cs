using Microsoft.Extensions.Logging;
using Microsoft.Graph.Communications.Calls;
using Microsoft.Graph.Communications.Calls.Media;
using Microsoft.Graph.Communications.Resources;
using TranslaTo.TeamsBot.Audio;

namespace TranslaTo.TeamsBot.Bot;

/// <summary>
/// Handles a single call session, managing audio capture and translation
/// </summary>
public class CallHandler : IAsyncDisposable
{
    public ICall Call { get; }

    private readonly ILogger _logger;
    private readonly BotMediaStream _mediaStream;
    private readonly TranslationClient _translationClient;
    private readonly string _orchestratorWs;
    private bool _disposed;

    public CallHandler(ICall call, string orchestratorWs, ILogger logger)
    {
        Call = call;
        _orchestratorWs = orchestratorWs;
        _logger = logger;

        // Initialize translation client
        _translationClient = new TranslationClient(orchestratorWs, logger);

        // Initialize media stream for audio capture
        _mediaStream = new BotMediaStream(call.GetLocalMediaSession(), _logger);
        _mediaStream.OnAudioReceived += OnAudioReceived;

        // Subscribe to call events
        Call.OnUpdated += OnCallUpdated;

        _logger.LogInformation("CallHandler created for call {CallId}", call.Id);
    }

    private void OnCallUpdated(ICall sender, ResourceEventArgs<Call> args)
    {
        _logger.LogDebug("Call {CallId} updated - State: {State}",
            sender.Id, args.NewResource.State);

        if (args.NewResource.State == CallState.Established)
        {
            _logger.LogInformation("Call {CallId} established, starting translation", sender.Id);
            Task.Run(() => _translationClient.ConnectAsync());
        }
    }

    private async void OnAudioReceived(object? sender, AudioReceivedEventArgs e)
    {
        try
        {
            // Send audio to translation pipeline
            await _translationClient.SendAudioAsync(
                e.AudioData,
                e.ParticipantId,
                e.Timestamp
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending audio to translation pipeline");
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        _logger.LogInformation("Disposing CallHandler for call {CallId}", Call.Id);

        _mediaStream.OnAudioReceived -= OnAudioReceived;
        Call.OnUpdated -= OnCallUpdated;

        await _translationClient.DisconnectAsync();
        _mediaStream.Dispose();

        try
        {
            await Call.DeleteAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error deleting call");
        }
    }
}

/// <summary>
/// Event args for received audio
/// </summary>
public class AudioReceivedEventArgs : EventArgs
{
    public byte[] AudioData { get; set; } = Array.Empty<byte>();
    public string ParticipantId { get; set; } = "";
    public long Timestamp { get; set; }
}
