import React from 'react';

const auth = {
  session: { user: { id: 'u1' } },
  user: { id: 'u1' },
  profile: { role: 'admin' },
  isLoading: false,
  isAuthenticated: true,
  role: 'admin',
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
};

export const useAuth = () => auth as any;
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export default { useAuth, AuthProvider };
