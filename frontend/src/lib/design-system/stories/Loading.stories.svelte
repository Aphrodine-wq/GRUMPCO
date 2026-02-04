<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Spinner from '../components/Loading/Spinner.svelte';
  import Skeleton from '../components/Loading/Skeleton.svelte';
  import Progress from '../components/Loading/Progress.svelte';

  const { Story } = defineMeta({
    title: 'Design System/Loading',
    component: Spinner,
    tags: ['autodocs'],
  });
</script>

<script>
  let progress = $state(65);
</script>

<Story name="Spinner Default">
  {#snippet children()}
    <Spinner />
  {/snippet}
</Story>

<Story name="Spinner Sizes">
  {#snippet children()}
    <div style="display: flex; gap: 24px; align-items: center;">
      <div style="text-align: center;">
        <Spinner size="sm" />
        <p style="margin-top: 8px; font-size: 12px; color: #666;">Small</p>
      </div>
      <div style="text-align: center;">
        <Spinner size="md" />
        <p style="margin-top: 8px; font-size: 12px; color: #666;">Medium</p>
      </div>
      <div style="text-align: center;">
        <Spinner size="lg" />
        <p style="margin-top: 8px; font-size: 12px; color: #666;">Large</p>
      </div>
    </div>
  {/snippet}
</Story>

<Story name="Skeleton Text">
  {#snippet children()}
    <div style="width: 400px; display: flex; flex-direction: column; gap: 12px;">
      <Skeleton variant="text" />
      <Skeleton variant="text" />
      <Skeleton variant="text" width="60%" />
    </div>
  {/snippet}
</Story>

<Story name="Skeleton Card">
  {#snippet children()}
    <div style="width: 300px;">
      <Skeleton variant="rectangular" height="150px" />
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>
  {/snippet}
</Story>

<Story name="Skeleton Avatar">
  {#snippet children()}
    <div style="display: flex; gap: 16px; align-items: center;">
      <Skeleton variant="circular" width="48px" height="48px" />
      <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
        <Skeleton variant="text" width="120px" />
        <Skeleton variant="text" width="200px" />
      </div>
    </div>
  {/snippet}
</Story>

<Story name="Progress Bar">
  {#snippet children()}
    <div style="width: 400px; display: flex; flex-direction: column; gap: 24px;">
      <div>
        <p style="margin-bottom: 8px; font-size: 14px;">0%</p>
        <Progress value={0} />
      </div>
      <div>
        <p style="margin-bottom: 8px; font-size: 14px;">25%</p>
        <Progress value={25} />
      </div>
      <div>
        <p style="margin-bottom: 8px; font-size: 14px;">65%</p>
        <Progress value={65} />
      </div>
      <div>
        <p style="margin-bottom: 8px; font-size: 14px;">100%</p>
        <Progress value={100} />
      </div>
    </div>
  {/snippet}
</Story>

<Story name="Progress with Label">
  {#snippet children()}
    <div style="width: 400px;">
      <Progress value={progress} showLabel />
      <div style="margin-top: 16px;">
        <input type="range" min="0" max="100" bind:value={progress} style="width: 100%;" />
      </div>
    </div>
  {/snippet}
</Story>

<Story name="Progress Sizes">
  {#snippet children()}
    <div style="width: 400px; display: flex; flex-direction: column; gap: 16px;">
      <div>
        <p style="margin-bottom: 8px; font-size: 12px; color: #666;">Small</p>
        <Progress value={60} size="sm" />
      </div>
      <div>
        <p style="margin-bottom: 8px; font-size: 12px; color: #666;">Medium</p>
        <Progress value={60} size="md" />
      </div>
      <div>
        <p style="margin-bottom: 8px; font-size: 12px; color: #666;">Large</p>
        <Progress value={60} size="lg" />
      </div>
    </div>
  {/snippet}
</Story>

<Story name="Indeterminate Progress">
  {#snippet children()}
    <div style="width: 400px;">
      <Progress indeterminate />
    </div>
  {/snippet}
</Story>
