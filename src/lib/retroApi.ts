import type {
  RetroBoard,
  RetroBoardAccess,
  RetroBoardDirectoryItem,
  RetroBoardSettings,
  RetroCard,
  RetroColumn,
  RetroComment,
  RetroMergedCard,
  RetroUser,
  RetroPoll,
  RetroPollOption,
  RetroTimer,
  SortMode,
} from '../types'

export const DATABASE_URL =
  'https://retro-3dcb3-default-rtdb.europe-west1.firebasedatabase.app'
export const DEFAULT_BOARD_ID = 'default-board'

const BOARD_STORAGE_KEY = 'retro-board-id'
const PARTICIPANT_STORAGE_KEY = 'retro-participant-id'

const defaultColumns: RetroColumn[] = [
  {
    id: 'went-well',
    title: 'Что прошло хорошо',
    accent: '#18c29c',
    cardColor: 'green',
    prompt: 'Что помогло команде двигаться вперед?',
    order: 0,
  },
  {
    id: 'to-improve',
    title: 'Что можно улучшить',
    accent: '#ff5c93',
    cardColor: 'pink',
    prompt: 'Что мешало и создавало трение?',
    order: 1,
  },
  {
    id: 'action-items',
    title: 'План действий',
    accent: '#8b6ff5',
    cardColor: 'violet',
    prompt: 'Какие решения забираем в следующую итерацию?',
    order: 2,
  },
]

const defaultBoardSettings: RetroBoardSettings = {
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

const defaultTimer: RetroTimer = {
  mode: 'idle',
  durationMinutes: 5,
  remainingSeconds: 300,
  startedAt: null,
}

function defaultPoll(): RetroPoll | null {
  return null
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeAccessCode(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function normalizeUserName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU')
}

function formatAccessCode(value: string) {
  return value.replace(/(.{4})/g, '$1-').replace(/-$/, '')
}

function generateAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)

  return formatAccessCode(
    Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join(''),
  )
}

async function hashAccessCode(accessCode: string) {
  const normalized = normalizeAccessCode(accessCode)

  if (!normalized) {
    throw new Error('Введите код доступа.')
  }

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized),
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function toRecord<T extends { id: string }>(items: T[]) {
  return items.reduce<Record<string, T>>((acc, item) => {
    acc[item.id] = item
    return acc
  }, {})
}

function getBoardPath(boardId: string) {
  return `/boards/${boardId}.json`
}

function getEntityPath(boardId: string, path: string) {
  return `/boards/${boardId}/${path}.json`
}

function getUserPath(userId: string) {
  return `/users/${userId}.json`
}

function getUserByCodePath(accessCodeHash: string) {
  return `/usersByAccessCode/${accessCodeHash}.json`
}

function getDirectoryPath(boardId: string) {
  return `/boardDirectory/${boardId}.json`
}

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${DATABASE_URL}${path}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Firebase request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

function localizeLegacyColumn(column: Partial<RetroColumn>, index: number): RetroColumn {
  const legacyKey = column.id || ''
  const mapped =
    legacyKey === 'wins'
      ? defaultColumns[0]
      : legacyKey === 'improve'
        ? defaultColumns[1]
        : legacyKey === 'actions'
          ? defaultColumns[2]
          : null

  return {
    id: column.id || generateId('column'),
    title: column.title || mapped?.title || `Колонка ${index + 1}`,
    accent: column.accent || mapped?.accent || '#d6dce8',
    cardColor: column.cardColor ?? mapped?.cardColor ?? null,
    prompt: column.prompt || mapped?.prompt || 'Опишите основные мысли команды',
    order: typeof column.order === 'number' ? column.order : index,
  }
}

function normalizeComment(raw: Partial<RetroComment>, id: string): RetroComment {
  return {
    id,
    createdBy: raw.createdBy || '',
    author: raw.author || 'Участник',
    message: raw.message || '',
    gifUrl: raw.gifUrl || null,
    createdAt: raw.createdAt || nowIso(),
  }
}

function normalizeMergedCard(raw: Partial<RetroMergedCard>, id: string): RetroMergedCard {
  const commentsEntries = Object.entries(raw.comments || {}).map(([commentId, comment]) => [
    commentId,
    normalizeComment(comment || {}, commentId),
  ])

  return {
    id,
    createdBy: raw.createdBy || '',
    content: raw.content || '',
    gifUrl: raw.gifUrl || null,
    color: raw.color ?? null,
    author: raw.author || 'Участник',
    createdAt: raw.createdAt || nowIso(),
    updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
    votes: raw.votes || {},
    reactions: raw.reactions || {},
    comments: Object.fromEntries(commentsEntries),
  }
}

