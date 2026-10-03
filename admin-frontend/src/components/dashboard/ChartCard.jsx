import { useLanguage } from '../../i18n/useLanguage'

export function ChartCard({ title, description, data = [], emptyMessage, className = '' }) {
  const { lang, t } = useLanguage()
  const rows = data.filter((item) => Number.isFinite(Number(item.value)) && Number(item.value) >= 0)
  const max = Math.max(...rows.map((item) => Number(item.value)), 0)
  const number = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR')

  return (
    <section className={`vanguard-chart-card ${className}`} aria-label={title}>
      <header className="vanguard-chart-header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="vanguard-chart-empty">{emptyMessage || t('dashboard.chartEmpty')}</p>
      ) : (
        <div className="vanguard-chart-rows" role="list" aria-label={title}>
          {rows.map((item) => {
            const value = Number(item.value)
            const width = max === 0 ? 0 : Math.max((value / max) * 100, value > 0 ? 2 : 0)
            return (
              <div className="vanguard-chart-row" role="listitem" key={item.key || item.label} title={`${item.label}: ${number.format(value)}`}>
                <span className="vanguard-chart-label">{item.label}</span>
                <span className="vanguard-chart-track" aria-hidden="true">
                  <span className="vanguard-chart-bar" style={{ width: `${width}%` }} />
                </span>
                <strong className="vanguard-chart-value">{number.format(value)}</strong>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
