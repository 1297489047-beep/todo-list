import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Bell,
  BellRing,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  Inbox,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import './App.css'

const TASKS_KEY = 'taskbell.tasks.v1'
const SETTINGS_KEY = 'taskbell.settings.v1'
const REMINDER_GRACE_MS = 15 * 60 * 1000

const PRIORITIES = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const LEAD_OPTIONS = [
  { value: 0, label: '准时' },
  { value: 5, label: '提前5分钟' },
  { value: 15, label: '提前15分钟' },
  { value: 30, label: '提前30分钟' },
  { value: 60, label: '提前1小时' },
  { value: 1440, label: '提前1天' },
]

const VIEWS = [
  { id: 'today', label: '今日', icon: CalendarCheck },
  { id: 'week', label: '本周', icon: Calendar },
  { id: 'upcoming', label: '即将', icon: CalendarClock },
  { id: 'all', label: '全部', icon: ListTodo },
  { id: 'done', label: '已完成', icon: CheckCircle2 },
]

const SECTION_TITLES = {
  overdue: '已逾期',
  today: '今天',
  tomorrow: '明天',
  week: '7天内',
  later: '更晚',
  none: '无日期',
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const LONG_WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const pad = (n) => String(n).padStart(2, '0')

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(date) {
  const d = startOfDay(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function dayDiff(a, b) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000)
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function nextHourTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseDueString(value) {
  if (!value) return null
  const [datePart, timePart = '00:00'] = String(value).split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min] = timePart.split(':').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, h || 0, min || 0)
}

