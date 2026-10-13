import React from 'react';

/** Mi Red Control's logo mark, as website/assets/logo-mark.svg draws it. */
export function BrandMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#0B1B33" />
      <path d="M20 31a13 13 0 0 1 13 13" fill="none" stroke="#2DD4BF" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M20 19a25 25 0 0 1 25 25" fill="none" stroke="#2DD4BF" strokeWidth="5.5" strokeLinecap="round" opacity=".55" />
      <circle cx="21" cy="43" r="5.5" fill="#FFFFFF" />
      <circle cx="45" cy="19" r="4" fill="#F5A524" />
    </svg>
  );
}
