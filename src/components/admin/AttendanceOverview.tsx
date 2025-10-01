import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Search, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AttendanceRecord {
  id: string;
  user_id: string;
  type: 'in' | 'out' | 'break_start' | 'break_end';
  timestamp: string;
  method: 'qr_code' | 'card' | 'photo' | 'manual';
  latitude?: number;
  longitude?: number;
  verified: boolean;
  profile: {
    full_name: string;
    employee_id?: string;
    student_id?: string;
  };
}

export const AttendanceOverview = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('punch_records')
        .select(`
          *,
          profile:profiles!punch_records_user_id_fkey(full_name, employee_id, student_id)
        `)
        .gte('timestamp', `${selectedDate}T00:00:00.000Z`)
        .lt('timestamp', `${selectedDate}T23:59:59.999Z`)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setRecords((data as any) || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'out':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'break_start':
      case 'break_end':
        return <Clock className="w-4 h-4 text-warning" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      in: 'Entrée',
      out: 'Sortie',
      break_start: 'Début pause',
      break_end: 'Fin pause',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getMethodBadge = (method: string) => {
    const config = {
      qr_code: { label: 'QR Code', variant: 'default' as const },
      card: { label: 'Carte', variant: 'secondary' as const },
      photo: { label: 'Photo', variant: 'outline' as const },
      manual: { label: 'Manuel', variant: 'destructive' as const },
    };
    
    const methodConfig = config[method as keyof typeof config] || config.manual;
    return <Badge variant={methodConfig.variant}>{methodConfig.label}</Badge>;
  };

  const filteredRecords = records.filter((record) =>
    record.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.profile?.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.profile?.student_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Vue d'ensemble des Présences</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full sm:w-64"
              />
            </div>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
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
                <TableHead>Heure</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucun pointage trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(record.timestamp), 'HH:mm:ss', { locale: fr })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {record.profile?.full_name || 'Inconnu'}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">
                        {record.profile?.employee_id || record.profile?.student_id || '-'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(record.type)}
                        <span className="text-sm">{getTypeLabel(record.type)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getMethodBadge(record.method)}</TableCell>
                    <TableCell>
                      {record.latitude && record.longitude ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>
                            {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Non disponible</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.verified ? (
                        <Badge variant="default" className="bg-success">
                          Vérifié
                        </Badge>
                      ) : (
                        <Badge variant="secondary">En attente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
