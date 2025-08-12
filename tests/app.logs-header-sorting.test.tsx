import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { act } from 'react';
import * as React from 'react';
import App from '../src/App';

describe('Logs demo header sort indicators and interactions', () => {
  it('shows default sort on # header (desc by index)', async () => {
    window.location.hash = '#/logs/desc';
    render(<App />);

    const hashHeader = await screen.findByRole('button', { name: '#' });
    // Arrow should be descending by default (▼)
    expect(within(hashHeader).getByText('▼')).toBeInTheDocument();

    // Sanity check first row content matches descending by index
    // The top-most non-trace row should be the last log message (index 30)
    expect(await screen.findByText('Log message 30')).toBeInTheDocument();
  });

  it('clicking another header replaces sort and updates indicators', async () => {
    window.location.hash = '#/logs/desc';
    render(<App />);

    const hashHeader = await screen.findByRole('button', { name: '#' });
    const levelHeader = await screen.findByRole('button', { name: 'Level' });

    // Initially, # is sorted desc
    expect(within(hashHeader).getByText('▼')).toBeInTheDocument();

    // Click Level to replace sorts with Level asc
    await act(async () => {
      fireEvent.click(levelHeader);
    });
    expect(within(levelHeader).getByText('▲')).toBeInTheDocument();
    expect(within(hashHeader).queryByText('▲')).toBeNull();
    expect(within(hashHeader).queryByText('▼')).toBeNull();

    // Click Level again to toggle to desc
    await act(async () => {
      fireEvent.click(levelHeader);
    });
    expect(within(levelHeader).getByText('▼')).toBeInTheDocument();
  });
});
