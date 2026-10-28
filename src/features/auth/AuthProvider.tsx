import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';
const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  error: string;
}>({ session: null, loading: true, error: '' });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let eventReceived = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      eventReceived = true;
      if (active) {
        setSession(next);
        setLoading(false);
        setError('');
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (active && !eventReceived) {
          setSession(data.session);
          setError(
            sessionError
              ? 'Your session could not be restored. Please sign in again.'
              : '',
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && !eventReceived) {
          setError('Your session could not be restored. Please sign in again.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <AuthContext.Provider value={{ session, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}
// Shared auth state is consumed throughout the workspace.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
