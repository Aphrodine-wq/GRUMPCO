<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Tooltip from '../components/Tooltip/Tooltip.svelte';
  import Button from '../components/Button/Button.svelte';

  const { Story } = defineMeta({
    title: 'Design System/Tooltip',
    component: Tooltip,
    tags: ['autodocs'],
    argTypes: {
      content: { control: 'text' },
      position: {
        control: 'select',
        options: ['top', 'bottom', 'left', 'right'],
      },
      delay: { control: 'number' },
    },
  });
</script>

<Story name="Top (Default)">
  {#snippet children()}
    <div style="padding: 60px; display: flex; justify-content: center;">
      <Tooltip content="This tooltip appears on top" position="top">
        <Button>Hover me</Button>
      </Tooltip>
    </div>
  {/snippet}
</Story>

<Story name="Bottom">
  {#snippet children()}
    <div style="padding: 60px; display: flex; justify-content: center;">
      <Tooltip content="This tooltip appears on bottom" position="bottom">
        <Button>Hover me</Button>
      </Tooltip>
    </div>
  {/snippet}
</Story>

<Story name="Left">
  {#snippet children()}
    <div style="padding: 60px; display: flex; justify-content: center;">
      <Tooltip content="Left tooltip" position="left">
        <Button>Hover me</Button>
      </Tooltip>
    </div>
  {/snippet}
</Story>

<Story name="Right">
  {#snippet children()}
    <div style="padding: 60px; display: flex; justify-content: center;">
      <Tooltip content="Right tooltip" position="right">
        <Button>Hover me</Button>
      </Tooltip>
    </div>
  {/snippet}
</Story>

<Story name="All Positions">
  {#snippet children()}
    <div style="padding: 80px; display: flex; gap: 32px; justify-content: center; flex-wrap: wrap;">
      <Tooltip content="Top" position="top">
        <Button variant="secondary">Top</Button>
      </Tooltip>
      <Tooltip content="Bottom" position="bottom">
        <Button variant="secondary">Bottom</Button>
      </Tooltip>
      <Tooltip content="Left" position="left">
        <Button variant="secondary">Left</Button>
      </Tooltip>
      <Tooltip content="Right" position="right">
        <Button variant="secondary">Right</Button>
      </Tooltip>
    </div>
  {/snippet}
</Story>

<Story name="With Delay">
  {#snippet children()}
    <div style="padding: 60px; display: flex; justify-content: center;">
      <Tooltip content="This appears after 500ms delay" delay={500}>
        <Button>Wait for it...</Button>
      </Tooltip>
    </div>
  {/snippet}
</Story>
