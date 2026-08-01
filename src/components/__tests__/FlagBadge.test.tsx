import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FlagBadge } from '../FlagBadge'
import React from 'react'

describe('FlagBadge', () => {
  it('renders flag image and country name', () => {
    render(<FlagBadge country="fr" name="France" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', 'fr')
    expect(img).toHaveAttribute('src', 'https://flagcdn.com/w80/fr.png')
    expect(screen.getByText('France')).toBeInTheDocument()
  })

  it('handles uppercase country codes gracefully', () => {
    render(<FlagBadge country="FR" name="France" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://flagcdn.com/w80/fr.png')
  })
})
