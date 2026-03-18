
interface BackToContentButtonProps {
  onClick: () => void
  visible: boolean
}

/**
 * A floating "Back to Content" button shown in the bottom-right corner
 * when all canvas content has scrolled offscreen — just like Excalidraw.
 */
export default function BackToContentButton({ onClick, visible }: BackToContentButtonProps) {
  return (
    <button
      id="back-to-content-btn"
      type="button"
      onClick={onClick}
      title="Back to content"
      aria-label="Back to content"
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: 'rgba(255, 255, 255, 0.92)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        borderRadius: '24px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 600,
        color: '#1e293b',
        letterSpacing: '0.01em',
        // Visibility animation
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)'
        e.currentTarget.style.transform = visible ? 'translateY(-1px) scale(1)' : 'translateY(8px) scale(0.96)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)'
        e.currentTarget.style.transform = visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)'
      }}
    >
      {/* Crosshair / target icon (plain SVG, no deps) */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
      Back to content
    </button>
  )
}
