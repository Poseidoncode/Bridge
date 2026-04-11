// @vitest-environment jsdom
import { render, fireEvent, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import LanguageSelector from '../../src/lib/LanguageSelector.svelte';
import { SUPPORTED_LANGUAGES } from '../../src/lib/languages';

describe('LanguageSelector', () => {
  it('renders with correct initial label and language', () => {
    render(LanguageSelector, {
      value: 'zh-Hant',
      label: 'Reading Language',
      labelIcon: '📖'
    });

    // Label should be present
    expect(screen.getByText('Reading Language')).toBeInTheDocument();
    expect(screen.getByText('📖')).toBeInTheDocument();

    // Initial selected language should be displayed
    expect(screen.getByText('🇹🇼 繁體中文')).toBeInTheDocument();
  });

  it('filters languages when searching', async () => {
    render(LanguageSelector, {
      value: 'en',
      label: 'Reading Language',
      labelIcon: '📖'
    });

    // Open dropdown
    await fireEvent.click(screen.getByRole('combobox'));

    const searchInput = screen.getByPlaceholderText('Search languages...');
    await fireEvent.input(searchInput, { target: { value: 'zh' } });

    // Should show matching languages
    expect(screen.getByText('🇹🇼 繁體中文')).toBeInTheDocument();
    expect(screen.getByText('🇨🇳 简体中文')).toBeInTheDocument();
    
    // Should hide non-matching languages
    expect(screen.queryByText('🇯🇵 日本語')).not.toBeInTheDocument();
  });

  it('updates selection and fires onchange when an option is clicked', async () => {
    const handleChange = vi.fn();
    
    render(LanguageSelector, {
      value: 'en',
      label: 'Reading Language',
      labelIcon: '📖',
      onchange: handleChange
    });

    // Open dropdown
    await fireEvent.click(screen.getByRole('combobox'));

    // Click an option
    const option = screen.getByText('🇯🇵 日本語');
    await fireEvent.click(option);

    // Verify onchange was called with the new value (or event)
    expect(handleChange).toHaveBeenCalled();
  });

  it('supports keyboard navigation', async () => {
    render(LanguageSelector, {
      value: 'en',
      label: 'Reading Language',
      labelIcon: '📖'
    });

    const trigger = screen.getByRole('combobox');
    
    // Open with Enter
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    
    // Input should be focused
    const searchInput = screen.getByPlaceholderText('Search languages...');
    expect(searchInput).toHaveFocus();

    // Press down arrow to move to first option
    await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    
    // Press enter to select it (en is first, zh-Hant is second)
    const firstOption = screen.getAllByText('🇬🇧 English')[1];
    await fireEvent.keyDown(firstOption, { key: 'Enter' });
    
    // Dropdown should close
    expect(screen.queryByPlaceholderText('Search languages...')).not.toBeInTheDocument();
  });
});
