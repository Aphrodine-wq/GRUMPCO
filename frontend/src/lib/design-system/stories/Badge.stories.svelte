<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Badge from '../components/Badge/Badge.svelte';

  const { Story } = defineMeta({
    title: 'Design System/Badge',
    component: Badge,
    tags: ['autodocs'],
    argTypes: {
      variant: {
        control: 'select',
        options: ['default', 'primary', 'success', 'warning', 'danger', 'info'],
      },
      size: {
        control: 'select',
        options: ['sm', 'md', 'lg'],
      },
    },
  });
</script>

<Story name="Default" args={{ variant: 'default' }}>
  {#snippet children(args)}
    <Badge {...args}>Default</Badge>
  {/snippet}
</Story>

<Story name="Primary" args={{ variant: 'primary' }}>
  {#snippet children(args)}
    <Badge {...args}>Primary</Badge>
  {/snippet}
</Story>

<Story name="Success" args={{ variant: 'success' }}>
  {#snippet children(args)}
    <Badge {...args}>Success</Badge>
  {/snippet}
</Story>

<Story name="Warning" args={{ variant: 'warning' }}>
  {#snippet children(args)}
    <Badge {...args}>Warning</Badge>
  {/snippet}
</Story>

<Story name="Danger" args={{ variant: 'danger' }}>
  {#snippet children(args)}
    <Badge {...args}>Danger</Badge>
  {/snippet}
</Story>

<Story name="Info" args={{ variant: 'info' }}>
  {#snippet children(args)}
    <Badge {...args}>Info</Badge>
  {/snippet}
</Story>

<Story name="All Variants">
  {#snippet children()}
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  {/snippet}
</Story>

<Story name="Sizes">
  {#snippet children()}
    <div style="display: flex; gap: 8px; align-items: center;">
      <Badge variant="primary" size="sm">Small</Badge>
      <Badge variant="primary" size="md">Medium</Badge>
      <Badge variant="primary" size="lg">Large</Badge>
    </div>
  {/snippet}
</Story>
