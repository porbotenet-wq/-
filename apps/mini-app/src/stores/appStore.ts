import { create } from 'zustand';
import { supabase } from '../api/supabase';

interface AppState {
  user: any | null;
  project: any | null;
  facades: any[];
  tasks: any[];
  modules: any[];
  documents: any[];
  loading: boolean;
  error: string | null;

  loadUser: (telegramId: number) => Promise<void>;
  loadProject: () => Promise<void>;
  loadFacades: (projectId: number) => Promise<void>;
  loadTasks: (projectId: number, filters?: any) => Promise<void>;
  loadModules: (projectId: number) => Promise<void>;
  loadDocuments: (projectId: number, filters?: any) => Promise<void>;
  updateModuleStatus: (moduleId: number, newStatus: string) => Promise<void>;
  changeTaskStatus: (taskId: number, newStatus: string) => Promise<void>;
  uploadDocument: (file: File, meta: any) => Promise<any>;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  project: null,
  facades: [],
  tasks: [],
  modules: [],
  documents: [],
  loading: false,
  error: null,

  setError: (error: string | null) => set({ error }),

  loadUser: async (telegramId: number) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, user_roles!user_roles_user_id_fkey(*, roles(*))')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      if (error) throw error;
      set({ user: data, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  loadProject: async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      set({ project: data });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadFacades: async (projectId: number) => {
    try {
      const { data, error } = await supabase
        .from('facades')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
      if (error) throw error;
      set({ facades: data || [] });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadTasks: async (projectId: number, filters?: any) => {
    set({ loading: true });
    try {
      let query = supabase
        .from('task_instances')
        .select('*, task_templates(name, code, phase, unit), facades(name), users!task_instances_assignee_id_fkey(id, first_name, last_name)')
        .eq('project_id', projectId)
        .order('planned_end', { ascending: true });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.facadeId) query = query.eq('facade_id', filters.facadeId);
      if (filters?.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
      if (filters?.type) query = query.eq('type', filters.type);

      const { data, error } = await query.limit(200);
      if (error) throw error;
      set({ tasks: data || [], loading: false });
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  loadModules: async (projectId: number) => {
    try {
      const { data, error } = await supabase
        .from('module_plan_items')
        .select('*, facades(name)')
        .eq('project_id', projectId)
        .order('mount_date', { ascending: true });
      if (error) throw error;
      set({ modules: data || [] });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadDocuments: async (projectId: number, filters?: any) => {
    try {
      let query = supabase
        .from('documents')
        .select('*, users:uploaded_by(first_name, last_name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.entityType) query = query.eq('entity_type', filters.entityType);

      const { data, error } = await query.limit(100);
      if (error) throw error;
      set({ documents: data || [] });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  updateModuleStatus: async (moduleId: number, newStatus: string) => {
    const { user, project } = get();
    if (!user || !project) return;

    try {
      const actualDateField: Record<string, string> = {
        IN_PRODUCTION: 'actual_production_date',
        PRODUCED: 'actual_production_date',
        SHIPPED: 'actual_shipment_date',
        ON_SITE: 'actual_shipment_date',
        MOUNTED: 'actual_mount_date',
        INSPECTED: 'actual_mount_date',
      };

      const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
      const dateField = actualDateField[newStatus];
      if (dateField) {
        updateData[dateField] = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('module_plan_items')
        .update(updateData)
        .eq('id', moduleId);

      if (error) throw error;

      // AuditLog
      await supabase.from('audit_logs').insert({
        action: 'MODULE_STATUS_CHANGED',
        entity_type: 'ModulePlanItem',
        entity_id: moduleId,
        user_id: user.id,
        new_value: { status: newStatus },
      });

      // Reload modules
      get().loadModules(project.id);
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  changeTaskStatus: async (taskId: number, newStatus: string) => {
    const { user, project } = get();
    if (!user || !project) return;

    try {
      const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'IN_PROGRESS') {
        updateData.actual_start = new Date().toISOString().split('T')[0];
      }
      if (newStatus === 'DONE' || newStatus === 'VERIFIED') {
        updateData.actual_end = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('task_instances')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action: 'TASK_STATUS_CHANGED',
        entity_type: 'TaskInstance',
        entity_id: taskId,
        user_id: user.id,
        new_value: { status: newStatus },
      });

      get().loadTasks(project.id);
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  uploadDocument: async (file: File, meta: any) => {
    const { user, project } = get();
    if (!user || !project) return null;

    try {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `projects/${project.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('stsphera-files')
        .upload(filePath, file);

      // Get public URL (or signed URL)
      const { data: urlData } = supabase.storage
        .from('stsphera-files')
        .getPublicUrl(filePath);

      const url = urlData?.publicUrl || filePath;

      // Create document record
      const { data: doc, error } = await supabase
        .from('documents')
        .insert({
          project_id: project.id,
          name: meta.name || file.name,
          type: meta.type || file.type.split('/').pop()?.toUpperCase() || 'FILE',
          url,
          size_bytes: file.size,
          status: 'DRAFT',
          entity_type: meta.entityType || null,
          entity_id: meta.entityId || null,
          task_instance_id: meta.taskInstanceId || null,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action: 'DOCUMENT_UPLOADED',
        entity_type: 'Document',
        entity_id: doc.id,
        user_id: user.id,
        new_value: { name: file.name, type: meta.type, size: file.size },
      });

      get().loadDocuments(project.id);
      return doc;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },
}));
