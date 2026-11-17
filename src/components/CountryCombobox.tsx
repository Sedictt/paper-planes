import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as Flags from 'country-flag-icons/react/3x2';
import { ChevronDown, Globe, Search, X } from 'lucide-react';
import { CountryOption, getCountryName } from '../lib/countries';
import { soundscape } from '../lib/soundscape';

interface ComboboxItem {
  code: string;
  label: string;
  searchText: string;
}

export interface CountryComboboxProps {
  value: string;
  onChange: (code: string) => void;
  options: CountryOption[];
  detectedCountry?: string | null;
}

type FlagMap = Record<string, React.ComponentType<React.SVGAttributes<SVGSVGElement>> | undefined>;

export function CountryFlag({ code, size = 14 }: { code: string; size?: number }) {
  if (!code) {
    return <Globe size={size} className="country-flag-globe" aria-hidden="true" />;
  }
  const FlagComponent = (Flags as unknown as FlagMap)[code.trim().toUpperCase()];
  if (!FlagComponent) {
    return <Globe size={size} className="country-flag-globe" aria-hidden="true" />;
  }
  return <FlagComponent className="country-flag-svg" aria-hidden="true" />;
}

export function CountryCombobox({
  value,
  onChange,
  options,
  detectedCountry,
}: CountryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);

  const listboxId = useId();

  const items = useMemo<ComboboxItem[]>(() => {
    const list: ComboboxItem[] = [
      {
        code: '',
        label: 'Global Sky',
        searchText: 'global sky all world',
      },
    ];

    if (detectedCountry) {
      const name = getCountryName(detectedCountry);
      list.push({
        code: detectedCountry,
        label: `Near me (${name})`,
        searchText: `near me ${name} ${detectedCountry}`,
      });
    }

    for (const opt of options) {
      if (opt.code === detectedCountry) continue;
      list.push({
        code: opt.code,
        label: opt.name,
        searchText: `${opt.name} ${opt.code}`,
      });
    }

    return list;
  }, [options, detectedCountry]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.searchText.toLowerCase().includes(q));
  }, [items, query]);

  // Reset highlighted index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Focus search input and highlight selected option when opening
  useEffect(() => {
    if (!isOpen) return;
    const selectedIdx = filteredItems.findIndex((item) => item.code === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  // Keep keyboard-highlighted option scrolled into view
  useEffect(() => {
    if (!isOpen || !listboxRef.current) return;
    const activeEl = listboxRef.current.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  // Close on outside pointer down
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const closeAndReturnFocus = () => {
    setIsOpen(false);
    setQuery('');
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

  const selectItem = (code: string) => {
    soundscape.playUiSfx('select');
    onChange(code);
    closeAndReturnFocus();
  };

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      soundscape.playUiSfx(next ? 'open' : 'close');
      if (!next) setQuery('');
      return next;
    });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length === 0) return;
      setActiveIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredItems.length === 0) return;
      setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (filteredItems.length > 0) setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (filteredItems.length > 0) setActiveIndex(filteredItems.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = filteredItems[activeIndex];
      if (chosen) {
        selectItem(chosen.code);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      soundscape.playUiSfx('close');
      closeAndReturnFocus();
    }
  };

  const selectedLabel = value ? getCountryName(value) : 'Global Sky';
  const activeOptionId =
    isOpen && filteredItems[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div className="popover-anchor" ref={containerRef}>
      <div className="control-strip">
        <button
          ref={triggerRef}
          id="region-filter-select"
          type="button"
          onClick={handleToggle}
          className={`hud-btn country-trigger-btn ${isOpen ? 'active' : ''}`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? listboxId : undefined}
          aria-label={`Filter letters by country: ${selectedLabel}`}
          title="Filter sky by country"
        >
          <CountryFlag code={value} size={14} />
          <span className="country-trigger-label">{selectedLabel}</span>
          <ChevronDown
            size={13}
            className={`country-trigger-chevron ${isOpen ? 'open' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="popover-menu country-combobox-popover"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="combobox-search-wrap">
              <Search size={13} className="combobox-search-icon" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                aria-autocomplete="list"
                aria-label="Search countries"
                placeholder="Search country..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="combobox-search-input"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="combobox-clear-btn"
                  aria-label="Clear search"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="popover-divider" />

            <div
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              aria-label="Countries"
              className="combobox-listbox"
            >
              {filteredItems.length === 0 ? (
                <div className="combobox-empty">No countries match &ldquo;{query.trim()}&rdquo;</div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = item.code === value;
                  const isHighlighted = idx === activeIndex;
                  return (
                    <button
                      key={item.code || 'global'}
                      id={`${listboxId}-opt-${idx}`}
                      data-index={idx}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectItem(item.code)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`popover-item combobox-option ${isSelected ? 'active' : ''} ${
                        isHighlighted ? 'highlighted' : ''
                      }`}
                    >
                      <span className="combobox-option-main">
                        <CountryFlag code={item.code} size={13} />
                        <span className="combobox-option-label">{item.label}</span>
                      </span>
                      {isSelected && <span className="popover-dot" aria-hidden="true" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
