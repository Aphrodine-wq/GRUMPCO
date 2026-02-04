<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Dropdown from '../components/Dropdown/Dropdown.svelte';

  const { Story } = defineMeta({
    title: 'Design System/Dropdown',
    component: Dropdown,
    tags: ['autodocs'],
    argTypes: {
      placeholder: { control: 'text' },
      disabled: { control: 'boolean' },
      size: {
        control: 'select',
        options: ['sm', 'md', 'lg'],
      },
    },
  });
</script>

<script>
  let selected1 = $state('');
  let selected2 = $state('option2');

  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
    { value: 'option4', label: 'Option 4' },
  ];

  const modelOptions = [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'claude-3', label: 'Claude 3' },
    { value: 'gemini-pro', label: 'Gemini Pro' },
  ];
</script>

<Story name="Default">
  {#snippet children()}
    <div style="width: 300px;">
      <Dropdown {options} bind:value={selected1} placeholder="Select an option" />
    </div>
  {/snippet}
</Story>

<Story name="With Preselected Value">
  {#snippet children()}
    <div style="width: 300px;">
      <Dropdown {options} bind:value={selected2} placeholder="Select an option" />
      <p style="margin-top: 8px; color: #666;">Selected: {selected2}</p>
    </div>
  {/snippet}
</Story>

<Story name="Model Selector">
  {#snippet children()}
    <div style="width: 300px;">
      <Dropdown options={modelOptions} placeholder="Select a model" />
    </div>
  {/snippet}
</Story>

<Story name="Disabled">
  {#snippet children()}
    <div style="width: 300px;">
      <Dropdown {options} disabled placeholder="Disabled dropdown" />
    </div>
  {/snippet}
</Story>
