-- CreateTable
CREATE TABLE "tb_audit" (
    "id" TEXT NOT NULL,
    "id_user" VARCHAR(255),
    "user_name" TEXT,
    "action_type" VARCHAR(255),
    "execute_type" VARCHAR(255),
    "class" VARCHAR(255),
    "function" VARCHAR(255),
    "params" TEXT,
    "raw" TEXT,
    "table_name" VARCHAR(255),
    "diff_value" TEXT,
    "error" TEXT,
    "host" TEXT,
    "ip" TEXT,
    "base_url" TEXT,
    "method" TEXT,
    "hostname" TEXT,
    "original_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_error_log" (
    "id" TEXT NOT NULL,
    "id_user" TEXT,
    "source" TEXT,
    "error_message" TEXT,
    "error_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_error_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tb_audit_id_user_created_at_idx" ON "tb_audit"("id_user", "created_at");

-- CreateIndex
CREATE INDEX "tb_audit_created_at_idx" ON "tb_audit"("created_at");

-- CreateIndex
CREATE INDEX "tb_audit_table_name_idx" ON "tb_audit"("table_name");

-- CreateIndex
CREATE INDEX "tb_error_log_created_at_idx" ON "tb_error_log"("created_at");
