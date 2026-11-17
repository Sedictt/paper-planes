import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { CountryCombobox } from '../src/components/CountryCombobox';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  vi.restoreAllMocks();
});

const SAMPLE_OPTIONS = [
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'PH', name: 'Philippines' },
];

describe('CountryCombobox', () => {
  it('opens the combobox popover, renders SVG flags, and selects an option', () => {
    const onChange = vi.fn();
    render(
      <CountryCombobox
        value=""
        onChange={onChange}
        options={SAMPLE_OPTIONS}
        detectedCountry="PH"
      />
    );

    const trigger = container.querySelector<HTMLButtonElement>('#region-filter-select');
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toContain('Global Sky');

    act(() => {
      trigger?.click();
    });

    const input = container.querySelector<HTMLInputElement>('[role="combobox"]');
    expect(input).not.toBeNull();
    expect(container.querySelectorAll('[role="option"]').length).toBe(4);
    expect(container.querySelectorAll('.country-flag-svg').length).toBe(3);

    const japanBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(
      (el) => el.textContent?.includes('Japan')
    );
    expect(japanBtn).not.toBeUndefined();

    act(() => {
      japanBtn?.click();
    });

    expect(onChange).toHaveBeenCalledWith('JP');
  });

  it('filters options by country name or code and shows empty state', () => {
    const onChange = vi.fn();
    render(<CountryCombobox value="" onChange={onChange} options={SAMPLE_OPTIONS} />);

    act(() => {
      container.querySelector<HTMLButtonElement>('#region-filter-select')?.click();
    });

    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'jp');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('Japan');

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'zzzz');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.querySelectorAll('[role="option"]').length).toBe(0);
    expect(container.textContent).toContain('No countries match');
  });

  it('supports keyboard navigation with ArrowDown and Enter', () => {
    const onChange = vi.fn();
    render(<CountryCombobox value="" onChange={onChange} options={SAMPLE_OPTIONS} />);

    act(() => {
      container.querySelector<HTMLButtonElement>('#region-filter-select')?.click();
    });

    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('AU');
  });
});
