using System.Windows;
using System.Windows.Input;
using Microsoft.Extensions.DependencyInjection;
using MauiAppBuilder.Core;
using MauiAppBuilder.Services;
using MauiAppBuilder.ViewModels;

namespace MauiAppBuilder;

public partial class MainWindow : Window
{
    private readonly MainViewModel _viewModel;
    private readonly ProjectManager _projectManager;
    private readonly SelectionManager _selectionManager;
    private readonly CommandManager _commandManager;

    public MainWindow()
    {
        InitializeComponent();
        
        _projectManager = App.ServiceProvider.GetRequiredService<ProjectManager>();
        _selectionManager = App.ServiceProvider.GetRequiredService<SelectionManager>();
        _commandManager = App.ServiceProvider.GetRequiredService<CommandManager>();
        
        _viewModel = new MainViewModel(
            _projectManager,
            _selectionManager,
            _commandManager,
            App.ServiceProvider.GetRequiredService<BuildService>());
        
        DataContext = _viewModel;
        
        // Wire up events
        _selectionManager.SelectionChanged += OnSelectionChanged;
        _commandManager.CommandExecuted += OnCommandExecuted;
        _projectManager.ProjectChanged += OnProjectChanged;
        
        Loaded += OnLoaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        // Initialize canvas with toolbox and properties references
        DesignerCanvas.Initialize(
            ToolboxPanel, 
            PropertiesPanel,
            App.ServiceProvider.GetRequiredService<DragDropManager>(),
            App.ServiceProvider.GetRequiredService<CanvasRenderer>(),
            _selectionManager);
            
        ToolboxPanel.Initialize(
            App.ServiceProvider.GetRequiredService<ComponentRegistry>(),
            App.ServiceProvider.GetRequiredService<DragDropManager>());
            
        PropertiesPanel.Initialize(
            _selectionManager,
            App.ServiceProvider.GetRequiredService<PropertyManager>());
            
        ProjectExplorer.Initialize(_projectManager, _selectionManager);
        
        // Create new project on startup
        _viewModel.NewProjectCommand.Execute(null);
    }

    private void OnSelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        var count = e.SelectedComponents.Count;
        SelectionInfo.Text = count == 0 
            ? "No selection" 
            : count == 1 
                ? $"Selected: {e.SelectedComponents[0].Name}" 
                : $"{count} items selected";
    }

    private void OnCommandExecuted(object? sender, CommandExecutedEventArgs e)
    {
        StatusText.Text = e.Description;
    }

    private void OnProjectChanged(object? sender, ProjectChangedEventArgs e)
    {
        Title = $"MAUI App Builder - {e.ProjectName}";
        if (e.IsModified)
            Title += " *";
    }

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        if (_projectManager.CurrentProject?.IsModified == true)
        {
            var result = MessageBox.Show(
                "The project has unsaved changes. Do you want to save before closing?",
                "Unsaved Changes",
                MessageBoxButton.YesNoCancel,
                MessageBoxImage.Question);
                
            if (result == MessageBoxResult.Yes)
            {
                _viewModel.SaveCommand.Execute(null);
            }
            else if (result == MessageBoxResult.Cancel)
            {
                e.Cancel = true;
                return;
            }
        }
        
        base.OnClosing(e);
    }
}
