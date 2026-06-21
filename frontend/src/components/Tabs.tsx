import { useEffect, useState } from 'react'

export interface TabDef {
  key: string
  label: string
  content: React.ReactNode
}

interface Props {
  tabs: TabDef[]
  defaultTab?: string
  active?: string
  onChange?: (key: string) => void
  flex?: boolean
}

export default function Tabs({ tabs, defaultTab, active: activeProp, onChange, flex }: Props) {
  const initial = defaultTab ?? tabs[0]?.key
  const [activeState, setActiveState] = useState(initial)
  const active = activeProp ?? activeState
  const [visites, setVisites] = useState<string[]>([active])
  const current = tabs.find(t => t.key === active) ?? tabs[0]

  useEffect(() => {
    setVisites(prev => prev.includes(active) ? prev : [...prev, active])
  }, [active])

  function selectionner(key: string) {
    if (onChange) onChange(key)
    else setActiveState(key)
  }

  return (
    <div style={flex ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : undefined}>
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1f2937', marginBottom: '20px', flexShrink: 0 }}>
        {tabs.map(tab => {
          const isActive = tab.key === current?.key
          return (
            <button
              key={tab.key}
              onClick={() => selectionner(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${isActive ? '#2563eb' : 'transparent'}`,
                color: isActive ? '#60a5fa' : '#9ca3af',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13px',
                padding: '10px 16px',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {tabs.filter(tab => visites.includes(tab.key)).map(tab => (
        <div key={tab.key} style={{ display: tab.key === current?.key ? (flex ? 'flex' : 'block') : 'none', ...(flex ? { flex: 1, minHeight: 0, flexDirection: 'column' } : {}) }}>
          {tab.content}
        </div>
      ))}
    </div>
  )
}
