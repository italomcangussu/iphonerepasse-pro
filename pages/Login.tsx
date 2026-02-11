import React, { useState } from 'react';
import { Lock, Mail, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import BrandLogo from '../components/BrandLogo';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Preencha email e senha.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate('/', { replace: true });
      toast.success('Login realizado com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível entrar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-100 via-white to-brand-50 dark:from-surface-dark-50 dark:via-surface-dark-100 dark:to-surface-dark-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md ios-card p-8">
        <div className="text-center mb-8">
          <BrandLogo
            variant="full"
            className="h-20 md:h-24 w-auto mx-auto object-contain"
            alt="iPhoneRepasse"
          />
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-1">
            Entre para acessar o painel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="ios-label">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                className="ios-input pl-10"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label className="ios-label">Senha</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                className="ios-input pl-10"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full ios-button-primary mt-4">
            <LogIn size={18} />
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
