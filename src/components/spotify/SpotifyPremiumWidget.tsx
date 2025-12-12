import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Music, Crown, ExternalLink, RefreshCw, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { initiateSpotifyAuth, getSpotifyUserProfile } from '@/integrations/spotify/spotifyApi';
import { useAuth } from '@/context/AuthContext';

interface SpotifyConnection {
  connected: boolean;
  displayName?: string;
  email?: string;
  product?: string;
  isPremium?: boolean;
  accessToken?: string;
}

const SpotifyPremiumWidget = () => {
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<SpotifyConnection>({ connected: false });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchSpotifyConnection();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const fetchSpotifyConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('connected_services')
        .select('*')
        .eq('user_id', user?.id)
        .eq('service_name', 'spotify')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No connection found
          setConnection({ connected: false });
        } else {
          console.error('Error fetching Spotify connection:', error);
        }
      } else if (data) {
        setConnection({
          connected: true,
          displayName: data.display_name,
          email: data.email,
          product: data.product,
          isPremium: data.is_premium,
          accessToken: data.access_token
        });
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!connection.accessToken) return;
    
    setRefreshing(true);
    try {
      // Fetch fresh profile from Spotify
      const profile = await getSpotifyUserProfile(connection.accessToken);
      const isPremium = profile.product === 'premium';
      
      // Update in database
      const { error } = await supabase
        .from('connected_services')
        .update({
          display_name: profile.display_name,
          email: profile.email,
          product: profile.product,
          is_premium: isPremium,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user?.id)
        .eq('service_name', 'spotify');

      if (error) throw error;

      setConnection(prev => ({
        ...prev,
        displayName: profile.display_name,
        email: profile.email,
        product: profile.product,
        isPremium
      }));
    } catch (err) {
      console.error('Error refreshing status:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnectSpotify = () => {
    initiateSpotifyAuth();
  };

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-[#1DB954]" />
            Spotify Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!connection.connected) {
    return (
      <Card className="glass border-[#1DB954]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-[#1DB954]" />
            Connect Spotify
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Spotify account to unlock music tasks and earn more ST Coins!
          </p>
          <Button 
            onClick={handleConnectSpotify}
            className="w-full bg-[#1DB954] hover:bg-[#1DB954]/90 text-white"
          >
            <Music className="h-4 w-4 mr-2" />
            Login with Spotify
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Premium user view
  if (connection.isPremium) {
    return (
      <Card className="glass border-[#1DB954]/50 bg-gradient-to-br from-[#1DB954]/10 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              <span className="bg-gradient-to-r from-[#1DB954] to-yellow-500 bg-clip-text text-transparent">
                Spotify Premium
              </span>
            </div>
            <Badge className="bg-[#1DB954] text-white">Premium</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1DB954]/20 flex items-center justify-center">
              <Music className="h-6 w-6 text-[#1DB954]" />
            </div>
            <div>
              <p className="font-medium">{connection.displayName}</p>
              <p className="text-sm text-muted-foreground">{connection.email}</p>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-[#1DB954]/10 border border-[#1DB954]/20">
            <p className="text-sm font-medium text-[#1DB954]">Welcome, Premium User! 🎉</p>
            <p className="text-xs text-muted-foreground mt-1">
              You have access to exclusive premium features and bonus tasks on SoundTrump.
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={handleRefreshStatus}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              asChild
            >
              <Link to="/spotify-history">
                <History className="h-4 w-4 mr-2" />
                History
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Free user view
  return (
    <Card className="glass border-muted/50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-[#1DB954]" />
            Spotify Connected
          </div>
          <Badge variant="secondary">Free</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <Music className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{connection.displayName}</p>
            <p className="text-sm text-muted-foreground">{connection.email}</p>
          </div>
        </div>
        
        <div className="p-3 rounded-lg bg-muted/30 border border-muted/50">
          <p className="text-sm font-medium">You are on Spotify Free</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upgrade to Spotify Premium to unlock exclusive features and bonus ST Coins!
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            className="flex-1 bg-[#1DB954] hover:bg-[#1DB954]/90 text-white"
            onClick={() => window.open('https://www.spotify.com/premium/', '_blank')}
          >
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Premium
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleRefreshStatus}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            asChild
          >
            <Link to="/spotify-history">
              <History className="h-4 w-4 mr-2" />
              History
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpotifyPremiumWidget;
