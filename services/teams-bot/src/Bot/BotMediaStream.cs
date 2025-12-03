using Microsoft.Extensions.Logging;
using Microsoft.Graph.Communications.Calls.Media;
using Microsoft.Skype.Bots.Media;

namespace TranslaTo.TeamsBot.Bot;

/// <summary>
/// Handles real-time audio capture from Teams meeting
/// Audio format: 16kHz mono PCM (32KB/second)
/// </summary>
public class BotMediaStream : IDisposable
{
    public event EventHandler<AudioReceivedEventArgs>? OnAudioReceived;

    private readonly ILocalMediaSession _mediaSession;
    private readonly ILogger _logger;
    private readonly IAudioSocket _audioSocket;
    private bool _disposed;

    public BotMediaStream(ILocalMediaSession mediaSession, ILogger logger)
    {
        _mediaSession = mediaSession;
        _logger = logger;

        // Get the audio socket from media session
        _audioSocket = _mediaSession.AudioSocket;

        // Subscribe to audio events
        _audioSocket.AudioMediaReceived += OnAudioMediaReceived;

        _logger.LogInformation("BotMediaStream initialized - Audio format: 16kHz mono PCM");
    }

    private void OnAudioMediaReceived(object sender, AudioMediaReceivedEventArgs e)
    {
        try
        {
            // Get the audio buffer
            var buffer = e.Buffer;

            if (buffer == null || buffer.Length == 0)
            {
                return;
            }

            // Extract audio data
            var audioData = new byte[buffer.Length];
            buffer.Data.CopyTo(audioData, 0);

            // Get participant info
            var participantId = buffer.ActiveSpeakers?.FirstOrDefault()?.ToString() ?? "unknown";
            var timestamp = buffer.Timestamp;

            // Log audio reception (debug level to avoid spam)
            _logger.LogTrace("Audio received: {Length} bytes from {Participant} at {Timestamp}",
                audioData.Length, participantId, timestamp);

            // Raise event for processing
            OnAudioReceived?.Invoke(this, new AudioReceivedEventArgs
            {
                AudioData = audioData,
                ParticipantId = participantId,
                Timestamp = timestamp
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing audio buffer");
        }
        finally
        {
            // IMPORTANT: Always dispose the buffer to prevent memory leaks
            e.Buffer?.Dispose();
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        _audioSocket.AudioMediaReceived -= OnAudioMediaReceived;
        _logger.LogInformation("BotMediaStream disposed");
    }
}
