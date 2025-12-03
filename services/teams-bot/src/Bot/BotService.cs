using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Graph.Communications.Calls;
using Microsoft.Graph.Communications.Calls.Media;
using Microsoft.Graph.Communications.Client;
using Microsoft.Graph.Communications.Common.Telemetry;
using System.Collections.Concurrent;

namespace TranslaTo.TeamsBot.Bot;

public interface IBotService
{
    Task InitializeAsync();
    Task<string> JoinCallAsync(string meetingUrl, string? displayName = null);
    Task EndCallAsync(string callId);
    ICall? GetCall(string callId);
}

public class BotOptions
{
    public string BotId { get; set; } = "";
    public string BotName { get; set; } = "Transla.to";
    public string TenantId { get; set; } = "";
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string CallbackUrl { get; set; } = "";
    public string OrchestratorWs { get; set; } = "";
}

public class BotService : IBotService
{
    private readonly ILogger<BotService> _logger;
    private readonly BotOptions _options;
    private ICommunicationsClient? _client;
    private readonly ConcurrentDictionary<string, CallHandler> _callHandlers = new();

    public BotService(ILogger<BotService> logger, IOptions<BotOptions> options)
    {
        _logger = logger;
        _options = options.Value;
    }

    public async Task InitializeAsync()
    {
        _logger.LogInformation("Initializing Transla.to Teams Bot...");

        // Validate configuration
        if (string.IsNullOrEmpty(_options.ClientId))
        {
            _logger.LogWarning("Azure credentials not configured. Bot will not be able to join calls.");
            _logger.LogWarning("Please set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID");
            return;
        }

        try
        {
            // Create authentication provider
            var authProvider = new BotAuthenticationProvider(
                _options.ClientId,
                _options.ClientSecret,
                _options.TenantId
            );

            // Create notification callback URI
            var notificationUri = new Uri($"{_options.CallbackUrl}/api/calls");

            // Build communications client
            var builder = new CommunicationsClientBuilder(
                _options.BotName,
                _options.ClientId,
                new GraphLogger(_options.BotName)
            );

            builder.SetAuthenticationProvider(authProvider);
            builder.SetNotificationUrl(notificationUri);
            builder.SetServiceBaseUrl(new Uri("https://graph.microsoft.com/v1.0"));

            _client = builder.Build();

            // Subscribe to call events
            _client.Calls().OnIncoming += OnIncomingCall;
            _client.Calls().OnUpdated += OnCallUpdated;

            _logger.LogInformation("Teams Bot initialized successfully");
            _logger.LogInformation("Callback URL: {Url}", notificationUri);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Teams Bot");
            throw;
        }

        await Task.CompletedTask;
    }

    public async Task<string> JoinCallAsync(string meetingUrl, string? displayName = null)
    {
        if (_client == null)
        {
            throw new InvalidOperationException("Bot not initialized");
        }

        _logger.LogInformation("Joining meeting: {Url}", meetingUrl);

        try
        {
            // Parse meeting URL to get join info
            var joinInfo = JoinInfo.ParseJoinUrl(meetingUrl);

            // Create media session for audio capture
            var mediaSession = CreateMediaSession();

            // Join the call
            var call = await _client.Calls().AddAsync(
                new JoinMeetingParameters
                {
                    MeetingInfo = joinInfo,
                    MediaConfig = new AppHostedMediaConfig
                    {
                        Blob = mediaSession.GetConfig()
                    },
                    TenantId = _options.TenantId,
                    DisplayName = displayName ?? _options.BotName
                },
                Guid.NewGuid()
            );

            // Create call handler
            var handler = new CallHandler(call, _options.OrchestratorWs, _logger);
            _callHandlers.TryAdd(call.Id, handler);

            _logger.LogInformation("Joined call: {CallId}", call.Id);
            return call.Id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to join meeting");
            throw;
        }
    }

