import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface SchoolLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getCurrentLocation = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('La géolocalisation n\'est pas supportée par votre navigateur'));
        return;
      }

      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setLocation(loc);
          setLoading(false);
          resolve(loc);
        },
        (error) => {
          let message = 'Erreur de géolocalisation';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Permission de géolocalisation refusée';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Position non disponible';
              break;
            case error.TIMEOUT:
              message = 'Délai de géolocalisation dépassé';
              break;
          }
          setError(message);
          setLoading(false);
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  const verifyLocationAtSchool = async (): Promise<{ 
    isAtSchool: boolean; 
    schoolLocation?: SchoolLocation;
    distance?: number;
  }> => {
    try {
      const currentLoc = await getCurrentLocation();
      
      // Récupérer les localisations de l'école
      const { data: schoolLocations, error: schoolError } = await supabase
        .from('school_locations')
        .select('*');

      if (schoolError) throw schoolError;

      if (!schoolLocations || schoolLocations.length === 0) {
        toast({
          title: 'Configuration requise',
          description: 'Aucune localisation d\'école n\'est configurée. Contactez l\'administrateur.',
          variant: 'destructive',
        });
        return { isAtSchool: false };
      }

      // Vérifier si l'utilisateur est dans le rayon de l'école
      for (const school of schoolLocations) {
        const distance = calculateDistance(
          currentLoc.latitude,
          currentLoc.longitude,
          Number(school.latitude),
          Number(school.longitude)
        );

        if (distance <= Number(school.radius)) {
          return {
            isAtSchool: true,
            schoolLocation: school,
            distance
          };
        }
      }

      return { 
        isAtSchool: false,
        distance: schoolLocations[0] ? calculateDistance(
          currentLoc.latitude,
          currentLoc.longitude,
          Number(schoolLocations[0].latitude),
          Number(schoolLocations[0].longitude)
        ) : undefined
      };
    } catch (error) {
      console.error('Error verifying location:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de vérifier votre localisation',
        variant: 'destructive',
      });
      return { isAtSchool: false };
    }
  };

  // Formule de Haversine pour calculer la distance entre deux points GPS
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371000; // Rayon de la Terre en mètres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  return {
    location,
    error,
    loading,
    getCurrentLocation,
    verifyLocationAtSchool,
    calculateDistance
  };
};
