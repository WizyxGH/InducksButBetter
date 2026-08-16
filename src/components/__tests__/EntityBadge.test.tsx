import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EntityBadge } from '../EntityBadge'
import { TooltipProvider } from '@/components/ui/tooltip'
import React from 'react'

/**
 * In the Vitest/jsdom environment:
 *   import.meta.env.BASE_URL = "/"
 *   → getBasePath() returns "" (trailing slash stripped)
 *   → Link href = "" + "/path" = "/path"
 *
 * routes.character('Donald')    = '/characters/Donald'
 * routes.author('Carl Barks')  = '/authors/Carl+Barks'  (spaces → +)
 */

const wrap = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>)

// The avatar is decorative (aria-hidden) so it stays out of the link's
// accessible name, which means it has no "img" role — query the DOM element.
const avatarImgs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('img'))

describe('EntityBadge', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  // ── Routing / href contract ──────────────────────────────────────────────

  it('character badge links to /characters/{code}', () => {
    wrap(<EntityBadge type="character" code="Donald" name="Donald Duck" />)
    const link = screen.getByRole('link', { name: /donald duck/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/characters/Donald')
  })

  it('creator badge links to /authors/{code} with spaces encoded as +', () => {
    wrap(<EntityBadge type="creator" code="Carl Barks" name="Carl Barks" />)
    const link = screen.getByRole('link', { name: /carl barks/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/authors/Carl+Barks')
  })

  it('character code with spaces encodes them as + in the href', () => {
    wrap(<EntityBadge type="character" code="Uncle Scrooge" name="Uncle Scrooge" />)
    const link = screen.getByRole('link', { name: /uncle scrooge/i })
    expect(link).toHaveAttribute('href', '/characters/Uncle+Scrooge')
  })

  // ── Avatar images ────────────────────────────────────────────────────────
  // Images are gated on proxy availability (imagesAvailable(), true under the
  // test env's DEV flag), no longer on a cookie string in localStorage — that
  // value was never sent anywhere.

  it('shows character proxy-image URL via characterthumb when no url prop', () => {
    const { container } = wrap(<EntityBadge type="character" code="Donald" name="Donald Duck" />)
    const imgs = avatarImgs(container)
    expect(imgs.length).toBeGreaterThan(0)
    expect(imgs[0]).toHaveAttribute(
      'src',
      `/api/proxy-image?url=${encodeURIComponent('https://inducks.org/characterthumb.php?c=Donald')}`,
    )
  })

  it('shows creator proxy-image URL with underscores replacing spaces', () => {
    const { container } = wrap(<EntityBadge type="creator" code="Carl Barks" name="Carl Barks" />)
    const imgs = avatarImgs(container)
    expect(imgs.length).toBeGreaterThan(0)
    expect(imgs[0]).toHaveAttribute(
      'src',
      `/api/proxy-image?url=${encodeURIComponent('https://inducks.org/creators/photos/Carl_Barks.jpg')}`,
    )
  })

  it('renders images regardless of any stored cookie value', () => {
    // The old gate suppressed images without a cookie; the proxy gate ignores it.
    const { container } = wrap(<EntityBadge type="character" code="Donald" name="Donald Duck" />)
    expect(avatarImgs(container).length).toBeGreaterThan(0)
  })

  // ── onSelect callback ────────────────────────────────────────────────────

  it('calls onSelect(code, name) when clicked', () => {
    const onSelect = vi.fn()
    wrap(
      <EntityBadge type="character" code="Donald" name="Donald Duck" onSelect={onSelect} />,
    )
    fireEvent.click(screen.getByRole('link', { name: /donald duck/i }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('Donald', 'Donald Duck')
  })

  it('does not throw when clicked without onSelect', () => {
    wrap(<EntityBadge type="character" code="Donald" name="Donald Duck" />)
    expect(() =>
      fireEvent.click(screen.getByRole('link', { name: /donald duck/i })),
    ).not.toThrow()
  })

  // ── appComment ───────────────────────────────────────────────────────────

  it('renders appComment text when provided', () => {
    wrap(
      <EntityBadge type="character" code="Donald" name="Donald Duck" appComment="as hero" />,
    )
    expect(screen.getByText(/as hero/i)).toBeInTheDocument()
  })

  it('does not render appComment section when omitted', () => {
    wrap(<EntityBadge type="character" code="Donald" name="Donald Duck" />)
    expect(screen.queryByText(/as hero/i)).not.toBeInTheDocument()
  })
})
