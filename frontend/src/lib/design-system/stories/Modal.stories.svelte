<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Modal from '../components/Modal/Modal.svelte';
  import Button from '../components/Button/Button.svelte';

  const { Story } = defineMeta({
    title: 'Design System/Modal',
    component: Modal,
    tags: ['autodocs'],
    argTypes: {
      open: { control: 'boolean' },
      title: { control: 'text' },
      size: {
        control: 'select',
        options: ['sm', 'md', 'lg', 'xl'],
      },
      closeOnBackdrop: { control: 'boolean' },
      showClose: { control: 'boolean' },
    },
  });
</script>

<script>
  let open1 = $state(false);
  let open2 = $state(false);
  let open3 = $state(false);
</script>

<Story name="Basic Modal">
  {#snippet children()}
    <Button onclick={() => (open1 = true)}>Open Modal</Button>
    <Modal bind:open={open1} title="Modal Title">
      <p>This is the modal content. You can put any content here.</p>
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
        <Button variant="ghost" onclick={() => (open1 = false)}>Cancel</Button>
        <Button variant="primary" onclick={() => (open1 = false)}>Confirm</Button>
      </div>
    </Modal>
  {/snippet}
</Story>

<Story name="Small Modal">
  {#snippet children()}
    <Button onclick={() => (open2 = true)}>Open Small Modal</Button>
    <Modal bind:open={open2} title="Confirm Action" size="sm">
      <p>Are you sure you want to proceed?</p>
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
        <Button variant="ghost" onclick={() => (open2 = false)}>Cancel</Button>
        <Button variant="danger" onclick={() => (open2 = false)}>Delete</Button>
      </div>
    </Modal>
  {/snippet}
</Story>

<Story name="Large Modal">
  {#snippet children()}
    <Button onclick={() => (open3 = true)}>Open Large Modal</Button>
    <Modal bind:open={open3} title="Large Modal with More Content" size="lg">
      <p>This is a larger modal that can contain more content.</p>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
        labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
        laboris.
      </p>
      <p>
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
        pariatur.
      </p>
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
        <Button variant="ghost" onclick={() => (open3 = false)}>Close</Button>
      </div>
    </Modal>
  {/snippet}
</Story>
