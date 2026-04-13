// components/ui/ReloadButton.jsx
'use client';

export default function ReloadButton({
  label = '🔄 Réessayer',
  className = '',
}) {
  return (
    <button onClick={() => window.location.reload()} className={className}>
      {label}
    </button>
  );
}
