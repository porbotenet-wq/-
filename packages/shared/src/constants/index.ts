// ===========================
// STSphera — Constants
// ===========================

// --- Notification timing defaults (section 7.2) ---
export const NOTIFICATION_DEFAULTS = {
  MORNING_REMINDER_TIME: '08:00',
  FACT_REMINDER_TIME: '19:00',
  FACT_ESCALATION_TIME: '21:00',
  DAILY_SUMMARY_TIME: '23:00',
  OVERDUE_CHECK_TIME: '07:00',
  ESCALATION_L1_DAYS: 1,
  ESCALATION_L2_DAYS: 3,
  ESCALATION_L3_DAYS: 7,
  DEVIATION_THRESHOLD_PCT: 20,
  TASK_ACCEPT_TIMEOUT_MIN: 120,
  MODULE_ACCEPT_TIMEOUT_MIN: 240,
  DEFECT_CRITICAL_TIMEOUT_MIN: 1440,
  DOC_REVIEW_TIMEOUT_MIN: 2880,
  RETRY_COUNT: 3,
  RETRY_BACKOFF_SECONDS: [30, 60, 120],
  QUIET_HOURS_START: '23:00',
  QUIET_HOURS_END: '07:00',
} as const;

// --- Task status transitions (WF-02 guards) ---
export const TASK_STATUS_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'BLOCKED', 'CANCELLED'],
  DONE: ['VERIFIED', 'IN_PROGRESS'], // IN_PROGRESS = rework
  VERIFIED: [], // final
  BLOCKED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [], // final
};

// --- Module status transitions (WF-03) ---
export const MODULE_STATUS_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ['IN_PRODUCTION'],
  IN_PRODUCTION: ['PRODUCED'],
  PRODUCED: ['SHIPPED'],
  SHIPPED: ['ON_SITE'],
  ON_SITE: ['MOUNTED'],
  MOUNTED: ['INSPECTED'],
  INSPECTED: [], // final
};

// --- Daily work log status transitions (WF-01) ---
export const DAILY_LOG_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['REVIEW'],
  REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: [], // final
  REJECTED: ['DRAFT'],
};

// --- Document status transitions (WF-07) ---
export const DOCUMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ON_REVIEW'],
  ON_REVIEW: ['APPROVED', 'DRAFT'], // DRAFT = rejected
  APPROVED: ['ARCHIVED'],
  ARCHIVED: [], // final
};

// --- API pagination ---
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
} as const;

// --- File upload limits ---
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  MAX_PHOTO_SIZE_BYTES: 20 * 1024 * 1024, // 20MB
  ALLOWED_DOC_TYPES: ['pdf', 'docx', 'xlsx', 'dwg', 'jpg', 'jpeg', 'png'],
  ALLOWED_PHOTO_TYPES: ['jpg', 'jpeg', 'png'],
} as const;

// --- Supabase Storage buckets ---
export const STORAGE_BUCKETS = {
  FILES: 'stsphera-files',
  PHOTOS: 'stsphera-photos',
} as const;
