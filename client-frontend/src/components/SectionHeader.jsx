export default function SectionHeader({ eyebrow, title, subtitle, center = false }) {
  return (
    <div className={`section-header${center ? ' section-header-center' : ''}`}>
      {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
      <h2 className="section-title">{title}</h2>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </div>
  )
}