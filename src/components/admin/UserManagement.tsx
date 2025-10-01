import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, UserPlus, Shield, User, GraduationCap, QrCode as QrCodeIcon } from 'lucide-react';
import { QRGenerator } from '../QRGenerator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  employee_id?: string;
  student_id?: string;
  department?: string;
  company_name?: string;
  qr_code?: string;
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'employee' | 'student';
}

export const UserManagement = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const fetchUsersAndRoles = async () => {
    try {
      setLoading(true);
      
      // Récupérer tous les profils
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Récupérer tous les rôles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Organiser les rôles par user_id
      const rolesMap: Record<string, string[]> = {};
      rolesData?.forEach((role: UserRole) => {
        if (!rolesMap[role.user_id]) {
          rolesMap[role.user_id] = [];
        }
        rolesMap[role.user_id].push(role.role);
      });

      setProfiles(profilesData || []);
      setRoles(rolesMap);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les utilisateurs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('generate_qr_code');
      
      if (error) throw error;

      const qrCode = data as string;
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ qr_code: qrCode })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      toast({
        title: 'QR Code généré',
        description: 'Le QR Code a été généré avec succès',
      });

      fetchUsersAndRoles();
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le QR Code',
        variant: 'destructive',
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'employee' | 'student') => {
    try {
      // Supprimer tous les rôles existants
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Ajouter le nouveau rôle
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (error) throw error;

      toast({
        title: 'Rôle mis à jour',
        description: 'Le rôle de l\'utilisateur a été mis à jour',
      });

      fetchUsersAndRoles();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le rôle',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadge = (userRoles: string[]) => {
    if (!userRoles || userRoles.length === 0) {
      return <Badge variant="outline">Aucun rôle</Badge>;
    }

    return (
      <div className="flex gap-1">
        {userRoles.map((role) => {
          const config = {
            admin: { variant: 'default' as const, icon: Shield, label: 'Admin' },
            employee: { variant: 'secondary' as const, icon: User, label: 'Employé' },
            student: { variant: 'outline' as const, icon: GraduationCap, label: 'Étudiant' },
          };
          
          const roleConfig = config[role as keyof typeof config];
          if (!roleConfig) return null;

          const Icon = roleConfig.icon;
          
          return (
            <Badge key={role} variant={roleConfig.variant} className="flex items-center gap-1">
              <Icon className="w-3 h-3" />
              {roleConfig.label}
            </Badge>
          );
        })}
      </div>
    );
  };

  const filteredProfiles = profiles.filter((profile) =>
    profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.student_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gestion des Utilisateurs</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>QR Code</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.full_name}</TableCell>
                  <TableCell>
                    <code className="text-xs">
                      {profile.employee_id || profile.student_id || '-'}
                    </code>
                  </TableCell>
                  <TableCell>{profile.department || '-'}</TableCell>
                  <TableCell>{getRoleBadge(roles[profile.user_id] || [])}</TableCell>
                  <TableCell>
                    {profile.qr_code ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <QrCodeIcon className="w-4 h-4 mr-2" />
                            Voir
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{profile.full_name}</DialogTitle>
                          </DialogHeader>
                          <QRGenerator value={profile.qr_code} size={300} />
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateQRCode(profile.user_id)}
                      >
                        <QrCodeIcon className="w-4 h-4 mr-2" />
                        Générer
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={roles[profile.user_id]?.[0] || 'employee'}
                      onValueChange={(value: 'admin' | 'employee' | 'student') =>
                        updateUserRole(profile.user_id, value)
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="employee">Employé</SelectItem>
                        <SelectItem value="student">Étudiant</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
