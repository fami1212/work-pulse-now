import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Camera, 
  Mail, 
  Building, 
  Badge as BadgeIcon, 
  Save, 
  Edit,
  Check,
  X,
  Upload,
  Loader2,
  Shield,
  Calendar,
  Clock,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
  full_name: string;
  company_name?: string;
  employee_id?: string;
  avatar_url?: string;
}

const UserProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    company_name: '',
    employee_id: '',
    avatar_url: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, company_name, employee_id, avatar_url')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
      } else {
        await createInitialProfile();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createInitialProfile = async () => {
    if (!user) return;

    try {
      const { data: employeeId } = await supabase.rpc('generate_employee_id');
      
      const newProfile = {
        user_id: user.id,
        full_name: user.user_metadata?.full_name || '',
        employee_id: employeeId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .insert(newProfile);

      if (!error) {
        setProfile({
          full_name: newProfile.full_name,
          employee_id: newProfile.employee_id,
          company_name: '',
          avatar_url: ''
        });
      }
    } catch (error) {
      console.error('Error creating initial profile:', error);
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          full_name: profile.full_name,
          company_name: profile.company_name,
          employee_id: profile.employee_id,
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving profile:', error);
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder le profil",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Profil sauvegardé",
        description: "Vos informations ont été mises à jour avec succès",
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Error uploading avatar:', uploadError);
        toast({
          title: "Erreur",
          description: "Impossible d'upload l'avatar",
          variant: "destructive",
        });
        return;
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = data.publicUrl;

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (profileUpdateError) {
        console.error('Error saving avatar URL to profile:', profileUpdateError);
        setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      } else {
        setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      }

      toast({
        title: "🎉 Avatar mis à jour",
        description: "Votre photo de profil a été changée avec succès",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "L'image doit faire moins de 5MB",
          variant: "destructive",
        });
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Format invalide",
          description: "Veuillez sélectionner une image",
          variant: "destructive",
        });
        return;
      }
      
      uploadAvatar(file);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
      >
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Mon Profil
          </h2>
          <p className="text-muted-foreground mt-1">
            Gérez vos informations personnelles et professionnelles
          </p>
        </div>
        
        <AnimatePresence mode="wait">
          {!isEditing ? (
            <motion.div
              key="edit-button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(true)}
                className="border-2 rounded-xl px-6 py-2 h-auto"
              >
                <Edit className="w-4 h-4 mr-2" />
                Modifier le profil
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="action-buttons"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex gap-2"
            >
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(false)}
                className="rounded-xl px-6 py-2 h-auto border-2"
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button 
                onClick={saveProfile} 
                disabled={saving}
                className="rounded-xl px-6 py-2 h-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
              >
                {saving ? (
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Sauvegarder
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-gradient-to-br from-white to-gray-50/80 border-0 shadow-2xl rounded-3xl relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full blur-xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-r from-secondary/5 to-primary/5 rounded-full blur-xl" />
          </div>

          <CardHeader className="text-center pb-6 relative z-10">
            <div className="flex flex-col items-center space-y-6">
              {/* Avatar Section */}
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Avatar className="w-32 h-32 border-4 border-white shadow-2xl">
                  <AvatarImage src={profile.avatar_url || ""} alt={profile.full_name} />
                  <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-primary/70 text-white">
                    {getInitials(profile.full_name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  className="absolute -bottom-2 -right-2 rounded-full w-10 h-10 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary border-2 border-white shadow-lg"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </motion.div>
              
              {/* User Info */}
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  {profile.full_name || 'Utilisateur'}
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0 px-3 py-1">
                    <User className="w-3 h-3 mr-1" />
                    Employé
                  </Badge>
                  <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-green-200 text-green-700 px-3 py-1">
                    <Check className="w-3 h-3 mr-1" />
                    Actif
                  </Badge>
                  <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-blue-200 text-blue-700 px-3 py-1">
                    <Shield className="w-3 h-3 mr-1" />
                    Vérifié
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>

          <Separator className="bg-gray-200" />

          <CardContent className="pt-8 relative z-10">
            <div className="space-y-8">
              {/* Form Section */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Email */}
                  <div className="space-y-3">
                    <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Mail className="w-4 h-4" />
                      Adresse email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-gray-50/80 border-2 border-gray-200 rounded-xl py-3 px-4 text-gray-600"
                    />
                    <p className="text-xs text-gray-500">
                      L'adresse email ne peut pas être modifiée
                    </p>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-3">
                    <Label htmlFor="fullName" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <User className="w-4 h-4" />
                      Nom complet
                    </Label>
                    <Input
                      id="fullName"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Votre nom complet"
                      className="border-2 rounded-xl py-3 px-4 disabled:bg-gray-50/80 disabled:text-gray-600"
                    />
                  </div>

                  {/* Company */}
                  <div className="space-y-3">
                    <Label htmlFor="company" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Building className="w-4 h-4" />
                      Entreprise
                    </Label>
                    <Input
                      id="company"
                      value={profile.company_name || ''}
                      onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Nom de votre entreprise"
                      className="border-2 rounded-xl py-3 px-4 disabled:bg-gray-50/80 disabled:text-gray-600"
                    />
                  </div>

                  {/* Employee ID */}
                  <div className="space-y-3">
                    <Label htmlFor="employeeId" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <BadgeIcon className="w-4 h-4" />
                      ID Employé
                    </Label>
                    <Input
                      id="employeeId"
                      value={profile.employee_id || ''}
                      onChange={(e) => setProfile({ ...profile, employee_id: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Votre identifiant employé"
                      className="border-2 rounded-xl py-3 px-4 disabled:bg-gray-50/80 disabled:text-gray-600 font-mono"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-gray-200" />

              {/* Account Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-lg">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Informations du compte
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Inscrit le</p>
                        <p className="font-semibold text-gray-900">
                          {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Clock className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Dernière connexion</p>
                        <p className="font-semibold text-gray-900">
                          {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('fr-FR') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Shield className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Statut</p>
                        <p className="font-semibold text-gray-900">Actif</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default UserProfile;