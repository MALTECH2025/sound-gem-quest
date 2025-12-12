
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { Music, Search, Eye, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from 'sonner';

interface SpotifyUser {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  is_premium: boolean | null;
  product: string | null;
  access_token: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    username: string | null;
    full_name: string | null;
  };
}

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
}

interface RecentlyPlayedItem {
  track: Track;
  played_at: string;
}

const AdminSpotifyStats = () => {
  const [users, setUsers] = useState<SpotifyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<SpotifyUser | null>(null);
  const [userTracks, setUserTracks] = useState<Track[]>([]);
  const [userRecentlyPlayed, setUserRecentlyPlayed] = useState<RecentlyPlayedItem[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchSpotifyUsers();
  }, []);

  const fetchSpotifyUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('connected_services')
        .select(`
          id,
          user_id,
          display_name,
          email,
          is_premium,
          product,
          access_token,
          created_at,
          updated_at
        `)
        .eq('service_name', 'spotify')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data for each user
      const usersWithProfiles = await Promise.all(
        (data || []).map(async (user) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, full_name')
            .eq('id', user.user_id)
            .single();
          
          return { ...user, profile };
        })
      );

      setUsers(usersWithProfiles);
    } catch (error) {
      console.error('Error fetching Spotify users:', error);
      toast.error('Failed to load Spotify users');
    } finally {
      setLoading(false);
    }
  };

  const viewUserStats = async (user: SpotifyUser) => {
    setSelectedUser(user);
    setDialogOpen(true);
    setLoadingTracks(true);
    setUserTracks([]);
    setUserRecentlyPlayed([]);

    if (!user.access_token) {
      toast.error('No access token available for this user');
      setLoadingTracks(false);
      return;
    }

    try {
      // Fetch top tracks
      const topTracksResponse = await fetch(
        `https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=20`,
        {
          headers: { 'Authorization': `Bearer ${user.access_token}` }
        }
      );
      
      // Fetch recently played
      const recentlyPlayedResponse = await fetch(
        `https://api.spotify.com/v1/me/player/recently-played?limit=20`,
        {
          headers: { 'Authorization': `Bearer ${user.access_token}` }
        }
      );

      if (topTracksResponse.ok) {
        const topTracksData = await topTracksResponse.json();
        setUserTracks(topTracksData.items || []);
      }

      if (recentlyPlayedResponse.ok) {
        const recentlyPlayedData = await recentlyPlayedResponse.json();
        setUserRecentlyPlayed(recentlyPlayedData.items || []);
      }

      if (!topTracksResponse.ok && !recentlyPlayedResponse.ok) {
        toast.error('Token may have expired. User needs to reconnect Spotify.');
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      toast.error('Failed to fetch user listening stats');
    } finally {
      setLoadingTracks(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.display_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.profile?.username?.toLowerCase().includes(query) ||
      user.profile?.full_name?.toLowerCase().includes(query)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Spotify User Stats</h1>
            <p className="text-muted-foreground">
              View and verify user streaming history for task validation
            </p>
          </div>
          <Button variant="outline" onClick={fetchSpotifyUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Connected Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-[#1DB954]" />
                {users.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Premium Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1DB954]">
                {users.filter(u => u.is_premium).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Free Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {users.filter(u => !u.is_premium).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Connected Spotify Users
            </CardTitle>
            <CardDescription>
              Click on a user to view their streaming history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No users found matching your search.' : 'No Spotify users connected yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Spotify Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Connected</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {user.profile?.full_name || user.profile?.username || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              @{user.profile?.username || 'N/A'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.display_name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">{user.email || 'N/A'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_premium ? 'default' : 'secondary'}>
                            {user.is_premium ? 'Premium' : 'Free'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewUserStats(user)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Stats
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Stats Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Music className="h-5 w-5 text-[#1DB954]" />
                {selectedUser?.display_name || 'User'}'s Listening History
              </DialogTitle>
              <DialogDescription>
                {selectedUser?.email} • {selectedUser?.is_premium ? 'Premium' : 'Free'} Account
              </DialogDescription>
            </DialogHeader>

            {loadingTracks ? (
              <div className="space-y-4 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {/* Top Tracks */}
                <div>
                  <h3 className="font-semibold mb-3">Top Tracks (Past 6 Months)</h3>
                  {userTracks.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userTracks.map((track, index) => (
                        <div key={track.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <span className="w-6 text-center text-sm font-medium text-muted-foreground">
                            {index + 1}
                          </span>
                          <Avatar className="h-10 w-10 rounded-md">
                            <img 
                              src={track.album.images[0]?.url} 
                              alt={track.album.name}
                              className="object-cover"
                            />
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{track.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {track.artists.map(a => a.name).join(', ')}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(track.duration_ms)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No top tracks data available
                    </p>
                  )}
                </div>

                {/* Recently Played */}
                <div>
                  <h3 className="font-semibold mb-3">Recently Played</h3>
                  {userRecentlyPlayed.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userRecentlyPlayed.map((item, index) => (
                        <div key={`${item.track.id}-${index}`} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <Avatar className="h-10 w-10 rounded-md">
                            <img 
                              src={item.track.album.images[0]?.url} 
                              alt={item.track.album.name}
                              className="object-cover"
                            />
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{item.track.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.track.artists.map(a => a.name).join(', ')}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(item.played_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No recently played data available
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSpotifyStats;
