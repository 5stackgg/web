import {
  Activity,
  Ban,
  Copy,
  Download,
  FilePlus,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  ImageIcon,
  Link2,
  Lock,
  LogOut,
  MoreVertical,
  Pause,
  PenLine,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  Unlock,
  Upload,
  UserMinus,
  UserPlus,
  X,
  XCircle,
} from "lucide-vue-next";

/**
 * Canonical icon per menu action.
 *
 * One glyph per verb. Import from here instead of reaching for a lucide icon
 * directly inside a menu, so the same action never renders two different icons.
 *
 * Sizing/spacing is owned by the menu primitives (`gap-2` + `[&>svg]:size-4`).
 * Do NOT add `mr-2` or `h-4 w-4` at the call site — they are redundant, and the
 * size classes are dead code (the primitive's arbitrary variant wins on
 * specificity).
 *
 *   <DropdownMenuItem @click="remove">
 *     <component :is="menuIcons.delete" />
 *     {{ $t("common.actions.delete") }}
 *   </DropdownMenuItem>
 */
export const menuIcons = {
  // destructive
  delete: Trash2,
  cancel: XCircle,
  ban: Ban,
  close: X,

  // mutate
  edit: Pencil,
  rename: PenLine,
  copy: Copy,
  share: Share2,
  link: Link2,
  settings: Settings2,

  // lifecycle
  start: Play,
  resume: Play,
  pause: Pause,
  reset: RotateCcw,
  refresh: RefreshCw,
  lock: Lock,
  unlock: Unlock,

  // people
  promoteCaptain: Shield,
  removeMember: UserMinus,
  addMember: UserPlus,
  leave: LogOut,
  kick: UserMinus,
  coach: GraduationCap,
  challenge: Swords,

  // files & nodes
  createFile: FilePlus,
  createFolder: FolderPlus,
  openFolder: FolderOpen,
  upload: Upload,
  download: Download,
  add: Plus,
  validate: ShieldCheck,
  activity: Activity,
  image: ImageIcon,
  highlight: Sparkles,
} as const;

/** The one overflow/kebab trigger glyph. Never PaginationEllipsis. */
export const kebabIcon = MoreVertical;

export type MenuAction = keyof typeof menuIcons;
