import { useAuth } from '../lib/auth-context.tsx';
import { LogIn, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';

export function LoginPage() {
  const { signIn, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async () => {
    try {
      setError(null);
      setIsLoggingIn(true);
      await signIn();
    } catch (e: any) {
      console.error('Login error:', e);
      if (e.code === 'auth/cancelled-popup-request' || e.code === 'auth/popup-closed-by-user') {
        setError('O login foi cancelado ou bloqueado. Tente novamente ou abra o app em uma nova guia.');
      } else {
        setError('Ocorreu um erro ao tentar fazer login. Tente novamente.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-3xl mb-4">M</div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Marketing OS
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Seu gerente de marketing inteligente
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-slate-200">
          
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={isLoggingIn}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-colors disabled:opacity-70"
          >
            <LogIn className="w-5 h-5 mr-2" />
            {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
          </button>
        </div>
      </div>
    </div>
  );
}
