import { type InputHTMLAttributes } from 'react'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  value: number
}

export default function Slider({ label, value, id, className = '', ...props }: SliderProps) {
  const min = Number(props.min ?? 0)
  const max = Number(props.max ?? 100)
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-3">
          <label htmlFor={id} className="font-medium text-[13px] text-[#6E6E73] uppercase tracking-[0.05em]">
            {label}
          </label>
          <span className="font-bold text-[16px] text-[#1D1D1F]">{value}%</span>
        </div>
      )}
      <input
        type="range"
        id={id}
        value={value}
        className={`slider-custom w-full ${className}`}
        style={{
          background: `linear-gradient(to right, #1D1D1F 0%, #1D1D1F ${pct}%, #D2D2D7 ${pct}%, #D2D2D7 100%)`,
        }}
        {...props}
      />
      <div className="flex justify-between mt-2">
        <span className="text-xs text-[#6E6E73]">{min}%</span>
        <span className="text-xs text-[#6E6E73]">{max}%</span>
      </div>
    </div>
  )
}