function normalizeCard(raw: Partial<RetroCard>, id: string, fallbackOrder: number): RetroCard {
  const commentsEntries = Object.entries(raw.comments || {}).map(([commentId, comment]) => [
    commentId,
    normalizeComment(comment || {}, commentId),
  ])
  const mergedCards = Array.isArray(raw.mergedCards)
    ? raw.mergedCards.map((mergedCard, index) =>
        normalizeMergedCard(mergedCard || {}, mergedCard?.id || `${id}-merged-${index}`),
      )
    : []

  return {
    id,
    createdBy: raw.createdBy || '',
    columnId: raw.columnId || defaultColumns[0].id,
    order: typeof raw.order === 'number' ? raw.order : fallbackOrder,
    content: raw.content || '',
    gifUrl: raw.gifUrl || null,
    color: raw.color ?? null,
    author: raw.author || 'Участник',
    createdAt: raw.createdAt || nowIso(),
    updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
    votes: raw.votes || {},
    reactions: raw.reactions || {},
    comments: Object.fromEntries(commentsEntries),
    ...(mergedCards.length ? { mergedCards } : {}),
    ...(raw.resolution ? { resolution: raw.resolution } : {}),
  }
}

function normalizeTimer(raw?: Partial<RetroTimer> | null): RetroTimer {
  const durationMinutes =
    typeof raw?.durationMinutes === 'number' && raw.durationMinutes > 0
      ? raw.durationMinutes
      : defaultTimer.durationMinutes
  const remainingSeconds =
    typeof raw?.remainingSeconds === 'number'
      ? raw.remainingSeconds
      : durationMinutes * 60

  return {
    mode: raw?.mode || defaultTimer.mode,
    durationMinutes,
    remainingSeconds,
    startedAt: raw?.startedAt || null,
  }
}

function normalizePollOption(raw: Partial<RetroPollOption>, id: string): RetroPollOption {
  return {
    id,
    label: raw.label || 'Вариант',
    votes: raw.votes || {},
  }
}

function normalizePoll(raw?: Partial<RetroPoll> | null): RetroPoll | null {
  if (!raw) {
    return null
  }

  const options = Object.fromEntries(
    Object.entries(raw.options || {}).map(([id, option]) => [
      id,
      normalizePollOption(option || {}, id),
    ]),
  )
  const fallbackOptions = Object.fromEntries(
    ['Да', 'Нет'].map((label, index) => {
      const id = generateId(`option-${index + 1}`)
      return [id, { id, label, votes: {} }]
    }),
  )

  return {
    id: raw.id || generateId('poll'),
    title: raw.title || 'Голосование',
    description: raw.description || '',
    isOpen: raw.isOpen ?? true,
    isVisible: raw.isVisible ?? true,
    allowMultiple: raw.allowMultiple ?? false,
    preset: raw.preset ?? null,
    options: Object.keys(options).length ? options : fallbackOptions,
  }
}

function normalizeBoard(raw: Partial<RetroBoard> | null, boardId: string): RetroBoard {
  const normalizedColumns = Object.values(raw?.columns || {}).length
    ? Object.entries(raw?.columns || {})
        .map(([id, column], index) =>
          localizeLegacyColumn({ ...column, id }, index),
        )
        .sort((a, b) => a.order - b.order)
    : defaultColumns

  const normalizedCards = Object.entries(raw?.cards || {}).map(([id, card], index) => [
    id,
    normalizeCard(card || {}, id, index),
  ])

  const description =
    raw?.description?.trim() === 'Share wins, friction points, and the next actions for the team.'
      ? ''
      : raw?.description || ''
  const access: RetroBoardAccess = {
    visibility: raw?.access?.visibility || 'public',
    ownerUserId: raw?.access?.ownerUserId || '',
    members: raw?.access?.members || {},
  }

  return {
    id: raw?.id || boardId,
    ownerId: raw?.ownerId || '',
    access,
    title: raw?.title || 'Ретроспектива команды',
    description,
    createdAt: raw?.createdAt || nowIso(),
    updatedAt: raw?.updatedAt || raw?.createdAt || nowIso(),
    sortOrder:
      raw?.sortOrder && ['order', 'date_created', 'votes', 'random', 'user'].includes(raw.sortOrder)
        ? raw.sortOrder
        : 'order',
    settings: { ...defaultBoardSettings, ...(raw?.settings || {}) },
    columns: toRecord(normalizedColumns),
    cards: Object.fromEntries(normalizedCards),
    timer: normalizeTimer(raw?.timer),
    poll: normalizePoll(raw?.poll) ?? defaultPoll(),
  }
}

