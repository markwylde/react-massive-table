import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { act } from 'react';
import * as React from 'react';
import App from '../src/App';

describe('App Logs inline-group example', () => {
  it('collapses to first occurrence, expands to full trace block below anchor (desc)', async () => {
    // Go to Logs example
    window.location.hash = '#/logs/desc';

    render(<App />);

    // Ensure table loaded with Trace ID column
    await screen.findByRole('button', { name: 'Trace ID' });

    // Initially collapsed: only one row per trace visible
    const anchorSpan = await screen.findByText(/for trace 2222222/);
    expect(anchorSpan).toBeInTheDocument();
    expect(screen.getAllByText(/for trace 2222222/).length).toBe(1);

    // Expand the first anchor (should be 2222222 with newest first)
    const expandButtons = await screen.findAllByRole('button', { name: /Expand/ });
    expect(expandButtons.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(expandButtons[0]);
    });

    // Now all 5 spans for trace 2222222 should be visible and contiguous, ordered desc by index
    const spans = await screen.findAllByText(/for trace 2222222/);
    expect(spans.length).toBe(5);
    const texts = spans.map((n) => n.textContent || '');
    // Expect order: Span 5, 4, 3, 2, 1
    expect(texts[0]).toMatch(/Span\s+5\s+of\s+5/);
    expect(texts[1]).toMatch(/Span\s+4\s+of\s+5/);
    expect(texts[2]).toMatch(/Span\s+3\s+of\s+5/);
    expect(texts[3]).toMatch(/Span\s+2\s+of\s+5/);
    expect(texts[4]).toMatch(/Span\s+1\s+of\s+5/);

    // Collapse again
    const collapseBtn = await screen.findByRole('button', { name: 'Collapse trace' });
    await act(async () => {
      fireEvent.click(collapseBtn);
    });
    expect(screen.getAllByText(/for trace 2222222/).length).toBe(1);
  });

  it('respects sort order when expanded (asc yields rising spans beneath anchor)', async () => {
    // Navigate to the Index Asc variant
    window.location.hash = '#/logs/asc';
    render(<App />);
    await screen.findByRole('button', { name: 'Trace ID' });

    // Click expand on a specific trace anchor to avoid ambiguity.
    // Choose trace 1111111 and its anchor message (Span 1 of 5...) in asc variant.
    const anchorMsg = await screen.findByText('Span 1 of 5 for trace 1111111');
    const rowEl = anchorMsg.closest('[role="button"]') as HTMLElement;
    const expander = within(rowEl).getByRole('button', { name: /Expand/ });
    await act(async () => {
      fireEvent.click(expander);
    });

    // Now all 5 spans for this trace should be visible in ascending order
    const spans = await screen.findAllByText(/for trace 1111111/);
    expect(spans.length).toBe(5);
    const txt = spans.map((n) => n.textContent || '');
    // Expect Span 1,2,3,4,5 ascending beneath the anchor
    expect(txt[0]).toMatch(/Span\s+1\s+of\s+5/);
    expect(txt[1]).toMatch(/Span\s+2\s+of\s+5/);
    expect(txt[2]).toMatch(/Span\s+3\s+of\s+5/);
    expect(txt[3]).toMatch(/Span\s+4\s+of\s+5/);
    expect(txt[4]).toMatch(/Span\s+5\s+of\s+5/);
  });
});
