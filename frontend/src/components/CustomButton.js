import React from 'react';

const CustomButton = ({ children, onClick, color = '#0d6efd', style = {}, ...props }) => {
  return (
    <button
      onClick={onClick}
      {...props}
      style={{
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${color}`,
        backgroundColor: 'transparent',
        color: color,
        padding: '0.375rem 0.75rem',
        fontSize: '1rem',
        borderRadius: '0.375rem',
        transition: 'color 0.4s ease',
        zIndex: 0,
        ...style,
      }}
      onMouseEnter={(e) => {
        const fill = document.createElement('span');
        fill.style.position = 'absolute';
        fill.style.top = 0;
        fill.style.left = 0;
        fill.style.height = '100%';
        fill.style.width = '0%';
        fill.style.backgroundColor = color;
        fill.style.zIndex = -1;
        fill.style.transition = 'width 0.4s ease';
        fill.className = 'fill-span';
        e.currentTarget.appendChild(fill);
        requestAnimationFrame(() => {
          fill.style.width = '100%';
        });
        e.currentTarget._fill = fill;
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        const fill = e.currentTarget._fill;
        if (fill) {
          fill.style.width = '0%';
          setTimeout(() => {
            if (fill && fill.remove) fill.remove();
          }, 400);
        }
        e.currentTarget.style.color = color;
      }}
    >
      {children}
    </button>
  );
};

export default CustomButton;
