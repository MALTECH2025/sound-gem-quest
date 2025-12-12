
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Music, Clock, BarChart, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSpotifyTopTracks, getSpotifyRecentlyPlayed, initiateSpotifyAuth } from '@/integrations/spotify/spotifyApi';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { toast } from 'sonner';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
  explicit: boolean;
}

interface RecentlyPlayedItem {
  track: Track;
  played_at: string;
}

const SpotifyHistory = () => {
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('medium_term');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<{
    display_name: string | null;
    email: string | null;
    is_premium: boolean | null;
    product: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchSpotifyData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('connected_services')
          .select('access_token, display_name, email, is_premium, product')
          .eq('service_name', 'spotify')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching Spotify data:', error);
          setLoading(false);
          return;
        }

        if (data) {
          setAccessToken(data.access_token);
          setSpotifyProfile({
            display_name: data.display_name,
            email: data.email,
            is_premium: data.is_premium,
            product: data.product
          });
        }
      } catch (error) {
        console.error('Error retrieving Spotify data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSpotifyData();
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    const fetchTracks = async () => {
      setLoading(true);
      try {
        const [topTracksData, recentlyPlayedData] = await Promise.all([
          getSpotifyTopTracks(accessToken, timeRange),
          getSpotifyRecentlyPlayed(accessToken)
        ]);
        
        setTopTracks(topTracksData.items || []);
        setRecentlyPlayed(recentlyPlayedData.items || []);
      } catch (error) {
        console.error('Error loading Spotify data:', error);
        toast.error('Failed to load Spotify data. Token may have expired.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTracks();
  }, [accessToken, timeRange]);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatPlayedAt = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleRefresh = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [topTracksData, recentlyPlayedData] = await Promise.all([
        getSpotifyTopTracks(accessToken, timeRange),
        getSpotifyRecentlyPlayed(accessToken)
      ]);
      
      setTopTracks(topTracksData.items || []);
      setRecentlyPlayed(recentlyPlayedData.items || []);
      toast.success('Spotify data refreshed!');
    } catch (error) {
      console.error('Error refreshing Spotify data:', error);
      toast.error('Failed to refresh. Please reconnect Spotify.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Spotify Listening History</h1>
          <p className="text-muted-foreground">
            View your top tracks and recently played songs
          </p>
        </div>

        {!accessToken && !loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connect Your Spotify</h2>
              <p className="text-muted-foreground mb-6">
                Link your Spotify account to view your listening history and complete music tasks.
              </p>
              <Button onClick={() => initiateSpotifyAuth()} className="bg-[#1DB954] hover:bg-[#1ed760]">
                <Music className="mr-2 h-4 w-4" />
                Connect Spotify
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Profile Card */}
            {spotifyProfile && (
              <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Music className="h-5 w-5 text-[#1DB954]" />
                      {spotifyProfile.display_name || 'Spotify User'}
                    </CardTitle>
                    <CardDescription>
                      {spotifyProfile.email} • {spotifyProfile.is_premium ? (
                        <span className="text-[#1DB954] font-medium">Premium</span>
                      ) : (
                        <span className="text-muted-foreground">Free</span>
                      )}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </CardHeader>
              </Card>
            )}

            {/* Tracks Card */}
            <Card>
              <CardHeader>
                <CardTitle>Your Listening Stats</CardTitle>
                <CardDescription>
                  Explore your listening habits and discover your top tracks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="top" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="top">
                      <BarChart className="h-4 w-4 mr-2" />
                      Top Tracks
                    </TabsTrigger>
                    <TabsTrigger value="recent">
                      <Clock className="h-4 w-4 mr-2" />
                      Recently Played
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="top">
                    <div className="mb-4 flex flex-wrap gap-2">
                      <Button 
                        variant={timeRange === 'short_term' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTimeRange('short_term')}
                      >
                        Past Month
                      </Button>
                      <Button 
                        variant={timeRange === 'medium_term' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTimeRange('medium_term')}
                      >
                        Past 6 Months
                      </Button>
                      <Button 
                        variant={timeRange === 'long_term' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTimeRange('long_term')}
                      >
                        All Time
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      {loading ? (
                        Array.from({ length: 10 }).map((_, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-40" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        ))
                      ) : topTracks.length > 0 ? (
                        topTracks.map((track, index) => (
                          <div key={track.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="w-6 text-center font-bold text-muted-foreground">{index + 1}</div>
                            <Avatar className="h-12 w-12 rounded-md">
                              <img 
                                src={track.album.images[0]?.url} 
                                alt={track.album.name}
                                className="object-cover"
                              />
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{track.name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {track.artists.map(a => a.name).join(', ')}
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDuration(track.duration_ms)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center py-8 text-muted-foreground">
                          No top tracks data available yet.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="recent">
                    <div className="space-y-4">
                      {loading ? (
                        Array.from({ length: 10 }).map((_, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-md" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-40" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-3 w-20" />
                          </div>
                        ))
                      ) : recentlyPlayed.length > 0 ? (
                        recentlyPlayed.map((item, index) => (
                          <div key={`${item.track.id}-${item.played_at}-${index}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <Avatar className="h-12 w-12 rounded-md">
                              <img 
                                src={item.track.album.images[0]?.url} 
                                alt={item.track.album.name}
                                className="object-cover"
                              />
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.track.name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {item.track.artists.map(a => a.name).join(', ')}
                              </p>
                            </div>
                            <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                              {formatPlayedAt(item.played_at)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center py-8 text-muted-foreground">
                          No recently played tracks available yet.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default SpotifyHistory;
