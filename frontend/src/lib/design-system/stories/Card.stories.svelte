<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Card from '../components/Card/Card.svelte';

  const { Story } = defineMeta({
    title: 'Design System/Card',
    component: Card,
    tags: ['autodocs'],
    argTypes: {
      variant: {
        control: 'select',
        options: ['default', 'elevated', 'outlined', 'filled'],
      },
      padding: {
        control: 'select',
        options: ['none', 'sm', 'md', 'lg'],
      },
      interactive: { control: 'boolean' },
    },
  });
</script>

<Story name="Default" args={{ variant: 'default', padding: 'md' }}>
  {#snippet children(args)}
    <Card {...args}>
      <h3 style="margin: 0 0 8px 0;">Card Title</h3>
      <p style="margin: 0; color: #666;">This is a default card with some content inside.</p>
    </Card>
  {/snippet}
</Story>

<Story name="Elevated" args={{ variant: 'elevated', padding: 'md' }}>
  {#snippet children(args)}
    <Card {...args}>
      <h3 style="margin: 0 0 8px 0;">Elevated Card</h3>
      <p style="margin: 0; color: #666;">This card has a shadow for depth.</p>
    </Card>
  {/snippet}
</Story>

<Story name="Outlined" args={{ variant: 'outlined', padding: 'md' }}>
  {#snippet children(args)}
    <Card {...args}>
      <h3 style="margin: 0 0 8px 0;">Outlined Card</h3>
      <p style="margin: 0; color: #666;">This card has a border outline.</p>
    </Card>
  {/snippet}
</Story>

<Story name="Interactive" args={{ variant: 'elevated', padding: 'md', interactive: true }}>
  {#snippet children(args)}
    <Card {...args}>
      <h3 style="margin: 0 0 8px 0;">Interactive Card</h3>
      <p style="margin: 0; color: #666;">Hover or click on this card!</p>
    </Card>
  {/snippet}
</Story>

<Story name="Card Grid">
  {#snippet children()}
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
      <Card variant="elevated" padding="md" interactive>
        <h4 style="margin: 0 0 8px 0;">Feature 1</h4>
        <p style="margin: 0; color: #666; font-size: 14px;">Description of feature one.</p>
      </Card>
      <Card variant="elevated" padding="md" interactive>
        <h4 style="margin: 0 0 8px 0;">Feature 2</h4>
        <p style="margin: 0; color: #666; font-size: 14px;">Description of feature two.</p>
      </Card>
      <Card variant="elevated" padding="md" interactive>
        <h4 style="margin: 0 0 8px 0;">Feature 3</h4>
        <p style="margin: 0; color: #666; font-size: 14px;">Description of feature three.</p>
      </Card>
    </div>
  {/snippet}
</Story>
