import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface AuthUser {
  name: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'querypal_auth_state';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Load auth state from localStorage on mount
  useEffect(() => {
    try {
      const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedAuth) {
        const authState = JSON.parse(storedAuth);
        if (authState.isAuthenticated && authState.user) {
          setUser(authState.user);
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Failed to load auth state from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  const login = () => {
    // In bypass mode, simulate a successful login with an email
    const newUser = { name: 'Developer User', email: 'dev.user@example.com' };
    setUser(newUser);
    setIsAuthenticated(true);
    
    // Persist auth state to localStorage
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        isAuthenticated: true,
        user: newUser
      }));
    } catch (error) {
      console.error('Failed to save auth state to localStorage:', error);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    
    // Clear auth state from localStorage
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear auth state from localStorage:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
