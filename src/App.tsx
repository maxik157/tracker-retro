import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import trackerLogo from './assets/tracker-retro-logo-cropped.png'
import {
  addComment,
  createRetroUser,
  createCard,
  createColumn,
  deleteColumn,
  deleteAllCards,
  deleteCard,
  fetchBoardDirectory,
  getBoardId,
  getParticipantId,
  getSortedCards,
  resetAllVotes,
  seedBoard,
  setPoll,
  subscribeToBoard,
  toggleVote,
  signInRetroUser,
  updateBoardAccess,
  updateBoardMeta,
  updateColumn,
  updateBoardSettings,
  updateCard,
  updateCards,
  updateTimer,
  votePoll,
} from './lib/retroApi'
import type {
  RetroBoard,
  RetroBoardAccess,
  RetroBoardDirectoryItem,
  RetroBoardSettings,
  RetroCard,
  RetroColumn,
  RetroComment,
  RetroMergedCard,
  RetroProblemResolution,
  RetroProblemStep,
  RetroPoll,
  RetroUser,
  SortMode,
} from './types'

type DraftMap = Record<string, string>
type GifDraftMap = Record<string, string | null>
type ComposerMode = string | null
type CardColor = RetroCard['color']
type BoardListItem = RetroBoardDirectoryItem
type AuthMode = 'sign-in' | 'sign-up'
type DragState = {
  cardId: string
  overColumnId: string | null
  overCardId: string | null
  mode: 'move' | 'merge'
  dropPosition: 'before' | 'after' | null
} | null
type ColumnDragState = {
  columnId: string
  overColumnId: string | null
  dropPosition: 'before' | 'after' | null
} | null
type ResolutionStepDragState = {
  cardId: string
  stepId: string
  overStepId: string | null
} | null
type PollDraft = {
  title: string
  description: string
  isOpen: boolean
  isVisible: boolean
  allowMultiple: boolean
  preset: string | null
  options: string[]
}
type CommentEditState = {
  cardId: string
  commentId: string
} | null
type GifPickerTarget =
  | { type: 'card-draft'; id: string }
  | { type: 'comment-draft'; id: string }
  | { type: 'card-edit'; id: string }
  | { type: 'comment-edit'; id: string }
type KlipyGif = {
  id: string
  title: string
  tinyUrl: string
  gifUrl: string
}
type KlipyApiMedia = {
  gif?: { url?: string }
  tinygif?: { url?: string }
}
type KlipyApiResult = {
  id?: string
  title?: string
  content_description?: string
  media_formats?: KlipyApiMedia
  media?: KlipyApiMedia[]
}

const klipyApiKey = import.meta.env.VITE_KLIPY_API_KEY as string | undefined
const klipyClientKey = 'tracker-retro'

function getKlipyGifUrl(result: KlipyApiResult) {
  const formats = result.media_formats || result.media?.[0] || {}

  return {
    tinyUrl: formats.tinygif?.url || formats.gif?.url || '',
    gifUrl: formats.gif?.url || formats.tinygif?.url || '',
  }
}

function normalizeKlipyResults(results: KlipyApiResult[]): KlipyGif[] {
  return results
    .map((result, index) => {
      const urls = getKlipyGifUrl(result)

      return {
        id: result.id || `${urls.gifUrl}-${index}`,
        title: result.title || result.content_description || 'GIF',
        ...urls,
      }
    })
    .filter((gif) => gif.gifUrl)
}
type WorkspaceView = 'board' | 'solutions'
type ProblemStatus = RetroProblemResolution['status']

const BOARD_LIST_STORAGE_KEY = 'retro-board-list'
const AUTH_USER_STORAGE_KEY = 'retro-user'
const SORT_STORAGE_PREFIX = 'retro-local-sort'
const AUTHOR_STORAGE_PREFIX = 'retro-board-author'
const ANONYMOUS_STORAGE_PREFIX = 'retro-board-anonymous'
type EditableSettingKey =
  | 'privateWriting'
  | 'showAuthors'
  | 'showCardDate'
  | 'allowComments'
  | 'allowVoting'
  | 'hideVoteCount'
  | 'showCommentsByDefault'
  | 'presentationMode'
  | 'highlightMode'
  | 'allowAnonymousNames'
  | 'everyoneCanEdit'
  | 'enableReactions'
  | 'allowGifs'

const fallbackSettings: RetroBoardSettings = {
  showAuthors: false,
  showCardDate: false,
  allowVoting: true,
  hideVoteCount: false,
  allowComments: true,
  allowCardEditing: true,
  allowCardMoving: true,
  privateWriting: false,
  presentationMode: false,
  highlightMode: false,
  enableReactions: false,
  allowGifs: true,
  oneVotePerCard: false,
  enforceSort: false,
  allowAnonymousNames: true,
  everyoneCanEdit: true,
  showCommentsByDefault: false,
  voteScope: 'board',
  maxVotesPerUser: 5,
  language: 'ru',
}

const cardPalette = [
  { id: null, label: 'По умолчанию', className: 'card-tone-default' },
  { id: 'green', label: 'Зеленый', className: 'card-tone-green' },
  { id: 'pink', label: 'Розовый', className: 'card-tone-pink' },
  { id: 'violet', label: 'Фиолетовый', className: 'card-tone-violet' },
  { id: 'yellow', label: 'Желтый', className: 'card-tone-yellow' },
  { id: 'blue', label: 'Синий', className: 'card-tone-blue' },
  { id: 'teal', label: 'Бирюзовый', className: 'card-tone-teal' },
  { id: 'orange', label: 'Оранжевый', className: 'card-tone-orange' },
  { id: 'red', label: 'Красный', className: 'card-tone-red' },
  { id: 'lime', label: 'Лайм', className: 'card-tone-lime' },
  { id: 'cyan', label: 'Циан', className: 'card-tone-cyan' },
  { id: 'indigo', label: 'Индиго', className: 'card-tone-indigo' },
  { id: 'purple', label: 'Пурпурный', className: 'card-tone-purple' },
  { id: 'rose', label: 'Роза', className: 'card-tone-rose' },
  { id: 'amber', label: 'Янтарный', className: 'card-tone-amber' },
  { id: 'slate', label: 'Графит', className: 'card-tone-slate' },
  { id: 'mint', label: 'Мята', className: 'card-tone-mint' },
] as const

const reactionOptions = ['👍', '❤️', '🎉', '🔥', '👏', '💡', '🚀', '✅', '👀', '🙌'] as const

const sortOptions: Array<{ id: SortMode; label: string }> = [
  { id: 'order', label: 'Порядок' },
  { id: 'votes', label: 'Голоса' },
  { id: 'date_created', label: 'Дата' },
  { id: 'random', label: 'Случайно' },
  { id: 'user', label: 'Автор' },
]

const defaultPollDraft: PollDraft = {
  title: 'Как прошел спринт?',
  description: '',
  isOpen: true,
  isVisible: true,
  allowMultiple: false,
  preset: null,
  options: ['Отлично', 'Нормально', 'Нужно улучшить'],
}

const problemStatusOptions: Array<{ id: ProblemStatus; label: string }> = [
  { id: 'open', label: 'Открыта' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'resolved', label: 'Завершена' },
  { id: 'paused', label: 'Отложена' },
  { id: 'canceled', label: 'Отменена' },
]

const settingsSections: Array<{
  title: string
  items: Array<{ key: EditableSettingKey; label: string }>
}> = [
  {
    title: 'Режим доски',
    items: [
      { key: 'privateWriting', label: 'Скрыть карточки до окончания сбора' },
      { key: 'presentationMode', label: 'Режим презентации' },
      { key: 'highlightMode', label: 'Подсветка карточек' },
    ],
  },
  {
    title: 'Карточки и комментарии',
    items: [
      { key: 'allowComments', label: 'Разрешить комментарии' },
      { key: 'enableReactions', label: 'Реакции на карточки' },
      { key: 'allowGifs', label: 'Разрешить GIF' },
      { key: 'showCommentsByDefault', label: 'Открывать комментарии сразу' },
      { key: 'showAuthors', label: 'Показывать автора карточки' },
      { key: 'showCardDate', label: 'Показывать дату карточки' },
    ],
  },
  {
    title: 'Голосование',
    items: [
      { key: 'allowVoting', label: 'Разрешить голосование' },
      { key: 'hideVoteCount', label: 'Скрыть счетчики голосов' },
      { key: 'allowAnonymousNames', label: 'Анонимные имена' },
      { key: 'everyoneCanEdit', label: 'Разрешить редактирование всем' },
    ],
  },
]

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getCardVotes(card: RetroCard) {
  return [
    card,
    ...(card.mergedCards || []),
  ].reduce((sum, item) => sum + Object.keys(item.votes || {}).length, 0)
}

function getCardReactionCount(card: RetroCard, reaction: string) {
  return Object.keys(card.reactions?.[reaction] || {}).length
}

function mergeSettings(settings?: Partial<RetroBoardSettings>) {
  return { ...fallbackSettings, ...(settings || {}) }
}

function getCardComments(card: RetroCard) {
  return [
    ...Object.values(card.comments || {}),
    ...(card.mergedCards || []).flatMap((mergedCard) =>
      Object.values(mergedCard.comments || {}),
    ),
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

function getCardSections(card: RetroCard): RetroMergedCard[] {
  return [
    {
      id: card.id,
      createdBy: card.createdBy,
      content: card.content,
      gifUrl: card.gifUrl || null,
      color: card.color,
      author: card.author,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      votes: card.votes || {},
      reactions: card.reactions || {},
      comments: card.comments || {},
    },
    ...(card.mergedCards || []),
  ]
}

function createResolutionFromCard(card: RetroCard): RetroProblemResolution {
  const timestamp = nowIso()
  const sections = getCardSections(card)
  const steps =
    sections.length > 1
      ? sections.map((section) => ({
          id: `${card.id}-step-${section.id}`,
          title: `Разобрать: ${section.content}`,
          done: false,
          createdAt: timestamp,
        }))
      : [
          {
            id: `${card.id}-step-1`,
            title: '',
            done: false,
            createdAt: timestamp,
          },
        ]

  return {
    status: 'open',
    summary: '',
    steps,
    updatedAt: timestamp,
  }
}

function ensureResolution(card: RetroCard): RetroProblemResolution {
  return card.resolution || createResolutionFromCard(card)
}

function getResolutionProgress(resolution?: RetroProblemResolution) {
  if (!resolution?.steps.length) {
    return 0
  }

  const doneCount = resolution.steps.filter((step) => step.done).length
  return Math.round((doneCount / resolution.steps.length) * 100)
}

function getResolutionStatusLabel(status: ProblemStatus) {
  return problemStatusOptions.find((option) => option.id === status)?.label || 'Открыта'
}

function getResolutionStatusClass(status: ProblemStatus) {
  return `status-${status.replace('_', '-')}`
}

function replaceBoardCard(
  board: RetroBoard,
  cardId: string,
  nextCard: RetroCard,
): RetroBoard {
  return {
    ...board,
    cards: {
      ...board.cards,
      [cardId]: nextCard,
    },
  }
}

function getRemainingTimerSeconds(board: RetroBoard | null) {
  if (!board) {
    return 0
  }

  const { timer } = board

  if (timer.mode !== 'running' || !timer.startedAt) {
    return Math.max(0, timer.remainingSeconds)
  }

  const startedAt = new Date(timer.startedAt).getTime()
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  return Math.max(0, timer.remainingSeconds - elapsed)
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function createOptionId(index: number) {
  return `option-${index + 1}-${Math.random().toString(36).slice(2, 7)}`
}

function buildPollFromDraft(draft: PollDraft, existingPoll?: RetroPoll | null): RetroPoll {
  const labels = draft.options
    .map((option) => option.trim())
    .filter(Boolean)

  const safeLabels = labels.length >= 2 ? labels : defaultPollDraft.options
  const existingOptions = Object.values(existingPoll?.options || {})
  const options = Object.fromEntries(
    safeLabels.map((label, index) => {
      const matchingExisting =
        existingOptions.find((option) => option.label === label) || existingOptions[index]
      const id = matchingExisting?.id || createOptionId(index)

      return [
        id,
        {
          id,
          label,
          votes: matchingExisting?.label === label ? matchingExisting.votes || {} : {},
        },
      ]
    }),
  )

  return {
    id: existingPoll?.id || `poll-${Math.random().toString(36).slice(2, 10)}`,
    title: draft.title.trim() || 'Опрос',
    description: draft.description.trim(),
    isOpen: draft.isOpen,
    isVisible: draft.isVisible,
    allowMultiple: draft.allowMultiple,
    preset: draft.preset,
    options,
  }
}

function buildId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function nowIso() {
  return new Date().toISOString()
}

function getNextOrder(items: Array<{ order: number }>) {
  return items.reduce((max, item) => Math.max(max, item.order), -1) + 1
}

function normalizeBoardListItem(item: Partial<BoardListItem>): BoardListItem | null {
  if (!item.id) {
    return null
  }

  return {
    id: item.id,
    title: item.title || 'Ретроспектива команды',
    updatedAt: item.updatedAt || nowIso(),
    ownerUserId: item.ownerUserId || '',
    visibility: item.visibility || 'public',
  }
}

function readStoredUser(): RetroUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as RetroUser
    return parsed?.id ? parsed : null
  } catch {
    return null
  }
}

function writeStoredUser(user: RetroUser | null) {
  if (!user) {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    return
  }

  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
}

function readBoardList(): BoardListItem[] {
  try {
    const raw = localStorage.getItem(BOARD_LIST_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as Array<Partial<BoardListItem>>
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeBoardListItem)
          .filter((item): item is BoardListItem => Boolean(item))
      : []
  } catch {
    return []
  }
}

function writeBoardList(items: BoardListItem[]) {
  localStorage.setItem(BOARD_LIST_STORAGE_KEY, JSON.stringify(items))
}

function mergeBoardLists(localItems: BoardListItem[], remoteItems: BoardListItem[]) {
  const byId = new Map<string, BoardListItem>()

  ;[...remoteItems, ...localItems].forEach((item) => {
    const normalized = normalizeBoardListItem(item)

    if (!normalized) {
      return
    }

    const current = byId.get(normalized.id)

    if (
      !current ||
      new Date(normalized.updatedAt).getTime() >= new Date(current.updatedAt).getTime()
    ) {
      byId.set(normalized.id, normalized)
    }
  })

  return Array.from(byId.values())
    .sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    )
    .slice(0, 48)
}

function upsertBoardListItem(item: BoardListItem) {
  const normalized = normalizeBoardListItem(item)

  if (!normalized) {
    return readBoardList()
  }

  const currentItems = readBoardList()
  const existingIndex = currentItems.findIndex((boardItem) => boardItem.id === normalized.id)
  const nextItems =
    existingIndex >= 0
      ? currentItems.map((boardItem) =>
          boardItem.id === normalized.id ? normalized : boardItem,
        )
      : [normalized, ...currentItems]

  const limitedItems = nextItems.slice(0, 48)

  writeBoardList(limitedItems)
  return limitedItems
}

function moveBoardListItem(items: BoardListItem[], sourceId: string, targetId: string) {
  if (sourceId === targetId) {
    return items
  }

  const sourceIndex = items.findIndex((item) => item.id === sourceId)
  const targetIndex = items.findIndex((item) => item.id === targetId)

  if (sourceIndex < 0 || targetIndex < 0) {
    return items
  }

  const nextItems = [...items]
  const [movingItem] = nextItems.splice(sourceIndex, 1)
  nextItems.splice(targetIndex, 0, movingItem)

  return nextItems
}

