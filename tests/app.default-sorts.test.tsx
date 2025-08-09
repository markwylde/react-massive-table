import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import * as React from 'react';
import App from '../src/App';

describe('App default sorts via hash routing', () => {
  it('applies Default Sorts when landing on #/sorting/1', async () => {
    // Navigate directly to the Sorting example, variant index 1 (Default Sorts)
    window.location.hash = '#/sorting/1';

    render(<App />);

    // Header for Last Name should exist
    const lastNameHeader = await screen.findByRole('button', { name: 'Last Name' });

    // Since the variant enables sorting with defaultSorts on lastName asc,
    // the header should display the ascending indicator (▲) without user interaction.
    // The indicator is rendered inside the header button.
    const indicator = await within(lastNameHeader).findByText('▲');
    expect(indicator).toBeInTheDocument();

    // The route is active already (sidebar highlights), but we only assert
    // the sort indicator to keep this test focused and stable.
  });
});