function dueInput(task) {
  if (!task.due) return { date: '', time: '' }
  const d = parseDueString(task.due)
  return { date: toDateInputValue(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

function relativeDayLabel(date, now) {
  const diff = dayDiff(date, now)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === -1) return '昨天'
  if (diff > 1 && diff < 7) return WEEKDAYS[date.getDay()]
  if (diff < 0 && diff > -7) return `${WEEKDAYS[date.getDay()]} · ${Math.abs(diff)}天前`
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatLongDate(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${LONG_WEEKDAYS[d.getDay()]}`
}

function hoursFromNowInput(hours) {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000)
  return `${toDateInputValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function daysFromNowInput(days, time = '09:30') {
  const d = addDays(new Date(), days)
  return `${toDateInputValue(d)}T${time}`
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // fall through to seed data
  }
  const nowIso = new Date().toISOString()
  return [
    {
      id: uid(),
      title: '整理本周工作重点',
      notes: '把下周要推进的事情列成清单',
      due: hoursFromNowInput(2),
      priority: 'high',
      tags: ['工作'],
      completed: false,
      reminder: { enabled: true, lead: 5, notifiedAt: null },
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: uid(),
      title: '预约牙医复诊',
      notes: '',
      due: daysFromNowInput(1, '10:30'),
      priority: 'medium',
      tags: ['生活'],
      completed: false,
      reminder: { enabled: true, lead: 30, notifiedAt: null },
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: uid(),
      title: '给项目写一周总结',
      notes: '附上本周的数据截图',
      due: daysFromNowInput(6, '18:00'),
      priority: 'low',
      tags: ['工作'],
      completed: false,
      reminder: { enabled: false, lead: 0, notifiedAt: null },
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ]
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { sound: true, ...JSON.parse(raw) }
  } catch {
    // ignore malformed settings
  }
  return { sound: true }
}

function TaskForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial.title || '')
  const [date, setDate] = useState(initial.date || '')
  const [time, setTime] = useState(initial.time || '')
  const [priority, setPriority] = useState(initial.priority || 'medium')
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(initial.reminderEnabled))
  const [lead, setLead] = useState(initial.lead ?? 0)
  const [notes, setNotes] = useState(initial.notes || '')
  const [tagText, setTagText] = useState((initial.tags || []).join(', '))

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit({
      title: trimmed,
      due: date ? `${date}T${time || '00:00'}` : '',
      priority,
      reminderEnabled,
      lead: Number(lead),
      notes: notes.trim(),
      tags: tagText
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6),
    })
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        className="title-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="要做点什么？"
        aria-label="待办标题"
        autoFocus={Boolean(initial.title)}
      />
      <div className="form-grid">
        <label className="field">
          <span>日期</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field">
          <span>时间</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <div className="field">
          <span>优先级</span>
          <div className="segmented" role="group" aria-label="优先级">
            {PRIORITIES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={priority === item.value ? 'active' : ''}
                aria-pressed={priority === item.value}
                onClick={() => setPriority(item.value)}
              >
                <Flag size={13} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>提前提醒</span>
          <select value={lead} onChange={(event) => setLead(Number(event.target.value))} disabled={!reminderEnabled}>
            {LEAD_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid-2">
        <label className="field">
          <span>备注</span>
          <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="补充细节" />
        </label>
        <label className="field">
          <span>标签</span>
          <input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="工作, 生活" />
        </label>
      </div>
      <div className="form-footer">
        <label className="check-label">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
          />
          <Bell size={15} />
          到点提醒我
        </label>
        <div className="form-actions">
          {onCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              取消
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={!title.trim()}>
            <Plus size={16} />
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}

function TaskRow({ task, now, onToggle, onToggleReminder, onEdit, onDelete }) {
  const due = parseDueString(task.due)
  const isOverdue = Boolean(due && due < startOfDay(now) && !task.completed)
  const priorityInfo = PRIORITIES.find((item) => item.value === task.priority) || PRIORITIES[1]
  const leadLabel = LEAD_OPTIONS.find((item) => Number(item.value) === Number(task.reminder?.lead))?.label

  return (
    <div className={`task ${task.completed ? 'is-done' : ''} ${isOverdue ? 'is-overdue' : ''}`}>
      <button
        type="button"
        className="task-check"
        onClick={() => onToggle(task.id)}
        title={task.completed ? '标记为未完成' : '标记为已完成'}
      >
        {task.completed ? <CheckCircle2 /> : <Circle />}
      </button>
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        {task.notes && <div className="task-notes">{task.notes}</div>}
        {(due || task.tags?.length > 0 || task.reminder?.enabled) && (
          <div className="task-meta">
            {due && (
              <span className={`due-chip ${isOverdue ? 'overdue' : ''}`}>
                <Clock size={13} />
                {relativeDayLabel(due, now)} {pad(due.getHours())}:{pad(due.getMinutes())}
              </span>
            )}
            {task.reminder?.enabled && leadLabel && (
              <span className="due-chip bell">
                <BellRing size={13} />
                {leadLabel}
              </span>
            )}
            {(task.tags || []).map((tag) => (
              <span key={tag} className="tag-chip">
                <Tag size={12} />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className={`priority-badge p-${priorityInfo.value}`}>{priorityInfo.label}</span>
      <div className="task-actions">
        <button
          type="button"
          className={`icon-btn ${task.reminder?.enabled ? 'is-active' : ''}`}
          onClick={() => onToggleReminder(task.id)}
          title={task.reminder?.enabled ? '关闭提醒' : '开启提醒'}
        >
          {task.reminder?.enabled ? <BellRing size={16} /> : <Bell size={16} />}
        </button>
        <button type="button" className="icon-btn" onClick={() => onEdit(task.id)} title="编辑">
          <Pencil size={16} />
        </button>
        <button type="button" className="icon-btn danger" onClick={() => onDelete(task.id)} title="删除">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [settings, setSettings] = useState(loadSettings)
  const [view, setView] = useState('today')
  const [priority, setPriority] = useState('all')
  const [tag, setTag] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('due')
  const [now, setNow] = useState(() => new Date())
  const [editingId, setEditingId] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const [toasts, setToasts] = useState([])
  const [notifPermission, setNotifPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const toastSeq = useRef(0)
  const audioRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
    } catch {
      // storage may be unavailable
    }
  }, [tasks])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // storage may be unavailable
    }
  }, [settings])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const addToast = useCallback(({ title, body, kind = 'reminder' }) => {
    const id = ++toastSeq.current
    setToasts((prev) => [...prev.slice(-2), { id, title, body, kind }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 8000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const playChime = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      if (!audioRef.current) audioRef.current = new Ctx()
      const ctx = audioRef.current
      const startAt = ctx.currentTime
      const chimeNotes = [880, 1174.66, 1567.98]
      chimeNotes.forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const t = startAt + index * 0.14
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.55)
      })
    } catch {
      // audio is optional
    }
  }, [])

  const fireReminder = useCallback(
    (task) => {
      const due = parseDueString(task.due)
      const leadLabel = LEAD_OPTIONS.find((item) => Number(item.value) === Number(task.reminder?.lead))?.label || '准时'
      const body = due
        ? `${relativeDayLabel(due, new Date())} ${pad(due.getHours())}:${pad(due.getMinutes())}`
        : '该开始处理了'
      addToast({ title: task.title, body: `${leadLabel}提醒 · ${body}` })
      if (settings.sound) playChime()
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const notification = new Notification('任务铃 · 待办提醒', {
            body: `${task.title} · ${body}`,
            tag: `taskbell-${task.id}`,
          })
          notification.onclick = () => {
            window.focus()
            notification.close()
          }
        } catch {
          // browser notification failed
        }
      }
    },
    [addToast, playChime, settings.sound]
  )

  useEffect(() => {
    const runCheck = () => {
      const dueReminders = []
      const updated = tasks.map((task) => {
        if (task.completed || !task.due || !task.reminder?.enabled || task.reminder.notifiedAt) return task
        const due = parseDueString(task.due)
        if (!due) return task
        const notifyAt = due.getTime() - (Number(task.reminder.lead) || 0) * 60000
        if (notifyAt <= Date.now()) {
          dueReminders.push({ task, notifyAt })
          return { ...task, reminder: { ...task.reminder, notifiedAt: new Date().toISOString() } }
        }
        return task
      })
      if (dueReminders.length > 0) {
        setTasks(updated)
        dueReminders.forEach(({ task, notifyAt }) => {
          if (Date.now() - notifyAt <= REMINDER_GRACE_MS) fireReminder(task)
        })
      }
    }
    runCheck()
    const timer = setInterval(runCheck, 30000)
    const handleFocus = () => runCheck()
    window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fireReminder, tasks])

  const handleEnableNotifications = useCallback(async () => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      setNotifPermission(result)
    } else {
      setNotifPermission(Notification.permission)
    }
  }, [])

  const addTask = useCallback(
    (data) => {
      const nowIso = new Date().toISOString()
      const task = {
        id: uid(),
        title: data.title,
        notes: data.notes || '',
        due: data.due || '',
        priority: data.priority,
        tags: data.tags || [],
        completed: false,
        reminder: {
          enabled: data.reminderEnabled,
          lead: Number(data.lead) || 0,
          notifiedAt: null,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      setTasks((prev) => [task, ...prev])
      setFormKey((key) => key + 1)
    },
    []
  )

  const updateTask = useCallback((id, data) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task
        return {
          ...task,
          title: data.title,
          notes: data.notes || '',
          due: data.due || '',
          priority: data.priority,
          tags: data.tags || [],
          reminder: {
            enabled: data.reminderEnabled,
            lead: Number(data.lead) || 0,
            notifiedAt:
              data.reminderEnabled && task.reminder?.enabled && task.reminder?.lead === Number(data.lead)
                ? task.reminder.notifiedAt
                : null,
          },
          updatedAt: new Date().toISOString(),
        }
      })
    )
    setEditingId(null)
  }, [])

  const toggleComplete = useCallback((id) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() } : task
      )
    )
  }, [])

  const toggleReminder = useCallback(
    (id) => {
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== id) return task
          if (!task.due) {
            addToast({ title: '没有截止时间', body: '先设置日期和时间，再开启提醒', kind: 'info' })
            return task
          }
          const enabled = !task.reminder?.enabled
          return {
            ...task,
            reminder: {
              enabled,
              lead: task.reminder?.lead ?? 0,
              notifiedAt: enabled ? null : task.reminder?.notifiedAt,
            },
          }
        })
      )
    },
    [addToast]
  )

  const deleteTask = useCallback(
    (id) => {
      const task = tasks.find((item) => item.id === id)
      if (task && window.confirm(`删除“${task.title}”？`)) {
        setTasks((prev) => prev.filter((item) => item.id !== id))
      }
    },
    [tasks]
  )

  const stats = useMemo(() => {
    const startToday = startOfDay(now)
    const weekStart = startOfWeek(now)
    const weekEnd = addDays(weekStart, 7)
    const active = tasks.filter((task) => !task.completed)
    const overdue = active.filter((task) => {
      const due = parseDueString(task.due)
      return due && due < startToday
    })
    const todayActive = active.filter((task) => {
      const due = parseDueString(task.due)
      return due && dayDiff(due, now) === 0
    })
    const weekActive = active.filter((task) => {
      const due = parseDueString(task.due)
      return due && due >= weekStart && due < weekEnd
    })
    const dueToday = tasks.filter((task) => {
      const due = parseDueString(task.due)
      return due && dayDiff(due, now) === 0
    })
    const todayDone = dueToday.filter((task) => task.completed).length
    const todayTotal = dueToday.length
    return {
      overdue: overdue.length,
      today: todayActive.length,
      week: weekActive.length,
      todayDone,
      todayTotal,
      progress: todayTotal ? Math.round((todayDone / todayTotal) * 100) : 100,
    }
  }, [tasks, now])

  const viewCounts = useMemo(() => {
    const startToday = startOfDay(now)
    const weekStart = startOfWeek(now)
    const weekEnd = addDays(weekStart, 7)
    const active = tasks.filter((task) => !task.completed)
    const count = (predicate) => active.filter(predicate).length
    return {
      today: count((task) => {
        const due = parseDueString(task.due)
        return due && dayDiff(due, now) === 0
      }),
      week: count((task) => {
        const due = parseDueString(task.due)
        return due && due >= weekStart && due < weekEnd
      }),
      upcoming: count((task) => {
        const due = parseDueString(task.due)
        return due && due >= startToday
      }),
      all: active.length,
      done: tasks.length - active.length,
    }
  }, [tasks, now])

  const allTags = useMemo(() => {
    const set = new Set()
    tasks.forEach((task) => (task.tags || []).forEach((item) => set.add(item)))
    return [...set]
  }, [tasks])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tasks
      .filter((task) => {
        if (view === 'done' && !task.completed) return false
        if (view !== 'done' && view !== 'all' && task.completed) return false
        if (priority !== 'all' && task.priority !== priority) return false
        if (tag !== 'all' && !(task.tags || []).includes(tag)) return false
        if (query) {
          const haystack = `${task.title} ${task.notes || ''} ${(task.tags || []).join(' ')}`.toLowerCase()
          if (!haystack.includes(query)) return false
        }
        const due = parseDueString(task.due)
        if (view === 'today') {
          if (!due || dayDiff(due, now) !== 0) return false
        } else if (view === 'week') {
          const weekStart = startOfWeek(now)
          const weekEnd = addDays(weekStart, 7)
          if (!due || due < weekStart || due >= weekEnd) return false
        } else if (view === 'upcoming') {
          if (!due || due < startOfDay(now)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (view !== 'done' && view !== 'all' && a.completed !== b.completed) {
          return a.completed ? 1 : -1
        }
        if (sortBy === 'created') {
          return (b.createdAt || '').localeCompare(a.createdAt || '')
        }
        const aDue = parseDueString(a.due)
        const bDue = parseDueString(b.due)
        if (!aDue && !bDue) return (b.createdAt || '').localeCompare(a.createdAt || '')
        if (!aDue) return 1
        if (!bDue) return -1
        return aDue.getTime() - bDue.getTime()
      })
  }, [now, priority, search, sortBy, tag, tasks, view])

  const sections = useMemo(() => {
    const map = new Map()
    filtered.forEach((task) => {
      const due = parseDueString(task.due)
      let key = 'none'
      if (due) {
        const diff = dayDiff(due, now)
        if (diff < 0) key = 'overdue'
        else if (diff === 0) key = 'today'
        else if (diff === 1) key = 'tomorrow'
        else if (diff <= 6) key = 'week'
        else key = 'later'
      }
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(task)
    })
    return ['overdue', 'today', 'tomorrow', 'week', 'later', 'none']
      .map((key) => ({ key, title: SECTION_TITLES[key], tasks: map.get(key) || [] }))
      .filter((section) => section.tasks.length > 0)
  }, [filtered, now])

  const currentView = VIEWS.find((item) => item.id === view) || VIEWS[0]
  const editingTask = editingId ? tasks.find((task) => task.id === editingId) : null

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <BellRing size={19} />
          </div>
          <div>
            <div className="brand-name">任务铃</div>
            <div className="brand-sub">待办与提醒</div>
          </div>
        </div>
        <nav className="nav-list" aria-label="视图">
          {VIEWS.map((item) => {
            const Icon = item.icon
            const count = viewCounts[item.id]
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${view === item.id ? 'active' : ''}`}
                onClick={() => setView(item.id)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {count > 0 && <span className="nav-count">{count}</span>}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-settings">
          <span className="settings-title">提醒设置</span>
          <label className="setting-row" title={settings.sound ? '关闭提醒声音' : '开启提醒声音'}>
            {settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>提醒声音</span>
            <input
              type="checkbox"
              className="switch"
              checked={settings.sound}
              onChange={(event) => setSettings((prev) => ({ ...prev, sound: event.target.checked }))}
            />
          </label>
          <button type="button" className="notif-mini" onClick={handleEnableNotifications}>
            {notifPermission === 'granted' ? (
              <BellRing size={16} />
            ) : notifPermission === 'denied' ? (
              <AlertCircle size={16} />
            ) : (
              <Bell size={16} />
            )}
            <span>
              {notifPermission === 'granted'
                ? '通知已开启'
                : notifPermission === 'denied'
                  ? '通知被阻止'
                  : notifPermission === 'unsupported'
                    ? '不支持通知'
                    : '开启通知'}
            </span>
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <header className="topbar">
            <div>
              <h1>{currentView.label}</h1>
              <p className="date-line">
                {formatLongDate(now)} · {viewCounts.all} 项待办进行中
              </p>
            </div>
            <button
              type="button"
              className={`notif-btn ${
                notifPermission === 'granted' ? 'is-on' : notifPermission === 'denied' ? 'is-off' : ''
              }`}
              onClick={handleEnableNotifications}
              disabled={notifPermission === 'unsupported'}
            >
              {notifPermission === 'granted' ? <BellRing size={16} /> : <Bell size={16} />}
              {notifPermission === 'granted'
                ? '通知已开启'
                : notifPermission === 'denied'
                  ? '通知未开启'
                  : notifPermission === 'unsupported'
                    ? '浏览器不支持通知'
                    : '开启通知提醒'}
            </button>
          </header>

          <section className="stats-row" aria-label="概览">
            <div className={`stat ${stats.overdue ? 'danger' : ''}`}>
              <div className="stat-value">{stats.overdue}</div>
              <div className="stat-label">已逾期</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.today}</div>
              <div className="stat-label">今日待办</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.week}</div>
              <div className="stat-label">本周待办</div>
            </div>
            <div className="stat progress-stat">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${stats.progress}%` }} />
              </div>
              <div className="stat-label">
                今日完成 {stats.todayDone}/{stats.todayTotal}
              </div>
            </div>
          </section>

          <section className="panel add-panel">
            <div className="panel-head">
              <Plus size={16} />
              <h2>新建待办</h2>
            </div>
            <TaskForm
              key={formKey}
              initial={{ date: toDateInputValue(now), time: nextHourTime(), priority: 'medium' }}
              submitLabel="添加任务"
              onSubmit={addTask}
            />
          </section>

          <div className="toolbar">
            <label className="search-box">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索标题、备注或标签"
              />
            </label>
            <label className="select-wrap">
              <span className="sr-only">优先级</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="all">全部优先级</option>
                {PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}优先级
                  </option>
                ))}
              </select>
            </label>
            {allTags.length > 0 && (
              <label className="select-wrap">
                <span className="sr-only">标签</span>
                <select value={tag} onChange={(event) => setTag(event.target.value)}>
                  <option value="all">全部标签</option>
                  {allTags.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="sort-toggle" role="group" aria-label="排序">
              <button
                type="button"
                className={sortBy === 'due' ? 'active' : ''}
                onClick={() => setSortBy('due')}
              >
                按时间
              </button>
              <button
                type="button"
                className={sortBy === 'created' ? 'active' : ''}
                onClick={() => setSortBy('created')}
              >
                最近添加
              </button>
            </div>
          </div>

          <section className="task-area">
            {sections.length === 0 ? (
              <div className="empty-state">
                <Inbox size={30} />
                <p>这里还没有待办</p>
              </div>
            ) : (
              sections.map((section) => (
                <div key={section.key} className="task-section">
                  <div className="section-head">
                    {section.key === 'overdue' && <AlertCircle size={14} />}
                    <span>{section.title}</span>
                    <span className="section-count">{section.tasks.length}</span>
                  </div>
                  <div className="task-list">
                    {section.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        now={now}
                        onToggle={toggleComplete}
                        onToggleReminder={toggleReminder}
                        onEdit={setEditingId}
                        onDelete={deleteTask}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </main>

      {editingTask && (
        <div className="modal-backdrop" onClick={() => setEditingId(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h2>编辑待办</h2>
              <button type="button" className="icon-btn" onClick={() => setEditingId(null)} title="关闭">
                <X size={18} />
              </button>
            </div>
            <TaskForm
              key={editingTask.id}
              initial={{
                title: editingTask.title,
                notes: editingTask.notes,
                tags: editingTask.tags,
                priority: editingTask.priority,
                reminderEnabled: editingTask.reminder?.enabled,
                lead: editingTask.reminder?.lead,
                ...dueInput(editingTask),
              }}
              submitLabel="保存修改"
              onSubmit={(data) => updateTask(editingTask.id, data)}
              onCancel={() => setEditingId(null)}
            />
          </div>
        </div>
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`}>
            <div className="toast-icon">
              <BellRing size={18} />
            </div>
            <div className="toast-content">
              <strong>{toast.title}</strong>
              <span>{toast.body}</span>
            </div>
            <button type="button" className="icon-btn" onClick={() => removeToast(toast.id)} title="关闭">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
