import { useAuth } from '~/hooks/use-auth-context';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

export function AuthGuard({ children, redirectTo = '/auth' }: AuthGuardProps) {
  const { user, loading, checkAuth } = useAuth();

  useEffect(() => {
    const checkAuthWithRefresh = async () => {
      if (!loading && !user) {
        // Try to refresh tokens by checking auth status
        await checkAuth();
      }
    };

    checkAuthWithRefresh();
  }, [user, loading, checkAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">Loading...</div>
          <div className="text-sm text-muted-foreground">Checking authentication</div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect immediately if user is still not authenticated after loading
    if (!loading) {
      window.location.href = redirectTo;
      return null;
    }

    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">Authenticating...</div>
          <div className="text-sm text-muted-foreground">Attempting to refresh session...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
