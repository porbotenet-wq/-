-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facades" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "area_m2" DECIMAL(12,2),
    "module_count" INTEGER,
    "floors" VARCHAR(100),
    "axes" VARCHAR(100),
    "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    "planned_start" DATE,
    "planned_end" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_types" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" TEXT NOT NULL,
    "unit" VARCHAR(20),
    "phase" VARCHAR(100),
    "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_volume_contracts" (
    "id" SERIAL NOT NULL,
    "work_type_id" INTEGER NOT NULL,
    "facade_id" INTEGER,
    "contract_volume" DECIMAL(14,4) NOT NULL,
    "completed_volume" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_volume_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_work_logs" (
    "id" SERIAL NOT NULL,
    "task_instance_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "day_of_week" VARCHAR(20),
    "work_type_code" VARCHAR(50),
    "work_name" TEXT,
    "facade_id" INTEGER,
    "floor_zone" VARCHAR(100),
    "unit" VARCHAR(20),
    "plan_day" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "fact_day" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "deviation" DECIMAL(12,4),
    "pct_day" DECIMAL(7,2),
    "acc_plan" DECIMAL(14,4),
    "acc_fact" DECIMAL(14,4),
    "brigade" VARCHAR(100),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_plan_items" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "phase" VARCHAR(100),
    "module_type" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "size_mm" VARCHAR(100),
    "quantity" INTEGER NOT NULL,
    "axes_facade" VARCHAR(100),
    "facade_id" INTEGER,
    "floors" VARCHAR(100),
    "production_date" DATE,
    "shipment_date" DATE,
    "mount_date" DATE,
    "actual_production_date" DATE,
    "actual_shipment_date" DATE,
    "actual_mount_date" DATE,
    "smr_link_task_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "facade_type" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" TEXT NOT NULL,
    "work_type_id" INTEGER,
    "unit" VARCHAR(20),
    "duration_days" INTEGER,
    "default_start" DATE,
    "default_end" DATE,
    "is_section_header" BOOLEAN NOT NULL DEFAULT false,
    "section_name" TEXT,
    "parent_template_id" INTEGER,
    "sort_order" INTEGER NOT NULL,
    "default_responsible_role" VARCHAR(50),
    "phase" VARCHAR(100),
    "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_instances" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER,
    "project_id" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'TASK',
    "status" VARCHAR(20) NOT NULL DEFAULT 'CREATED',
    "assignee_id" INTEGER,
    "reviewer_id" INTEGER,
    "facade_id" INTEGER,
    "floor_zone" VARCHAR(100),
    "planned_start" DATE,
    "planned_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "planned_volume" DECIMAL(14,4),
    "actual_volume" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "completion_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "brigade" VARCHAR(100),
    "module_plan_item_id" INTEGER,
    "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" SERIAL NOT NULL,
    "predecessor_id" INTEGER NOT NULL,
    "successor_id" INTEGER NOT NULL,
    "dependency_type" VARCHAR(5) NOT NULL DEFAULT 'FS',
    "lag_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_scenarios" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "task_name" TEXT NOT NULL,
    "trigger_type" VARCHAR(20) NOT NULL,
    "notification_type" VARCHAR(100),
    "recipients_config" JSONB,
    "message_template_id" INTEGER,
    "buttons_config" JSONB,
    "escalation_config" JSONB,
    "escalation_time_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" SERIAL NOT NULL,
    "parameter" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "applies_to" VARCHAR(100),
    "is_configurable" BOOLEAN NOT NULL DEFAULT true,
    "example" TEXT,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" SERIAL NOT NULL,
    "message_type" VARCHAR(100) NOT NULL,
    "template_text" TEXT NOT NULL,
    "variables" JSONB,
    "example_filled" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" BIGSERIAL NOT NULL,
    "scenario_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" INTEGER,
    "task_instance_id" INTEGER,
    "message_text" TEXT NOT NULL,
    "buttons_json" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "telegram_message_id" BIGINT,
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "username" VARCHAR(100),
    "phone" VARCHAR(20),
    "full_name" VARCHAR(255),
    "department_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "system_name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "access_level" VARCHAR(50),
    "receives_notifications" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "facade_ids" INTEGER[],
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" INTEGER,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rbac_permissions" (
    "id" SERIAL NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "rbac_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER,
    "user_id" INTEGER,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "url" TEXT NOT NULL,
    "size_bytes" BIGINT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_document_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "entity_type" VARCHAR(50),
    "entity_id" INTEGER,
    "task_instance_id" INTEGER,
    "uploaded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL,
    "records_total" INTEGER NOT NULL DEFAULT 0,
    "records_imported" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "errors_json" JSONB,
    "warnings_json" JSONB,
    "uploaded_by" INTEGER,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_summaries" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "module_type" VARCHAR(100),
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "mounted_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "unit" VARCHAR(20),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accumulative_series" (
    "id" BIGSERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "facade_id" INTEGER,
    "metric_name" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(14,4),
    "stock_available" DECIMAL(14,4),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accumulative_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "work_types_project_id_code_key" ON "work_types"("project_id", "code");

-- CreateIndex
CREATE INDEX "daily_work_logs_date_idx" ON "daily_work_logs"("date");

-- CreateIndex
CREATE INDEX "daily_work_logs_facade_id_date_idx" ON "daily_work_logs"("facade_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_work_logs_task_instance_id_date_key" ON "daily_work_logs"("task_instance_id", "date");

-- CreateIndex
CREATE INDEX "module_plan_items_project_id_status_idx" ON "module_plan_items"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "module_plan_items_project_id_code_key" ON "module_plan_items"("project_id", "code");

-- CreateIndex
CREATE INDEX "task_instances_project_id_status_idx" ON "task_instances"("project_id", "status");

-- CreateIndex
CREATE INDEX "task_instances_assignee_id_status_idx" ON "task_instances"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "task_instances_planned_end_idx" ON "task_instances"("planned_end");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_predecessor_id_successor_id_key" ON "task_dependencies"("predecessor_id", "successor_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_scenarios_code_key" ON "notification_scenarios"("code");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_parameter_key" ON "notification_settings"("parameter");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_message_type_key" ON "message_templates"("message_type");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_created_at_idx" ON "notification_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_system_name_key" ON "roles"("system_name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_project_id_key" ON "user_roles"("user_id", "role_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "rbac_permissions_resource_action_key" ON "rbac_permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "accumulative_series_project_id_facade_id_metric_name_date_key" ON "accumulative_series"("project_id", "facade_id", "metric_name", "date");

-- AddForeignKey
ALTER TABLE "facades" ADD CONSTRAINT "facades_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_types" ADD CONSTRAINT "work_types_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_volume_contracts" ADD CONSTRAINT "work_volume_contracts_work_type_id_fkey" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_volume_contracts" ADD CONSTRAINT "work_volume_contracts_facade_id_fkey" FOREIGN KEY ("facade_id") REFERENCES "facades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_logs" ADD CONSTRAINT "daily_work_logs_task_instance_id_fkey" FOREIGN KEY ("task_instance_id") REFERENCES "task_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_logs" ADD CONSTRAINT "daily_work_logs_facade_id_fkey" FOREIGN KEY ("facade_id") REFERENCES "facades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_logs" ADD CONSTRAINT "daily_work_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_plan_items" ADD CONSTRAINT "module_plan_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_plan_items" ADD CONSTRAINT "module_plan_items_facade_id_fkey" FOREIGN KEY ("facade_id") REFERENCES "facades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_plan_items" ADD CONSTRAINT "module_plan_items_smr_link_task_id_fkey" FOREIGN KEY ("smr_link_task_id") REFERENCES "task_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_work_type_id_fkey" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_parent_template_id_fkey" FOREIGN KEY ("parent_template_id") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_facade_id_fkey" FOREIGN KEY ("facade_id") REFERENCES "facades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_module_plan_item_id_fkey" FOREIGN KEY ("module_plan_item_id") REFERENCES "module_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "task_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "task_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_scenarios" ADD CONSTRAINT "notification_scenarios_message_template_id_fkey" FOREIGN KEY ("message_template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "notification_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_task_instance_id_fkey" FOREIGN KEY ("task_instance_id") REFERENCES "task_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "rbac_permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_task_instance_id_fkey" FOREIGN KEY ("task_instance_id") REFERENCES "task_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_summaries" ADD CONSTRAINT "module_summaries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accumulative_series" ADD CONSTRAINT "accumulative_series_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accumulative_series" ADD CONSTRAINT "accumulative_series_facade_id_fkey" FOREIGN KEY ("facade_id") REFERENCES "facades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