async function putBoard(boardId: string, board: RetroBoard) {
  await request(getBoardPath(boardId), {
    method: 'PUT',
    body: JSON.stringify(board),
  })
}

async function patchBoard(boardId: string, patch: Record<string, unknown>) {
  await request(getBoardPath(boardId), {
    method: 'PATCH',
    body: JSON.stringify({
      ...patch,
      updatedAt: nowIso(),
    }),
  })
}

function boardToDirectoryItem(board: RetroBoard): RetroBoardDirectoryItem {
  return {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    ownerUserId: board.access.ownerUserId || '',
    visibility: board.access.visibility || 'public',
  }
}

async function upsertBoardDirectory(board: RetroBoard) {
  if (board.access.visibility !== 'public') {
    return
  }

  await request(getDirectoryPath(board.id), {
    method: 'PUT',
    body: JSON.stringify(boardToDirectoryItem(board)),
  })
}

export async function fetchBoardDirectory() {
  const [directoryRaw, boardsRaw] = await Promise.all([
    request<Record<string, Partial<RetroBoardDirectoryItem>> | null>('/boardDirectory.json'),
    request<Record<string, Partial<RetroBoard>> | null>('/boards.json'),
  ])
  const itemsById = new Map<string, RetroBoardDirectoryItem>()
  const missingPublicBoards: RetroBoard[] = []

  Object.entries(directoryRaw || {}).forEach(([id, item]) => {
    if ((item?.visibility || 'public') !== 'public') {
      return
    }

    itemsById.set(id, {
      id: item?.id || id,
      title: item?.title || 'Ретроспектива команды',
      createdAt: item?.createdAt || item?.updatedAt || nowIso(),
      updatedAt: item?.updatedAt || nowIso(),
      ownerUserId: item?.ownerUserId || '',
      visibility: 'public',
    })
  })

  Object.entries(boardsRaw || {}).forEach(([id, raw]) => {
    const board = normalizeBoard(raw || {}, id)

    if (board.access.visibility !== 'public') {
      return
    }

    itemsById.set(id, boardToDirectoryItem(board))

    if (!directoryRaw?.[id]) {
      missingPublicBoards.push(board)
    }
  })

  if (missingPublicBoards.length) {
    await Promise.allSettled(missingPublicBoards.map((board) => upsertBoardDirectory(board)))
  }

  return Array.from(itemsById.values()).sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )
}

export async function createRetroUser(name: string) {
  const trimmedName = name.trim().replace(/\s+/g, ' ') || 'Участник'
  const normalizedName = normalizeUserName(trimmedName)
  const users = await request<Record<string, Partial<RetroUser>> | null>('/users.json')
  const hasDuplicateName = Object.values(users || {}).some(
    (user) => normalizeUserName(user?.name || '') === normalizedName,
  )

  if (hasDuplicateName) {
    throw new Error('Это имя уже занято. Выберите другое имя или войдите по коду доступа.')
  }

  const accessCode = generateAccessCode()
  const accessCodeHash = await hashAccessCode(accessCode)
  const existingUserId = await request<string | null>(getUserByCodePath(accessCodeHash))

  if (existingUserId) {
    return createRetroUser(trimmedName)
  }

  const timestamp = nowIso()
  const user: RetroUser = {
    id: generateId('user'),
    name: trimmedName,
    accessCodeHash,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await request(getUserPath(user.id), {
    method: 'PUT',
    body: JSON.stringify(user),
  })
  await request(getUserByCodePath(accessCodeHash), {
    method: 'PUT',
    body: JSON.stringify(user.id),
  })

  return { user, accessCode }
}

export async function signInRetroUser(accessCode: string) {
  const accessCodeHash = await hashAccessCode(accessCode)
  const userId = await request<string | null>(getUserByCodePath(accessCodeHash))

  if (!userId) {
    throw new Error('Код доступа не найден.')
  }

  const user = await request<RetroUser | null>(getUserPath(userId))

  if (!user) {
    throw new Error('Профиль не найден.')
  }

  return user
}

export async function seedBoard(
  boardId = DEFAULT_BOARD_ID,
  ownerId = '',
  title = 'Ретроспектива команды',
  ownerUser?: RetroUser | null,
) {
  const timestamp = nowIso()
  const access: RetroBoardAccess = {
    visibility: 'public',
    ownerUserId: ownerUser?.id || '',
    members: ownerUser
      ? {
          [ownerUser.id]: {
            role: 'owner',
            displayName: ownerUser.name,
            addedAt: timestamp,
          },
        }
      : {},
  }
  const seeded: RetroBoard = {
    id: boardId,
    ownerId,
    access,
    title,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    sortOrder: 'order',
    settings: defaultBoardSettings,
    columns: toRecord(defaultColumns),
    cards: {},
    timer: defaultTimer,
    poll: null,
  }

  await putBoard(boardId, seeded)
  await upsertBoardDirectory(seeded)
  return seeded
}

export async function fetchBoard(boardId = DEFAULT_BOARD_ID) {
  const raw = await request<RetroBoard | null>(getBoardPath(boardId))

  if (!raw) {
    return null
  }

  const normalized = normalizeBoard(raw, boardId)

  if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
    await putBoard(boardId, normalized)
  }

  return normalized
}

