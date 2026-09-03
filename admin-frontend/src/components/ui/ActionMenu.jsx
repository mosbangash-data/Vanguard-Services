import React, { useState, useRef, useEffect } from 'react'
import { MoreVertical, MoreHorizontal } from 'lucide-react'

export function ActionMenu({
  items = [],
  horizontal = false,
  align = 'right',
  ariaLabel = 'Menu d’actions',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const toggle = (e) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const handleItemClick = (e, item) => {
    e.stopPropagation()
    setIsOpen(false)
    if (item.onClick && !item.disabled) {
      item.onClick()
    }
  }

  return (
    <div className={`vanguard-action-menu ${className}`} ref={menuRef}>
      <button
        type="button"
        className="vanguard-action-menu-trigger"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {horizontal ? <MoreHorizontal size={16} /> : <MoreVertical size={16} />}
      </button>

      {isOpen && (
        <div className={`vanguard-action-menu-dropdown vanguard-action-menu-dropdown--${align}`}>
          <div className="vanguard-action-menu-list" role="menu">
            {items.map((item, index) => {
              if (item.divider) {
                return <div key={`divider-${index}`} className="vanguard-action-menu-divider" />
              }

              const Icon = item.icon
              const itemVariant = item.variant || 'default'

              return (
                <button
                  key={item.label || index}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={`vanguard-action-menu-item vanguard-action-menu-item--${itemVariant} ${
                    item.disabled ? 'is-disabled' : ''
                  }`}
                  onClick={(e) => handleItemClick(e, item)}
                >
                  {Icon && <Icon size={14} className="menu-item-icon" />}
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
