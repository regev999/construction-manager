-- ========================================
-- BUILD MANAGER - Supabase Schema
-- הרץ ב-Supabase SQL Editor
-- ========================================

-- 1. Users table (syncs with auth.users)
CREATE TABLE IF NOT EXISTS users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  phone      text,
  role       text NOT NULL DEFAULT 'client' CHECK (role IN ('admin','client')),
  created_at timestamptz DEFAULT now()
);

-- 2. Projects
CREATE TABLE IF NOT EXISTS projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  address         text,
  total_budget    numeric(12,2),
  start_date      date,
  target_end_date date,
  status          text DEFAULT 'active' CHECK (status IN ('active','on_hold','completed')),
  build_type      text CHECK (build_type IN ('self','turnkey')),
  location_type   text CHECK (location_type IN ('city','moshav','kibbutz','other')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Project members (for sharing with spouse/partner)
CREATE TABLE IF NOT EXISTS project_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text DEFAULT 'viewer' CHECK (role IN ('viewer','editor')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- 3. Stages
CREATE TABLE IF NOT EXISTS stages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          text NOT NULL,
  sort_order    int DEFAULT 0,
  status        text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','on_hold')),
  planned_cost  numeric(12,2),
  start_date    date,
  end_date      date,
  created_at    timestamptz DEFAULT now()
);

-- 4. Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id       uuid NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  is_completed   boolean DEFAULT false,
  is_required    boolean DEFAULT true,
  sort_order     int DEFAULT 0,
  priority       text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  planned_cost   numeric(12,2),
  actual_cost    numeric(12,2),
  contractor_id  uuid,
  due_date       date,
  completed_at   timestamptz,
  notes          text,
  why_important  text,
  what_if_skip   text,
  pro_tip        text,
  created_at     timestamptz DEFAULT now()
);

-- 5. Contractors
CREATE TABLE IF NOT EXISTS contractors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  trade       text,
  phone       text,
  email       text,
  notes       text,
  rating      int CHECK (rating BETWEEN 1 AND 5),
  created_at  timestamptz DEFAULT now()
);

-- 6. Budget Entries
CREATE TABLE IF NOT EXISTS budget_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id      uuid REFERENCES stages(id) ON DELETE SET NULL,
  task_id       uuid REFERENCES tasks(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES contractors(id) ON DELETE SET NULL,
  amount        numeric(12,2) NOT NULL,
  description   text NOT NULL,
  receipt_url   text,
  payment_date  date DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now()
);

-- 7. Documents
CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id    uuid REFERENCES stages(id) ON DELETE SET NULL,
  name        text NOT NULL,
  category    text DEFAULT 'other' CHECK (category IN ('permit','plan','receipt','contract','photo','other')),
  file_url    text NOT NULL,
  file_size   bigint,
  mime_type   text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users: each user sees their own record
CREATE POLICY "users_own" ON users FOR ALL USING (id = auth.uid());

-- Projects: admin sees all their projects, client sees their project
CREATE POLICY "projects_admin" ON projects FOR ALL
  USING (admin_id = auth.uid());

CREATE POLICY "projects_client" ON projects FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "projects_member" ON projects FOR SELECT
  USING (id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- Project members
CREATE POLICY "project_members_access" ON project_members FOR ALL
  USING (
    user_id = auth.uid() OR
    project_id IN (SELECT id FROM projects WHERE admin_id = auth.uid())
  );

-- Stages, tasks, etc: inherit from project access
CREATE POLICY "stages_access" ON stages FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE admin_id = auth.uid() OR client_id = auth.uid()
    )
  );

CREATE POLICY "tasks_access" ON tasks FOR ALL
  USING (
    stage_id IN (
      SELECT s.id FROM stages s
      JOIN projects p ON s.project_id = p.id
      WHERE p.admin_id = auth.uid() OR p.client_id = auth.uid()
    )
  );

CREATE POLICY "contractors_access" ON contractors FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE admin_id = auth.uid() OR client_id = auth.uid()
    )
  );

CREATE POLICY "budget_entries_access" ON budget_entries FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE admin_id = auth.uid() OR client_id = auth.uid()
    )
  );

CREATE POLICY "documents_access" ON documents FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE admin_id = auth.uid() OR client_id = auth.uid()
    )
  );

-- ========================================
-- AUTO-CREATE USER RECORD ON SIGNUP
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'client')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
