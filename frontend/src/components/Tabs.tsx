import { useState } from 'react'

export interface TabDef {
  key: string
  label: string
  content: React.ReactNode
}

interface Props {
  tabs: TabDef[]
  defaultTab?: string
}

export default function Tabs({ tabs, defaultTab }: Props) {
  const initial = defaultTab ?? tabs[0]?.key
  const [active, setActive] = useState(initial)
  const [visites, setVisites] = useState<string[]>([initial])
  const current = tabs.find(t => t.key === active) ?? tabs[0]

  function selectionner(key: string) {
    setActive(key)
    setVisites(prev => prev.includes(key) ? prev : [...prev, key])
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1f2937', marginBottom: '20px' }}>
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
        <div key={tab.key} style={{ display: tab.key === current?.key ? 'block' : 'none' }}>
          {tab.content}
        </div>
      ))}
    </div>
  )
}
