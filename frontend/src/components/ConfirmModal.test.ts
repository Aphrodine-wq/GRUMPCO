import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ConfirmModal from './ConfirmModal.svelte';

describe('ConfirmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when open is false', () => {
    const { container } = render(ConfirmModal, {
      props: { open: false },
    });

    expect(container.querySelector('.confirm-overlay')).toBeFalsy();
  });

  it('should render when open is true', () => {
    const { container } = render(ConfirmModal, {
      props: { open: true },
    });

    expect(container.querySelector('.confirm-overlay')).toBeTruthy();
  });

  it('should display the title', () => {
    const { getByText } = render(ConfirmModal, {
      props: { open: true, title: 'Delete Item?' },
    });

    expect(getByText('Delete Item?')).toBeTruthy();
  });

  it('should display the message', () => {
    const { getByText } = render(ConfirmModal, {
      props: { open: true, message: 'This action cannot be undone.' },
    });

    expect(getByText('This action cannot be undone.')).toBeTruthy();
  });

  it('should use default title when not provided', () => {
    const { getByText } = render(ConfirmModal, {
      props: { open: true },
    });

    expect(getByText('Confirm')).toBeTruthy();
  });

  it('should use custom button labels', () => {
    const { getByText } = render(ConfirmModal, {
      props: {
        open: true,
        confirmLabel: 'Delete',
        cancelLabel: 'Keep',
      },
    });

    expect(getByText('Delete')).toBeTruthy();
    expect(getByText('Keep')).toBeTruthy();
  });

  it('should use default button labels', () => {
    const { getByText } = render(ConfirmModal, {
      props: { open: true },
    });

    expect(getByText('Confirm')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const { getByText } = render(ConfirmModal, {
      props: { open: true, onConfirm },
    });

    await fireEvent.click(getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    const { getByText } = render(ConfirmModal, {
      props: { open: true, onClose },
    });

    await fireEvent.click(getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should have dialog role', () => {
    const { container } = render(ConfirmModal, {
      props: { open: true, title: 'Test Dialog' },
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-label')).toBe('Test Dialog');
  });
});