function createCardDragImage(cardElement: HTMLElement) {
  const wrapper = document.createElement('div')
  const clone = cardElement.cloneNode(true) as HTMLElement
  const rect = cardElement.getBoundingClientRect()

  wrapper.className = 'retro-card-drag-preview'
  wrapper.style.width = `${rect.width + 48}px`
  wrapper.style.height = `${rect.height + 48}px`
  wrapper.style.position = 'fixed'
  wrapper.style.top = '-1000px'
  wrapper.style.left = '-1000px'
  wrapper.style.pointerEvents = 'none'
  clone.classList.add('retro-card-drag-preview__card')
  clone.style.width = `${rect.width}px`
  clone.removeAttribute('draggable')

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)
  void wrapper.offsetHeight

  return wrapper
}

function getVotesWord(count: number) {
  const lastTwo = count % 100
  const last = count % 10

  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'голосов'
  }

  if (last === 1) {
    return 'голос'
  }

  if (last >= 2 && last <= 4) {
    return 'голоса'
  }

  return 'голосов'
}

function playTimerAlarm() {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextConstructor) {
    return
  }

  const audioContext = new AudioContextConstructor()
  const now = audioContext.currentTime
  const beeps = [
    { start: 0, frequency: 880 },
    { start: 0.22, frequency: 1040 },
    { start: 0.44, frequency: 880 },
  ]

  beeps.forEach((beep) => {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(beep.frequency, now + beep.start)
    gain.gain.setValueAtTime(0.0001, now + beep.start)
    gain.gain.exponentialRampToValueAtTime(0.28, now + beep.start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + beep.start + 0.18)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now + beep.start)
    oscillator.stop(now + beep.start + 0.2)
  })

  window.setTimeout(() => {
    void audioContext.close()
  }, 900)
}

function resizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

function SolutionFirework() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return undefined
    }

    const context = canvas.getContext('2d')

    if (!context) {
      return undefined
    }

    const ctx = context
    const pixelRatio = window.devicePixelRatio || 1
    const width = 460
    const height = 360
    let frameId = 0
    let hasBurst = false
    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      life: number
      ttl: number
      hue: number
      size: number
    }> = []
    const rocket = {
      x: width * 0.5,
      y: height - 42,
      vx: 0.14,
      vy: -6.2,
      life: 48,
    }

    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(pixelRatio, pixelRatio)

    function burst(x: number, y: number) {
      const count = 126

      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + (Math.random() - 0.5) * 0.16
        const speed = 2.1 + Math.random() * 5.8
        const ttl = 70 + Math.random() * 44

        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.55,
          life: ttl,
          ttl,
          hue: [168, 216, 42, 340, 205][index % 5],
          size: 1.4 + Math.random() * 2.2,
        })
      }
    }

    function drawParticle(
      particle: (typeof particles)[number],
      previousX: number,
      previousY: number,
    ) {
      const alpha = Math.max(0, particle.life / particle.ttl)
      const trailX = previousX - particle.vx * 2.8
      const trailY = previousY - particle.vy * 2.8
      const gradient = ctx.createLinearGradient(trailX, trailY, particle.x, particle.y)

      gradient.addColorStop(0, `hsla(${particle.hue}, 96%, 64%, 0)`)
      gradient.addColorStop(1, `hsla(${particle.hue}, 96%, 64%, ${alpha})`)
      ctx.strokeStyle = gradient
      ctx.lineWidth = particle.size
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(trailX, trailY)
      ctx.lineTo(particle.x, particle.y)
      ctx.stroke()
    }

    function animate() {
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      if (!hasBurst) {
        const previousX = rocket.x
        const previousY = rocket.y

        rocket.x += rocket.vx
        rocket.y += rocket.vy
        rocket.vy += 0.13
        rocket.life -= 1

        ctx.strokeStyle = 'rgba(79, 124, 255, 0.88)'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(previousX, previousY)
        ctx.lineTo(rocket.x, rocket.y)
        ctx.stroke()

        if (rocket.life <= 0 || rocket.vy >= -0.5) {
          hasBurst = true
          burst(rocket.x, rocket.y)
        }
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]
        const previousX = particle.x
        const previousY = particle.y

        particle.x += particle.vx
        particle.y += particle.vy
        particle.vx *= 0.982
        particle.vy = particle.vy * 0.982 + 0.075
        particle.life -= 1

        drawParticle(particle, previousX, previousY)

        if (particle.life <= 0) {
          particles.splice(index, 1)
        }
      }

      if (!hasBurst || particles.length) {
        frameId = window.requestAnimationFrame(animate)
      }
    }

    animate()

    return () => window.cancelAnimationFrame(frameId)
  }, [])

  return <canvas ref={canvasRef} className="solution-firework" aria-hidden="true" />
}

function getStoredAuthor(boardId: string | null) {
  if (!boardId || typeof window === 'undefined') {
    return 'Участник'
  }

  return localStorage.getItem(`${AUTHOR_STORAGE_PREFIX}-${boardId}`) || 'Участник'
}

function getStoredAnonymousMode(boardId: string | null) {
  return Boolean(
    boardId &&
      typeof window !== 'undefined' &&
      localStorage.getItem(`${ANONYMOUS_STORAGE_PREFIX}-${boardId}`) === 'true',
  )
}

function getWorkspaceViewFromUrl(): WorkspaceView {
  if (typeof window === 'undefined') {
    return 'board'
  }

  return new URL(window.location.href).searchParams.get('view') === 'solutions'
    ? 'solutions'
    : 'board'
}

