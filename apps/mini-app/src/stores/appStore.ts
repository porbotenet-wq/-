import { create } from 'zustand';
import { supabase } from '../api/supabase';

interface AppState {
  user: any | null;
  userLoaded: boolean;
  project: any | null;
  facades: any[];
  tasks: any[];
  modules: any[];
  loading: boolean;

  loadUser: (telegramId: number) => Promise<void>;
  loadProject: () => Promise<void>;
  loadFacades: (projectId: number) => Promise<void>;
  loadTasks: (projectId: number, filters?: any) => Promise<void>;
  loadModules: (projectId: number) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  userLoaded: false,
  project: null,
  facades: [],
  tasks: [],
  modules: [],
  loading: false,

  loadUser: async (telegramId: number) => {
    set({ loading: true, userLoaded: false });
    try {
      const { data } = await supabase
        .from('users')
        .select('*, user_roles!user_roles_user_id_fkey(*, roles(*))')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      set({ user: data, userLoaded: true, loading: false });
    } catch (_error) {
      set({ user: null, userLoaded: true, loading: false });
    }
  },

  loadProject: async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();
    set({ project: data });
  },

  loadFacades: async (projectId: number) => {
    const { data } = await supabase
      .from('facades')
      .select('*')
      .eq('project_id', projectId)
      .order('name');
    set({ facades: data || [] });
  },

  loadTasks: async (projectId: number, filters?: any) => {
    set({ loading: true });
    let query = supabase
      .from('task_instances')
      .select('*, task_templates(name, code, phase), facades(name), users!task_instances_assignee_id_fkey(first_name, last_name)')
      .eq('project_id', projectId)
      .order('planned_end', { ascending: true });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.facadeId) query = query.eq('facade_id', filters.facadeId);
    if (filters?.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
    if (filters?.taskId) query = query.eq('id', filters.taskId);

    const { data } = await query.limit(100);
    set({ tasks: data || [], loading: false });
  },

  loadModules: async (projectId: number) => {
    const { data } = await supabase
      .from('module_plan_items')
      .select('*, facades(name)')
      .eq('project_id', projectId)
      .order('mount_date', { ascending: true });
    set({ modules: data || [] });
  },
}));
