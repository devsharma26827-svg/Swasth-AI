// Typed API Client for SwasthAI REST Services

import {
  UserProfile,
  PPGMeasurementResult,
  HeartSoundResult,
  CoughResult,
  GaitResult,
  CameraGaitResult,
  BMIResult,
  CheckupSession,
  RiskSummary,
  TrendDataset,
  Doctor,
  Appointment,
  LabPartner,
  LabTest,
  LabBooking,
  HealthReport,
  DemoScenario,
  AdminUserListItem,
  AdminAuditLog,
  AdminStats,
  UserRole
} from '../types';

const BASE_URL = '';

let currentAuthToken = localStorage.getItem('swasthai_token') || '';

export function setAuthToken(token: string | null) {
  if (token) {
    currentAuthToken = token;
    localStorage.setItem('swasthai_token', token);
  } else {
    currentAuthToken = '';
    localStorage.removeItem('swasthai_token');
  }
}

export function getAuthToken(): string {
  return currentAuthToken || localStorage.getItem('swasthai_token') || '';
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}${url}`, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const message = data?.error?.message || data?.message || `Request failed with status ${res.status}`;
    const code = data?.code || data?.error?.code || 'UNKNOWN_ERROR';
    const err: any = new Error(message);
    err.code = code;
    err.data = data;
    throw err;
  }
  return data as T;
}

export const authApi = {
  login: async (email: string, password?: string) => {
    const res = await fetchJson<{ success: boolean; token: string; refreshToken?: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: password || 'default_pass_2026' })
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },
  register: async (payload: {
    name: string;
    email: string;
    password?: string;
    role?: UserRole;
    age?: number;
    sex?: string;
    height?: number;
    weight?: number;
  }) => {
    const res = await fetchJson<{ success: boolean; token: string; refreshToken?: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },
  logout: async () => {
    try {
      await fetchJson<{ success: boolean; message: string }>('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
    }
  },
  me: async () => fetchJson<{ success: boolean; user: UserProfile; profile: UserProfile }>('/api/auth/me')
};

export const profileApi = {
  get: async () => fetchJson<{ success: boolean; profile: UserProfile }>('/api/profile'),
  update: async (profile: Partial<UserProfile>) => fetchJson<{ success: boolean; profile: UserProfile }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(profile)
  }),
  deleteAccount: async () => fetchJson<{ success: boolean; message: string }>('/api/profile', {
    method: 'DELETE'
  }),
  exportDataUrl: '/api/profile/export'
};

export const measurementApi = {
  submitPPG: async (payload: {
    mode?: 'real' | 'demo';
    redValues?: number[];
    greenValues?: number[];
    blueValues?: number[];
    frameTimestampsMs?: number[];
    fps?: number;
    simulatedScenario?: DemoScenario;
  }) => fetchJson<{ success: boolean; measurement: PPGMeasurementResult }>('/api/measurements/ppg', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  submitHeartSound: async (payload: {
    mode?: 'real' | 'demo';
    audioSamples?: number[];
    sampleRate?: number;
    simulatedScenario?: DemoScenario;
  }) => fetchJson<{ success: boolean; screening: HeartSoundResult }>('/api/screening/heart-sound', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  submitCough: async (payload: {
    mode?: 'real' | 'demo';
    audioSamples?: number[];
    sampleRate?: number;
    simulatedScenario?: DemoScenario;
  }) => fetchJson<{ success: boolean; screening: CoughResult }>('/api/screening/cough', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  submitGait: async (payload: {
    mode?: 'real' | 'demo';
    readings?: { x: number; y: number; z: number; timestampMs: number }[];
    simulatedScenario?: DemoScenario;
  }) => fetchJson<{ success: boolean; gait: GaitResult }>('/api/screening/gait', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  submitCameraGait: async (payload: {
    frames?: any[];
    durationSeconds?: number;
    fps?: number;
    mode?: 'real' | 'demo';
    simulatedScenario?: DemoScenario;
  }) => fetchJson<{ success: boolean; result: CameraGaitResult; gaitCamera?: CameraGaitResult }>('/api/measurements/gait/camera', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  submitBMI: async (payload: { heightCm: number; weightKg: number }) =>
    fetchJson<{ success: boolean; bmi: BMIResult }>('/api/measurements/bmi', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};

export const checkupApi = {
  list: async () => fetchJson<{ success: boolean; checkups: CheckupSession[] }>('/api/checkups'),
  getCurrent: async () => fetchJson<{ success: boolean; checkup: CheckupSession | null }>('/api/checkups/current'),
  create: async (cadenceType: 'daily' | 'weekly' | 'comprehensive' = 'daily', selectedModules?: string[]) =>
    fetchJson<{ success: boolean; checkup: CheckupSession }>('/api/checkups', {
      method: 'POST',
      body: JSON.stringify({ cadenceType, selectedModules })
    }),
  complete: async (id: string) =>
    fetchJson<{ success: boolean; checkup: CheckupSession }>(`/api/checkups/${id}/complete`, {
      method: 'POST'
    })
};

export const riskApi = {
  getSummary: async () => fetchJson<{ success: boolean; risk: RiskSummary }>('/api/risk/summary')
};

export const trendsApi = {
  getAll: async () => fetchJson<{ success: boolean; trends: TrendDataset[] }>('/api/trends'),
  getMetric: async (metric: string) => fetchJson<{ success: boolean; dataset: TrendDataset }>(`/api/trends/${metric}`)
};

export const doctorApi = {
  list: async (specialty?: string) => fetchJson<{ success: boolean; doctors: Doctor[] }>(`/api/doctors${specialty ? `?specialty=${specialty}` : ''}`),
  get: async (id: string) => fetchJson<{ success: boolean; doctor: Doctor }>(`/api/doctors/${id}`),
  getSlots: async (id: string) => fetchJson<{ success: boolean; availableDays: string[]; slots: string[] }>(`/api/doctors/${id}/slots`),
  listAppointments: async () => fetchJson<{ success: boolean; appointments: Appointment[] }>('/api/appointments'),
  bookAppointment: async (payload: {
    doctorId: string;
    date: string;
    timeSlot: string;
    consultType: 'video' | 'in_person';
    notes?: string;
  }) => fetchJson<{ success: boolean; appointment: Appointment }>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};

export const labApi = {
  getPartners: async () => fetchJson<{ success: boolean; provider: string; partners: LabPartner[] }>('/api/labs'),
  getTests: async (category?: string) => fetchJson<{ success: boolean; tests: LabTest[] }>(`/api/labs/tests${category ? `?category=${category}` : ''}`),
  listPackages: async () => {
    return {
      success: true,
      packages: [
        {
          id: 'pkg_cardio_diabetic',
          name: 'Cardio-Metabolic Screening Panel',
          priceInr: 999,
          description: 'Lipid profile, HbA1c, fasting glucose, and hs-CRP inflammatory marker.',
          parametersIncluded: ['Lipid Profile', 'HbA1c', 'Fasting Blood Sugar', 'hs-CRP'],
          fastingRequired: true,
          partnerOptions: ['Thyrocare Diagnostics', 'Dr. Lal PathLabs']
        },
        {
          id: 'pkg_comprehensive_vital',
          name: 'Comprehensive Vital Organ Battery',
          priceInr: 1499,
          description: 'LFT, KFT, Thyroid Profile, and Complete Blood Count (CBC).',
          parametersIncluded: ['Liver Function', 'Kidney Function', 'Thyroid Profile', 'CBC with ESR'],
          fastingRequired: false,
          partnerOptions: ['Thyrocare Diagnostics', 'Dr. Lal PathLabs', 'SRL Diagnostics']
        },
        {
          id: 'pkg_respiratory_care',
          name: 'Respiratory & Thoracic Assessment',
          priceInr: 1200,
          description: 'Chest X-Ray PA view screening and digital spirometry volume kinetics.',
          parametersIncluded: ['Chest X-Ray Digital', 'Spirometry FEV1/FVC', 'CBC with Absolute Eosinophil Count'],
          fastingRequired: false,
          partnerOptions: ['Dr. Lal PathLabs', 'SRL Diagnostics']
        }
      ]
    };
  },
  getSlots: async () => fetchJson<{ success: boolean; dates: string[]; timeSlots: string[] }>('/api/labs/slots'),
  listBookings: async () => fetchJson<{ success: boolean; bookings: LabBooking[] }>('/api/labs/bookings'),
  bookTests: async (payload: {
    labId: string;
    testIds: string[];
    bookingType: 'home_collection' | 'lab_visit';
    address?: string;
    date: string;
    timeSlot: string;
  }) => fetchJson<{ success: boolean; booking: LabBooking }>('/api/labs/bookings', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  book: async (payload: {
    packageId?: string;
    labId?: string;
    testIds?: string[];
    patientName: string;
    patientPhone: string;
    patientAddress: string;
    bookingType: 'home_collection' | 'lab_visit';
    slotDate: string;
    slotTime: string;
  }) => fetchJson<{ success: boolean; booking: LabBooking }>('/api/labs/bookings', {
    method: 'POST',
    body: JSON.stringify({
      labId: payload.labId || 'lab_1',
      testIds: payload.testIds || ['t_lipid'],
      bookingType: payload.bookingType,
      address: payload.patientAddress,
      date: payload.slotDate,
      timeSlot: payload.slotTime
    })
  })
};

export const reportApi = {
  list: async () => fetchJson<{ success: boolean; reports: HealthReport[] }>('/api/reports'),
  get: async (id: string) => fetchJson<{ success: boolean; report: HealthReport }>(`/api/reports/${id}`),
  getLatest: async () => {
    const list = await fetchJson<{ success: boolean; reports: HealthReport[] }>('/api/reports');
    if (list.reports && list.reports.length > 0) {
      return { success: true, report: list.reports[0] };
    }
    return fetchJson<{ success: boolean; report: HealthReport }>('/api/reports', { method: 'POST' });
  },
  generate: async (checkupId?: string) => fetchJson<{ success: boolean; report: HealthReport }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ checkupId })
  }),
  downloadReport: async (id: string, reportNumber?: string) => {
    const token = getAuthToken();
    const res = await fetch(`/api/reports/${id}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SwasthAI_Report_${reportNumber || id}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  getDownloadUrl: (id: string) => `/api/reports/${id}/download`
};

