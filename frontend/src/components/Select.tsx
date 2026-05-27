import { type SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  placeholder?: string
  options: { value: string; label: string }[]
}

export default function Select({ label, placeholder, options, id, className = '', ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-[14px] text-apple-muted mb-1.5">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`border border-apple-border rounded-input px-4 py-3 text-[17px] w-full focus:border-[#0071E3] focus:outline-none transition-colors duration-200 bg-white appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
