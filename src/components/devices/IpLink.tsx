import React from 'react';

/** An IP that opens the device's own web UI in a new tab. */
export function IpLink({ ip, className = 'text-xs' }: { ip: string; className?: string }) {
  return (
    <a
      href={`http://${ip}`}
      target="_blank"
      rel="noopener noreferrer"
      // Rows that are clickable themselves (tables, expandable rows) shouldn't also react.
      onClick={(e) => e.stopPropagation()}
      className={`font-mono text-blue-600 dark:text-blue-400 hover:underline ${className}`}
    >
      {ip}
    </a>
  );
}
