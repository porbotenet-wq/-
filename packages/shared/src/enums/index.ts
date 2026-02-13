// ===========================
// STSphera — Domain Enums
// ===========================

// --- Project ---
export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

// --- Task Instance (WF-02) ---
export enum TaskInstanceStatus {
  CREATED = 'CREATED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  VERIFIED = 'VERIFIED',
  BLOCKED = 'BLOCKED',
  CANCELLED = 'CANCELLED',
}

export enum TaskInstanceType {
  TASK = 'TASK',
  DEFECT = 'DEFECT',
  MILESTONE = 'MILESTONE',
}

// --- Task Dependency ---
export enum DependencyType {
  FS = 'FS', // Finish-to-Start
  SS = 'SS', // Start-to-Start
  FF = 'FF', // Finish-to-Finish
  SF = 'SF', // Start-to-Finish
}

// --- Module Plan Item (WF-03) ---
export enum ModuleStatus {
  PLANNED = 'PLANNED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  PRODUCED = 'PRODUCED',
  SHIPPED = 'SHIPPED',
  ON_SITE = 'ON_SITE',
  MOUNTED = 'MOUNTED',
  INSPECTED = 'INSPECTED',
}

// --- Daily Work Log (WF-01) ---
export enum DailyWorkLogStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// --- Document (WF-07) ---
export enum DocumentStatus {
  DRAFT = 'DRAFT',
  ON_REVIEW = 'ON_REVIEW',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
}

export enum DocumentType {
  PHOTO = 'PHOTO',
  PDF = 'PDF',
  DOCX = 'DOCX',
  XLSX = 'XLSX',
  DWG = 'DWG',
  OTHER = 'OTHER',
}

// --- User ---
export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

// --- Priority ---
export enum Priority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

// --- Work Type ---
export enum WorkTypeStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

// --- Notification ---
export enum TriggerType {
  UI_ACTION = 'UI_ACTION',
  DATA_CHANGE = 'DATA_CHANGE',
  SCHEDULE = 'SCHEDULE',
  IMPORT = 'IMPORT',
}

export enum NotificationDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

// --- Import ---
export enum ImportStatus {
  UPLOADED = 'UPLOADED',
  VALIDATING = 'VALIDATING',
  VALIDATED = 'VALIDATED',
  IMPORTING = 'IMPORTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ImportFileType {
  GPR = 'GPR',
  PLAN_FACT = 'PLAN_FACT',
  MODULES = 'MODULES',
  SUMMARY = 'SUMMARY',
  WORK_VOLUMES = 'WORK_VOLUMES',
}

// --- RBAC Roles (from section 4) ---
export enum SystemRole {
  PROJECT_DIRECTOR = 'project_director',
  SITE_MANAGER = 'site_manager',
  FOREMAN = 'foreman',
  BRIGADIER = 'brigadier',
  QC_INSPECTOR = 'qc_inspector',
  LOGISTICS_MANAGER = 'logistics_manager',
  PRODUCTION_MANAGER = 'production_manager',
  ENGINEER = 'engineer',
  ADMIN = 'admin',
  VIEWER = 'viewer',
}

// --- GPR (WF-04) ---
export enum GprStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}
