import type { PageTemplate } from '../types'

interface AddPageModalProps {
  onClose: () => void
  onSelect: (template: PageTemplate) => void
  onImportPDF?: (file: File) => void
}

const TEMPLATES: { value: PageTemplate; label: string }[] = [
  { value: 'blank', label: 'Blank' },
  { value: 'squared', label: 'Squared' },
  { value: 'lined', label: 'Lined' },
]

export default function AddPageModal({ onClose, onSelect, onImportPDF }: AddPageModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        transition: 'all 0.05s linear',
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="button"
      tabIndex={0}
    >
      <div
        style={{
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          minWidth: 280,
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add page"
      >
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Choose template</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TEMPLATES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              style={{
                padding: '12px',
                cursor: 'pointer',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1e293b'
              }}
            >
              {label}
            </button>
          ))}
          <div style={{ height: '8px' }} />
          <label
            style={{
              padding: '12px',
              cursor: 'pointer',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '14px',
              fontWeight: 600,
              color: '#475569',
              textAlign: 'center',
              display: 'block'
            }}
          >
            Import PDF
            <input
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && onImportPDF) {
                  onImportPDF(file)
                }
              }}
            />
          </label>
        </div>
        <button type="button" onClick={onClose} style={{ marginTop: 16 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
