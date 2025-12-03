using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using TranslaTo.TeamsBot.Bot;
using TranslaTo.TeamsBot.Audio;

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

// Add Serilog
builder.Host.UseSerilog();

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Register bot services
builder.Services.AddSingleton<IBotService, BotService>();
builder.Services.AddSingleton<ITranslationClient, TranslationClient>();

// Configure bot options
builder.Services.Configure<BotOptions>(options =>
{
    options.BotId = Environment.GetEnvironmentVariable("BOT_ID") ?? "";
    options.BotName = Environment.GetEnvironmentVariable("BOT_NAME") ?? "Transla.to";
    options.TenantId = Environment.GetEnvironmentVariable("AZURE_TENANT_ID") ?? "";
    options.ClientId = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID") ?? "";
    options.ClientSecret = Environment.GetEnvironmentVariable("AZURE_CLIENT_SECRET") ?? "";
    options.CallbackUrl = Environment.GetEnvironmentVariable("CALLBACK_URL") ?? "";
    options.OrchestratorWs = Environment.GetEnvironmentVariable("ORCHESTRATOR_WS") ?? "wss://transla.to/ws";
});

var app = builder.Build();

// Initialize bot service
var botService = app.Services.GetRequiredService<IBotService>();
await botService.InitializeAsync();

app.UseRouting();
app.MapControllers();

// Health check endpoint
app.MapGet("/health", () => new { status = "healthy", service = "transla-teams-bot" });

Log.Information("Transla.to Teams Bot starting on port {Port}",
    Environment.GetEnvironmentVariable("PORT") ?? "5000");

app.Run();
