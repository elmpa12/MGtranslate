using Microsoft.AspNetCore.Mvc;
using TranslaTo.TeamsBot.Bot;

namespace TranslaTo.TeamsBot.Controllers;

/// <summary>
/// Controller for manually joining Teams meetings
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class JoinController : ControllerBase
{
    private readonly IBotService _botService;
    private readonly ILogger<JoinController> _logger;

    public JoinController(IBotService botService, ILogger<JoinController> logger)
    {
        _botService = botService;
        _logger = logger;
    }

    /// <summary>
    /// Join a Teams meeting
    /// </summary>
    /// <param name="request">Meeting join request</param>
    /// <returns>Call ID if successful</returns>
    [HttpPost]
    public async Task<IActionResult> JoinMeetingAsync([FromBody] JoinMeetingRequest request)
    {
        if (string.IsNullOrEmpty(request.MeetingUrl))
        {
            return BadRequest(new { error = "Meeting URL is required" });
        }

        try
        {
            _logger.LogInformation("Request to join meeting: {Url}", request.MeetingUrl);

            var callId = await _botService.JoinCallAsync(
                request.MeetingUrl,
                request.DisplayName ?? "Transla.to Translator"
            );

            return Ok(new
            {
                success = true,
                callId = callId,
                message = "Successfully joined meeting"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to join meeting");

            return StatusCode(500, new
            {
                success = false,
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Leave a Teams meeting
    /// </summary>
    /// <param name="callId">Call ID to leave</param>
    [HttpDelete("{callId}")]
    public async Task<IActionResult> LeaveMeetingAsync(string callId)
    {
        try
        {
            await _botService.EndCallAsync(callId);

            return Ok(new
            {
                success = true,
                message = "Left meeting successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to leave meeting");

            return StatusCode(500, new
            {
                success = false,
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Get call status
    /// </summary>
    [HttpGet("{callId}")]
    public IActionResult GetCallStatus(string callId)
    {
        var call = _botService.GetCall(callId);

        if (call == null)
        {
            return NotFound(new { error = "Call not found" });
        }

        return Ok(new
        {
            callId = call.Id,
            state = call.Resource.State?.ToString(),
            direction = call.Resource.Direction?.ToString()
        });
    }
}

public class JoinMeetingRequest
{
    /// <summary>
    /// Teams meeting URL (e.g., https://teams.microsoft.com/l/meetup-join/...)
    /// </summary>
    public string MeetingUrl { get; set; } = "";

    /// <summary>
    /// Display name for the bot in the meeting
    /// </summary>
    public string? DisplayName { get; set; }

    /// <summary>
    /// Source language (default: auto-detect)
    /// </summary>
    public string? SourceLanguage { get; set; }

    /// <summary>
    /// Target language for translation
    /// </summary>
    public string? TargetLanguage { get; set; }
}
