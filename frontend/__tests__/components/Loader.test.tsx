import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Loader from '../../components/Loader'

describe('Loader', () => {
  it('should render the loader component', () => {
    render(<Loader />)
    
    const loadingText = screen.getByText('Generating query...')
    expect(loadingText).toBeInTheDocument()
  })

  it('should display the spinning SVG', () => {
    const { container } = render(<Loader />)
    
    const spinner = container.querySelector('svg')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('animate-spin')
  })

  it('should have proper styling classes', () => {
    const { container } = render(<Loader />)
    
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv).toHaveClass('flex', 'justify-center', 'items-center', 'p-8')
  })
})