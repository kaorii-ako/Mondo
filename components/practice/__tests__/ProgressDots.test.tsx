import { render, screen } from '@testing-library/react'
import { ProgressDots } from '../ProgressDots'

it('renders correct number of dots', () => {
  render(<ProgressDots total={5} current={2} />)
  const dots = screen.getAllByTestId('progress-dot')
  expect(dots).toHaveLength(5)
})

it('marks dots before current as completed', () => {
  render(<ProgressDots total={5} current={2} />)
  const dots = screen.getAllByTestId('progress-dot')
  expect(dots[0]).toHaveAttribute('data-state', 'done')
  expect(dots[1]).toHaveAttribute('data-state', 'done')
  expect(dots[2]).toHaveAttribute('data-state', 'current')
  expect(dots[3]).toHaveAttribute('data-state', 'pending')
})
