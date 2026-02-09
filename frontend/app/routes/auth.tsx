import { Button } from '@/components/ui/button';
import { useAuthFlow } from '~/hooks/use-auth-flow';

// Auth component imports (needed for rendering in JSX)
import { MethodSelection } from '@/components/auth/method-selection';
import { PasswordCreation } from '@/components/auth/password-creation';
import { RecoveryOptions } from '@/components/auth/recovery-options';
import { SeedDisplay } from '@/components/auth/seed-display';
import { SeedVerification } from '@/components/auth/seed-verification';


export default function AuthRoute() {
  const {
    loading,
    hasKey,
    step,
    seed,
    handleCreateAccount,
    handleMethodSelect,
    handleSeedConfirmed,
    handleSeedVerified,
    handlePasswordCreated,
    handleClearKey,
    handleRecovery,
    handlePasswordRecovery,
    handleSeedRecovery,
  } = useAuthFlow();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center text-lg">Loading...</div>
      </div>
    );
  }

  if (step === 'method-selection') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <MethodSelection
          onSelectCloud={() => handleMethodSelect('cloud')}
          onSelectSelfCustody={() => handleMethodSelect('self-custody')}
        />
      </div>
    );
  }

  if (step === 'seed-display') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SeedDisplay seed={seed} onConfirm={handleSeedConfirmed} />
      </div>
    );
  }

  if (step === 'seed-verify') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SeedVerification seed={seed} onVerified={handleSeedVerified} />
      </div>
    );
  }

  if (step === 'password') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PasswordCreation onPasswordCreated={handlePasswordCreated} />
      </div>
    );
  }

  if (step === 'recovery') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RecoveryOptions
          onPasswordRecovery={handlePasswordRecovery}
          onSeedRecovery={handleSeedRecovery}
        />
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">BeSafe Chat</h1>
          <p className="text-muted-foreground">Anonymous E2EE Messenger</p>
        </div>

        {hasKey ? (
          <div className="space-y-3">
            <div className="text-center py-6 text-lg">
              <div className="mb-2">Stored account detected</div>
              <div className="text-sm text-muted-foreground">Automatically authenticating...</div>
            </div>
            <Button onClick={handleRecovery} variant="outline" className="w-full py-6 text-lg">
              Restore Access
            </Button>
            <Button onClick={handleCreateAccount} className="w-full py-6 text-lg">
              Create New Account
            </Button>
            <div className="text-center">
              <button
                onClick={handleClearKey}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Clear Stored Account
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={handleRecovery} variant="outline" className="w-full py-6 text-lg">
              Restore Access
            </Button>
            <Button onClick={handleCreateAccount} className="w-full py-6 text-lg">
              Create Account
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}