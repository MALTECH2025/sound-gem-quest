
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { handleSpotifyCallback } from '@/integrations/spotify/spotifyApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { Music, Check, AlertCircle } from 'lucide-react';

const SpotifyCallback = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your Spotify authentication...');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get the code and state from the URL
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const state = params.get('state');
        
        if (!code || !state) {
          setStatus('error');
          setMessage('Missing required parameters for Spotify authentication');
          return;
        }
        
        console.log('Processing Spotify callback with code and state');
        
        // Process the callback
        const result = await handleSpotifyCallback(code, state);
        
        if (result.success) {
          setStatus('success');
          const premiumMsg = result.isPremium 
            ? 'You have Spotify Premium! Enjoy exclusive features.' 
            : 'Connected with Spotify Free. Upgrade for bonus rewards!';
          setMessage(`Spotify connected successfully! ${premiumMsg}`);
          toast.success('Spotify account connected successfully!');
        } else {
          setStatus('error');
          setMessage(result.message || 'Failed to connect Spotify account');
          toast.error(result.message || 'Failed to connect Spotify account');
        }
      } catch (error: any) {
        console.error('Error processing Spotify callback:', error);
        setStatus('error');
        setMessage(error.message || 'An unexpected error occurred');
        toast.error('Failed to process Spotify authentication');
      }
    };
    
    processCallback();
  }, [location.search]);
  
  const goToDashboard = () => {
    navigate('/dashboard');
  };
  
  const tryAgain = () => {
    // Redirect back to the settings page
    navigate('/settings');
  };
  
  return (
    <div className="container mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Spotify Connection
          </CardTitle>
          <CardDescription>
            {status === 'processing' ? 'Connecting your Spotify account' : 
             status === 'success' ? 'Your Spotify account has been connected' : 
             'Failed to connect your Spotify account'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center text-center">
          {status === 'processing' && (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sound-medium mb-4"></div>
          )}
          
          {status === 'success' && (
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
          )}
          
          {status === 'error' && (
            <div className="rounded-full bg-red-100 p-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          )}
          
          <p className="mb-6">{message}</p>
          
          {status !== 'processing' && (
            <div className="flex gap-3">
              {status === 'success' ? (
                <Button onClick={goToDashboard}>Go to Dashboard</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={tryAgain}>Try Again</Button>
                  <Button onClick={goToDashboard}>Go to Dashboard</Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SpotifyCallback;
