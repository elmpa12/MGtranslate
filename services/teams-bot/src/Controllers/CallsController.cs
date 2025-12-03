using Microsoft.AspNetCore.Mvc;
using TranslaTo.TeamsBot.Bot;

namespace TranslaTo.TeamsBot.Controllers;

/// <summary>
/// Controller for Teams webhook callbacks
/// Microsoft Teams sends call notifications to this endpoint
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class CallsController : ControllerBase
{
    private readonly IBotService _botService;
    private readonly ILogger<CallsController> _logger;

    public CallsController(IBotService botService, ILogger<CallsController> logger)
    {
        _botService = botService;
        _logger = logger;
    }

    /// <summary>
    /// Webhook endpoint for incoming call notifications from Microsoft Graph
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> OnIncomingRequestAsync()
    {
        _logger.LogInformation("Received webhook callback from Teams");

        // Read the request body
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        _logger.LogDebug("Webhook body: {Body}", body);

        // The actual processing is handled by the Communications SDK
        // which processes the notification through the registered handlers
        // in BotService.OnIncomingCall and BotService.OnCallUpdated

        return Ok();
    }

    /// <summary>
    /// Handle notification callbacks
    /// </summary>
    [HttpPost("callback")]
    public IActionResult Callback()
    {
        _logger.LogDebug("Received callback notification");
        return Ok();
    }
}
