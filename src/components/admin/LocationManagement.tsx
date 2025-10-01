import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Save, Edit } from 'lucide-react';
import { motion } from 'framer-motion';

interface SchoolLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export const LocationManagement = () => {
  const [locations, setLocations] = useState<SchoolLocation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: '',
    radius: '100',
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('school_locations')
        .select('*');

      if (error) throw error;
      setLocations(data || []);

      if (data && data[0]) {
        setFormData({
          latitude: data[0].latitude.toString(),
          longitude: data[0].longitude.toString(),
          radius: data[0].radius.toString(),
        });
        setEditingId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const lat = parseFloat(formData.latitude);
      const lon = parseFloat(formData.longitude);
      const rad = parseFloat(formData.radius);

      if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
        toast({
          title: 'Erreur',
          description: 'Veuillez entrer des valeurs valides',
          variant: 'destructive',
        });
        return;
      }

      if (editingId) {
        const { error } = await supabase
          .from('school_locations')
          .update({
            latitude: lat,
            longitude: lon,
            radius: rad,
          })
          .eq('id', editingId);

        if (error) throw error;
      }

      toast({
        title: 'Localisation mise à jour',
        description: 'Les coordonnées de l\'école ont été mises à jour',
      });

      fetchLocations();
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la localisation',
        variant: 'destructive',
      });
    }
  };

  const getCurrentPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          });
          toast({
            title: 'Position obtenue',
            description: 'Les coordonnées actuelles ont été remplies',
          });
        },
        (error) => {
          toast({
            title: 'Erreur',
            description: 'Impossible d\'obtenir votre position',
            variant: 'destructive',
          });
        }
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Localisation de l'École
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="p-4 bg-muted/30 rounded-lg space-y-4">
            <p className="text-sm text-muted-foreground">
              Configurez les coordonnées GPS de l'école pour vérifier automatiquement
              que les pointages sont effectués sur place.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.0000001"
                  value={formData.latitude}
                  onChange={(e) =>
                    setFormData({ ...formData, latitude: e.target.value })
                  }
                  placeholder="Ex: 48.8566"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.0000001"
                  value={formData.longitude}
                  onChange={(e) =>
                    setFormData({ ...formData, longitude: e.target.value })
                  }
                  placeholder="Ex: 2.3522"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="radius">Rayon de détection (mètres)</Label>
              <Input
                id="radius"
                type="number"
                value={formData.radius}
                onChange={(e) =>
                  setFormData({ ...formData, radius: e.target.value })
                }
                placeholder="Ex: 100"
              />
              <p className="text-xs text-muted-foreground">
                Les pointages seront autorisés dans un rayon de {formData.radius || 0}m
                autour des coordonnées définies
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={getCurrentPosition} variant="outline" className="flex-1">
                <MapPin className="w-4 h-4 mr-2" />
                Utiliser ma position actuelle
              </Button>
              <Button onClick={handleSave} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </div>

          {locations[0] && (
            <div className="p-4 border rounded-lg space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-success" />
                Configuration actuelle
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nom:</span>
                  <p className="font-medium">{locations[0].name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rayon:</span>
                  <p className="font-medium">{locations[0].radius}m</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Latitude:</span>
                  <p className="font-mono text-xs">{locations[0].latitude}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Longitude:</span>
                  <p className="font-mono text-xs">{locations[0].longitude}</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </CardContent>
    </Card>
  );
};
