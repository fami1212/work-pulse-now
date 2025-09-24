import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

export const TimeDisplay = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Card className="p-8 text-center bg-gradient-to-br from-card to-card/50 border-0 shadow-lg">
      <div className="space-y-2">
        <div className="text-4xl font-bold text-primary font-mono tracking-wide">
          {formatTime(currentTime)}
        </div>
        <div className="text-lg text-muted-foreground capitalize">
          {formatDate(currentTime)}
        </div>
      </div>
    </Card>
  );
};