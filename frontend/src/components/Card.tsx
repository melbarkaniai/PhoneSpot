import { type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'dark'
}

export default function Card({ variant = 'default', className = '', children, ...props }: CardProps) {
  const variants = {
    default: 'bg-white border border-apple-border rounded-card p-6',
    dark: 'bg-[#1D1D1F] rounded-card p-6 text-white',
  }

  return (
    <div
      className={`${variants[variant]} shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