export function subscribeToBoard(
  boardId: string,
  onValue: (board: RetroBoard | null) => void,
  onError?: (error: Error) => void,
) {
  let active = true
  let controller: AbortController | null = null
  let snapshot: Partial<RetroBoard> | null = null

  function cloneSnapshot() {
    return snapshot ? JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown> : {}
  }

  function writeAtPath(path: string, data: unknown, merge: boolean) {
    if (path === '/') {
      if (merge && snapshot && data && typeof data === 'object') {
        snapshot = {
          ...snapshot,
          ...(data as Partial<RetroBoard>),
        }
      } else {
        snapshot = data as Partial<RetroBoard> | null
      }

      onValue(snapshot ? normalizeBoard(snapshot, boardId) : null)
      return
    }

    const root = cloneSnapshot()
    const parts = path.split('/').filter(Boolean)
    let cursor: Record<string, unknown> = root

    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index]
      const nextValue = cursor[part]

      if (!nextValue || typeof nextValue !== 'object') {
        cursor[part] = {}
      }

      cursor = cursor[part] as Record<string, unknown>
    }

    const lastPart = parts[parts.length - 1]

    if (data === null) {
      delete cursor[lastPart]
    } else if (merge && cursor[lastPart] && typeof cursor[lastPart] === 'object' && typeof data === 'object') {
      cursor[lastPart] = {
        ...(cursor[lastPart] as Record<string, unknown>),
        ...(data as Record<string, unknown>),
      }
    } else {
      cursor[lastPart] = data
    }

    snapshot = root as Partial<RetroBoard>
    onValue(normalizeBoard(snapshot, boardId))
  }

  function applyEvent(eventName: string, dataLines: string[]) {
    if (!dataLines.length || (eventName !== 'put' && eventName !== 'patch')) {
      return
    }

    const payload = JSON.parse(dataLines.join('\n')) as {
      path?: string
      data?: unknown
    }

    writeAtPath(payload.path || '/', payload.data ?? null, eventName === 'patch')
  }

  async function stream() {
    while (active) {
      try {
        controller = new AbortController()
        const response = await fetch(`${DATABASE_URL}${getBoardPath(boardId)}`, {
          headers: {
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Firebase request failed with status ${response.status}`)
        }

        if (!response.body) {
          throw new Error('Firebase stream is not readable')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let eventName = ''
        let dataLines: string[] = []

        while (active) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ''

          lines.forEach((line) => {
            if (!line) {
              applyEvent(eventName, dataLines)
              eventName = ''
              dataLines = []
              return
            }

            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim()
              return
            }

            if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trimStart())
            }
          })
        }
      } catch (error) {
        if (!active) {
          return
        }

        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        onError?.(error instanceof Error ? error : new Error('Subscription error'))
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 2500)
      })
    }
  }

  void stream()

  return () => {
    active = false
    controller?.abort()
  }
}

export async function updateBoardMeta(
  boardId: string,
  next: Pick<RetroBoard, 'title' | 'description'>,
) {
  await patchBoard(boardId, next)
  const board = await fetchBoard(boardId)

  if (board) {
    await upsertBoardDirectory(board)
  }
}

export async function updateBoardAccess(boardId: string, access: RetroBoardAccess) {
  await patchBoard(boardId, { access })
  const board = await fetchBoard(boardId)

  if (board) {
    await upsertBoardDirectory(board)
  }
}

export async function updateBoardSettings(boardId: string, settings: RetroBoardSettings) {
  await patchBoard(boardId, { settings })
}

export async function updateBoardSortOrder(boardId: string, sortOrder: SortMode) {
  await patchBoard(boardId, { sortOrder })
}

export async function createCard(
  boardId: string,
  card: RetroCard,
) {
  await request(getEntityPath(boardId, `cards/${card.id}`), {
    method: 'PUT',
    body: JSON.stringify(card),
  })
}

export async function updateCard(
  boardId: string,
  cardId: string,
  patch: Partial<RetroCard>,
) {
  await request(getEntityPath(boardId, `cards/${cardId}`), {
    method: 'PATCH',
    body: JSON.stringify({
      ...patch,
      updatedAt: nowIso(),
    }),
  })
}

export async function deleteCard(boardId: string, cardId: string) {
  await request(getEntityPath(boardId, `cards/${cardId}`), {
    method: 'DELETE',
  })
}

export async function deleteAllCards(boardId: string) {
  await patchBoard(boardId, { cards: {} })
}

export async function updateCards(boardId: string, cards: Record<string, RetroCard>) {
  await patchBoard(boardId, { cards })
}

export async function toggleVote(
  boardId: string,
  cardId: string,
  participantId: string,
  hasVoted: boolean,
) {
  const path = getEntityPath(boardId, `cards/${cardId}/votes/${participantId}`)

  await request(path, {
    method: hasVoted ? 'DELETE' : 'PUT',
    body: hasVoted ? undefined : JSON.stringify(true),
  })
}

export async function addComment(
  boardId: string,
  cardId: string,
  comment: RetroComment,
) {
  await request(getEntityPath(boardId, `cards/${cardId}/comments/${comment.id}`), {
    method: 'PUT',
    body: JSON.stringify(comment),
  })
}

export async function resetAllVotes(
  boardId: string,
  cards: Record<string, RetroCard>,
) {
  const nextCards = Object.fromEntries(
    Object.entries(cards).map(([id, card]) => [
      id,
      {
        ...card,
        votes: {},
      },
    ]),
  )

  await patchBoard(boardId, { cards: nextCards })
}

export async function createColumn(
  boardId: string,
  column: RetroColumn,
) {
  await request(getEntityPath(boardId, `columns/${column.id}`), {
    method: 'PUT',
    body: JSON.stringify(column),
  })
}

export async function updateColumn(
  boardId: string,
  columnId: string,
  patch: Partial<RetroColumn>,
) {
  await request(getEntityPath(boardId, `columns/${columnId}`), {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteColumn(
  boardId: string,
  columnId: string,
  nextCards: Record<string, RetroCard>,
) {
  await request(getEntityPath(boardId, `columns/${columnId}`), {
    method: 'DELETE',
  })
  await patchBoard(boardId, { cards: nextCards })
}

export async function updateTimer(boardId: string, timer: RetroTimer) {
  await patchBoard(boardId, { timer })
}

export async function setPoll(boardId: string, poll: RetroPoll | null) {
  await patchBoard(boardId, { poll })
}

export async function votePoll(
  boardId: string,
  poll: RetroPoll | null,
  optionId: string,
  participantId: string,
  checked: boolean,
) {
  if (!poll) {
    return
  }

  const options = Object.fromEntries(
    Object.entries(poll.options).map(([id, option]) => {
      const votes = { ...(option.votes || {}) }

      if (id === optionId) {
        if (checked) {
          votes[participantId] = true
        } else {
          delete votes[participantId]
        }
      } else if (!poll.allowMultiple) {
        delete votes[participantId]
      }

      return [id, { ...option, votes }]
    }),
  )

  await setPoll(boardId, {
    ...poll,
    options,
  })
}

export function getBoardId() {
  const url = new URL(window.location.href)
  const fromQuery = url.searchParams.get('board')

  if (fromQuery) {
    localStorage.setItem(BOARD_STORAGE_KEY, fromQuery)
    return fromQuery
  }

  return null
}

export function getParticipantId() {
  const stored = localStorage.getItem(PARTICIPANT_STORAGE_KEY)

  if (stored) {
    return stored
  }

  const id = generateId('participant')
  localStorage.setItem(PARTICIPANT_STORAGE_KEY, id)
  return id
}

function seededRandom(seed: string) {
  let value = 0

  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) >>> 0
  }

  return value / 4294967295
}

export function getSortedCards(cards: RetroCard[], sortMode: SortMode) {
  const clone = [...cards]

  switch (sortMode) {
    case 'votes':
      return clone.sort((left, right) => {
        const votesDiff =
          Object.keys(right.votes || {}).length - Object.keys(left.votes || {}).length

        if (votesDiff !== 0) {
          return votesDiff
        }

        return left.order - right.order
      })
    case 'date_created':
      return clone.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    case 'random':
      return clone.sort((left, right) => seededRandom(left.id) - seededRandom(right.id))
    case 'user':
      return clone.sort((left, right) =>
        left.author.localeCompare(right.author, 'ru', { sensitivity: 'base' }),
      )
    case 'order':
    default:
      return clone.sort((left, right) => left.order - right.order)
  }
}

export { defaultBoardSettings, normalizeBoard, patchBoard }
