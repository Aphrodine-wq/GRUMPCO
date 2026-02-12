import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SkeletonLoader from './SkeletonLoader.svelte';

describe('SkeletonLoader', () => {
  it('should render text variant by default', () => {
    const { container } = render(SkeletonLoader);

    expect(container.querySelector('.skeleton-loader--text')).toBeTruthy();
  });

  it('should render correct number of items for text variant', () => {
    const { container } = render(SkeletonLoader, {
      props: { variant: 'text', count: 5 },
    });

    const textItems = container.querySelectorAll('.skeleton-text');
    expect(textItems.length).toBe(5);
  });

  it('should render diagram variant', () => {
    const { container } = render(SkeletonLoader, {
      props: { variant: 'diagram' },
    });

    expect(container.querySelector('.skeleton-loader--diagram')).toBeTruthy();
    expect(container.querySelector('.skeleton-diagram')).toBeTruthy();
  });

  it('should render card variant with correct count', () => {
    const { container } = render(SkeletonLoader, {
      props: { variant: 'card', count: 2 },
    });

    expect(container.querySelector('.skeleton-loader--card')).toBeTruthy();
    const cards = container.querySelectorAll('.skeleton-card');
    expect(cards.length).toBe(2);
  });

  it('should render message variant', () => {
    const { container } = render(SkeletonLoader, {
      props: { variant: 'message', count: 3 },
    });

    expect(container.querySelector('.skeleton-loader--message')).toBeTruthy();
    const messages = container.querySelectorAll('.skeleton-message');
    expect(messages.length).toBe(3);
  });

  it('should render table variant', () => {
    const { container } = render(SkeletonLoader, {
      props: { variant: 'table' },
    });

    expect(container.querySelector('.skeleton-loader--table')).toBeTruthy();
    expect(container.querySelector('.skeleton-table')).toBeTruthy();
    expect(container.querySelector('.skeleton-table-header')).toBeTruthy();
  });

  it('should render code variant', () => {
    const { container } = render(SkeletonLoader, {
      props: { variant: 'code', count: 4 },
    });

    expect(container.querySelector('.skeleton-loader--code')).toBeTruthy();
    const codeLines = container.querySelectorAll('.skeleton-code-line');
    expect(codeLines.length).toBe(4);
  });

  it('should apply animated class by default', () => {
    const { container } = render(SkeletonLoader);

    expect(container.querySelector('.skeleton-loader.animated')).toBeTruthy();
  });

  it('should not apply animated class when animated is false', () => {
    const { container } = render(SkeletonLoader, {
      props: { animated: false },
    });

    expect(container.querySelector('.skeleton-loader.animated')).toBeFalsy();
    expect(container.querySelector('.skeleton-loader')).toBeTruthy();
  });

  it('should render default count of 3 items', () => {
    const { container } = render(SkeletonLoader, {
      props: { variant: 'text' },
    });

    const textItems = container.querySelectorAll('.skeleton-text');
    expect(textItems.length).toBe(3);
  });
});