    public async Task EndCallAsync(string callId)
    {
        if (_callHandlers.TryRemove(callId, out var handler))
        {
            await handler.DisposeAsync();
            _logger.LogInformation("Ended call: {CallId}", callId);
        }
    }

    public ICall? GetCall(string callId)
    {
        return _callHandlers.TryGetValue(callId, out var handler) ? handler.Call : null;
    }

    private ILocalMediaSession CreateMediaSession()
    {
        // Audio socket configuration for 16kHz mono PCM
        var audioSocketSettings = new AudioSocketSettings
        {
            StreamDirections = StreamDirection.Recvonly,
            SupportedAudioFormat = AudioFormat.Pcm16K,
            CallId = Guid.NewGuid().ToString()
        };

        // Create media platform settings
        var mediaPlatformSettings = new MediaPlatformSettings
        {
            MediaPlatformInstanceSettings = new MediaPlatformInstanceSettings
            {
                CertificateThumbprint = "", // Set in production
                InstanceInternalPort = 8445,
                InstancePublicIPAddress = System.Net.IPAddress.Any,
                InstancePublicPort = 8445,
                ServiceFqdn = new Uri(_options.CallbackUrl).Host
            },
            ApplicationId = _options.ClientId
        };

        // Create media session
        return MediaPlatform.CreateMediaSession(
            mediaPlatformSettings,
            audioSocketSettings,
            null, // No video
            null  // No VBSS
        );
    }

    private void OnIncomingCall(ICallCollection sender, CollectionEventArgs<ICall> args)
    {
        var call = args.AddedResources.FirstOrDefault();
        if (call == null) return;

        _logger.LogInformation("Incoming call: {CallId}", call.Id);

        // Auto-answer incoming calls
        Task.Run(async () =>
        {
            try
            {
                await call.AnswerAsync(new AppHostedMediaConfig
                {
                    Blob = CreateMediaSession().GetConfig()
                });

                var handler = new CallHandler(call, _options.OrchestratorWs, _logger);
                _callHandlers.TryAdd(call.Id, handler);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to answer call");
            }
        });
    }

    private void OnCallUpdated(ICallCollection sender, CollectionEventArgs<ICall> args)
    {
        foreach (var call in args.AddedResources)
        {
            _logger.LogDebug("Call updated: {CallId} - State: {State}", call.Id, call.Resource.State);

            if (call.Resource.State == CallState.Terminated)
            {
                _callHandlers.TryRemove(call.Id, out _);
                _logger.LogInformation("Call terminated: {CallId}", call.Id);
            }
        }
    }
}

/// <summary>
/// Simple authentication provider for bot credentials
/// </summary>
public class BotAuthenticationProvider : IRequestAuthenticationProvider
{
    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly string _tenantId;

    public BotAuthenticationProvider(string clientId, string clientSecret, string tenantId)
    {
        _clientId = clientId;
        _clientSecret = clientSecret;
        _tenantId = tenantId;
    }

    public async Task AuthenticateOutboundRequestAsync(HttpRequestMessage request, string tenantId)
    {
        // Get access token using client credentials flow
        var token = await GetAccessTokenAsync();
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    }

    public Task<RequestValidationResult> ValidateInboundRequestAsync(HttpRequestMessage request)
    {
        // Validate incoming webhook requests
        // In production, validate the JWT token from Microsoft
        return Task.FromResult(new RequestValidationResult { IsValid = true });
    }

    private async Task<string> GetAccessTokenAsync()
    {
        using var client = new HttpClient();
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = _clientId,
            ["client_secret"] = _clientSecret,
            ["scope"] = "https://graph.microsoft.com/.default"
        });

        var response = await client.PostAsync(
            $"https://login.microsoftonline.com/{_tenantId}/oauth2/v2.0/token",
            content
        );

        var json = await response.Content.ReadAsStringAsync();
        dynamic result = Newtonsoft.Json.JsonConvert.DeserializeObject(json)!;
        return result.access_token;
    }
}
