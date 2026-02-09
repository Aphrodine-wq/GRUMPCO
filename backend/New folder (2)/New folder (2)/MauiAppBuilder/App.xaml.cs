using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using MauiAppBuilder.Core;
using MauiAppBuilder.Services;

namespace MauiAppBuilder;

public partial class App : Application
{
    public static IServiceProvider ServiceProvider { get; private set; } = null!;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        
        var services = new ServiceCollection();
        ConfigureServices(services);
        ServiceProvider = services.BuildServiceProvider();
    }

    private void ConfigureServices(IServiceCollection services)
    {
        // Core services
        services.AddSingleton<ProjectManager>();
        services.AddSingleton<ComponentRegistry>();
        services.AddSingleton<SelectionManager>();
        services.AddSingleton<CommandManager>();
        services.AddSingleton<DragDropManager>();
        services.AddSingleton<CanvasRenderer>();
        services.AddSingleton<PropertyManager>();
        
        // Code generation
        services.AddSingleton<XamlGenerator>();
        services.AddSingleton<CodeBehindGenerator>();
        services.AddSingleton<ProjectScaffolder>();
        
        // Build services
        services.AddSingleton<BuildService>();
        services.AddSingleton<PreviewService>();
    }
}
