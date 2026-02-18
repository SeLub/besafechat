import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion'; // Добавим для "летности"
import React from 'react';
import { useAuthFlow } from '~/hooks/use-auth-flow';
import { useMediaQuery } from '~/hooks/use-media-query';

// Auth component imports (needed for rendering in JSX)
import { MethodSelection } from '@/components/auth/method-selection';
import { PasswordCreation } from '@/components/auth/password-creation';
import { RecoveryOptions } from '@/components/auth/recovery-options';
import { SeedDisplay } from '@/components/auth/seed-display';
import { SeedVerification } from '@/components/auth/seed-verification';

export default function AuthRoute() {
  const {
    loading,
    step, // Предполагаем, что тип AuthStep не включает 'initial'
    seed,
    handleCreateAccount,
    handleMethodSelect,
    handleSeedConfirmed,
    handleSeedVerified,
    handlePasswordCreated,
    handleRecovery,
    handlePasswordRecovery,
    handleSeedRecovery,
  } = useAuthFlow();

  const { isMobile } = useMediaQuery();

  // Общая обертка
  const PageWrapper = ({ children, id }: { children: React.ReactNode; id: string }) => {
    // На шаге method-selection используем полную ширину на планшете/десктопе
    const isMethodSelectionStep = id === 'method-selection';
    const maxWidthClass = isMethodSelectionStep && !isMobile ? 'max-w-6xl' : 'max-w-md';

    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
        {/* Декоративные пятна */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-tertiary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]" />

        <AnimatePresence mode="wait">
          <motion.div
            key={id} // Важно для AnimatePresence
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`z-10 w-full ${maxWidthClass} p-8 mx-4 rounded-3xl border border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl`}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };

  if (loading) {
    return (
      <PageWrapper id="loading">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          <div className="text-primary font-medium tracking-wide">Preparing yourSky...</div>
        </div>
      </PageWrapper>
    );
  }

  // Исправляем логику: если step не определен или равен 'main', показываем главный экран
  // Если в вашем типе есть конкретный шаг для старта (напр. 'idle'), замените null на него
  if (step === null || step === undefined || step === 'main') {
    return (
      <PageWrapper id="initial">
        <div className="text-center mb-10">
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-block p-4 rounded-3xl bg-primary/10 text-primary mb-4"
          >
            {/* Стилизованная птица/крыло (Lucide Bird или кастомный SVG) */}
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 12C3 12 7 14 10 11C13 8 18 4 21 5C18 6 15 9 13 12C11 15 10 19 10 19C9 16 6 14 3 12Z"
                fill="currentColor"
              />
            </svg>
          </motion.div>
          <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">Leteem</h1>
          <p className="text-muted-foreground font-medium">
            Your Identity. Your Freedom. Your Sky.
          </p>
        </div>

        {/* Контент страницы /auth после того как сервер вернул 401 или ключ не совпал */}
        <div className="space-y-4 w-full">
          <Button
            onClick={handleCreateAccount}
            className="w-full py-7 text-lg rounded-2xl bg-primary text-primary-foreground font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
          >
            Create Identity
          </Button>

          <Button
            variant="outline"
            onClick={handleRecovery}
            className="w-full py-7 text-lg rounded-2xl border-primary/20 bg-background/40 backdrop-blur-md hover:bg-primary/5 transition-all text-primary font-bold"
          >
            Restore Access
          </Button>

          <p className="text-center text-[11px] text-muted-foreground/60 mt-6 px-4">
            By entering the Sky, you agree to our decentralized protocol rules. Your Identity is
            yours alone.
          </p>
        </div>
      </PageWrapper>
    );
  }

  // Логика для завершения
  if (step === 'complete') {
    return (
      <PageWrapper id="complete">
        <div className="text-center py-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <span className="text-4xl">✓</span>
          </motion.div>
          <h2 className="text-3xl font-bold mb-2">You are live!</h2>
          <p className="text-muted-foreground font-medium">TheSky is open. Redirecting...</p>
        </div>
      </PageWrapper>
    );
  }

  // Рендер контента в зависимости от шага
  const renderStepContent = () => {
    switch (step) {
      case 'method-selection':
        return (
          <MethodSelection
            onSelectCloud={() => handleMethodSelect('cloud')}
            onSelectSelfCustody={() => handleMethodSelect('self-custody')}
          />
        );
      case 'seed-display':
        return <SeedDisplay seed={seed} onConfirm={handleSeedConfirmed} />;
      case 'seed-verify':
        return <SeedVerification seed={seed} onVerified={handleSeedVerified} />;
      case 'password':
        return <PasswordCreation onPasswordCreated={handlePasswordCreated} />;
      case 'recovery':
        return (
          <RecoveryOptions
            onPasswordRecovery={handlePasswordRecovery}
            onSeedRecovery={handleSeedRecovery}
          />
        );
      default:
        return null;
    }
  };

  return <PageWrapper id={step}>{renderStepContent()}</PageWrapper>;
}
