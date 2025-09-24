import { TimeDisplay } from "@/components/TimeDisplay";
import { PunchCard } from "@/components/PunchCard";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Système de Pointage
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Application moderne de gestion des temps de présence pour votre entreprise
          </p>
        </header>

        <div className="max-w-4xl mx-auto space-y-8">
          <TimeDisplay />
          <PunchCard />
        </div>
      </div>
    </div>
  );
};

export default Index;