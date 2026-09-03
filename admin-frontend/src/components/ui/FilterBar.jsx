import React from 'react'
import { Search, X, RefreshCw } from 'lucide-react'
import { IconButton } from './IconButton'

export function SearchBar({
  value,
  onChange,
  placeholder = 'Rechercher…',
  onClear,
  className = '',
}) {
  return (
    <div className={`vanguard-search-bar ${className}`}>
      <Search size={15} className="vanguard-search-icon" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="vanguard-search-input"
      />
      {value && (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onChange(''))}
          className="vanguard-search-clear"
          aria-label="Effacer la recherche"
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
  return (
    <div className={`vanguard-filter-bar ${className}`}>
      <div className="vanguard-filter-bar-controls">{children}</div>
      {onRefresh && (
        <div className="vanguard-filter-bar-actions">
          <IconButton
            icon={RefreshCw}
            variant="outline"
            title="Actualiser les données"
            onClick={onRefresh}
            className={isRefreshing ? 'animate-spin' : ''}
            disabled={isRefreshing}
          />
        </div>
      )}
    </div>
  )
}
