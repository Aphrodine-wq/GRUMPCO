using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Collections.Generic;
using System.Linq;
using MauiAppBuilder.Core.Models;
using MauiAppBuilder.Core.Services;

namespace MauiAppBuilder.Visual
{
    public partial class DesignerCanvas : UserControl
    {
        private readonly SelectionManager _selectionManager;
        private readonly DragDropManager _dragDropManager;
        private readonly CanvasRenderer _canvasRenderer;
        private readonly CommandManager _commandManager;
        
        private Point _dragStartPoint;
        private bool _isDragging;
        private DesignerComponent? _draggedComponent;
        private readonly List<SelectionAdorner> _selectionAdorners = new();

        public event EventHandler<DesignerComponent>? ComponentSelected;
        public event EventHandler? CanvasClicked;
        public event EventHandler<List<DesignerComponent>>? SelectionChanged;

        public DesignerCanvas()
        {
            InitializeComponent();
            
            _selectionManager = new SelectionManager();
            _dragDropManager = new DragDropManager();
            _canvasRenderer = new CanvasRenderer(ComponentCanvas);
            _commandManager = CommandManager.Instance;
            
            _selectionManager.SelectionChanged += OnSelectionManagerChanged;
            
            DrawGridLines();
        }

        private void DrawGridLines()
        {
            const double gridSize = 20;
            const double width = 2000;
            const double height = 2000;
            
            for (double x = 0; x <= width; x += gridSize)
            {
                var line = new Line
                {
                    X1 = x, Y1 = 0,
                    X2 = x, Y2 = height,
                    Stroke = new SolidColorBrush(Color.FromRgb(230, 230, 230)),
                    StrokeThickness = 1
                };
                GridLinesCanvas.Children.Add(line);
            }
            
            for (double y = 0; y <= height; y += gridSize)
            {
                var line = new Line
                {
                    X1 = 0, Y1 = y,
                    X2 = width, Y2 = y,
                    Stroke = new SolidColorBrush(Color.FromRgb(230, 230, 230)),
                    StrokeThickness = 1
                };
                GridLinesCanvas.Children.Add(line);
            }
        }

        public void LoadProject(ProjectModel project)
        {
            _canvasRenderer.Clear();
            _selectionManager.Clear();
            
            foreach (var component in project.Components)
            {
                var element = _canvasRenderer.RenderComponent(component);
                element.MouseLeftButtonDown += (s, e) => OnComponentMouseDown(s, e, component);
            }
        }

        public void AddComponent(ComponentType componentType, Point position)
        {
            var component = new DesignerComponent
            {
                Id = Guid.NewGuid().ToString(),
                Type = componentType,
                X = SnapToGrid(position.X),
                Y = SnapToGrid(position.Y),
                Width = componentType.DefaultWidth,
                Height = componentType.DefaultHeight,
                Properties = new Dictionary<string, object>()
            };

            var command = new AddComponentCommand(this, component);
            _commandManager.Execute(command);
            
            _selectionManager.SelectSingle(component);
        }

        public void RemoveComponent(DesignerComponent component)
        {
            var command = new RemoveComponentCommand(this, component);
            _commandManager.Execute(command);
        }

        public void UpdateComponent(DesignerComponent component)
        {
            _canvasRenderer.UpdateComponent(component);
            UpdateSelectionAdorners();
        }

        internal void AddComponentInternal(DesignerComponent component)
        {
            var element = _canvasRenderer.RenderComponent(component);
            element.MouseLeftButtonDown += (s, e) => OnComponentMouseDown(s, e, component);
        }

        internal void RemoveComponentInternal(DesignerComponent component)
        {
            _canvasRenderer.RemoveComponent(component);
            _selectionManager.Deselect(component);
        }

        private double SnapToGrid(double value)
        {
            const double gridSize = 10;
            return Math.Round(value / gridSize) * gridSize;
        }

        private void OnDragEnter(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent(typeof(ComponentType)))
            {
                e.Effects = DragDropEffects.Copy;
                DragGhost.Visibility = Visibility.Visible;
            }
        }

