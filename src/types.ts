export type SortMode = 'order' | 'date_created' | 'votes' | 'random' | 'user'

export interface RetroBoardSettings {
  showAuthors: boolean
  showCardDate: boolean
  allowVoting: boolean
  hideVoteCount: boolean
  allowComments: boolean
  allowCardEditing: boolean
  allowCardMoving: boolean
  privateWriting: boolean
  presentationMode: boolean
  highlightMode: boolean
  enableReactions: boolean
  allowGifs: boolean
  oneVotePerCard: boolean
  enforceSort: boolean
  allowAnonymousNames: boolean
  everyoneCanEdit: boolean
  showCommentsByDefault: boolean
  voteScope: 'board' | 'column'
  maxVotesPerUser: number
  language: 'ru' | 'en'
}

export type RetroBoardRole = 'owner' | 'editor' | 'viewer'

export interface RetroBoardMember {
  role: RetroBoardRole
  displayName: string
  addedAt: string
}

export interface RetroBoardAccess {
  visibility: 'public' | 'private'
  ownerUserId: string
  members: Record<string, RetroBoardMember>
}

export interface RetroUser {
  id: string
  name: string
  accessCodeHash: string
  createdAt: string
  updatedAt: string
}

export interface RetroBoardDirectoryItem {
  id: string
  title: string
  createdAt?: string
  updatedAt: string
  ownerId?: string
  ownerUserId: string
  members?: Record<string, RetroBoardMember>
  visibility: 'public' | 'private'
  cardsCount?: number
  preview?: RetroBoardDirectoryPreviewColumn[]
}

export interface RetroBoardDirectoryPreviewCard {
  id: string
  color: string | null
  heightUnits?: number
}

export interface RetroBoardDirectoryPreviewColumn {
  id: string
  accent: string
  cardColor: string | null
  cardsCount?: number
  cards: RetroBoardDirectoryPreviewCard[]
}

export interface RetroComment {
  id: string
  createdBy: string
  author: string
  message: string
  gifUrl?: string | null
  createdAt: string
}

export interface RetroMergedCard {
  id: string
  createdBy: string
  content: string
  gifUrl?: string | null
  color: string | null
  author: string
  createdAt: string
  updatedAt: string
  votes: Record<string, boolean>
  reactions?: Record<string, Record<string, boolean>>
  comments: Record<string, RetroComment>
}

export interface RetroCard {
  id: string
  createdBy: string
  columnId: string
  order: number
  content: string
  gifUrl?: string | null
  color: string | null
  author: string
  createdAt: string
  updatedAt: string
  votes: Record<string, boolean>
  reactions?: Record<string, Record<string, boolean>>
  comments: Record<string, RetroComment>
  mergedCards?: RetroMergedCard[]
  resolution?: RetroProblemResolution
}

export interface RetroProblemStep {
  id: string
  title: string
  done: boolean
  createdAt: string
}

export interface RetroProblemResolution {
  status: 'open' | 'in_progress' | 'resolved' | 'paused' | 'canceled'
  summary: string
  steps: RetroProblemStep[]
  updatedAt: string
}

export interface RetroColumn {
  id: string
  title: string
  accent: string
  cardColor: string | null
  prompt: string
  order: number
}

export interface RetroTimer {
  mode: 'idle' | 'running' | 'paused'
  durationMinutes: number
  remainingSeconds: number
  startedAt: string | null
}

export interface RetroPollOption {
  id: string
  label: string
  votes: Record<string, boolean>
}

export interface RetroPoll {
  id: string
  title: string
  description: string
  isOpen: boolean
  isVisible: boolean
  allowMultiple: boolean
  preset: string | null
  options: Record<string, RetroPollOption>
}

export interface RetroBoard {
  id: string
  ownerId: string
  access: RetroBoardAccess
  title: string
  description: string
  createdAt: string
  updatedAt: string
  sortOrder: SortMode
  settings: RetroBoardSettings
  columns: Record<string, RetroColumn>
  cards: Record<string, RetroCard>
  timer: RetroTimer
  poll: RetroPoll | null
}
