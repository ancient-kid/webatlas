// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { installApiStub } from './test/apiStub'

describe('component test harness', () => {
  it('renders the app into jsdom', async () => {
    installApiStub()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'WebAtlas' })).toBeInTheDocument()
    expect(screen.getByTestId('app-root')).toBeVisible()
  })
})
