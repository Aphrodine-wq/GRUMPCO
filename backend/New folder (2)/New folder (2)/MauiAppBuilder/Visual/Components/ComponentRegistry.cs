using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using MauiAppBuilder.Models;

namespace MauiAppBuilder.Visual.Components
{
    /// <summary>
    /// Registry of all available MAUI components that can be used in the visual designer.
    /// </summary>
    public class ComponentRegistry
    {
        private static readonly Lazy<ComponentRegistry> _instance = new(() => new ComponentRegistry());
        public static ComponentRegistry Instance => _instance.Value;

        private readonly ObservableCollection<ComponentDefinition> _components;
        public ReadOnlyObservableCollection<ComponentDefinition> Components { get; }

        private ComponentRegistry()
        {
            _components = new ObservableCollection<ComponentDefinition>();
            Components = new ReadOnlyObservableCollection<ComponentDefinition>(_components);
            RegisterDefaultComponents();
        }

        private void RegisterDefaultComponents()
        {
            // Layout Containers
            RegisterComponent(new ComponentDefinition
            {
                Id = "StackLayout",
                Name = "Stack Layout",
                Category = ComponentCategory.Layout,
                Description = "Arranges child elements in a single line",
                Icon = "StackLayoutIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Orientation", "Vertical" },
                    { "Spacing", 0 }
                },
                IsContainer = true,
                AllowedChildren = null // All components allowed
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "Grid",
                Name = "Grid",
                Category = ComponentCategory.Layout,
                Description = "Arranges child elements in rows and columns",
                Icon = "GridIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "RowDefinitions", "*" },
                    { "ColumnDefinitions", "*" }
                },
                IsContainer = true,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "ScrollView",
                Name = "Scroll View",
                Category = ComponentCategory.Layout,
                Description = "Provides scrolling for content",
                Icon = "ScrollViewIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Orientation", "Vertical" }
                },
                IsContainer = true,
                AllowedChildren = new[] { "StackLayout", "Grid", "FlexLayout" }
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "FlexLayout",
                Name = "Flex Layout",
                Category = ComponentCategory.Layout,
                Description = "Flexible box layout with wrapping",
                Icon = "FlexLayoutIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Direction", "Row" },
                    { "Wrap", "Wrap" }
                },
                IsContainer = true,
                AllowedChildren = null
            });

            // UI Controls
            RegisterComponent(new ComponentDefinition
            {
                Id = "Button",
                Name = "Button",
                Category = ComponentCategory.Control,
                Description = "Tappable button with text",
                Icon = "ButtonIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Text", "Button" },
                    { "BackgroundColor", "#512BD4" },
                    { "TextColor", "#FFFFFF" }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "Label",
                Name = "Label",
                Category = ComponentCategory.Control,
                Description = "Displays read-only text",
                Icon = "LabelIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Text", "Label" },
                    { "FontSize", 14 },
                    { "TextColor", "#000000" }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "Entry",
                Name = "Entry",
                Category = ComponentCategory.Control,
                Description = "Single-line text input",
                Icon = "EntryIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Placeholder", "Enter text..." },
                    { "Keyboard", "Default" }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "Editor",
                Name = "Editor",
                Category = ComponentCategory.Control,
                Description = "Multi-line text input",
                Icon = "EditorIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Placeholder", "Enter text..." },
                    { "AutoSize", "TextChanges" }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "Image",
                Name = "Image",
                Category = ComponentCategory.Control,
                Description = "Displays an image",
                Icon = "ImageIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Source", "dotnet_bot.png" },
                    { "Aspect", "AspectFit" }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "CollectionView",
                Name = "Collection View",
                Category = ComponentCategory.Control,
                Description = "Scrollable list of items",
                Icon = "CollectionViewIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "SelectionMode", "Single" }
                },
                IsContainer = true,
                AllowedChildren = new[] { "DataTemplate" }
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "Picker",
                Name = "Picker",
                Category = ComponentCategory.Control,
                Description = "Dropdown selection control",
                Icon = "PickerIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Title", "Select..." }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "Slider",
                Name = "Slider",
                Category = ComponentCategory.Control,
                Description = "Horizontal slider for numeric values",
                Icon = "SliderIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Minimum", 0 },
                    { "Maximum", 100 },
                    { "Value", 50 }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "Switch",
                Name = "Switch",
                Category = ComponentCategory.Control,
                Description = "Toggle switch control",
                Icon = "SwitchIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "IsToggled", false }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "CheckBox",
                Name = "Check Box",
                Category = ComponentCategory.Control,
                Description = "Checkbox control",
                Icon = "CheckBoxIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "IsChecked", false }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "RadioButton",
                Name = "Radio Button",
                Category = ComponentCategory.Control,
                Description = "Radio button control",
                Icon = "RadioButtonIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Content", "Option" }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "ProgressBar",
                Name = "Progress Bar",
                Category = ComponentCategory.Control,
                Description = "Shows progress indication",
                Icon = "ProgressBarIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Progress", 0.5 }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "ActivityIndicator",
                Name = "Activity Indicator",
                Category = ComponentCategory.Control,
                Description = "Loading spinner",
                Icon = "ActivityIndicatorIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "IsRunning", true },
                    { "Color", "#512BD4" }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "DatePicker",
                Name = "Date Picker",
                Category = ComponentCategory.Control,
                Description = "Date selection control",
                Icon = "DatePickerIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Format", "D" }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "TimePicker",
                Name = "Time Picker",
                Category = ComponentCategory.Control,
                Description = "Time selection control",
                Icon = "TimePickerIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Format", "t" }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "Stepper",
                Name = "Stepper",
                Category = ComponentCategory.Control,
                Description = "Numeric stepper control",
                Icon = "StepperIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Minimum", 0 },
                    { "Maximum", 10 },
                    { "Increment", 1 },
                    { "Value", 0 }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "SearchBar",
                Name = "Search Bar",
                Category = ComponentCategory.Control,
                Description = "Search input with search button",
                Icon = "SearchBarIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Placeholder", "Search..." }
                },
                IsContainer = false,
                AllowedChildren = null
            });

            // Navigation
            RegisterComponent(new ComponentDefinition
            {
                Id = "Shell",
                Name = "Shell",
                Category = ComponentCategory.Navigation,
                Description = "App shell with navigation structure",
                Icon = "ShellIcon",
                DefaultProperties = new Dictionary<string, object>(),
                IsContainer = true,
                AllowedChildren = new[] { "TabBar", "FlyoutItem", "MenuItem" }
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "TabBar",
                Name = "Tab Bar",
                Category = ComponentCategory.Navigation,
                Description = "Bottom tab navigation",
                Icon = "TabBarIcon",
                DefaultProperties = new Dictionary<string, object>(),
                IsContainer = true,
                AllowedChildren = new[] { "Tab" }
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "FlyoutItem",
                Name = "Flyout Item",
                Category = ComponentCategory.Navigation,
                Description = "Flyout menu item",
                Icon = "FlyoutItemIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Title", "Menu Item" }
                },
                IsContainer = true,
                AllowedChildren = new[] { "ShellContent" }
            });

            RegisterComponent(new ComponentDefinition
            {
                Id = "ShellContent",
                Name = "Shell Content",
                Category = ComponentCategory.Navigation,
                Description = "Content page for shell navigation",
                Icon = "ShellContentIcon",
                DefaultProperties = new Dictionary<string, object>
                {
                    { "Title", "Page" }
                },
                IsContainer = true,
                AllowedChildren = new[] { "StackLayout", "Grid", "ScrollView" }
            });
        }

        public void RegisterComponent(ComponentDefinition component)
        {
            if (component == null)
                throw new ArgumentNullException(nameof(component));

            if (_components.Any(c => c.Id == component.Id))
                throw new InvalidOperationException($"Component with ID '{component.Id}' is already registered.");

            _components.Add(component);
        }

        public void UnregisterComponent(string componentId)
        {
            var component = _components.FirstOrDefault(c => c.Id == componentId);
            if (component != null)
            {
                _components.Remove(component);
            }
        }

        public ComponentDefinition? GetComponent(string componentId)
        {
            return _components.FirstOrDefault(c => c.Id == componentId);
        }

        public IEnumerable<ComponentDefinition> GetComponentsByCategory(ComponentCategory category)
        {
            return _components.Where(c => c.Category == category);
        }

        public bool IsValidChild(string parentId, string childId)
        {
            var parent = GetComponent(parentId);
            if (parent == null) return false;

            if (!parent.IsContainer) return false;

            if (parent.AllowedChildren == null) return true;

            return parent.AllowedChildren.Contains(childId);
        }
    }
}
