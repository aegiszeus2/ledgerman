import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://app.ledgerman.org/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let authToken: string | null = null;

export const setAuthToken = async (token: string) => {
  authToken = token;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  await AsyncStorage.setItem('authToken', token);
};

export const clearAuthToken = async () => {
  authToken = null;
  delete api.defaults.headers.common['Authorization'];
  await AsyncStorage.removeItem('authToken');
};

export const restoreAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      await setAuthToken(token);
      return token;
    }
  } catch (error) {
    console.error('Failed to restore auth token:', error);
  }
  return null;
};

export interface LoginRequest {
  company: string;
  name: string;
  pin: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  worker: {
    id: string;
    name: string;
    company: string;
  };
}

export interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  project: string;
  notes?: string;
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

export const authService = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/workers/login', data),
  logout: () => {
    clearAuthToken();
    return Promise.resolve();
  },
};

export const timeService = {
  getEntries: () => api.get<TimeEntry[]>('/time-entries'),
  createEntry: (data: Omit<TimeEntry, 'id'>) =>
    api.post<TimeEntry>('/time-entries', data),
  updateEntry: (id: string, data: Partial<TimeEntry>) =>
    api.put<TimeEntry>(`/time-entries/${id}`, data),
};


export interface PhotoUploadRequest {
  projectId?: string;
  workerId?: string;
  submissionId?: string;
  date?: string;
  filename: string;
  blobB64: string;
  thumbnailB64: string;
}

export const photoService = {
  uploadPhoto: (data: PhotoUploadRequest) =>
    api.post<Photo>('/photos', data),
  getPhotos: (projectId?: string) =>
    api.get<Photo[]>('/photos', { params: { project_id: projectId } }),
};

export const projectService = {
  getProjects: () => api.get<Project[]>('/projects'),
  getProjectById: (id: string) => api.get<Project>(`/projects/${id}`),
  createProject: (data: Omit<Project, 'id' | 'created_at'>) =>
    api.post<Project>('/projects', data),
  updateProject: (id: string, data: Partial<Project>) =>
    api.put<Project>(`/projects/${id}`, data),
};

export const taskService = {
  getTasks: (projectId?: string) =>
    api.get<Task[]>('/tasks', { params: { project_id: projectId } }),
  getTaskById: (id: string) => api.get<Task>(`/tasks/${id}`),
  createTask: (data: Omit<Task, 'id' | 'created_at'>) =>
    api.post<Task>('/tasks', data),
  updateTask: (id: string, data: Partial<Task>) =>
    api.put<Task>(`/tasks/${id}`, data),
  deleteTask: (id: string) => api.delete<void>(`/tasks/${id}`),
};

export interface Worker {
  id: string;
  name: string;
  company: string;
  role?: string;
}

export const workerService = {
  getWorker: (id: string) => api.get<Worker>(`/workers/${id}`),
  updateWorker: (id: string, data: Partial<Worker>) =>
    api.put<Worker>(`/workers/${id}`, data),
};

export default api;
