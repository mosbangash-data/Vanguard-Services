import React from 'react'
import { Search, X, RefreshCw } from 'lucide-react'
import { IconButton } from './IconButton'
import { useLanguage } from '../../i18n/useLanguage'

export function SearchBar({
  value,
  onChange,
  placeholder,
  onClear,
  className = '',
}) {
  const { t } = useLanguage()
  return (
    <div className={`vanguard-search-bar ${className}`}>
      <Search size={15} className="vanguard-search-icon" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t('commonUi.search')}
        className="vanguard-search-input"
      />
      {value && (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onChange(''))}
          className="vanguard-search-clear"
          aria-label={t('commonUi.clearSearch')}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function FilterBar({
  children,
  onRefresh,
  isRefreshing = false,
  className = '',
}) {
  const { t } = useLanguage()
  return (
    <div className={`vanguard-filter-bar ${className}`}>
      <div className="vanguard-filter-bar-controls">{children}</div>
      {onRefresh && (
        <div className="vanguard-filter-bar-actions">
          <IconButton
            icon={RefreshCw}
            variant="outline"
            title={t('commonUi.refresh')}
            onClick={onRefresh}
            className={isRefreshing ? 'animate-spin' : ''}
            disabled={isRefreshing}
          />
        </div>
      )}
    </div>
  )
}
