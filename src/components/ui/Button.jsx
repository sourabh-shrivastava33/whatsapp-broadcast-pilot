import React from 'react'

export function Button({ children, variant = 'primary', size, icon: Icon, onClick, className = '', ...props }) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} onClick={onClick} {...props}>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, onClick, className = '', size = 18, ...props }) {
  return (
    <button className={`btn btn-icon btn-ghost ${className}`} onClick={onClick} {...props}>
      <Icon size={size} />
    </button>
  )
}
