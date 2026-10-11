import { createContext, useContext } from 'react';
import type { T } from './lib/i18n';
import type { Calendar, Shop, Staff } from './lib/types';
import type { PrintJob } from './print/Print';

export type Screen = 'dashboard' | 'orders' | 'customers' | 'fabrics' | 'waitlist' | 'perfumes' | 'users' | 'settings' | 'help';

export interface OrderPreset { customerId?: string | null; garment?: string; qty?: number; tailorId?: string | null; fabricId?: string | null }

export type Sheet =
  | { kind: 'detail'; orderId: string; tab?: 'Overview' | 'Measurements' }
  | { kind: 'order'; preset?: OrderPreset }
  | { kind: 'measure'; customerId?: string | null; startNew?: boolean }
  | { kind: 'roll' } | { kind: 'perfume' } | { kind: 'user'; staffId?: string }
  | { kind: 'cash'; direction: 'in' | 'out' } | { kind: 'money' }
  | { kind: 'notif' } | { kind: 'account' } | { kind: 'sync' } | { kind: 'search' };

export interface UI {
  screen: Screen;
  go: (s: Screen, extra?: { customerId?: string; filter?: string }) => void;
  sheet: Sheet | null;
  open: (s: Sheet) => void;
  close: () => void;
  toast: (msg: string, error?: boolean) => void;
  print: (job: PrintJob) => void;
  me: Staff;
  isAdmin: boolean;
  demo: boolean;
  shop: Shop;
  cal: Calendar;
  i: T;
  customerId: string | null;
  setCustomerId: (id: string) => void;
  orderFilter: string;
  setOrderFilter: (f: string) => void;
  signOutCounter: () => void;
  switchTo: (staffId: string) => void;
}

export const UICtx = createContext<UI | null>(null);
export function useUI() {
  const v = useContext(UICtx);
  if (!v) throw new Error('UI context missing');
  return v;
}
