// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('component test harness', () => {
  it('renders a React component into jsdom', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'WebAtlas' })).toBeInTheDocument()
    expect(screen.getByTestId('app-root')).toBeVisible()
  })
})
