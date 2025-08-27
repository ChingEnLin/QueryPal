import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QueryDisplay from '../../components/QueryDisplay'

describe('QueryDisplay', () => {
  const mockProps = {
    code: 'db.users.find({})',
    onCodeChange: vi.fn(),
    onRunQuery: vi.fn(),
    onSaveQuery: vi.fn(),
    isExecuting: false,
    historyCount: 3,
    historyIndex: 1,
    onNavigateHistory: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the query display component', () => {
    render(<QueryDisplay {...mockProps} />)
    
    // Check for the textarea with the code
    expect(screen.getByDisplayValue('db.users.find({})')).toBeInTheDocument()
  })

  it('should call onRunQuery when run button is clicked', () => {
    render(<QueryDisplay {...mockProps} />)
    
    const runButton = screen.getByRole('button', { name: /run query/i })
    fireEvent.click(runButton)
    
    expect(mockProps.onRunQuery).toHaveBeenCalledTimes(1)
  })

  it('should call onSaveQuery when save button is clicked', () => {
    render(<QueryDisplay {...mockProps} />)
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)
    
    expect(mockProps.onSaveQuery).toHaveBeenCalledTimes(1)
  })

  it('should disable run button when executing', () => {
    render(<QueryDisplay {...mockProps} isExecuting={true} />)
    
    const runButton = screen.getByRole('button', { name: /running/i })
    expect(runButton).toBeDisabled()
  })

  it('should show history navigation when historyCount > 1', () => {
    render(<QueryDisplay {...mockProps} />)
    
    // Should have navigation buttons when history exists
    expect(screen.getByRole('button', { name: /previous query version/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next query version/i })).toBeInTheDocument()
  })

  it('should call onNavigateHistory with correct direction', () => {
    render(<QueryDisplay {...mockProps} />)
    
    const prevButton = screen.getByRole('button', { name: /previous query version/i })
    const nextButton = screen.getByRole('button', { name: /next query version/i })
    
    fireEvent.click(prevButton)
    expect(mockProps.onNavigateHistory).toHaveBeenCalledWith('prev')
    
    fireEvent.click(nextButton)
    expect(mockProps.onNavigateHistory).toHaveBeenCalledWith('next')
  })

  it('should call onCodeChange when code is modified', () => {
    render(<QueryDisplay {...mockProps} />)
    
    const textarea = screen.getByDisplayValue('db.users.find({})')
    fireEvent.change(textarea, { target: { value: 'db.products.find({})' } })
    
    expect(mockProps.onCodeChange).toHaveBeenCalledWith('db.products.find({})')
  })
})