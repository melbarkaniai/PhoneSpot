import { type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export default function Input({ label, className = '', id, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-[14px] text-apple-muted mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`border border-apple-border rounded-input px-4 py-3 text-[17px] w-full focus:border-[#0071E3] focus:outline-none transition-colors duration-200 ${className}`}
        {...props}
      />
    </div>
  )
}
