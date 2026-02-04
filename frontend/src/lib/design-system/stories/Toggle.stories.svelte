<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Toggle from '../components/Toggle/Toggle.svelte';
  import Checkbox from '../components/Toggle/Checkbox.svelte';
  import Radio from '../components/Toggle/Radio.svelte';

  const { Story } = defineMeta({
    title: 'Design System/Toggle & Checkbox',
    component: Toggle,
    tags: ['autodocs'],
    argTypes: {
      size: {
        control: 'select',
        options: ['sm', 'md', 'lg'],
      },
      disabled: { control: 'boolean' },
    },
  });
</script>

<script>
  let toggle1 = $state(false);
  let toggle2 = $state(true);
  let checkbox1 = $state(false);
  let checkbox2 = $state(true);
  let selectedRadio = $state('option1');
</script>

<Story name="Toggle Off" args={{ size: 'md' }}>
  {#snippet children(args)}
    <Toggle {...args} bind:checked={toggle1} label="Enable notifications" />
  {/snippet}
</Story>

<Story name="Toggle On" args={{ size: 'md' }}>
  {#snippet children(args)}
    <Toggle {...args} bind:checked={toggle2} label="Dark mode" />
  {/snippet}
</Story>

<Story name="Toggle Sizes">
  {#snippet children()}
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <Toggle size="sm" label="Small toggle" />
      <Toggle size="md" label="Medium toggle" />
      <Toggle size="lg" label="Large toggle" />
    </div>
  {/snippet}
</Story>

<Story name="Toggle Disabled">
  {#snippet children()}
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <Toggle disabled label="Disabled off" />
      <Toggle disabled checked={true} label="Disabled on" />
    </div>
  {/snippet}
</Story>

<Story name="Checkbox Unchecked">
  {#snippet children()}
    <Checkbox bind:checked={checkbox1} label="I agree to the terms" />
  {/snippet}
</Story>

<Story name="Checkbox Checked">
  {#snippet children()}
    <Checkbox bind:checked={checkbox2} label="Remember me" />
  {/snippet}
</Story>

<Story name="Checkbox Group">
  {#snippet children()}
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <Checkbox label="Option A" />
      <Checkbox label="Option B" checked />
      <Checkbox label="Option C" />
      <Checkbox label="Option D (disabled)" disabled />
    </div>
  {/snippet}
</Story>

<Story name="Radio Group">
  {#snippet children()}
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <Radio name="options" value="option1" bind:group={selectedRadio} label="First option" />
      <Radio name="options" value="option2" bind:group={selectedRadio} label="Second option" />
      <Radio name="options" value="option3" bind:group={selectedRadio} label="Third option" />
    </div>
    <p style="margin-top: 16px; color: #666;">Selected: {selectedRadio}</p>
  {/snippet}
</Story>
