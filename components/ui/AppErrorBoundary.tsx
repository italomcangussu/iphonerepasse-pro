import React from "react";
import { RefreshCw } from "lucide-react";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  declare props: Readonly<AppErrorBoundaryProps>;

  state: AppErrorBoundaryState = { hasError: false };

  constructor(props: AppErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[app] unrecoverable render error", error);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    // A árvore do React caiu: troca de rota e recarrega para montar o app do zero.
    window.location.hash = '#/';
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-surface-light-100 px-5 py-8 text-slate-900 dark:bg-surface-dark-50 dark:text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
            <RefreshCw size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tight">Não foi possível abrir esta tela</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Algo deu errado ao montar esta tela. Seus dados salvos não foram afetados. Recarregue para tentar de novo ou volte ao início.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.98]"
          >
            <RefreshCw size={16} />
            Recarregar app
          </button>
          <button
            type="button"
            onClick={this.goHome}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/20"
          >
            Voltar ao início
          </button>
        </div>
      </main>
    );
  }
}

export default AppErrorBoundary;
