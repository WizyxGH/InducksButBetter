import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AvatarWithFallback } from '../AvatarWithFallback'

describe('AvatarWithFallback', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('renders initials alone when there is no source', () => {
    render(<AvatarWithFallback src="" name="Donald Duck" />)
    expect(screen.getByText('DD')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the image when a source and a reachable proxy exist', () => {
    // Images are gated on proxy availability (true under DEV), no longer on a
    // string in localStorage — that value was never sent anywhere.
    render(<AvatarWithFallback src="/api/proxy-image?url=foo" name="Mickey Mouse" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/api/proxy-image?url=foo')
    expect(screen.getByText('MM')).toBeInTheDocument()
  })

  it('ignores a stored cookie value entirely', () => {
    localStorage.setItem('inducks_cookie', 'token')
    render(<AvatarWithFallback src="" name="Donald Duck" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('uses the provided custom class names', () => {
    render(<AvatarWithFallback src="" name="A" className="custom-class" sizeClasses="w-10 h-10" />)
    const container = screen.getByText('A').parentElement
    expect(container).toHaveClass('custom-class')
    expect(container).toHaveClass('w-10')
    expect(container).toHaveClass('h-10')
  })
})
