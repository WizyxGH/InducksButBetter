import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AvatarWithFallback } from '../AvatarWithFallback'

describe('AvatarWithFallback', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('renders initials when no cookie is present', () => {
    render(<AvatarWithFallback src="/api/proxy-image?url=foo" name="Donald Duck" />)
    expect(screen.getByText('DD')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the image when the cookie is present', () => {
    localStorage.setItem('inducks_cookie', 'token')
    render(<AvatarWithFallback src="/api/proxy-image?url=foo" name="Mickey Mouse" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/api/proxy-image?url=foo')
    expect(screen.getByText('MM')).toBeInTheDocument()
  })

  it('uses the provided custom class names', () => {
    render(<AvatarWithFallback src="" name="A" className="custom-class" sizeClasses="w-10 h-10" />)
    const container = screen.getByText('A').parentElement
    expect(container).toHaveClass('custom-class')
    expect(container).toHaveClass('w-10')
    expect(container).toHaveClass('h-10')
  })
})
