export interface Worker {
  id: string;
  name: string;
  company: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  company_id: string;
  status: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: string;
  due_date?: string;
  created_at: string;
}

export interface Photo {
  id: string;
  project_id?: string;
  task_id?: string;
  url: string;
  caption?: string;
  uploaded_at: string;
}

export interface AuthState {
  token: string | null;
  worker: Worker | null;
  isLoggedIn: boolean;
}

export interface AppState {
  auth: AuthState;
  loading: boolean;
  error: string | null;
}