function App() {
  const [boardId, setBoardId] = useState<string | null>(() => getBoardId())
  const [participantId] = useState(() => getParticipantId())
  const [boardList, setBoardList] = useState<BoardListItem[]>(() => readBoardList())
  const [currentUser, setCurrentUser] = useState<RetroUser | null>(() => readStoredUser())
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [authName, setAuthName] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [createdAccessCode, setCreatedAccessCode] = useState<string | null>(null)
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false)
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [board, setBoard] = useState<RetroBoard | null>(null)
  const [settings, setSettings] = useState<RetroBoardSettings>(fallbackSettings)
  const [loading, setLoading] = useState(() =>
    typeof window !== 'undefined' ? Boolean(new URL(window.location.href).searchParams.get('board')) : true,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [author, setAuthor] = useState(() => getStoredAuthor(getBoardId()))
  const [isAnonymousAuthor, setIsAnonymousAuthor] = useState(() =>
    getStoredAnonymousMode(getBoardId()),
  )
  const [localSortOrder, setLocalSortOrder] = useState<SortMode>('order')
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [draftGifs, setDraftGifs] = useState<GifDraftMap>({})
  const [commentDrafts, setCommentDrafts] = useState<DraftMap>({})
  const [commentDraftGifs, setCommentDraftGifs] = useState<GifDraftMap>({})
  const [commentEditState, setCommentEditState] = useState<CommentEditState>(null)
  const [commentEditText, setCommentEditText] = useState('')
  const [commentEditGif, setCommentEditGif] = useState<string | null>(null)
  const [columnTitleDrafts, setColumnTitleDrafts] = useState<DraftMap>({})
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})
  const [isHostPanelOpen, setIsHostPanelOpen] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [boardTitle, setBoardTitle] = useState('')
  const [composerColumnId, setComposerColumnId] = useState<ComposerMode>(null)
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [editingGif, setEditingGif] = useState<string | null>(null)
  const [editingSectionTexts, setEditingSectionTexts] = useState<Record<string, string>>({})
  const [editingSectionGifs, setEditingSectionGifs] = useState<GifDraftMap>({})
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [pollDraft, setPollDraft] = useState<PollDraft>(defaultPollDraft)
  const [isPollEditorOpen, setIsPollEditorOpen] = useState(false)
  const [isPollVotingOpen, setIsPollVotingOpen] = useState(false)
  const [showPollResults, setShowPollResults] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false)
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false)
  const [activeColumnMenuId, setActiveColumnMenuId] = useState<string | null>(null)
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null)
  const [activeReactionMenuCardId, setActiveReactionMenuCardId] = useState<string | null>(null)
  const [activeProblemStatusMenuId, setActiveProblemStatusMenuId] = useState<string | null>(null)
  const [gifPickerTarget, setGifPickerTarget] = useState<GifPickerTarget | null>(null)
  const [gifSearch, setGifSearch] = useState('')
  const [gifResults, setGifResults] = useState<KlipyGif[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState<string | null>(null)
  const [voteLimitWarning, setVoteLimitWarning] = useState<string | null>(null)
  const [selectedMobileColumnId, setSelectedMobileColumnId] = useState<string | null>(null)
  const [boardListDragId, setBoardListDragId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState>(null)
  const [columnDragState, setColumnDragState] = useState<ColumnDragState>(null)
  const [resolutionStepDragState, setResolutionStepDragState] =
    useState<ResolutionStepDragState>(null)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(() => getWorkspaceViewFromUrl())
  const [isCompactView, setIsCompactView] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 720 : false,
  )
  const isEditingTitleRef = useRef(false)
  const savingRef = useRef(false)
  const timerAlarmPlayedRef = useRef(false)
  const cardDragImageRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    isEditingTitleRef.current = isEditingTitle
  }, [isEditingTitle])

  useEffect(() => {
    savingRef.current = saving
  }, [saving])

  useEffect(() => {
    if (!voteLimitWarning) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setVoteLimitWarning(null), 2600)

    return () => window.clearTimeout(timeoutId)
  }, [voteLimitWarning])

  useEffect(() => {
    let active = true

    setDirectoryLoading(true)

    fetchBoardDirectory()
      .then((items) => {
        if (!active) {
          return
        }

        const nextItems = mergeBoardLists(readBoardList(), items)
        writeBoardList(nextItems)
        setBoardList(nextItems)
      })
      .catch((directoryError) => {
        console.error(directoryError)
      })
      .finally(() => {
        if (active) {
          setDirectoryLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function handlePopState() {
      const url = new URL(window.location.href)
      const nextBoardId = url.searchParams.get('board')
      setBoardId(nextBoardId)
      setWorkspaceView(url.searchParams.get('view') === 'solutions' ? 'solutions' : 'board')
      setLoading(Boolean(nextBoardId))

      if (!nextBoardId) {
        setBoard(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function setWorkspaceViewWithUrl(nextView: WorkspaceView) {
    setWorkspaceView(nextView)

    const url = new URL(window.location.href)

    if (nextView === 'solutions') {
      url.searchParams.set('view', 'solutions')
    } else {
      url.searchParams.delete('view')
    }

    window.history.replaceState({}, '', url)
  }

  function syncBoardState(nextBoard: RetroBoard) {
    setBoard(nextBoard)
    setBoardList(
      upsertBoardListItem({
        id: nextBoard.id,
        title: nextBoard.title,
        updatedAt: nextBoard.updatedAt,
        ownerUserId: nextBoard.access.ownerUserId,
        visibility: nextBoard.access.visibility,
      }),
    )
    setSettings(mergeSettings(nextBoard.settings))
    setBoardTitle((currentTitle) =>
      isEditingTitleRef.current ? currentTitle : nextBoard.title,
    )
    setRemainingSeconds(getRemainingTimerSeconds(nextBoard))
  }

  useEffect(() => {
    if (!boardId) {
      setBoard(null)
      setLoading(false)
      return undefined
    }

    setLoading(true)

    return subscribeToBoard(
      boardId,
      (nextBoard) => {
        if (!nextBoard) {
          setBoard(null)
          setLoading(false)
          return
        }

        if (savingRef.current) {
          setLoading(false)
          return
        }

        syncBoardState(nextBoard)
        setError(null)
        setLoading(false)
      },
      (subscriptionError) => {
        setError(subscriptionError.message)
        setLoading(false)
      },
    )
  }, [boardId])

  useEffect(() => {
    if (!boardId) {
      setLocalSortOrder('order')
      setAuthor('Участник')
      setIsAnonymousAuthor(false)
      return
    }

    const storedSortOrder = localStorage.getItem(
      `${SORT_STORAGE_PREFIX}-${boardId}-${participantId}`,
    ) as SortMode | null
    setLocalSortOrder(
      storedSortOrder && sortOptions.some((option) => option.id === storedSortOrder)
        ? storedSortOrder
        : 'order',
    )

    setAuthor(localStorage.getItem(`${AUTHOR_STORAGE_PREFIX}-${boardId}`) || 'Участник')
    setIsAnonymousAuthor(localStorage.getItem(`${ANONYMOUS_STORAGE_PREFIX}-${boardId}`) === 'true')
  }, [boardId, participantId])

  useEffect(() => {
    if (!boardId) {
      return
    }

    localStorage.setItem(`${AUTHOR_STORAGE_PREFIX}-${boardId}`, author)
  }, [author, boardId])

  useEffect(() => {
    if (!boardId) {
      return
    }

    localStorage.setItem(`${ANONYMOUS_STORAGE_PREFIX}-${boardId}`, String(isAnonymousAuthor))
  }, [boardId, isAnonymousAuthor])

  useEffect(() => {
    if (!gifPickerTarget) {
      return
    }

    if (!klipyApiKey) {
      setGifResults([])
      setGifError('Добавьте VITE_KLIPY_API_KEY, чтобы искать GIF в Klipy.')
      return
    }

    const abortController = new AbortController()
    const timeoutId = window.setTimeout(() => {
      const query = gifSearch.trim()

      if (!query) {
        setGifResults([])
        setGifLoading(false)
        setGifError(null)
        return
      }

      const url = new URL('https://api.klipy.com/v2/search')

      url.searchParams.set('key', klipyApiKey)
      url.searchParams.set('client_key', klipyClientKey)
      url.searchParams.set('q', query)
      url.searchParams.set('limit', '24')
      url.searchParams.set('media_filter', 'gif,tinygif')

      setGifLoading(true)
      setGifError(null)

      void fetch(url, { signal: abortController.signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Klipy ответил ${response.status}`)
          }

          return response.json()
        })
        .then((payload) => {
          setGifResults(normalizeKlipyResults(payload.results || []))
        })
        .catch((searchError: Error) => {
          if (abortController.signal.aborted) {
            return
          }

          setGifResults([])
          setGifError(searchError.message)
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setGifLoading(false)
          }
        })
    }, 260)

    return () => {
      window.clearTimeout(timeoutId)
      abortController.abort()
    }
  }, [gifPickerTarget, gifSearch])

  useEffect(() => {
    if (!board || board.timer.mode !== 'running') {
      return
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds(getRemainingTimerSeconds(board))
    }, 250)

    return () => window.clearInterval(intervalId)
  }, [board])

  useEffect(() => {
    if (!board || board.timer.mode !== 'running') {
      timerAlarmPlayedRef.current = false
      return
    }

    if (remainingSeconds > 0) {
      timerAlarmPlayedRef.current = false
      return
    }

    if (timerAlarmPlayedRef.current) {
      return
    }

    timerAlarmPlayedRef.current = true
    playTimerAlarm()
    void handleTimerMode('paused')
  }, [board?.timer.mode, remainingSeconds])

  useEffect(() => {
    function handleWindowClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null

      if (target?.closest('[data-menu-root="true"]')) {
        return
      }

      setIsSortMenuOpen(false)
      setIsBoardMenuOpen(false)
      setIsCreateMenuOpen(false)
      setActiveColumnMenuId(null)
      setActiveCardMenuId(null)
      setActiveReactionMenuCardId(null)
      setActiveProblemStatusMenuId(null)
      closeGifPicker()
    }

    window.addEventListener('click', handleWindowClick)
    return () => window.removeEventListener('click', handleWindowClick)
  }, [])

  useEffect(() => {
    function handleResize() {
      setIsCompactView(window.innerWidth <= 720)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const columns = useMemo(() => {
    return Object.values(board?.columns || {}).sort((left, right) => left.order - right.order)
  }, [board?.columns])

  useEffect(() => {
    if (!columns.length) {
      setSelectedMobileColumnId(null)
      return
    }

    setSelectedMobileColumnId((current) => {
      if (current && columns.some((column) => column.id === current)) {
        return current
      }

      return columns[0].id
    })
  }, [columns])

  const filteredCardsByColumn = useMemo(() => {
    const grouped = new Map<string, RetroCard[]>()
    const normalizedSearch = search.trim().toLowerCase()
    const sortMode = localSortOrder

    columns.forEach((column) => grouped.set(column.id, []))

    Object.values(board?.cards || {}).forEach((card) => {
      const matches =
        !normalizedSearch ||
        card.content.toLowerCase().includes(normalizedSearch) ||
        card.author.toLowerCase().includes(normalizedSearch)

      if (!matches) {
        return
      }

      const list = grouped.get(card.columnId) || []
      list.push(card)
      grouped.set(card.columnId, list)
    })

    for (const [columnId, cards] of grouped.entries()) {
      grouped.set(columnId, getSortedCards(cards, sortMode))
    }

    return grouped
  }, [board?.cards, columns, localSortOrder, search])

  const participantVotesUsed = useMemo(() => {
    return Object.values(board?.cards || {}).reduce((sum, card) => {
      return card.votes?.[participantId] ? sum + 1 : sum
    }, 0)
  }, [board?.cards, participantId])

  const boardStats = useMemo(() => {
    const cards = Object.values(board?.cards || {})
    const totalVotes = cards.reduce((sum, card) => sum + getCardVotes(card), 0)
    const voters = new Set<string>([participantId])

    cards.forEach((card) => {
      Object.keys(card.votes || {}).forEach((voterId) => voters.add(voterId))
      ;(card.mergedCards || []).forEach((mergedCard) => {
        Object.keys(mergedCard.votes || {}).forEach((voterId) => voters.add(voterId))
      })
    })

    const totalVotePool = voters.size * settings.maxVotesPerUser

    return {
      cardsCount: cards.length,
      totalVotes,
      participantVotes: participantVotesUsed,
      votersCount: voters.size,
      remainingVotes: Math.max(0, totalVotePool - totalVotes),
    }
  }, [board?.cards, participantId, participantVotesUsed, settings.maxVotesPerUser])

  const hostFlagsCount = useMemo(() => {
    return [
      settings.privateWriting,
      settings.presentationMode,
      settings.highlightMode,
      settings.hideVoteCount,
    ].filter(Boolean).length
  }, [settings])

  const pollOptions = useMemo(() => {
    return Object.values(board?.poll?.options || {})
  }, [board?.poll?.options])
  const pollVotesTotal = useMemo(() => {
    if (!board?.poll) {
      return 0
    }

    if (board.poll.allowMultiple) {
      return pollOptions.reduce((sum, option) => sum + Object.keys(option.votes || {}).length, 0)
    }

    const voters = new Set<string>()
    pollOptions.forEach((option) => {
      Object.keys(option.votes || {}).forEach((voterId) => voters.add(voterId))
    })

    return voters.size
  }, [board?.poll, pollOptions])
  const activeMobileColumnId = selectedMobileColumnId || columns[0]?.id || null
  const visibleColumns =
    isCompactView && activeMobileColumnId
      ? columns.filter((column) => column.id === activeMobileColumnId)
      : columns
  const actionColumn = columns[columns.length - 1] || null
  const actionCards = useMemo(() => {
    if (!actionColumn) {
      return []
    }

    return getSortedCards(
      Object.values(board?.cards || {}).filter((card) => card.columnId === actionColumn.id),
      localSortOrder,
    )
  }, [actionColumn, board?.cards, localSortOrder])
  const openProblemsCount = actionCards.filter(
    (card) => card.resolution?.status !== 'resolved' && card.resolution?.status !== 'canceled',
  ).length
  const resolvedProblemsCount = actionCards.length - openProblemsCount
  const currentBoardId = boardId ?? ''
  const accountRole = currentUser && board ? board.access.members[currentUser.id]?.role : null
  const isLegacyOwner = Boolean(
    board && !board.access.ownerUserId && board.ownerId && board.ownerId === participantId,
  )
  const isBoardOwner =
    Boolean(board && currentUser && board.access.ownerUserId === currentUser.id) ||
    accountRole === 'owner' ||
    isLegacyOwner ||
    Boolean(board && !board.access.ownerUserId && !board.ownerId)
  const canManageBoard = isBoardOwner || accountRole === 'editor'
  const boardRoleLabel = isBoardOwner ? 'Владелец' : canManageBoard ? 'Редактор' : 'Просмотр'
  const canControlTimer = canManageBoard || board?.timer.mode === 'idle'
  const effectiveAuthor = isAnonymousAuthor ? 'Анонимно' : author.trim() || 'Участник'

  useEffect(() => {
    if (
      !board ||
      !currentUser ||
      board.access.ownerUserId ||
      !board.ownerId ||
      board.ownerId !== participantId
    ) {
      return
    }

    const timestamp = nowIso()
    const currentMember = board.access.members[currentUser.id]
    const nextAccess: RetroBoardAccess = {
      ...board.access,
      visibility: board.access.visibility || 'public',
      ownerUserId: currentUser.id,
      members: {
        ...board.access.members,
        [currentUser.id]: {
          role: 'owner',
          displayName: currentUser.name,
          addedAt: currentMember?.addedAt || timestamp,
        },
      },
    }

    updateBoardAccess(board.id, nextAccess).catch((ownershipError) => {
      setError(
        ownershipError instanceof Error
          ? ownershipError.message
          : 'Не удалось закрепить владельца доски.',
      )
    })
  }, [board, currentUser, participantId])

  function openGifPicker(target: GifPickerTarget) {
    setGifPickerTarget(target)
    setGifSearch('')
    setGifError(null)
  }

  function closeGifPicker() {
    setGifPickerTarget(null)
    setGifResults([])
    setGifError(null)
  }

  function setGifForTarget(target: GifPickerTarget, gifUrl: string | null) {
    if (target.type === 'card-draft') {
      setDraftGifs((current) => ({ ...current, [target.id]: gifUrl }))
    } else if (target.type === 'comment-draft') {
      setCommentDraftGifs((current) => ({ ...current, [target.id]: gifUrl }))
    } else if (target.type === 'card-edit') {
      if (target.id === editingCardId) {
        setEditingGif(gifUrl)
      } else {
        setEditingSectionGifs((current) => ({ ...current, [target.id]: gifUrl }))
      }
    } else {
      setCommentEditGif(gifUrl)
    }
  }

  function getGifForTarget(target: GifPickerTarget) {
    if (target.type === 'card-draft') {
      return draftGifs[target.id] || null
    }

    if (target.type === 'comment-draft') {
      return commentDraftGifs[target.id] || null
    }

    if (target.type === 'card-edit') {
      return target.id === editingCardId ? editingGif : editingSectionGifs[target.id] || null
    }

    return commentEditGif
  }

  function handleSelectGif(gif: KlipyGif) {
    if (!gifPickerTarget) {
      return
    }

    setGifForTarget(gifPickerTarget, gif.gifUrl)
    closeGifPicker()
  }

  function handleRemoveGif(target: GifPickerTarget) {
    setGifForTarget(target, null)
  }

  function renderGifControls(target: GifPickerTarget) {
    if (!settings.allowGifs) {
      return null
    }

    const currentGif = getGifForTarget(target)
    const isOpen =
      gifPickerTarget?.type === target.type && gifPickerTarget.id === target.id

    return (
      <div className="gif-tools" data-menu-root="true">
        {currentGif ? (
          <div className="gif-preview">
            <img src={currentGif} alt="" />
            <button
              type="button"
              className="gif-preview__remove"
              aria-label="Удалить GIF"
              onClick={() => handleRemoveGif(target)}
            >
              <i className="ri-close-line" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="gif-button"
          onClick={(event) => {
            event.stopPropagation()
            if (isOpen) {
              closeGifPicker()
              return
            }

            openGifPicker(target)
          }}
        >
          GIF
        </button>
        {isOpen ? (
          <div className="gif-picker">
            <div className="gif-picker__search">
              <i className="ri-search-line" aria-hidden="true" />
              <input
                autoFocus
                value={gifSearch}
                onChange={(event) => setGifSearch(event.target.value)}
                placeholder="Search GIFs"
              />
            </div>
            <div className="gif-picker__body">
              {!klipyApiKey ? (
                <p className="gif-picker__message">Нужен VITE_KLIPY_API_KEY для Klipy.</p>
              ) : gifLoading ? (
                <p className="gif-picker__message">Ищем GIF...</p>
              ) : gifError ? (
                <p className="gif-picker__message">{gifError}</p>
              ) : gifResults.length ? (
                <div className="gif-grid">
                  {gifResults.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      className="gif-grid__item"
                      onClick={() => handleSelectGif(gif)}
                    >
                      <img src={gif.tinyUrl || gif.gifUrl} alt={gif.title} loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="gif-picker__message">Ничего не найдено.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  function openBoard(nextBoardId: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('board', nextBoardId)
    window.history.pushState(null, '', url)
    localStorage.setItem('retro-board-id', nextBoardId)
    setLoading(true)
    setBoardId(nextBoardId)
  }

  function openBoardList() {
    const url = new URL(window.location.href)
    url.searchParams.delete('board')
    window.history.pushState(null, '', url)
    setBoard(null)
    setLoading(false)
    setBoardId(null)
  }

  function persistBoardList(nextItems: BoardListItem[]) {
    writeBoardList(nextItems)
    setBoardList(nextItems)
  }

  function handleDeleteBoardFromList(boardItem: BoardListItem) {
    const nextItems = boardList.filter((item) => item.id !== boardItem.id)

    persistBoardList(nextItems)

    if (localStorage.getItem('retro-board-id') === boardItem.id) {
      localStorage.removeItem('retro-board-id')
    }

    if (boardId === boardItem.id) {
      openBoardList()
    }
  }

  function handleDropBoardListItem(targetId: string) {
    if (!boardListDragId || boardListDragId === targetId) {
      setBoardListDragId(null)
      return
    }

    persistBoardList(moveBoardListItem(boardList, boardListDragId, targetId))
    setBoardListDragId(null)
  }

  async function handleCreateBoardFromHome(event?: FormEvent) {
    event?.preventDefault()
    const title = newBoardTitle.trim()

    if (!title) {
      setIsCreateBoardOpen(true)
      return
    }

    const nextBoardId = buildId('board')
    const createdAt = nowIso()

    setSaving(true)
    setError(null)

    try {
      const nextBoard = await seedBoard(nextBoardId, participantId, title, currentUser)
      setBoardList(
        upsertBoardListItem({
          id: nextBoardId,
          title,
          updatedAt: nextBoard.updatedAt || createdAt,
          ownerUserId: nextBoard.access.ownerUserId,
          visibility: nextBoard.access.visibility,
        }),
      )
      setNewBoardTitle('')
      setIsCreateBoardOpen(false)
      openBoard(nextBoardId)
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Не удалось создать доску.',
      )
    } finally {
      setSaving(false)
    }
  }

  function requestCreateBoard() {
    setIsCreateBoardOpen(true)
    setNewBoardTitle('')
  }

  function setAuthTab(nextMode: AuthMode) {
    setAuthMode(nextMode)
    setAuthError(null)
    setCreatedAccessCode(null)
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    setCreatedAccessCode(null)

    try {
      if (authMode === 'sign-up') {
        const { user, accessCode } = await createRetroUser(authName)

        setCurrentUser(user)
        writeStoredUser(user)
        setCreatedAccessCode(accessCode)
        setAuthName('')
      } else {
        const user = await signInRetroUser(authCode)

        setCurrentUser(user)
        writeStoredUser(user)
        setAuthCode('')
      }
    } catch (authSubmitError) {
      setAuthError(
        authSubmitError instanceof Error ? authSubmitError.message : 'Не удалось войти.',
      )
    } finally {
      setAuthLoading(false)
    }
  }

  function handleSignOut() {
    setCurrentUser(null)
    writeStoredUser(null)
    setCreatedAccessCode(null)
    setAuthCode('')
  }

  function renderAccountPanel(compact = false) {
    if (currentUser) {
      return (
        <div className={`account-panel account-panel--signed-in${compact ? ' account-panel--compact' : ''}`}>
          <div className="account-user">
            <i className="ri-user-line" aria-hidden="true" />
            <span>{currentUser.name}</span>
          </div>
          {createdAccessCode ? (
            <span className="account-message">
              Код: <strong>{createdAccessCode}</strong>
            </span>
          ) : null}
          <button type="button" className="inline-secondary" onClick={handleSignOut}>
            Выйти
          </button>
        </div>
      )
    }

    return (
      <form
        className={`account-panel account-form${compact ? ' account-panel--compact' : ''}`}
        onSubmit={handleAuthSubmit}
      >
        <div className="account-tabs" role="tablist" aria-label="Аккаунт">
          <button
            type="button"
            className={authMode === 'sign-in' ? 'is-active' : ''}
            onClick={() => setAuthTab('sign-in')}
          >
            Вход
          </button>
          <button
            type="button"
            className={authMode === 'sign-up' ? 'is-active' : ''}
            onClick={() => setAuthTab('sign-up')}
          >
            Регистрация
          </button>
        </div>
        {authMode === 'sign-up' ? (
          <input
            value={authName}
            onChange={(event) => setAuthName(event.target.value)}
            placeholder="Имя"
            aria-label="Имя"
          />
        ) : (
          <input
            value={authCode}
            onChange={(event) => setAuthCode(event.target.value)}
            placeholder="Код доступа"
            aria-label="Код доступа"
          />
        )}
        <button type="submit" className="inline-secondary" disabled={authLoading}>
          {authLoading ? '...' : authMode === 'sign-in' ? 'Войти' : 'Создать'}
        </button>
        {authError ? <span className="account-message account-message--error">{authError}</span> : null}
      </form>
    )
  }

  function ownsCard(card: RetroCard | RetroMergedCard) {
    return !card.createdBy || card.createdBy === participantId
  }

  function ownsComment(comment: RetroComment) {
    return !comment.createdBy || comment.createdBy === participantId
  }

  function canEditCard(card: RetroCard | RetroMergedCard) {
    return settings.allowCardEditing && (canManageBoard || settings.everyoneCanEdit || ownsCard(card))
  }

  function canMoveCard(card: RetroCard) {
    return settings.allowCardMoving && (canManageBoard || settings.everyoneCanEdit || ownsCard(card))
  }

  function canReadCard(card: RetroCard | RetroMergedCard) {
    return !settings.privateWriting || canManageBoard || ownsCard(card)
  }

  async function runMutation(task: () => Promise<void>, optimisticBoard?: RetroBoard) {
    const previousBoard = board

    if (optimisticBoard) {
      syncBoardState(optimisticBoard)
    }

    setSaving(true)
    setError(null)

    try {
      await task()
    } catch (mutationError) {
      if (previousBoard) {
        syncBoardState(previousBoard)
      }
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Не удалось сохранить изменения.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function persistBoardTitle(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    if (!board || !canManageBoard) {
      return
    }

    const nextTitle = boardTitle.trim() || 'Ретроспектива команды'

    if (nextTitle === board?.title) {
      setBoardTitle(nextTitle)
      setIsEditingTitle(false)
      return
    }

    const optimisticBoard = {
      ...board,
      title: nextTitle,
      description: board.description || '',
      updatedAt: nowIso(),
    }

    setIsEditingTitle(false)

    await runMutation(async () => {
      await updateBoardMeta(currentBoardId, {
        title: nextTitle,
        description: board.description || '',
      })
      setIsEditingTitle(false)
    }, optimisticBoard)
  }

  async function handleCreateCard(columnId: string) {
    if (!board) {
      return
    }

    const content = drafts[columnId]?.trim()
    const gifUrl = settings.allowGifs ? draftGifs[columnId] || null : null

    if (!content && !gifUrl) {
      return
    }

    const timestamp = nowIso()
    const columnCards = Object.values(board.cards).filter((card) => card.columnId === columnId)
    const column = board.columns[columnId]
    const nextCard: RetroCard = {
      id: buildId('card'),
      createdBy: participantId,
      columnId,
      order: getNextOrder(columnCards),
      content,
      gifUrl,
      color: column?.cardColor ?? null,
      author: effectiveAuthor,
      createdAt: timestamp,
      updatedAt: timestamp,
      votes: {},
      comments: {},
    }
    const optimisticBoard = {
      ...board,
      cards: {
        ...board.cards,
        [nextCard.id]: nextCard,
      },
      updatedAt: timestamp,
    }

    setDrafts((current) => ({ ...current, [columnId]: '' }))
    setDraftGifs((current) => ({ ...current, [columnId]: null }))
    setComposerColumnId(null)

    await runMutation(async () => {
      await createCard(currentBoardId, nextCard)
      setDrafts((current) => ({ ...current, [columnId]: '' }))
      setDraftGifs((current) => ({ ...current, [columnId]: null }))
      setComposerColumnId(null)
    }, optimisticBoard)
  }

  async function handleCreateColumn() {
    if (!board || !canManageBoard) {
      return
    }

    if (!newColumnTitle.trim()) {
      return
    }

    const order = getNextOrder(columns)
    const paletteColor = cardPalette[(order % (cardPalette.length - 1)) + 1]?.id ?? 'green'
    const nextColumn: RetroColumn = {
      id: buildId('column'),
      title: newColumnTitle.trim(),
      accent: '#d6dce8',
      cardColor: paletteColor,
      prompt: 'Опишите основные мысли команды',
      order,
    }
    const optimisticBoard = {
      ...board,
      columns: {
        ...board.columns,
        [nextColumn.id]: nextColumn,
      },
      updatedAt: nowIso(),
    }

    setNewColumnTitle('')

    await runMutation(async () => {
      await createColumn(currentBoardId, nextColumn)
      setNewColumnTitle('')
    }, optimisticBoard)
  }

  function openPollEditor(poll?: RetroPoll | null) {
    if (!canManageBoard) {
      return
    }

    setPollDraft(
      poll
        ? {
            title: poll.title,
            description: poll.description || '',
            isOpen: poll.isOpen,
            isVisible: poll.isVisible,
            allowMultiple: poll.allowMultiple,
            preset: poll.preset,
            options: Object.values(poll.options || {}).map((option) => option.label),
          }
        : defaultPollDraft,
    )
    setIsBoardMenuOpen(false)
    setIsHostPanelOpen(false)
    setIsPollVotingOpen(false)
    setIsPollEditorOpen(true)
  }

  function startEditingCard(card: RetroCard) {
    if (!canEditCard(card)) {
      return
    }

    setEditingCardId(card.id)
    setEditingText(card.content)
    setEditingGif(card.gifUrl || null)
    setEditingSectionTexts(
      Object.fromEntries((card.mergedCards || []).map((section) => [section.id, section.content])),
    )
    setEditingSectionGifs(
      Object.fromEntries((card.mergedCards || []).map((section) => [section.id, section.gifUrl || null])),
    )
    setActiveCardMenuId(null)
  }

  function updatePollOption(index: number, value: string) {
    setPollDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    }))
  }

  function addPollOption() {
    setPollDraft((current) => ({
      ...current,
      options: [...current.options, ''],
    }))
  }

  function removePollOption(index: number) {
    setPollDraft((current) => ({
      ...current,
      options:
        current.options.length > 2
          ? current.options.filter((_, optionIndex) => optionIndex !== index)
          : current.options,
    }))
  }

  async function handleSavePoll() {
    if (!board || !canManageBoard) {
      return
    }

    const nextPoll = buildPollFromDraft(pollDraft, board.poll)
    const optimisticBoard = {
      ...board,
      poll: nextPoll,
      updatedAt: nowIso(),
    }

    setIsPollEditorOpen(false)
    setShowPollResults(false)
    setIsPollVotingOpen(true)

    await runMutation(async () => {
      await setPoll(currentBoardId, nextPoll)
      setIsPollEditorOpen(false)
      setShowPollResults(false)
      setIsPollVotingOpen(true)
    }, optimisticBoard)
  }

  async function handleDeletePoll() {
    if (!board || !canManageBoard) {
      return
    }

    const optimisticBoard = {
      ...board,
      poll: null,
      updatedAt: nowIso(),
    }

    setIsPollEditorOpen(false)
    setIsPollVotingOpen(false)
    setShowPollResults(false)

    await runMutation(async () => {
      await setPoll(currentBoardId, null)
      setIsPollEditorOpen(false)
      setIsPollVotingOpen(false)
      setShowPollResults(false)
    }, optimisticBoard)
  }

  async function handleSaveColumn(columnId: string) {
    if (!board || !canManageBoard) {
      return
    }

    const currentTitle = board?.columns[columnId]?.title || 'Колонка'
    const title = columnTitleDrafts[columnId]?.trim() || currentTitle

    if (title === currentTitle) {
      setColumnTitleDrafts((current) => ({ ...current, [columnId]: currentTitle }))
      setEditingColumnId(null)
      setActiveColumnMenuId(null)
      return
    }

    const optimisticBoard = {
      ...board,
      columns: {
        ...board.columns,
        [columnId]: {
          ...board.columns[columnId],
          title,
        },
      },
      updatedAt: nowIso(),
    }

    setEditingColumnId(null)
    setActiveColumnMenuId(null)

    await runMutation(async () => {
      await updateColumn(currentBoardId, columnId, { title })
      setEditingColumnId(null)
      setActiveColumnMenuId(null)
    }, optimisticBoard)
  }

  async function handleColumnColorChange(columnId: string, color: CardColor) {
    if (!board || !canManageBoard) {
      return
    }

    if (board?.columns[columnId]?.cardColor === color) {
      setActiveColumnMenuId(null)
      return
    }

    const optimisticBoard = {
      ...board,
      columns: {
        ...board.columns,
        [columnId]: {
          ...board.columns[columnId],
          cardColor: color,
        },
      },
      updatedAt: nowIso(),
    }

    setActiveColumnMenuId(null)

    await runMutation(async () => {
      await updateColumn(currentBoardId, columnId, { cardColor: color })
      setActiveColumnMenuId(null)
    }, optimisticBoard)
  }

  async function handleBoardSettingsChange(nextSettings: RetroBoardSettings) {
    if (!board || !canManageBoard) {
      return
    }

    const optimisticBoard = {
      ...board,
      settings: nextSettings,
      updatedAt: nowIso(),
    }

    setSettings(nextSettings)

    await runMutation(async () => {
      await updateBoardSettings(currentBoardId, nextSettings)
    }, optimisticBoard)
  }

  async function handleBoardSettingToggle(
    key: EditableSettingKey,
    value: boolean,
  ) {
    await handleBoardSettingsChange({
      ...settings,
      [key]: value,
    })
  }

  async function handleMaxVotesChange(delta: number) {
    await handleBoardSettingsChange({
      ...settings,
      maxVotesPerUser: Math.min(20, Math.max(1, settings.maxVotesPerUser + delta)),
    })
  }

  async function handleDeleteColumn(columnId: string) {
    if (!board || !canManageBoard) {
      return
    }

    const nextCards = Object.fromEntries(
      Object.entries(board.cards).filter(([, card]) => card.columnId !== columnId),
    )
    const nextColumns = { ...board.columns }
    delete nextColumns[columnId]
    const optimisticBoard = {
      ...board,
      columns: nextColumns,
      cards: nextCards,
      updatedAt: nowIso(),
    }

    setActiveColumnMenuId(null)
    setComposerColumnId((current) => (current === columnId ? null : current))

    await runMutation(async () => {
      await deleteColumn(currentBoardId, columnId, nextCards)
      setActiveColumnMenuId(null)
      setComposerColumnId((current) => (current === columnId ? null : current))
    }, optimisticBoard)
  }

  async function handleToggleCardVote(card: RetroCard, columnCards: RetroCard[]) {
    if (!board) {
      return
    }

    const hasVoted = Boolean(card.votes?.[participantId])
    const usedVotes =
      settings.voteScope === 'column'
        ? columnCards.reduce(
            (sum, scopedCard) => (scopedCard.votes?.[participantId] ? sum + 1 : sum),
            0,
          )
        : participantVotesUsed

    if (
      !hasVoted &&
      settings.allowVoting &&
      usedVotes >= settings.maxVotesPerUser
    ) {
      setVoteLimitWarning(
        `Лимит голосов исчерпан: максимум ${settings.maxVotesPerUser}.`,
      )
      return
    }

    const nextVotes = { ...(card.votes || {}) }

    if (hasVoted) {
      delete nextVotes[participantId]
    } else {
      nextVotes[participantId] = true
    }

    const optimisticBoard = replaceBoardCard(board, card.id, {
      ...card,
      votes: nextVotes,
      updatedAt: nowIso(),
    })

    await runMutation(async () => {
      await toggleVote(currentBoardId, card.id, participantId, hasVoted)
    }, optimisticBoard)
  }

  async function handleToggleCardReaction(card: RetroCard, reaction: string) {
    if (!board || !settings.enableReactions) {
      return
    }

    const currentReaction = { ...(card.reactions?.[reaction] || {}) }

    if (currentReaction[participantId]) {
      delete currentReaction[participantId]
    } else {
      currentReaction[participantId] = true
    }

    const reactions = {
      ...(card.reactions || {}),
      [reaction]: currentReaction,
    }
    const optimisticBoard = replaceBoardCard(board, card.id, {
      ...card,
      reactions,
      updatedAt: nowIso(),
    })

    await runMutation(async () => {
      await updateCard(currentBoardId, card.id, { reactions })
    }, optimisticBoard)
  }

  async function handleCardComment(cardId: string) {
    const message = commentDrafts[cardId]?.trim()
    const gifUrl = settings.allowGifs ? commentDraftGifs[cardId] || null : null

    if (!message && !gifUrl) {
      return
    }

    if (!board?.cards[cardId] || !settings.allowComments) {
      return
    }

    const comment = {
      id: buildId('comment'),
      createdBy: participantId,
      author: effectiveAuthor,
      message,
      gifUrl,
      createdAt: nowIso(),
    }
    const card = board.cards[cardId]
    const optimisticBoard = replaceBoardCard(board, cardId, {
      ...card,
      comments: {
        ...(card.comments || {}),
        [comment.id]: comment,
      },
      updatedAt: nowIso(),
    })

    setCommentDrafts((current) => ({ ...current, [cardId]: '' }))
    setCommentDraftGifs((current) => ({ ...current, [cardId]: null }))
    setExpandedCards((current) => ({ ...current, [cardId]: true }))

    await runMutation(async () => {
      await addComment(currentBoardId, cardId, comment)
      setCommentDrafts((current) => ({ ...current, [cardId]: '' }))
      setCommentDraftGifs((current) => ({ ...current, [cardId]: null }))
      setExpandedCards((current) => ({ ...current, [cardId]: true }))
    }, optimisticBoard)
  }

  async function handleDeleteComment(cardId: string, comment: RetroComment) {
    if (!board || !settings.allowComments || (!canManageBoard && !ownsComment(comment))) {
      return
    }

    const card = board.cards[cardId]

    if (!card) {
      return
    }

    const nextComments = { ...(card.comments || {}) }
    let nextMergedCards = card.mergedCards

    if (nextComments[comment.id]) {
      delete nextComments[comment.id]
    } else {
      nextMergedCards = (card.mergedCards || []).map((section) => {
        if (!section.comments?.[comment.id]) {
          return section
        }

        const sectionComments = { ...section.comments }
        delete sectionComments[comment.id]
        return { ...section, comments: sectionComments, updatedAt: nowIso() }
      })
    }

    const nextCard = {
      ...card,
      comments: nextComments,
      mergedCards: nextMergedCards?.length ? nextMergedCards : undefined,
      updatedAt: nowIso(),
    }
    const optimisticBoard = replaceBoardCard(board, cardId, nextCard)

    await runMutation(async () => {
      await updateCard(currentBoardId, cardId, {
        comments: nextComments,
        mergedCards: nextMergedCards?.length ? nextMergedCards : undefined,
      })
    }, optimisticBoard)
  }

  function startEditingComment(cardId: string, comment: RetroComment) {
    if (!settings.allowComments || (!canManageBoard && !ownsComment(comment))) {
      return
    }

    setCommentEditState({ cardId, commentId: comment.id })
    setCommentEditText(comment.message)
    setCommentEditGif(comment.gifUrl || null)
  }

  function cancelEditingComment() {
    setCommentEditState(null)
    setCommentEditText('')
    setCommentEditGif(null)
  }

  async function handleSaveComment(cardId: string, comment: RetroComment) {
    const message = commentEditText.trim()
    const gifUrl = settings.allowGifs ? commentEditGif || null : comment.gifUrl || null

    if (!board || (!message && !gifUrl) || (!canManageBoard && !ownsComment(comment))) {
      return
    }

    const card = board.cards[cardId]

    if (!card) {
      return
    }

    const nextComment = { ...comment, message, gifUrl }
    const nextComments = { ...(card.comments || {}) }
    let nextMergedCards = card.mergedCards

    if (nextComments[comment.id]) {
      nextComments[comment.id] = nextComment
    } else {
      nextMergedCards = (card.mergedCards || []).map((section) => {
        if (!section.comments?.[comment.id]) {
          return section
        }

        return {
          ...section,
          comments: {
            ...section.comments,
            [comment.id]: nextComment,
          },
          updatedAt: nowIso(),
        }
      })
    }

    const nextCard = {
      ...card,
      comments: nextComments,
      mergedCards: nextMergedCards?.length ? nextMergedCards : undefined,
      updatedAt: nowIso(),
    }
    const optimisticBoard = replaceBoardCard(board, cardId, nextCard)

    cancelEditingComment()

    await runMutation(async () => {
      await updateCard(currentBoardId, cardId, {
        comments: nextComments,
        mergedCards: nextMergedCards?.length ? nextMergedCards : undefined,
      })
      cancelEditingComment()
    }, optimisticBoard)
  }

  async function handleSaveCard(card: RetroCard) {
    if (!board || !canEditCard(card)) {
      return
    }

    const content = editingText.trim()
    const gifUrl = settings.allowGifs ? editingGif || null : card.gifUrl || null
    const mergedCards = (card.mergedCards || []).map((section) => ({
      ...section,
      content: (editingSectionTexts[section.id] ?? section.content).trim(),
      gifUrl: settings.allowGifs
        ? editingSectionGifs[section.id] ?? section.gifUrl ?? null
        : section.gifUrl ?? null,
      updatedAt: nowIso(),
    }))

    if ((!content && !gifUrl) || mergedCards.some((section) => !section.content && !section.gifUrl)) {
      return
    }

    const optimisticBoard = replaceBoardCard(board, card.id, {
      ...card,
      content,
      gifUrl,
      mergedCards: mergedCards.length ? mergedCards : undefined,
      updatedAt: nowIso(),
    })

    setEditingCardId(null)
    setEditingText('')
    setEditingGif(null)
    setEditingSectionTexts({})
    setEditingSectionGifs({})

    await runMutation(async () => {
      await updateCard(currentBoardId, card.id, {
        content,
        gifUrl,
        mergedCards: mergedCards.length ? mergedCards : undefined,
      })
      setEditingCardId(null)
      setEditingText('')
      setEditingGif(null)
      setEditingSectionTexts({})
      setEditingSectionGifs({})
    }, optimisticBoard)
  }

  async function handleDeleteCard(cardId: string) {
    if (!board) {
      return
    }

    const deletedCard = board.cards[cardId]

    if (!deletedCard || !canEditCard(deletedCard)) {
      return
    }

    const nextCards = { ...board.cards }
    delete nextCards[cardId]

    Object.values(nextCards)
      .filter((card) => card.columnId === deletedCard.columnId)
      .sort((left, right) => left.order - right.order)
      .forEach((card, order) => {
        nextCards[card.id] = { ...card, order }
      })

    const optimisticBoard = {
      ...board,
      cards: nextCards,
      updatedAt: nowIso(),
    }

    setActiveCardMenuId(null)

    await runMutation(async () => {
      await deleteCard(currentBoardId, cardId)
      setActiveCardMenuId(null)
    }, optimisticBoard)
  }

  async function handleMoveCard(
    cardId: string,
    columnId: string,
    targetCardId: string | null = null,
    position: 'before' | 'after' = 'after',
  ) {
    if (!board || !settings.allowCardMoving) {
      return
    }

    const movingCard = board.cards[cardId]

    if (!movingCard || !canMoveCard(movingCard)) {
      return
    }

    const nextCards = { ...board.cards }
    const destinationColumn = board.columns[columnId]
    const destinationIsActionColumn =
      columns[columns.length - 1]?.id === columnId && movingCard.columnId !== columnId
    const destinationCards = Object.values(nextCards)
      .filter((card) => card.columnId === columnId && card.id !== cardId)
      .sort((left, right) => left.order - right.order)
    const insertIndex =
      targetCardId && destinationCards.some((card) => card.id === targetCardId)
        ? destinationCards.findIndex((card) => card.id === targetCardId) +
          (position === 'after' ? 1 : 0)
        : destinationCards.length
    const movedCard = {
      ...movingCard,
      columnId,
      color: destinationColumn?.cardColor ?? movingCard.color,
      ...(destinationIsActionColumn ? { resolution: ensureResolution(movingCard) } : {}),
      updatedAt: nowIso(),
    }
    const orderedDestinationCards = [
      ...destinationCards.slice(0, insertIndex),
      movedCard,
      ...destinationCards.slice(insertIndex),
    ]

    orderedDestinationCards.forEach((card, order) => {
      nextCards[card.id] = { ...card, order }
    })

    if (movingCard.columnId !== columnId) {
      Object.values(nextCards)
        .filter((card) => card.columnId === movingCard.columnId && card.id !== cardId)
        .sort((left, right) => left.order - right.order)
        .forEach((card, order) => {
          nextCards[card.id] = { ...card, order }
        })
    }

    const optimisticBoard = {
      ...board,
      cards: nextCards,
      updatedAt: nowIso(),
    }

    setLocalSortOrder('order')
    localStorage.setItem(`${SORT_STORAGE_PREFIX}-${currentBoardId}-${participantId}`, 'order')
    setDragState(null)

    await runMutation(async () => {
      await updateCards(currentBoardId, nextCards)
      setDragState(null)
    }, optimisticBoard)
  }

  async function handleMoveColumn(
    columnId: string,
    targetColumnId: string,
    position: 'before' | 'after' = 'before',
  ) {
    if (!board || !canManageBoard || columnId === targetColumnId) {
      return
    }

    const orderedColumns = columns.filter((column) => column.id !== columnId)
    const movingColumn = board.columns[columnId]
    const targetIndex = orderedColumns.findIndex((column) => column.id === targetColumnId)

    if (!movingColumn || targetIndex < 0) {
      return
    }

    orderedColumns.splice(targetIndex + (position === 'after' ? 1 : 0), 0, movingColumn)

    const nextColumns = { ...board.columns }
    const changedColumns = orderedColumns
      .map((column, order) => ({ ...column, order }))
      .filter((column) => board.columns[column.id]?.order !== column.order)

    changedColumns.forEach((column) => {
      nextColumns[column.id] = column
    })

    setColumnDragState(null)

    await runMutation(async () => {
      await Promise.all(
        changedColumns.map((column) =>
          updateColumn(currentBoardId, column.id, { order: column.order }),
        ),
      )
    }, {
      ...board,
      columns: nextColumns,
      updatedAt: nowIso(),
    })
  }

  async function handleMergeCards(sourceCardId: string, targetCardId: string) {
    if (!board || sourceCardId === targetCardId || !settings.allowCardMoving) {
      return
    }

    const sourceCard = board.cards[sourceCardId]
    const targetCard = board.cards[targetCardId]

    if (!sourceCard || !targetCard || !canMoveCard(sourceCard) || !canMoveCard(targetCard)) {
      return
    }

    const nextCards = { ...board.cards }
    const sourceMergedCards = sourceCard.mergedCards || []
    const sourceSection: RetroMergedCard = {
      id: sourceCard.id,
      createdBy: sourceCard.createdBy,
      content: sourceCard.content,
      gifUrl: sourceCard.gifUrl || null,
      color: sourceCard.color,
      author: sourceCard.author,
      createdAt: sourceCard.createdAt,
      updatedAt: sourceCard.updatedAt,
      votes: sourceCard.votes || {},
      reactions: sourceCard.reactions || {},
      comments: sourceCard.comments || {},
    }

    nextCards[targetCardId] = {
      ...targetCard,
      mergedCards: [
        ...(targetCard.mergedCards || []),
        sourceSection,
        ...sourceMergedCards,
      ],
      updatedAt: nowIso(),
    }

    delete nextCards[sourceCardId]

    Object.values(nextCards)
      .filter((card) => card.columnId === sourceCard.columnId)
      .sort((left, right) => left.order - right.order)
      .forEach((card, order) => {
        nextCards[card.id] = { ...card, order }
      })

    const optimisticBoard = {
      ...board,
      cards: nextCards,
      updatedAt: nowIso(),
    }

    setDragState(null)
    setExpandedCards((current) => ({ ...current, [targetCardId]: current[targetCardId] }))

    await runMutation(async () => {
      await updateCards(currentBoardId, nextCards)
      setDragState(null)
      setExpandedCards((current) => ({ ...current, [targetCardId]: current[targetCardId] }))
    }, optimisticBoard)
  }

  async function handleUnmergeCard(cardId: string) {
    if (!board || !settings.allowCardMoving) {
      return
    }

    const card = board.cards[cardId]

    if (!card?.mergedCards?.length || !canMoveCard(card)) {
      return
    }

    const mergedCards = card.mergedCards
    const timestamp = nowIso()
    const columnCards = Object.values(board.cards)
      .filter((columnCard) => columnCard.columnId === card.columnId)
      .sort((left, right) => left.order - right.order)
    const baseOrder = columnCards.findIndex((columnCard) => columnCard.id === card.id)
    const nextCards = { ...board.cards }

    nextCards[cardId] = {
      ...card,
      mergedCards: undefined,
      updatedAt: timestamp,
    }

    mergedCards.forEach((mergedCard, index) => {
      nextCards[mergedCard.id] = {
        id: mergedCard.id,
        createdBy: mergedCard.createdBy,
        columnId: card.columnId,
        order: baseOrder + index + 1,
        content: mergedCard.content,
        gifUrl: mergedCard.gifUrl || null,
        color: mergedCard.color,
        author: mergedCard.author,
        createdAt: mergedCard.createdAt,
        updatedAt: timestamp,
        votes: mergedCard.votes || {},
        reactions: mergedCard.reactions || {},
        comments: mergedCard.comments || {},
      }
    })

    const orderedColumnCards: RetroCard[] = []

    columnCards.forEach((columnCard) => {
      const nextColumnCard = nextCards[columnCard.id]

      if (!nextColumnCard) {
        return
      }

      orderedColumnCards.push(nextColumnCard)

      if (columnCard.id === card.id) {
        mergedCards.forEach((mergedCard) => {
          const restoredCard = nextCards[mergedCard.id]

          if (restoredCard) {
            orderedColumnCards.push(restoredCard)
          }
        })
      }
    })

    Object.values(nextCards)
      .filter((columnCard) => columnCard.columnId === card.columnId)
      .filter((columnCard) =>
        !orderedColumnCards.some((orderedCard) => orderedCard.id === columnCard.id),
      )
      .forEach((columnCard) => {
        orderedColumnCards.push(columnCard)
      })

    orderedColumnCards.forEach((columnCard, order) => {
      nextCards[columnCard.id] = { ...columnCard, order }
    })

    const optimisticBoard = {
      ...board,
      cards: nextCards,
      updatedAt: timestamp,
    }

    await runMutation(async () => {
      await updateCards(currentBoardId, nextCards)
    }, optimisticBoard)
  }

  async function updateProblemResolution(
    cardId: string,
    updater: (resolution: RetroProblemResolution, card: RetroCard) => RetroProblemResolution,
  ) {
    if (!board) {
      return
    }

    const card = board.cards[cardId]

    if (!card || !canEditCard(card)) {
      return
    }

    const nextResolution = updater(ensureResolution(card), card)
    const nextCard = {
      ...card,
      resolution: nextResolution,
      updatedAt: nowIso(),
    }
    const optimisticBoard = replaceBoardCard(board, cardId, nextCard)

    await runMutation(async () => {
      await updateCard(currentBoardId, cardId, {
        resolution: nextResolution,
      })
    }, optimisticBoard)
  }

  async function handleResolutionSummaryChange(cardId: string, summary: string) {
    await updateProblemResolution(cardId, (resolution) => ({
      ...resolution,
      summary,
      updatedAt: nowIso(),
    }))
  }

  async function handleResolutionStatusChange(
    cardId: string,
    status: ProblemStatus,
  ) {
    await updateProblemResolution(cardId, (resolution) => ({
      ...resolution,
      status,
      updatedAt: nowIso(),
    }))
  }

  async function handleResolutionStepChange(cardId: string, stepId: string, title: string) {
    await updateProblemResolution(cardId, (resolution) => ({
      ...resolution,
      steps: resolution.steps.map((step) =>
        step.id === stepId ? { ...step, title } : step,
      ),
      updatedAt: nowIso(),
    }))
  }

  async function handleResolutionStepToggle(cardId: string, stepId: string) {
    await updateProblemResolution(cardId, (resolution) => {
      const steps = resolution.steps.map((step) =>
        step.id === stepId ? { ...step, done: !step.done } : step,
      )
      const allDone = steps.length > 0 && steps.every((step) => step.done)

      return {
        ...resolution,
        steps,
        status: allDone
          ? 'resolved'
          : resolution.status === 'resolved'
            ? 'in_progress'
            : resolution.status,
        updatedAt: nowIso(),
      }
    })
  }

  async function handleAddResolutionStep(cardId: string) {
    await updateProblemResolution(cardId, (resolution) => ({
      ...resolution,
      status: resolution.status === 'resolved' ? 'in_progress' : resolution.status,
      steps: [
        ...resolution.steps,
        {
          id: buildId('step'),
          title: '',
          done: false,
          createdAt: nowIso(),
        },
      ],
      updatedAt: nowIso(),
    }))
  }

  async function handleDeleteResolutionStep(cardId: string, stepId: string) {
    await updateProblemResolution(cardId, (resolution) => ({
      ...resolution,
      steps: resolution.steps.filter((step) => step.id !== stepId),
      updatedAt: nowIso(),
    }))
  }

  async function handleResolutionStepReorder(cardId: string, stepId: string, targetStepId: string) {
    if (stepId === targetStepId) {
      setResolutionStepDragState(null)
      return
    }

    await updateProblemResolution(cardId, (resolution) => {
      const steps = [...resolution.steps]
      const fromIndex = steps.findIndex((step) => step.id === stepId)
      const toIndex = steps.findIndex((step) => step.id === targetStepId)

      if (fromIndex < 0 || toIndex < 0) {
        return resolution
      }

      const [movedStep] = steps.splice(fromIndex, 1)
      steps.splice(toIndex, 0, movedStep)

      return {
        ...resolution,
        steps,
        updatedAt: nowIso(),
      }
    })
    setResolutionStepDragState(null)
  }

  async function handleTimerMode(nextMode: 'idle' | 'running' | 'paused') {
    if (!board || !canControlTimer) {
      return
    }

    const timer =
      nextMode === 'running'
        ? {
            ...board.timer,
            mode: 'running' as const,
            startedAt: new Date().toISOString(),
          }
        : nextMode === 'paused'
          ? {
              ...board.timer,
              mode: 'paused' as const,
              remainingSeconds,
              startedAt: null,
            }
          : {
              ...board.timer,
              mode: 'idle' as const,
              remainingSeconds: board.timer.durationMinutes * 60,
              startedAt: null,
            }

    const optimisticBoard = {
      ...board,
      timer,
      updatedAt: nowIso(),
    }

    syncBoardState(optimisticBoard)

    await runMutation(async () => {
      await updateTimer(currentBoardId, timer)
    })
  }

  async function handleTimerDurationChange(deltaSeconds: number) {
    if (!board || !canControlTimer) {
      return
    }

    const currentDurationSeconds = Math.round(board.timer.durationMinutes * 60)
    const durationSeconds = Math.min(3600, Math.max(30, currentDurationSeconds + deltaSeconds))
    const durationMinutes = durationSeconds / 60
    const nextTimer = {
      ...board.timer,
      durationMinutes,
      remainingSeconds:
        board.timer.mode === 'idle' ? durationSeconds : board.timer.remainingSeconds,
    }
    const optimisticBoard = {
      ...board,
      timer: nextTimer,
      updatedAt: nowIso(),
    }

    syncBoardState(optimisticBoard)

    await runMutation(async () => {
      await updateTimer(currentBoardId, nextTimer)
    })
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    window.setTimeout(() => setCopiedLink(false), 1800)
  }

  function scrollToSolution(cardId: string) {
    const element = document.getElementById(`solution-${cardId}`)
    const container = element?.closest('.solutions-roadmap') as HTMLElement | null

    if (!element || !container) {
      return
    }

    container.scrollTo({
      top: element.offsetTop - container.offsetTop,
      behavior: 'smooth',
    })
  }

  if (!boardId) {
    return (
      <main className="home-shell">
        <header className="home-topbar">
          <img src={trackerLogo} alt="Tracker Retro" className="home-logo" />
          {renderAccountPanel()}
        </header>

        <section className="home-board-list">
          <div className="home-board-list__header">
            <h1>Доски</h1>
            <button
              type="button"
              className="inline-primary"
              onClick={requestCreateBoard}
            >
              <i className="ri-add-line" aria-hidden="true" />
              Создать доску
            </button>
          </div>

          {isCreateBoardOpen ? (
            <form className="home-create-board" onSubmit={handleCreateBoardFromHome}>
              <input
                autoFocus
                value={newBoardTitle}
                onChange={(event) => setNewBoardTitle(event.target.value)}
                placeholder="Название доски"
              />
              <button type="submit" className="inline-primary" disabled={saving}>
                Создать
              </button>
              <button
                type="button"
                className="inline-secondary"
                onClick={() => {
                  setIsCreateBoardOpen(false)
                  setNewBoardTitle('')
                }}
              >
                Отмена
              </button>
            </form>
          ) : null}

          {boardList.length ? (
            <div className="home-board-grid">
              {boardList.map((item) => (
                <article
                  key={item.id}
                  className={[
                    'home-board-item',
                    boardListDragId === item.id ? 'is-dragging' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', item.id)
                    setBoardListDragId(item.id)
                  }}
                  onDragOver={(event) => {
                    if (!boardListDragId || boardListDragId === item.id) {
                      return
                    }

                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    handleDropBoardListItem(item.id)
                  }}
                  onDragEnd={() => setBoardListDragId(null)}
                >
                  <button
                    type="button"
                    className="home-board-item__main"
                    onClick={() => openBoard(item.id)}
                  >
                    <span>{item.title || 'Ретроспектива команды'}</span>
                    <small>
                      {formatTimestamp(item.updatedAt)}
                      {currentUser?.id && item.ownerUserId === currentUser.id
                        ? ' - Владелец'
                        : ' - Просмотр'}
                    </small>
                  </button>
                  <div className="home-board-item__actions">
                    <button
                      type="button"
                      className="home-board-item__icon home-board-item__icon--danger"
                      aria-label="Удалить доску из списка"
                      onClick={() => handleDeleteBoardFromList(item)}
                    >
                      <i className="ri-delete-bin-line" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="home-empty">
              <p>{directoryLoading ? 'Загружаем доски...' : 'Пока нет сохраненных досок.'}</p>
            </div>
          )}
        </section>
      </main>
    )
  }

  if (loading) {
    return null
  }

  if (!board) {
    return <main className="status-shell">Данные доски недоступны.</main>
  }

  return (
    <main
      className={[
        'retro-shell',
        settings.presentationMode ? 'presentation-shell' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {voteLimitWarning ? (
        <div className="vote-limit-toast" role="status">
          <i className="ri-information-line" aria-hidden="true" />
          <span>{voteLimitWarning}</span>
        </div>
      ) : null}
      <header className="topbar">
        <div className="topbar__brand">
          <button
            type="button"
            className="topbar__logo-button"
            aria-label="К списку досок"
            onClick={openBoardList}
          >
            <img src={trackerLogo} alt="Tracker Retro" className="topbar__logo" />
          </button>
        </div>

        <form onSubmit={persistBoardTitle} className="board-title-form topbar__title">
          {isEditingTitle && canManageBoard ? (
            <input
              autoFocus
              className="board-title-input"
              value={boardTitle}
              onChange={(event) => setBoardTitle(event.target.value)}
              onBlur={() => {
                void persistBoardTitle()
              }}
            />
          ) : (
            <button
              type="button"
              className="board-title-display"
              onClick={() => {
                if (canManageBoard) {
                  setIsEditingTitle(true)
                }
              }}
            >
              {board.title}
            </button>
          )}
        </form>

        <div className="topbar__actions">
          <div className="account-status" title={currentUser ? currentUser.name : 'Гость'}>
            <i className={currentUser ? 'ri-user-line' : 'ri-user-smile-line'} aria-hidden="true" />
            <span>{currentUser ? currentUser.name : 'Гость'}</span>
            <small>{boardRoleLabel}</small>
          </div>
          {renderAccountPanel(true)}
          <div className="board-stats-eye" data-menu-root="true">
            <button type="button" className="topbar-icon-button" aria-label="Статистика доски">
              <i className="ri-eye-line" aria-hidden="true" />
            </button>
            <div className="board-stats-popover" role="tooltip">
              <div>
                <strong>{boardStats.cardsCount}</strong>
                <span>Карточек</span>
              </div>
              <div>
                <strong>{boardStats.totalVotes}</strong>
                <span>Голосов</span>
              </div>
              <div>
                <strong>{boardStats.participantVotes}</strong>
                <span>Ваших голосов</span>
              </div>
              <div>
                <strong>{boardStats.votersCount}</strong>
                <span>Участников</span>
              </div>
              <div>
                <strong>{boardStats.remainingVotes}</strong>
                <span>Осталось голосов</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className={[
              'author-mode-switch',
              isAnonymousAuthor ? 'is-anonymous' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={isAnonymousAuthor}
            onClick={() => setIsAnonymousAuthor((current) => !current)}
          >
            <span className="author-mode-switch__track">
              <span className="author-mode-switch__thumb" />
            </span>
            <span>{isAnonymousAuthor ? 'Анонимно' : 'С именем'}</span>
          </button>
          <label className="topbar-user">
            <i className="ri-edit-line" aria-hidden="true" />
            <input
              value={author}
              disabled={isAnonymousAuthor}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Ваше имя"
            />
          </label>
        </div>
      </header>

      <section className="board-controls">
        <div className="board-controls__left">
          <label className="search-field board-control-compact">
            <i className="ri-search-line" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск карточек"
            />
          </label>

          <div className="dropdown" data-menu-root="true">
            <button
              type="button"
              className={[
                'dropdown-trigger',
                'board-control-compact',
                isSortMenuOpen ? 'is-open' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(event) => {
                event.stopPropagation()
                setIsSortMenuOpen((current) => !current)
              }}
            >
              <i className="ri-sort-desc" aria-hidden="true" />
              <span>
                Сортировка:{' '}
                {sortOptions.find((option) => option.id === localSortOrder)?.label ||
                  'Порядок'}
              </span>
              <i className="ri-arrow-down-s-line" aria-hidden="true" />
            </button>

            {isSortMenuOpen ? (
              <div className="dropdown-menu dropdown-menu--compact">
                {sortOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={[
                      'dropdown-option',
                      localSortOrder === option.id ? 'is-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      setLocalSortOrder(option.id)
                      localStorage.setItem(
                        `${SORT_STORAGE_PREFIX}-${currentBoardId}-${participantId}`,
                        option.id,
                      )
                      setIsSortMenuOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="dropdown" data-menu-root="true">
            <button
              type="button"
              className={[
                'dropdown-trigger',
                'board-control-compact',
                'dropdown-trigger--tools',
                isBoardMenuOpen ? 'is-open' : '',
                board.timer.mode === 'running' ? 'is-timer-running' : '',
                remainingSeconds === 0 ? 'is-timer-done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(event) => {
                event.stopPropagation()
                setIsBoardMenuOpen((current) => !current)
              }}
            >
              <i className="ri-timer-flash-line" aria-hidden="true" />
              <span className="dropdown-trigger__meta">{formatDuration(remainingSeconds)}</span>
              <i className="ri-arrow-down-s-line" aria-hidden="true" />
            </button>

            {isBoardMenuOpen ? (
              <div className="dropdown-menu dropdown-menu--board">
                <section className="menu-section">
                  <div className="menu-section__header">
                    <span>Таймер</span>
                  </div>
                  <div className="menu-stepper">
                    <button
                      type="button"
                      disabled={!canControlTimer}
                      onClick={() => void handleTimerDurationChange(-30)}
                    >
                      -
                    </button>
                    <span>{formatDuration(Math.round(board.timer.durationMinutes * 60))}</span>
                    <button
                      type="button"
                      disabled={!canControlTimer}
                      onClick={() => void handleTimerDurationChange(30)}
                    >
                      +
                    </button>
                  </div>
                  <div className="menu-actions-row">
                    {board.timer.mode !== 'running' ? (
                      <button
                        type="button"
                        className="inline-primary"
                        disabled={!canControlTimer}
                        onClick={() => void handleTimerMode('running')}
                      >
                        Старт
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-secondary"
                        disabled={!canControlTimer}
                        onClick={() => void handleTimerMode('paused')}
                      >
                        Пауза
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-secondary"
                      disabled={!canControlTimer}
                      onClick={() => void handleTimerMode('idle')}
                    >
                      Сброс
                    </button>
                  </div>
                </section>

              </div>
            ) : null}
          </div>

          <div className="dropdown" data-menu-root="true">
            <button
              type="button"
              className={[
                'dropdown-trigger',
                'board-control-compact',
                isCreateMenuOpen ? 'is-open' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(event) => {
                event.stopPropagation()
                setIsCreateMenuOpen((current) => !current)
              }}
            >
              <i className="ri-add-circle-line" aria-hidden="true" />
              <span>Добавить</span>
              <i className="ri-arrow-down-s-line" aria-hidden="true" />
            </button>

            {isCreateMenuOpen ? (
              <div className="dropdown-menu dropdown-menu--board">
                <section className="menu-section">
                  <div className="menu-section__header">
                    <span>Новая колонка</span>
                  </div>
                  <div className="menu-inline-form">
                    <input
                      value={newColumnTitle}
                      disabled={!canManageBoard}
                      onChange={(event) => setNewColumnTitle(event.target.value)}
                      placeholder="Название колонки"
                    />
                    <button
                      type="button"
                      className="inline-secondary"
                      disabled={!canManageBoard}
                      onClick={() => {
                        void handleCreateColumn()
                        setIsCreateMenuOpen(false)
                      }}
                    >
                      Добавить
                    </button>
                  </div>
                </section>

                <section className="menu-section">
                  <div className="menu-section__header">
                    <span>Опрос</span>
                  </div>
                  <button
                    type="button"
                    className="dropdown-option"
                    disabled={!canManageBoard && !board.poll}
                    onClick={() => {
                      setIsCreateMenuOpen(false)
                      if (board.poll) {
                        setIsPollVotingOpen(true)
                        return
                      }

                      openPollEditor(null)
                    }}
                  >
                    <i className="ri-survey-line" aria-hidden="true" />
                    {board.poll ? board.poll.title || 'Открыть опрос' : 'Создать опрос'}
                  </button>
                </section>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={[
              'inline-secondary',
              'board-flow-button',
              workspaceView === 'solutions' ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() =>
              setWorkspaceViewWithUrl(workspaceView === 'board' ? 'solutions' : 'board')
            }
          >
            <i className="ri-route-line" aria-hidden="true" />
            <span>Решения {openProblemsCount > 0 ? `(${openProblemsCount})` : ''}</span>
          </button>
        </div>

        <div className="board-controls__right">
          <button type="button" className="inline-secondary" onClick={() => void handleCopyLink()}>
            <i className="ri-share-forward-fill" aria-hidden="true" />
            {copiedLink ? 'Ссылка скопирована' : 'Поделиться'}
          </button>
          <button
            type="button"
            className="inline-secondary"
            disabled={!canManageBoard}
            onClick={() => setIsHostPanelOpen(true)}
          >
            <i className="ri-settings-4-fill" aria-hidden="true" />
            Настройки {hostFlagsCount > 0 ? `(${hostFlagsCount})` : ''}
          </button>
        </div>
      </section>

      {error ? <div className="board-alert">{error}</div> : null}

      <div
        className={[
          'workspace-viewport',
          workspaceView === 'solutions' ? 'is-showing-solutions' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="workspace-rail">
          <section className="board-layout workspace-panel">
        {isCompactView && columns.length > 1 ? (
          <div className="column-tabs" aria-label="Переключение колонок">
            {columns.map((column) => (
              <button
                key={column.id}
                type="button"
                className={[
                  'column-tabs__button',
                  activeMobileColumnId === column.id ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedMobileColumnId(column.id)}
              >
                {column.title}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className={[
            'columns-grid',
            visibleColumns.length <= 4 ? 'columns-grid--fluid' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {visibleColumns.map((column) => {
            const cards = filteredCardsByColumn.get(column.id) || []

            return (
              <article
                className={[
                  'retro-column',
                  columnDragState?.columnId === column.id ? 'is-column-dragging' : '',
                  columnDragState?.overColumnId === column.id &&
                  columnDragState.dropPosition === 'before'
                    ? 'is-column-drop-before'
                    : '',
                  columnDragState?.overColumnId === column.id &&
                  columnDragState.dropPosition === 'after'
                    ? 'is-column-drop-after'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={column.id}
                onDragOver={(event) => {
                  if (!columnDragState || dragState || columnDragState.columnId === column.id) {
                    return
                  }

                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  const rect = event.currentTarget.getBoundingClientRect()
                  const dropPosition = event.clientX - rect.left < rect.width / 2 ? 'before' : 'after'
                  setColumnDragState((current) =>
                    current
                      ? {
                          ...current,
                          overColumnId: column.id,
                          dropPosition,
                        }
                      : current,
                  )
                }}
                onDrop={(event) => {
                  if (!columnDragState || dragState) {
                    return
                  }

                  event.preventDefault()
                  void handleMoveColumn(
                    columnDragState.columnId,
                    column.id,
                    columnDragState.dropPosition || 'before',
                  )
                }}
              >
                <header
                  className="retro-column__header"
                  draggable={canManageBoard && editingColumnId !== column.id}
                  onDragStart={(event) => {
                    if (!canManageBoard || editingColumnId === column.id) {
                      event.preventDefault()
                      return
                    }

                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', column.id)
                    setColumnDragState({
                      columnId: column.id,
                      overColumnId: null,
                      dropPosition: null,
                    })
                  }}
                  onDragEnd={() => setColumnDragState(null)}
                >
                  <div className="retro-column__title-row">
                    {editingColumnId === column.id ? (
                      <form
                        className="retro-column__title-form"
                        onSubmit={(event) => {
                          event.preventDefault()
                          void handleSaveColumn(column.id)
                        }}
                      >
                        <input
                          autoFocus
                          className="retro-column__title-input"
                          value={columnTitleDrafts[column.id] || ''}
                          onChange={(event) =>
                            setColumnTitleDrafts((current) => ({
                              ...current,
                              [column.id]: event.target.value,
                            }))
                          }
                          onBlur={() => {
                            void handleSaveColumn(column.id)
                          }}
                          placeholder="Название колонки"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="retro-column__title-display"
                        disabled={!canManageBoard}
                        onClick={() => {
                          setColumnTitleDrafts((current) => ({
                            ...current,
                            [column.id]: current[column.id] || column.title,
                          }))
                          setEditingColumnId(column.id)
                          setActiveColumnMenuId(null)
                        }}
                      >
                        {column.title}
                      </button>
                    )}
                    <div className="retro-column__header-actions">
                      <button
                        type="button"
                        className="column-menu-trigger"
                        data-menu-root="true"
                        disabled={!canManageBoard}
                        onClick={(event) => {
                          event.stopPropagation()
                          setColumnTitleDrafts((current) => ({
                            ...current,
                            [column.id]: current[column.id] || column.title,
                          }))
                          setActiveColumnMenuId((current) =>
                            current === column.id ? null : column.id,
                          )
                        }}
                      >
                        <i className="ri-more-2-fill" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  {activeColumnMenuId === column.id ? (
                    <div className="column-menu" data-menu-root="true">
                      <div className="column-menu__group">
                        <span className="column-menu__label">Цвет карточек</span>
                        <div className="card-composer__palette">
                          {cardPalette.filter((color) => color.id !== null).map((color) => (
                            <button
                              key={String(color.id)}
                              type="button"
                              aria-label={color.label}
                              className={[
                                'palette-swatch',
                                color.className,
                                column.cardColor === color.id ? 'is-active' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onClick={() => {
                                void handleColumnColorChange(column.id, color.id)
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="column-menu__actions column-menu__actions--end">
                        <button
                          type="button"
                          className="inline-danger"
                          onClick={() => void handleDeleteColumn(column.id)}
                        >
                          <i className="ri-delete-bin-line" aria-hidden="true" />
                          Удалить
                        </button>
                      </div>
                    </div>
                  ) : null}
                </header>

                <div
                  className="retro-column__cards"
                  onDragOver={(event) => {
                    if (!dragState || event.currentTarget !== event.target) {
                      return
                    }

                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDragState((current) =>
                      current
                        ? {
                            ...current,
                            overColumnId: column.id,
                            overCardId: null,
                            mode: 'move',
                            dropPosition: null,
                          }
                        : current,
                    )
                  }}
                  onDrop={(event) => {
                    event.preventDefault()

                    if (dragState?.cardId && dragState.mode === 'move') {
                      void handleMoveCard(dragState.cardId, column.id)
                    }
                  }}
                >
                  {composerColumnId !== column.id ? (
                    <button
                      type="button"
                      className="column-add-row"
                      onClick={() => setComposerColumnId(column.id)}
                      onDragOver={(event) => {
                        if (!dragState) {
                          return
                        }

                        event.preventDefault()
                        event.stopPropagation()
                        event.dataTransfer.dropEffect = 'move'
                        const firstDestinationCard =
                          cards.find((columnCard) => columnCard.id !== dragState.cardId) ?? null
                        setDragState((current) =>
                          current
                            ? {
                                ...current,
                                overColumnId: column.id,
                                overCardId: firstDestinationCard?.id ?? null,
                                mode: 'move',
                                dropPosition: firstDestinationCard ? 'before' : null,
                              }
                            : current,
                        )
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        event.stopPropagation()

                        if (dragState?.cardId) {
                          const firstDestinationCard =
                            cards.find((columnCard) => columnCard.id !== dragState.cardId) ?? null

                          void handleMoveCard(
                            dragState.cardId,
                            column.id,
                            firstDestinationCard?.id ?? null,
                            'before',
                          )
                        }
                      }}
                    >
                      <i className="ri-add-line column-add-row__plus" aria-hidden="true" />
                      <span className="column-add-row__text">Добавить карточку</span>
                    </button>
                  ) : null}
                  {composerColumnId === column.id ? (
                    <section className="card-composer card-composer--inline">
                      <textarea
                        rows={3}
                        value={drafts[column.id] || ''}
                        onInput={(event) => resizeTextarea(event.currentTarget)}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [column.id]: event.target.value,
                          }))
                        }
                        placeholder="Введите что-нибудь..."
                      />
                      <div className="card-composer__footer">
                        {renderGifControls({ type: 'card-draft', id: column.id })}
                        <div className="card-composer__actions">
                          <button
                            type="button"
                            className="inline-primary"
                            onClick={() => {
                              void handleCreateCard(column.id)
                            }}
                          >
                            Добавить карточку
                          </button>
                          <button
                            type="button"
                            className="inline-secondary"
                            onClick={() => setComposerColumnId(null)}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {cards.map((card) => {
                    const comments = getCardComments(card)
                    const sections = getCardSections(card)
                    const isExpanded =
                      expandedCards[card.id] ?? settings.showCommentsByDefault
                    const isEditing = editingCardId === card.id
                    const voteCount = getCardVotes(card)
                    const hasVoted = Boolean(card.votes?.[participantId])
                    const canEditCurrentCard = canEditCard(card)
                    const canMoveCurrentCard = canMoveCard(card)
                    const isGifPickerInsideCard =
                      gifPickerTarget?.type === 'comment-draft' && gifPickerTarget.id === card.id
                        ? true
                        : gifPickerTarget?.type === 'comment-edit' &&
                            comments.some((comment) => comment.id === gifPickerTarget.id)
                          ? true
                          : gifPickerTarget?.type === 'card-edit' &&
                              sections.some((section) => section.id === gifPickerTarget.id)

                    return (
                      <article
                        key={card.id}
                        draggable={canMoveCurrentCard && !isEditing}
                        data-card-id={card.id}
                        className={[
                          'retro-card',
                          (column.cardColor ?? card.color)
                            ? `card-tone-${column.cardColor ?? card.color}`
                            : 'card-tone-default',
                          settings.highlightMode ? 'retro-card--highlighted' : '',
                          settings.presentationMode ? 'retro-card--presentation' : '',
                          activeCardMenuId === card.id ? 'is-menu-open' : '',
                          isGifPickerInsideCard ? 'is-gif-picker-open' : '',
                          dragState?.cardId === card.id ? 'is-dragging' : '',
                          dragState?.overCardId === card.id && dragState.mode === 'merge'
                            ? 'is-merge-target'
                            : '',
                          dragState?.overCardId === card.id &&
                          dragState.mode === 'move' &&
                          dragState.dropPosition === 'before'
                            ? 'is-drop-before'
                            : '',
                          dragState?.overCardId === card.id &&
                          dragState.mode === 'move' &&
                          dragState.dropPosition === 'after'
                            ? 'is-drop-after'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', card.id)
                          const dragImage = createCardDragImage(event.currentTarget)
                          cardDragImageRef.current = dragImage
                          event.dataTransfer.setDragImage(dragImage, 24, 24)
                          setDragState({
                            cardId: card.id,
                            overColumnId: column.id,
                            overCardId: null,
                            mode: 'move',
                            dropPosition: null,
                          })
                        }}
                        onDragOver={(event) => {
                          if (!dragState || dragState.cardId === card.id) {
                            return
                          }

                          event.preventDefault()
                          event.stopPropagation()
                          event.dataTransfer.dropEffect = 'move'
                          const rect = event.currentTarget.getBoundingClientRect()
                          const relativeY = event.clientY - rect.top
                          const edgeBand = Math.min(36, rect.height * 0.3)
                          const dropPosition =
                            relativeY < edgeBand
                              ? 'before'
                              : relativeY > rect.height - edgeBand
                                ? 'after'
                                : null
                          setDragState((current) =>
                            current
                              ? {
                                  ...current,
                                  overColumnId: column.id,
                                  overCardId: card.id,
                                  mode: dropPosition ? 'move' : 'merge',
                                  dropPosition,
                                }
                              : current,
                          )
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          event.stopPropagation()

                          if (dragState?.cardId && dragState.cardId !== card.id) {
                            if (dragState.mode === 'move') {
                              void handleMoveCard(
                                dragState.cardId,
                                column.id,
                                card.id,
                                dragState.dropPosition || 'after',
                              )
                              return
                            }

                            void handleMergeCards(dragState.cardId, card.id)
                          }
                        }}
                        onDragEnd={() => {
                          setDragState(null)
                          cardDragImageRef.current?.remove()
                          cardDragImageRef.current = null
                        }}
                      >
                        <div className="retro-card__body">
                          <div className="retro-card__topline">
                            <div className="retro-card__topline-main">
                              {settings.showAuthors || settings.showCardDate ? (
                                <div className="retro-card__meta">
                                  {settings.showAuthors ? <span>{card.author}</span> : null}
                                  {settings.showCardDate ? (
                                    <span>{formatTimestamp(card.createdAt)}</span>
                                  ) : null}
                                </div>
                              ) : null}
                              {!isEditing ? (
                                <div className="retro-card__sections">
                                  {sections.map((section, sectionIndex) => (
                                    <div
                                      key={`${card.id}-${section.id}-${sectionIndex}`}
                                      className="retro-card__section"
                                    >
                                      {sectionIndex > 0 ? (
                                        <div
                                          className="retro-card__merge-divider"
                                          aria-hidden="true"
                                        />
                                      ) : null}
                                      <p className="retro-card__text">
                                        {settings.privateWriting && !canReadCard(section)
                                          ? 'Карточка скрыта до завершения сбора.'
                                          : section.content}
                                      </p>
                                      {!settings.privateWriting || canReadCard(section) ? (
                                        section.gifUrl ? (
                                          <img
                                            className="retro-card__gif"
                                            src={section.gifUrl}
                                            alt=""
                                          />
                                        ) : null
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="retro-card__menu"
                              data-menu-root="true"
                              disabled={!canEditCurrentCard && !card.mergedCards?.length}
                              onClick={(event) => {
                                event.stopPropagation()
                                setActiveCardMenuId((current) =>
                                  current === card.id ? null : card.id,
                                )
                              }}
                            >
                              <i className="ri-more-2-fill" aria-hidden="true" />
                            </button>
                            {activeCardMenuId === card.id ? (
                              <div className="retro-card__menu-popover" data-menu-root="true">
                                <button
                                  type="button"
                                  className="dropdown-option"
                                  disabled={!canEditCurrentCard}
                                  onClick={() => {
                                    startEditingCard(card)
                                  }}
                                >
                                  <i className="ri-pencil-line" aria-hidden="true" />
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  className="dropdown-option dropdown-option--danger"
                                  disabled={!canEditCurrentCard}
                                  onClick={() => {
                                    void handleDeleteCard(card.id)
                                  }}
                                >
                                  <i className="ri-delete-bin-line" aria-hidden="true" />
                                  Удалить
                                </button>
                                {card.mergedCards?.length && canMoveCurrentCard ? (
                                  <button
                                    type="button"
                                    className="dropdown-option"
                                    onClick={() => {
                                      setActiveCardMenuId(null)
                                      void handleUnmergeCard(card.id)
                                    }}
                                  >
                                    <i className="ri-scissors-cut-line" aria-hidden="true" />
                                    Разъединить
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {isEditing ? (
                            <div className="retro-card__editing">
                              {sections.map((section, sectionIndex) => (
                                <div key={section.id} className="retro-card__editing-section">
                                  {sectionIndex > 0 ? (
                                    <div
                                      className="retro-card__merge-divider"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  <textarea
                                    rows={4}
                                    value={
                                      sectionIndex === 0
                                        ? editingText
                                        : editingSectionTexts[section.id] ?? section.content
                                    }
                                    onInput={(event) => resizeTextarea(event.currentTarget)}
                                    onChange={(event) => {
                                      if (sectionIndex === 0) {
                                        setEditingText(event.target.value)
                                        return
                                      }

                                      setEditingSectionTexts((current) => ({
                                        ...current,
                                        [section.id]: event.target.value,
                                      }))
                                    }}
                                  />
                                  {renderGifControls({
                                    type: 'card-edit',
                                    id: sectionIndex === 0 ? card.id : section.id,
                                  })}
                                </div>
                              ))}
                              <div className="retro-card__editing-actions">
                                <button
                                  type="button"
                                  className="inline-secondary"
                                  onClick={() => {
                                    setEditingCardId(null)
                                    setEditingText('')
                                    setEditingGif(null)
                                    setEditingSectionTexts({})
                                    setEditingSectionGifs({})
                                  }}
                                >
                                  Отмена
                                </button>
                                <button
                                  type="button"
                                  className="inline-primary"
                                  onClick={() => {
                                    void handleSaveCard(card)
                                  }}
                                >
                                  Сохранить
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="retro-card__footer">
                            {settings.enableReactions ? (
                              <div className="retro-card__reaction-dock" data-menu-root="true">
                                <button
                                  type="button"
                                  className="retro-card__reaction-trigger"
                                  aria-label="Добавить реакцию"
                                  aria-expanded={activeReactionMenuCardId === card.id}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setActiveReactionMenuCardId((current) =>
                                      current === card.id ? null : card.id,
                                    )
                                  }}
                                >
                                  <i className="ri-emotion-line" aria-hidden="true" />
                                </button>
                                <div className="retro-card__reaction-summary">
                                  {reactionOptions.map((reaction) => {
                                    const count = getCardReactionCount(card, reaction)

                                    return count > 0 ? (
                                      <button
                                        key={reaction}
                                        type="button"
                                        className="retro-card__reaction-pill"
                                        aria-label={
                                          settings.hideVoteCount ? reaction : `${reaction}: ${count}`
                                        }
                                        onClick={() => {
                                          void handleToggleCardReaction(card, reaction)
                                        }}
                                      >
                                        <span>{reaction}</span>
                                        {!settings.hideVoteCount ? <strong>{count}</strong> : null}
                                      </button>
                                    ) : null
                                  })}
                                </div>
                                {activeReactionMenuCardId === card.id ? (
                                  <div className="retro-card__reaction-menu">
                                    {reactionOptions.map((reaction) => {
                                      const count = getCardReactionCount(card, reaction)
                                      const isActive = Boolean(card.reactions?.[reaction]?.[participantId])

                                      return (
                                        <button
                                          key={reaction}
                                          type="button"
                                          className={[
                                            'retro-card__reaction-option',
                                            isActive ? 'is-active' : '',
                                          ]
                                            .filter(Boolean)
                                            .join(' ')}
                                          aria-pressed={isActive}
                                          onClick={() => {
                                            void handleToggleCardReaction(card, reaction)
                                          }}
                                        >
                                          <span>{reaction}</span>
                                          {count > 0 && !settings.hideVoteCount ? (
                                            <strong>{count}</strong>
                                          ) : null}
                                        </button>
                                      )
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {settings.allowVoting ? (
                              <button
                                type="button"
                                className={[
                                  'retro-card__stat',
                                  'retro-card__stat--votes',
                                  hasVoted ? 'is-active' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                aria-pressed={hasVoted}
                                onClick={() => {
                                  void handleToggleCardVote(card, cards)
                                }}
                              >
                                <i className="ri-thumb-up-line retro-card__stat-icon" aria-hidden="true" />
                                {settings.hideVoteCount ? (
                                  <span className="retro-card__hidden-votes" aria-label="Голоса скрыты" />
                                ) : (
                                  <strong>{voteCount}</strong>
                                )}
                              </button>
                            ) : null}
                            {settings.allowComments ? (
                              <button
                                type="button"
                                className="retro-card__stat"
                                aria-expanded={isExpanded}
                                onClick={() =>
                                  setExpandedCards((current) => ({
                                    ...current,
                                    [card.id]: !isExpanded,
                                  }))
                                }
                              >
                                <i className="ri-chat-3-line retro-card__stat-icon" aria-hidden="true" />
                                <span className="retro-card__stat-label">Комментарии</span>
                                <strong>{comments.length}</strong>
                              </button>
                            ) : null}
                          </div>

                          {settings.allowComments && isExpanded ? (
                            <div className="retro-card__comments">
                              <div className="retro-comment-list">
                                {comments.map((comment: RetroComment) => {
                                  const canManageComment =
                                    canManageBoard || ownsComment(comment)
                                  const isEditingComment =
                                    commentEditState?.cardId === card.id &&
                                    commentEditState.commentId === comment.id

                                  return (
                                    <article key={comment.id} className="retro-comment">
                                      <div className="retro-comment__meta">
                                        <strong>{comment.author}</strong>
                                        <span>{formatTimestamp(comment.createdAt)}</span>
                                      </div>
                                      {isEditingComment ? (
                                        <div className="retro-comment__editing">
                                          <textarea
                                            rows={2}
                                            value={commentEditText}
                                            onInput={(event) => resizeTextarea(event.currentTarget)}
                                            onChange={(event) =>
                                              setCommentEditText(event.target.value)
                                            }
                                          />
                                          {renderGifControls({ type: 'comment-edit', id: comment.id })}
                                          <div className="retro-comment__editing-actions">
                                            <button
                                              type="button"
                                              className="inline-secondary"
                                              onClick={cancelEditingComment}
                                            >
                                              Отмена
                                            </button>
                                            <button
                                              type="button"
                                              className="inline-primary"
                                              onClick={() => {
                                                void handleSaveComment(card.id, comment)
                                              }}
                                            >
                                              Сохранить
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          {comment.message ? <p>{comment.message}</p> : null}
                                          {comment.gifUrl ? (
                                            <img
                                              className="retro-comment__gif"
                                              src={comment.gifUrl}
                                              alt=""
                                            />
                                          ) : null}
                                        </>
                                      )}
                                      {canManageComment && !isEditingComment ? (
                                        <div className="retro-comment__actions">
                                          <button
                                            type="button"
                                            className="retro-comment__icon-button"
                                            aria-label="Редактировать комментарий"
                                            onClick={() => startEditingComment(card.id, comment)}
                                          >
                                            <i className="ri-pencil-line" aria-hidden="true" />
                                          </button>
                                          <button
                                            type="button"
                                            className="retro-comment__icon-button retro-comment__icon-button--danger"
                                            aria-label="Удалить комментарий"
                                            onClick={() => {
                                              void handleDeleteComment(card.id, comment)
                                            }}
                                          >
                                            <i className="ri-delete-bin-line" aria-hidden="true" />
                                          </button>
                                        </div>
                                      ) : null}
                                    </article>
                                  )
                                })}
                                {comments.length === 0 ? (
                                  <p className="retro-comment-list__empty">
                                    Пока комментариев нет.
                                  </p>
                                ) : null}
                              </div>
                              <div className="retro-comment-form">
                                <textarea
                                  rows={2}
                                  value={commentDrafts[card.id] || ''}
                                  onInput={(event) => resizeTextarea(event.currentTarget)}
                                  onChange={(event) =>
                                    setCommentDrafts((current) => ({
                                      ...current,
                                      [card.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Введите ваш комментарий..."
                                />
                                {renderGifControls({ type: 'comment-draft', id: card.id })}
                                <button
                                  type="button"
                                  className="inline-primary"
                                  onClick={() => {
                                    void handleCardComment(card.id)
                                  }}
                                >
                                  Отправить
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                  {dragState?.overColumnId === column.id &&
                  dragState.mode === 'move' &&
                  !dragState.overCardId ? (
                    <div className="drop-insertion-line" aria-hidden="true" />
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
          </section>

          <section className="solutions-flow workspace-panel" aria-label="Флоу решения проблем">
            <div className="solutions-metrics" aria-label="Сводка решений">
              <div>
                <strong>{actionCards.length}</strong>
                <span>в работе</span>
              </div>
              <div>
                <strong>{openProblemsCount}</strong>
                <span>открыто</span>
              </div>
              <div>
                <strong>{resolvedProblemsCount}</strong>
                <span>решено</span>
              </div>
            </div>

            {actionCards.length ? (
              <div className="solutions-workbench">
                <aside className="solutions-index" aria-label="Проблемы из последней колонки">
                  {actionCards.map((card, index) => {
                    const resolution = ensureResolution(card)
                    const progress = getResolutionProgress(resolution)

                    return (
                      <button
                        key={card.id}
                        type="button"
                        className="solutions-index__item"
                        onClick={() => scrollToSolution(card.id)}
                      >
                        <span className="solutions-index__number">{index + 1}</span>
                        <span className="solutions-index__content">
                          <strong>{card.content}</strong>
                          <small>{getResolutionStatusLabel(resolution.status)} · {progress}%</small>
                        </span>
                      </button>
                    )
                  })}
                </aside>

                <div className="solutions-roadmap">
                {actionCards.map((card) => {
                  const resolution = ensureResolution(card)
                  const sections = getCardSections(card)
                  const progress = getResolutionProgress(resolution)
                  const canEditProblem = canEditCard(card)

                  return (
                    <article
                      id={`solution-${card.id}`}
                      key={card.id}
                      className={[
                        'solution-item',
                        getResolutionStatusClass(resolution.status),
                        resolution.status === 'resolved' ? 'is-resolved' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="solution-item__rail">
                        <span />
                      </div>

                      <div className="solution-item__main">
                        {resolution.status === 'resolved' ? <SolutionFirework /> : null}
                        <div className="solution-item__header">
                          <div>
                            <h3>{card.content}</h3>
                          </div>
                          <div className="solution-item__header-actions">
                            <div
                              className="solution-status-box"
                              data-menu-root="true"
                            >
                              <span>Статус</span>
                              <button
                                type="button"
                                className={[
                                  'solution-status-select',
                                  getResolutionStatusClass(resolution.status),
                                  activeProblemStatusMenuId === card.id ? 'is-open' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                disabled={!canEditProblem}
                                aria-expanded={activeProblemStatusMenuId === card.id}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setActiveProblemStatusMenuId((current) =>
                                    current === card.id ? null : card.id,
                                  )
                                }}
                              >
                                <span>{getResolutionStatusLabel(resolution.status)}</span>
                                <i className="ri-arrow-down-s-line" aria-hidden="true" />
                              </button>
                              {activeProblemStatusMenuId === card.id ? (
                                <div className="solution-status-menu">
                                  {problemStatusOptions.map((option) => (
                                    <button
                                      key={option.id}
                                      type="button"
                                      className={[
                                        'solution-status-option',
                                        getResolutionStatusClass(option.id),
                                        resolution.status === option.id ? 'is-active' : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      onClick={() => {
                                        void handleResolutionStatusChange(card.id, option.id)
                                        setActiveProblemStatusMenuId(null)
                                      }}
                                    >
                                      <span className="solution-status-dot" aria-hidden="true" />
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <div className="solution-item__progress">
                              <strong>{progress}%</strong>
                              <div className="solution-progress" aria-label={`Прогресс ${progress}%`}>
                                <span style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {sections.length > 1 ? (
                          <div className="solution-sources">
                            {sections.map((section) => (
                              <span key={section.id}>{section.content}</span>
                            ))}
                          </div>
                        ) : null}

                        <div className="solution-editor-row">
                          <label className="solution-summary">
                            <span>Решение</span>
                            <textarea
                              rows={3}
                              defaultValue={resolution.summary}
                              disabled={!canEditProblem}
                              ref={(element) => {
                                if (element) {
                                  resizeTextarea(element)
                                }
                              }}
                              onInput={(event) => resizeTextarea(event.currentTarget)}
                              onBlur={(event) => {
                                void handleResolutionSummaryChange(card.id, event.target.value)
                              }}
                              placeholder="Опишите, что меняем в процессе, договоренностях или продукте"
                            />
                          </label>

                        </div>

                      <div className="solution-steps">
                        <div className="solution-steps__header">
                          <span>Шаги</span>
                          <button
                            type="button"
                            className="solution-icon-button"
                            disabled={!canEditProblem}
                            aria-label="Добавить шаг"
                            onClick={() => {
                              void handleAddResolutionStep(card.id)
                            }}
                          >
                            <i className="ri-add-line" aria-hidden="true" />
                          </button>
                        </div>

                        {resolution.steps.map((step: RetroProblemStep) => (
                          <div
                            key={step.id}
                            draggable={canEditProblem}
                            className={[
                              'solution-step',
                              step.done ? 'is-done' : '',
                              resolutionStepDragState?.stepId === step.id ? 'is-dragging' : '',
                              resolutionStepDragState?.cardId === card.id &&
                              resolutionStepDragState.overStepId === step.id
                                ? 'is-drop-target'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onDragStart={(event) => {
                              if (!canEditProblem) {
                                event.preventDefault()
                                return
                              }

                              event.dataTransfer.effectAllowed = 'move'
                              event.dataTransfer.setData('text/plain', step.id)
                              setResolutionStepDragState({
                                cardId: card.id,
                                stepId: step.id,
                                overStepId: null,
                              })
                            }}
                            onDragOver={(event) => {
                              if (
                                !resolutionStepDragState ||
                                resolutionStepDragState.cardId !== card.id ||
                                resolutionStepDragState.stepId === step.id
                              ) {
                                return
                              }

                              event.preventDefault()
                              event.dataTransfer.dropEffect = 'move'
                              setResolutionStepDragState((current) =>
                                current ? { ...current, overStepId: step.id } : current,
                              )
                            }}
                            onDrop={(event) => {
                              event.preventDefault()

                              if (
                                resolutionStepDragState?.cardId === card.id &&
                                resolutionStepDragState.stepId !== step.id
                              ) {
                                void handleResolutionStepReorder(
                                  card.id,
                                  resolutionStepDragState.stepId,
                                  step.id,
                                )
                              }
                            }}
                            onDragEnd={() => setResolutionStepDragState(null)}
                          >
                            <i className="ri-draggable" aria-hidden="true" />
                            <button
                              type="button"
                              className="solution-step__check"
                              disabled={!canEditProblem}
                              aria-label={step.done ? 'Вернуть шаг' : 'Отметить шаг'}
                              onClick={() => {
                                void handleResolutionStepToggle(card.id, step.id)
                              }}
                            >
                              <i
                                className={step.done ? 'ri-check-line' : 'ri-circle-line'}
                                aria-hidden="true"
                              />
                            </button>
                            <textarea
                              rows={1}
                              defaultValue={step.title}
                              disabled={!canEditProblem}
                              ref={(element) => {
                                if (element) {
                                  resizeTextarea(element)
                                }
                              }}
                              onInput={(event) => resizeTextarea(event.currentTarget)}
                              onBlur={(event) => {
                                void handleResolutionStepChange(
                                  card.id,
                                  step.id,
                                  event.target.value,
                                )
                              }}
                              placeholder="Что нужно сделать?"
                            />
                            <button
                              type="button"
                              className="solution-icon-button"
                              disabled={!canEditProblem || resolution.steps.length <= 1}
                              aria-label="Удалить шаг"
                              onClick={() => {
                                void handleDeleteResolutionStep(card.id, step.id)
                              }}
                            >
                              <i className="ri-close-line" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                      </div>
                    </article>
                  )
                })}
                </div>
              </div>
            ) : (
              <div className="solutions-empty">
                <i className="ri-drag-drop-line" aria-hidden="true" />
                <p>
                  Перетащите карточку в последнюю колонку, и здесь появится план решения.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {isPollVotingOpen && board.poll ? (
        <div className="create-survey-container">
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Закрыть опрос"
            onClick={() => setIsPollVotingOpen(false)}
          />
          <section
            className="easy-modal easy-survey-box easy-survey-box--modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="poll-vote-title"
          >
            <div className="easy-survey-header">
              <div>
                <span className="panel-kicker">Опрос</span>
                <h2 id="poll-vote-title">{board.poll.title}</h2>
                {board.poll.description ? <p>{board.poll.description}</p> : null}
              </div>
              <div className="easy-survey-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Редактировать опрос"
                  onClick={() => openPollEditor(board.poll)}
                >
                  <i className="ri-pencil-line" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={board.poll.isOpen ? 'Закрыть голосование' : 'Открыть голосование'}
                  onClick={() => {
                    if (!board.poll) {
                      return
                    }

                    const nextPoll = { ...board.poll, isOpen: !board.poll.isOpen }
                    const optimisticBoard = {
                      ...board,
                      poll: nextPoll,
                      updatedAt: nowIso(),
                    }

                    void runMutation(async () => {
                      await setPoll(currentBoardId, nextPoll)
                    }, optimisticBoard)
                  }}
                >
                  <i
                    className={board.poll.isOpen ? 'ri-lock-unlock-line' : 'ri-lock-line'}
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  aria-label="Удалить опрос"
                  onClick={() => {
                    void handleDeletePoll()
                  }}
                >
                  <i className="ri-delete-bin-line" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Закрыть"
                  onClick={() => setIsPollVotingOpen(false)}
                >
                  <i className="ri-close-fill" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="easy-survey-options">
              {pollOptions.map((option) => {
                const votes = Object.keys(option.votes || {}).length
                const checked = Boolean(option.votes?.[participantId])
                const percent = pollVotesTotal > 0 ? Math.round((votes / pollVotesTotal) * 100) : 0
                const isBest =
                  pollVotesTotal > 0 &&
                  votes ===
                    Math.max(
                      ...pollOptions.map((pollOption) =>
                        Object.keys(pollOption.votes || {}).length,
                      ),
                    )

                if (showPollResults || !board.poll!.isOpen) {
                  return (
                    <div
                      key={option.id}
                      className={['easy-survey-result', isBest ? 'is-best' : '']
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span
                        className="easy-survey-result-background"
                        style={{ width: `${percent}%` }}
                      />
                      <span className="easy-survey-result-label">{option.label}</span>
                      <span className="easy-survey-result-votes">
                        {votes} / {percent}%
                      </span>
                    </div>
                  )
                }

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={['easy-survey-item-button', checked ? 'is-selected' : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      void votePoll(currentBoardId, board.poll!, option.id, participantId, !checked)
                    }}
                  >
                    {checked ? <i className="ri-check-line" aria-hidden="true" /> : null}
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="easy-survey-footer">
              <span>
                {pollVotesTotal} {getVotesWord(pollVotesTotal)}
                {!board.poll.isOpen ? ' - голосование закрыто' : ''}
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => setShowPollResults((current) => !current)}
              >
                {showPollResults ? 'Скрыть результат' : 'Показать результат'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isPollEditorOpen ? (
        <div className="create-survey-container">
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Закрыть редактор опроса"
            onClick={() => setIsPollEditorOpen(false)}
          />
          <section
            className="easy-modal create-survey"
            role="dialog"
            aria-modal="true"
            aria-labelledby="poll-editor-title"
          >
            <div className="create-survey__header">
              <div>
                <span className="panel-kicker">Опрос</span>
                <h2 id="poll-editor-title">
                  {board.poll ? 'Редактировать опрос' : 'Создать опрос'}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Закрыть"
                onClick={() => setIsPollEditorOpen(false)}
              >
                <i className="ri-close-fill" aria-hidden="true" />
              </button>
            </div>

            <div className="create-survey__body">
              <label className="easy-form-group">
                <span>Вопрос</span>
                <input
                  className="easy-form-input"
                  value={pollDraft.title}
                  onChange={(event) =>
                    setPollDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="За что голосуем?"
                />
              </label>

              <label className="easy-form-group">
                <span>Описание</span>
                <textarea
                  className="easy-form-input"
                  rows={3}
                  value={pollDraft.description}
                  onChange={(event) =>
                    setPollDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Контекст для команды"
                />
              </label>

              <div className="create-survey__toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={pollDraft.isOpen}
                    onChange={(event) =>
                      setPollDraft((current) => ({
                        ...current,
                        isOpen: event.target.checked,
                      }))
                    }
                  />
                  Принимать голоса
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={pollDraft.allowMultiple}
                    onChange={(event) =>
                      setPollDraft((current) => ({
                        ...current,
                        allowMultiple: event.target.checked,
                      }))
                    }
                  />
                  Можно выбрать несколько вариантов
                </label>
              </div>

              <div className="easy-form-group">
                <span>Варианты ответа</span>
                <div className="easy-column-list">
                  {pollDraft.options.map((option, index) => (
                    <div key={`option-${index}`} className="easy-column-input">
                      <span>{index + 1}</span>
                      <input
                        value={option}
                        onChange={(event) => updatePollOption(index, event.target.value)}
                        placeholder={`Вариант ${index + 1}`}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Удалить вариант"
                        disabled={pollDraft.options.length <= 2}
                        onClick={() => removePollOption(index)}
                      >
                        <i className="ri-close-line" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="inline-secondary create-survey__add"
                  onClick={addPollOption}
                >
                  <i className="ri-add-line" aria-hidden="true" />
                  Добавить вариант
                </button>
              </div>
            </div>

            <div className="create-survey__footer">
              {board.poll ? (
                <button
                  type="button"
                  className="inline-danger"
                  onClick={() => {
                    void handleDeletePoll()
                  }}
                >
                  <i className="ri-delete-bin-line" aria-hidden="true" />
                  Удалить
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
              <div className="create-survey__footer-actions">
                <button
                  type="button"
                  className="inline-secondary"
                  onClick={() => setIsPollEditorOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="inline-primary"
                  disabled={saving}
                  onClick={() => {
                    void handleSavePoll()
                  }}
                >
                  {board.poll ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isHostPanelOpen ? (
        <>
          <button
            type="button"
            className="host-panel-overlay"
            aria-label="Закрыть панель ведущего"
            onClick={() => {
              setIsHostPanelOpen(false)
            }}
          />
          <aside className="host-panel">
            <div className="host-panel__header">
              <div>
                <span className="panel-kicker">Настройки ведущего</span>
                <h2>Параметры доски</h2>
              </div>
              <button
                type="button"
                className="host-panel__close"
                onClick={() => {
                  setIsHostPanelOpen(false)
                }}
              >
                <i className="ri-close-fill" aria-hidden="true" />
              </button>
            </div>

            <div className="host-panel__body">
              <section className="host-panel__section">
                <h3>Голоса</h3>
                <label className="stepper-row">
                  <span>Голосов на участника</span>
                  <div className="mini-stepper">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleMaxVotesChange(-1)}
                    >
                      -
                    </button>
                    <strong>{settings.maxVotesPerUser}</strong>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleMaxVotesChange(1)}
                    >
                      +
                    </button>
                  </div>
                </label>
              </section>

              {settingsSections.map((section) => (
                <section key={section.title} className="host-panel__section">
                  <h3>{section.title}</h3>
                  <div className="toggle-list">
                    {section.items.map((item) => (
                      <label key={item.key} className="toggle-row">
                        <span>{item.label}</span>
                        <input
                          type="checkbox"
                          checked={settings[item.key]}
                          disabled={saving}
                          onChange={(event) => {
                            void handleBoardSettingToggle(item.key, event.target.checked)
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              ))}

              <section className="host-panel__section">
                <h3>Действия</h3>
                <div className="host-actions">
                  <button type="button" className="inline-secondary" onClick={() => void handleCopyLink()}>
                    {copiedLink ? 'Ссылка скопирована' : 'Скопировать ссылку'}
                  </button>
                  <button
                    type="button"
                    className="inline-secondary"
                    onClick={() => {
                      const nextCards = Object.fromEntries(
                        Object.entries(board.cards).map(([id, card]) => [
                          id,
                          { ...card, votes: {}, updatedAt: nowIso() },
                        ]),
                      )

                      void runMutation(async () => {
                        await resetAllVotes(currentBoardId, board.cards)
                      }, {
                        ...board,
                        cards: nextCards,
                        updatedAt: nowIso(),
                      })
                    }}
                  >
                    Сбросить голоса
                  </button>
                  <button
                    type="button"
                    className="inline-danger"
                    onClick={() => {
                      void runMutation(async () => {
                        await deleteAllCards(currentBoardId)
                      })
                    }}
                  >
                    Удалить все карточки
                  </button>
                </div>
              </section>
            </div>

          </aside>
        </>
      ) : null}
    </main>
  )
}

export default App
