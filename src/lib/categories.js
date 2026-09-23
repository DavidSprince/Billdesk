export const BILL_TYPES = [
  { name: 'TA Bill', icon: '🚌', color: '#f59e0b' },
  { name: 'TA Advance', icon: '💰', color: '#22c55e' },
  { name: 'Tour Bill', icon: '🧳', color: '#0ea5e9' },
  { name: 'Medical Bill', icon: '🏥', color: '#ef4444' },
  { name: 'Office Expense', icon: '🖇️', color: '#8b5cf6' },
  { name: 'Purchase Bill', icon: '🛒', color: '#10b981' },
  { name: 'Internet & Phone', icon: '🌐', color: '#06b6d4' },
  { name: 'Electricity', icon: '⚡', color: '#f59e0b' },
  { name: 'Water', icon: '💧', color: '#38bdf8' },
  { name: 'Rent', icon: '🏠', color: '#e0417d' },
  { name: 'Contingency', icon: '📦', color: '#64748b' },
  { name: 'Other', icon: '📄', color: '#94a3b8' },
]
export const catIcon = (name) => (BILL_TYPES.find(c => c.name === name) || { icon: '📄' }).icon
