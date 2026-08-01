import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KindBadge } from '../KindBadge'
import React from 'react'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: any) => options?.defaultValue || key,
    }),
  }
})

describe('KindBadge', () => {
  it('renders badge for kind "s"', () => {
    render(<KindBadge kind="s" />)
    expect(screen.getByText('S')).toBeInTheDocument()
  })

  it('renders badge for kind "c"', () => {
    render(<KindBadge kind="c" />)
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('renders badge for kind "g"', () => {
    render(<KindBadge kind="g" />)
    expect(screen.getByText('G')).toBeInTheDocument()
  })

  it('renders badge for kind "i"', () => {
    render(<KindBadge kind="i" />)
    expect(screen.getByText('I')).toBeInTheDocument()
  })

  it('renders badge for kind "a"', () => {
    render(<KindBadge kind="a" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('defaults to capitalized kind string for unknown kind', () => {
    render(<KindBadge kind="xyz" />)
    expect(screen.getByText('Xyz')).toBeInTheDocument()
  })
})
