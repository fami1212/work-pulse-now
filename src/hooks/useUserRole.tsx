import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'employee' | 'student';

interface UserRoles {
  roles: UserRole[];
  isAdmin: boolean;
  isEmployee: boolean;
  isStudent: boolean;
  loading: boolean;
}

export const useUserRole = (): UserRoles => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;

        const userRoles = data.map((r) => r.role as UserRole);
        setRoles(userRoles);
      } catch (error) {
        console.error('Error fetching user roles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRoles();

    // Real-time updates pour les rôles
    if (user) {
      const channel = supabase
        .channel('user-roles-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_roles',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchUserRoles();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return {
    roles,
    isAdmin: roles.includes('admin'),
    isEmployee: roles.includes('employee'),
    isStudent: roles.includes('student'),
    loading,
  };
};
