import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedSort, PUBLICATION_SORT_STORAGE_KEY } from '../useSharedSort';

describe('useSharedSort', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on the fallback when nothing is stored', () => {
    const { result } = renderHook(() => useSharedSort('title_asc'));
    expect(result.current[0]).toBe('title_asc');
  });

  it('starts on the stored value when one exists', () => {
    localStorage.setItem(PUBLICATION_SORT_STORAGE_KEY, 'issues_desc');
    const { result } = renderHook(() => useSharedSort('title_asc'));
    expect(result.current[0]).toBe('issues_desc');
  });

  it('persists changes under the historical key', () => {
    const { result } = renderHook(() => useSharedSort('title_asc'));
    act(() => result.current[1]('issues_desc'));
    expect(result.current[0]).toBe('issues_desc');
    expect(localStorage.getItem(PUBLICATION_SORT_STORAGE_KEY)).toBe('issues_desc');
  });

  it('keeps two mounted components in sync', () => {
    const a = renderHook(() => useSharedSort('title_asc'));
    const b = renderHook(() => useSharedSort('title_asc'));

    act(() => a.result.current[1]('issues_desc'));

    expect(a.result.current[0]).toBe('issues_desc');
    expect(b.result.current[0]).toBe('issues_desc');
  });

  it('stops listening after unmount', () => {
    const a = renderHook(() => useSharedSort('title_asc'));
    const b = renderHook(() => useSharedSort('title_asc'));
    b.unmount();

    // Must not throw or update the unmounted hook.
    act(() => a.result.current[1]('issues_asc'));
    expect(a.result.current[0]).toBe('issues_asc');
  });
});
