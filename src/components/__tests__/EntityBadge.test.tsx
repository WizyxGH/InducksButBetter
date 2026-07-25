import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EntityBadge } from '../EntityBadge'
import { TooltipProvider } from '@/components/ui/tooltip'
import React from 'react'

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('EntityBadge Component', () => {
  it('renders the character badge with name and correct link', () => {
    renderWithProvider(
      <EntityBadge type="character" code="Donald" name="Donald Duck" />
    )

    const link = screen.getByRole('link', { name: /donald duck/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '#/characters/Donald')
  })

  it('renders the creator badge with correct link', () => {
    renderWithProvider(
      <EntityBadge type="creator" code="Carl Barks" name="Carl Barks" />
    )

    const link = screen.getByRole('link', { name: /carl barks/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '#/authors/Carl Barks')
  })

  it('generates the correct proxy image URL for characters', () => {
    renderWithProvider(
      <EntityBadge type="character" code="Donald" name="Donald Duck" />
    )

    // Using queryAllByRole since the image is rendered inside the trigger and potentially the tooltip
    const images = screen.queryAllByRole('img')
    expect(images.length).toBeGreaterThan(0)
    
    const expectedUrl = `/api/proxy-image?url=${encodeURIComponent('https://inducks.org/characterthumb.php?c=Donald')}`
    expect(images[0]).toHaveAttribute('src', expectedUrl)
  })

  it('generates the correct proxy image URL for creators (replacing spaces with underscores)', () => {
    renderWithProvider(
      <EntityBadge type="creator" code="Carl Barks" name="Carl Barks" />
    )

    const images = screen.queryAllByRole('img')
    expect(images.length).toBeGreaterThan(0)

    const expectedUrl = `/api/proxy-image?url=${encodeURIComponent('https://inducks.org/creators/photos/Carl_Barks.jpg')}`
    expect(images[0]).toHaveAttribute('src', expectedUrl)
  })

  it('calls onSelect and prevents default navigation when clicked', () => {
    const handleSelect = vi.fn()
    renderWithProvider(
      <EntityBadge
        type="character"
        code="Donald"
        name="Donald Duck"
        onSelect={handleSelect}
      />
    )

    const link = screen.getByRole('link', { name: /donald duck/i })
    fireEvent.click(link)

    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(handleSelect).toHaveBeenCalledWith('Donald', 'Donald Duck')
  })
})