        private void OnDragOver(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent(typeof(ComponentType)))
            {
                var position = e.GetPosition(ComponentCanvas);
                DragGhost.Width = 100;
                DragGhost.Height = 40;
                Canvas.SetLeft(DragGhost, position.X - 50);
                Canvas.SetTop(DragGhost, position.Y - 20);
                e.Effects = DragDropEffects.Copy;
                e.Handled = true;
            }
        }

        private void OnDragLeave(object sender, DragEventArgs e)
        {
            DragGhost.Visibility = Visibility.Collapsed;
        }

        private void OnDrop(object sender, DragEventArgs e)
        {
            DragGhost.Visibility = Visibility.Collapsed;
            
            if (e.Data.GetDataPresent(typeof(ComponentType)))
            {
                var componentType = e.Data.GetData(typeof(ComponentType)) as ComponentType;
                var position = e.GetPosition(ComponentCanvas);
                
                if (componentType != null)
                {
                    AddComponent(componentType, position);
                }
            }
        }

        private void OnDesignSurfaceDrop(object sender, DragEventArgs e)
        {
            OnDrop(sender, e);
        }

        private void OnCanvasMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.Source == this || e.Source == ComponentCanvas)
            {
                _selectionManager.Clear();
                CanvasClicked?.Invoke(this, EventArgs.Empty);
            }
        }

        private void OnComponentCanvasMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            _dragStartPoint = e.GetPosition(ComponentCanvas);
            _isDragging = false;
            
            if (e.Source is FrameworkElement element)
            {
                var component = _canvasRenderer.GetComponentFromElement(element);
                if (component != null)
                {
                    if (Keyboard.IsKeyDown(Key.LeftCtrl) || Keyboard.IsKeyDown(Key.RightCtrl))
                    {
                        _selectionManager.ToggleSelection(component);
                    }
                    else if (!_selectionManager.IsSelected(component))
                    {
                        _selectionManager.SelectSingle(component);
                    }
                    
                    _draggedComponent = component;
                    CaptureMouse();
                }
            }
        }

        private void OnCanvasMouseMove(object sender, MouseEventArgs e)
        {
            if (_draggedComponent != null && IsMouseCaptured)
            {
                var currentPosition = e.GetPosition(ComponentCanvas);
                var offset = currentPosition - _dragStartPoint;
                
                if (!_isDragging && (Math.Abs(offset.X) > 3 || Math.Abs(offset.Y) > 3))
                {
                    _isDragging = true;
                }
                
                if (_isDragging)
                {
                    var selectedComponents = _selectionManager.SelectedComponents.ToList();
                    
                    foreach (var component in selectedComponents)
                    {
                        component.X = SnapToGrid(component.X + offset.X);
                        component.Y = SnapToGrid(component.Y + offset.Y);
                        _canvasRenderer.UpdateComponentPosition(component);
                    }
                    
                    UpdateSelectionAdorners();
                    _dragStartPoint = currentPosition;
                }
            }
        }

        private void OnCanvasMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
        {
            if (_isDragging && _draggedComponent != null)
            {
                var selectedComponents = _selectionManager.SelectedComponents.ToList();
                var command = new MoveComponentsCommand(_canvasRenderer, selectedComponents);
                _commandManager.Execute(command);
            }
            
            _isDragging = false;
            _draggedComponent = null;
            ReleaseMouseCapture();
        }

        private void OnComponentMouseDown(object sender, MouseButtonEventArgs e, DesignerComponent component)
        {
            e.Handled = true;
            
            if (Keyboard.IsKeyDown(Key.LeftCtrl) || Keyboard.IsKeyDown(Key.RightCtrl))
            {
                _selectionManager.ToggleSelection(component);
            }
            else
            {
                _selectionManager.SelectSingle(component);
            }
            
            ComponentSelected?.Invoke(this, component);
        }

        private void OnSelectionManagerChanged(object? sender, EventArgs e)
        {
            UpdateSelectionAdorners();
            SelectionChanged?.Invoke(this, _selectionManager.SelectedComponents.ToList());
        }

        private void UpdateSelectionAdorners()
        {
            // Clear existing adorners
            foreach (var adorner in _selectionAdorners)
            {
                adorner.Detach();
            }
            _selectionAdorners.Clear();
            SelectionLayer.Children.Clear();
            
            // Add new adorners for selected components
            foreach (var component in _selectionManager.SelectedComponents)
            {
                var element = _canvasRenderer.GetElementFromComponent(component);
                if (element != null)
                {
                    var adorner = new SelectionAdorner(element, SelectionLayer, component);
                    adorner.ResizeHandleDragged += OnResizeHandleDragged;
                    _selectionAdorners.Add(adorner);
                }
            }
        }

        private void OnResizeHandleDragged(object? sender, ResizeEventArgs e)
        {
            var component = e.Component;
            component.Width = Math.Max(20, e.NewWidth);
            component.Height = Math.Max(20, e.NewHeight);
            component.X = e.NewX;
            component.Y = e.NewY;
            
            _canvasRenderer.UpdateComponent(component);
            UpdateSelectionAdorners();
        }

        public List<DesignerComponent> GetAllComponents()
        {
            return _canvasRenderer.GetAllComponents();
        }

        public void Clear()
        {
            _canvasRenderer.Clear();
            _selectionManager.Clear();
            _selectionAdorners.Clear();
            SelectionLayer.Children.Clear();
        }
    }

    public class ResizeEventArgs : EventArgs
    {
        public DesignerComponent Component { get; set; } = null!;
        public double NewWidth { get; set; }
        public double NewHeight { get; set; }
        public double NewX { get; set; }
        public double NewY { get; set; }
    }
}
