import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteExclusionManager } from '../../src/lib/siteExclusions';

describe('SiteExclusionManager', () => {
  beforeEach(() => {
    SiteExclusionManager.resetInstance();
    vi.clearAllMocks();
  });

  it('adds a pattern to exclusions', async () => {
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({ siteExclusions: [] });
    vi.mocked(chrome.storage.sync.set).mockResolvedValue();

    const manager = SiteExclusionManager.getInstance();
    await manager.add('example.com');

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      siteExclusions: [
        expect.objectContaining({
          pattern: 'example.com',
        }),
      ],
    });
  });

  it('removes a pattern from exclusions', async () => {
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({
      siteExclusions: [{ pattern: 'example.com', addedAt: 1 }],
    });
    vi.mocked(chrome.storage.sync.set).mockResolvedValue();

    const manager = SiteExclusionManager.getInstance();
    await manager.remove('example.com');

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ siteExclusions: [] });
  });

  it('returns all exclusions', async () => {
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({
      siteExclusions: [
        { pattern: 'example.com', addedAt: 1 },
        { pattern: '*.example.org', addedAt: 2 },
      ],
    });

    const manager = SiteExclusionManager.getInstance();
    const exclusions = await manager.getAll();

    expect(exclusions).toHaveLength(2);
    expect(exclusions[0].pattern).toBe('example.com');
    expect(exclusions[1].pattern).toBe('*.example.org');
  });

  it('matches exact domains, wildcard subdomains, and URL patterns', async () => {
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({
      siteExclusions: [
        { pattern: 'example.com', addedAt: 1 },
        { pattern: '*.wild.com', addedAt: 2 },
        { pattern: 'https://docs.site.com/specific-page', addedAt: 3 },
      ],
    });

    const manager = SiteExclusionManager.getInstance();
    await manager.initialize();

    expect(manager.isExcluded('https://example.com')).toBe(true);
    expect(manager.isExcluded('https://sub.example.com')).toBe(true);
    expect(manager.isExcluded('https://a.wild.com/path')).toBe(true);
    expect(manager.isExcluded('https://docs.site.com/specific-page?id=1')).toBe(true);
    expect(manager.isExcluded('https://different-domain.com')).toBe(false);
  });

  it('throws when adding a duplicate pattern', async () => {
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({
      siteExclusions: [{ pattern: 'example.com', addedAt: 1 }],
    });

    const manager = SiteExclusionManager.getInstance();

    await expect(manager.add('example.com')).rejects.toThrow(
      'Pattern already exists in exclusions',
    );
  });

  it('throws when removing a missing pattern', async () => {
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({ siteExclusions: [] });

    const manager = SiteExclusionManager.getInstance();

    await expect(manager.remove('example.com')).rejects.toThrow(
      'Pattern not found in exclusions',
    );
  });

  it('persists exclusions to chrome.storage.sync', async () => {
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({ siteExclusions: [] });
    vi.mocked(chrome.storage.sync.set).mockResolvedValue();

    const manager = SiteExclusionManager.getInstance();
    await manager.add('example.com');

    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      siteExclusions: expect.arrayContaining([
        expect.objectContaining({ pattern: 'example.com' }),
      ]),
    });
  });

  it('returns singleton instance', () => {
    const first = SiteExclusionManager.getInstance();
    const second = SiteExclusionManager.getInstance();

    expect(first).toBe(second);
  });
});
