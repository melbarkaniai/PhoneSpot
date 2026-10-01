import { Link } from 'react-router-dom'
import { GENERATIONS } from '../lib/models'

// Every /estimer/<slug> page, grouped by generation (newest first). Plain
// <Link>s so the full list is crawlable in the prerendered HTML.
export default function ModelDirectory() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {GENERATIONS.map((gen) => (
        <div key={gen.number} className="bg-white border border-[#D2D2D7] rounded-card p-6">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-semibold text-[17px] text-[#1D1D1F]">{gen.label}</h3>
            <span className="text-[13px] text-[#6E6E73]">{gen.year}</span>
          </div>
          <ul>
            {gen.models.map(({ slug, model }) => (
              <li key={slug}>
                <Link
                  to={`/estimer/${slug}`}
                  className="flex items-center justify-between py-2 text-[15px] text-[#1D1D1F] hover:text-[#0071E3] transition-colors duration-200"
                >
                  <span>Prix de reprise {model}</span>
                  <span aria-hidden="true" className="text-[#6E6E73]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