export const consentApi = {
  record: async (type: string, version: string = 'v2.1') => fetchJson('/api/consent', {
    method: 'POST',
    body: JSON.stringify({ type, version })
  }),
  list: async () => fetchJson<{ success: boolean; consents: any[] }>('/api/consent'),
  revoke: async (type: string) => fetchJson('/api/consent', {
    method: 'DELETE',
    body: JSON.stringify({ type })
  })
};

export const scenarioApi = {
  getCurrent: async () => fetchJson<{ success: boolean; currentScenario: DemoScenario }>('/api/scenario'),
  set: async (scenario: DemoScenario) => fetchJson<{ success: boolean; currentScenario: DemoScenario }>('/api/scenario', {
    method: 'POST',
    body: JSON.stringify({ scenario })
  })
};

export const dataApi = {
  reset: async () => fetchJson<{ success: boolean; message: string }>('/api/admin/reset', { method: 'POST' }),
  exportDataUrl: '/api/profile/export',
  exportData: async (format: 'json' | 'csv' = 'json') => {
    return fetchJson<any>(`/api/profile/export?format=${format}`);
  }
};

export const adminApi = {
  getStats: async () => fetchJson<{ success: boolean; stats: AdminStats }>('/api/admin/stats'),
  getUsers: async () => fetchJson<{ success: boolean; users: AdminUserListItem[] }>('/api/admin/users'),
  getUserDetails: async (id: string) => fetchJson<{ success: boolean; user: any }>(`/api/admin/users/${id}`),
  getCheckups: async () => fetchJson<{ success: boolean; checkups: any[] }>('/api/admin/checkups'),
  getReports: async () => fetchJson<{ success: boolean; reports: any[] }>('/api/admin/reports'),
  getAppointments: async () => fetchJson<{ success: boolean; appointments: any[]; labBookings: any[] }>('/api/admin/appointments'),
  getAuditLogs: async () => fetchJson<{ success: boolean; auditLogs: AdminAuditLog[] }>('/api/admin/audit-logs'),
  setDemoScenario: async (scenario: DemoScenario) => fetchJson<{ success: boolean; currentScenario: DemoScenario }>('/api/admin/demo-scenario', {
    method: 'POST',
    body: JSON.stringify({ scenario })
  }),
  resetData: async () => fetchJson<{ success: boolean; message: string }>('/api/admin/reset', { method: 'POST' })
};
