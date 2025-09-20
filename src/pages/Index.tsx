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
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <div className="text-center">
          <img 
            src={pogosLogo} 
            alt="Pogo's Restaurant" 
            className="h-16 mx-auto mb-4 rounded-lg"
          />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md mx-auto p-6">
        <img 
          src={pogosLogo} 
          alt="Pogo's Restaurant" 
          className="h-24 mx-auto rounded-lg shadow-lg"
        />
        <div>
          <h1 className="mb-4 text-4xl font-bold text-foreground">Welcome to Pogo's</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Join our loyalty program and start earning rewards!
          </p>
        </div>
        <Button 
          onClick={() => navigate('/auth')} 
          size="lg"
          className="w-full"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default Index;
