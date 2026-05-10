import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const base = 'rounded transition-colors disabled:opacity-60 font-sans'
  const variants = {
    primary: 'bg-wabi-primary text-wabi-bg hover:bg-wabi-dark',
    ghost:   'bg-wabi-surface text-wabi-primary border border-wabi-border hover:bg-wabi-light',
  }
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
}
