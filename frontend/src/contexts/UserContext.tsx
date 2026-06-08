import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserInfo {
  displayName: string;
  email: string;
  localId: string;
  id: string;
  username: string;
}

interface UserContextType {
  user: UserInfo | null;
  setUser: (user: UserInfo | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
};

const FullScreenLoader = () => (
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
    <div className="w-10 h-10 border-4 border-slate-100 border-t-burgundy rounded-full animate-spin"></div>
    <p className="mt-4 text-slate-500 font-medium">Đang xác thực thông tin...</p>
  </div>
);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          setLoading(false);
          return;
        }

        const refreshRes = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken })
        });

        if (!refreshRes.ok) throw new Error('Token expired');

        const refreshData = await refreshRes.json();

        if (refreshData.access_token) {
          const expires = new Date();
          expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000);
          document.cookie = `accessToken=${refreshData.access_token};expires=${expires.toUTCString()};path=/;Secure;SameSite=None`;

          const idTokenReq = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: refreshData.access_token })
          });
          const resData = await idTokenReq.json();
          const customAttributes = JSON.parse(resData.users[0].customAttributes);

          if (customAttributes) {
            const authHeader = `Bearer ${refreshData.access_token}`;
            const reqInfo = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/find-info`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({ payload: { id: customAttributes.id } })
            });
            const res = await reqInfo.json();
            if (res && res.users && res.users.findInfoInRoleById && res.users.findInfoInRoleById.length > 0) {
              const infoData = res.users.findInfoInRoleById[0].info;
              setUser({
                displayName: infoData.fullName,
                email: infoData.email,
                localId: infoData.user,
                id: infoData._id,
                username: customAttributes.name
              });
            }
          }

          if (refreshData.refresh_token) {
            localStorage.setItem('refreshToken', refreshData.refresh_token);
          }
        }
      } catch (err) {
        console.error('Lỗi lấy thông tin đăng nhập tự động:', err);
        localStorage.removeItem('refreshToken');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  if (loading) {
    return <FullScreenLoader />;
  }

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
