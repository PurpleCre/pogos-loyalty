import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import pogosLogo from '@/assets/pogos-logo.jpg';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
        <div className="text-center space-y-4 animate-in fade-in duration-500">
          <img 
            src={pogosLogo} 
            alt="Pogo's Restaurant" 
            className="h-16 mx-auto mb-4 rounded-lg animate-pulse shadow-lg"
          />
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
      <div className="text-center space-y-8 max-w-md mx-auto animate-in fade-in slide-in-from-bottom duration-700">
        <img 
          src={pogosLogo} 
          alt="Pogo's Restaurant" 
          className="h-24 mx-auto rounded-lg shadow-lg hover:scale-105 transition-transform duration-300"
        />
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '150ms' }}>
          <h1 className="text-4xl font-bold text-foreground bg-clip-text">Welcome to Pogo's</h1>
          <p className="text-xl text-muted-foreground">
            Join our loyalty program and start earning rewards!
          </p>
        </div>
        <div className="animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '300ms' }}>
          <Button 
            onClick={() => navigate('/auth')} 
            size="lg"
            className="w-full"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
