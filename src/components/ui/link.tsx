import React from 'react';
import { navigate, getBasePath } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace, className, children, onClick, ...props }, ref) => {
    
    // Resolve full path for the href attribute so native browser features (right click -> open in new tab) work correctly
    const normalizedTo = to.startsWith('/') ? to : `/${to}`;
    const href = `${getBasePath()}${normalizedTo}`;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (onClick) {
        onClick(e);
      }

      // Let browser handle native behavior if command/ctrl/shift click, or middle click, or if default was prevented
      if (
        e.defaultPrevented ||
        e.button !== 0 || // Not left click
        e.metaKey ||
        e.altKey ||
        e.ctrlKey ||
        e.shiftKey ||
        props.target === '_blank'
      ) {
        return;
      }

      e.preventDefault();
      navigate(normalizedTo, replace);
    };

    return (
      <a
        ref={ref}
        href={href}
        onClick={handleClick}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </a>
    );
  }
);
Link.displayName = 'Link';
