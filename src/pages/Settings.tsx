
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { 
  Lock, 
  UserRound, 
  Shield, 
  Bell, 
  Smartphone, 
  CreditCard, 
  Music, 
  Music2, 
  Mail, 
  MessageSquare, 
  Key, 
  Trash,
  AlertTriangle,
  Link as LinkIcon
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AnimatedTransition } from '@/components/ui/AnimatedTransition';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { toast } from '@/lib/toast';
import { initiateSpotifyAuth, handleSpotifyCallback } from '@/integrations/spotify/spotifyApi';
import { useLocation, Link } from 'react-router-dom';

interface ConnectedService {
  id: string;
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'pending';
}

const profileFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

const passwordFormSchema = z.object({
  currentPassword: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  newPassword: z.string().min(8, {
    message: "New password must be at least 8 characters.",
  }),
  confirmPassword: z.string().min(8, {
    message: "Please confirm your new password.",
  }),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

const Settings = () => {
  const location = useLocation();
  const { profile, updateUserProfile, user: authUser } = useAuth();
  const { user } = useProfile();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [notificationChannel, setNotificationChannel] = useState<string>("email");
  const [spotifyConnecting, setSpotifyConnecting] = useState(false);
  const [spotifyData, setSpotifyData] = useState<{
    display_name: string | null;
    email: string | null;
    is_premium: boolean | null;
    product: string | null;
    created_at: string | null;
  } | null>(null);
  
  const [services, setServices] = useState<ConnectedService[]>([
    {
      id: 'spotify',
      name: 'Spotify',
      icon: <Music className="h-4 w-4" />,
      connected: false,
      status: 'disconnected'
    },
    {
      id: 'applemusic',
      name: 'Apple Music',
      icon: <Music2 className="h-4 w-4" />,
      connected: false,
      status: 'disconnected'
    }
  ]);
  
  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    marketingEmails: false,
  });

  // Fetch Spotify connection status on mount
  useEffect(() => {
    const fetchSpotifyStatus = async () => {
      if (!authUser?.id) return;
      
      const { data, error } = await supabase
        .from('connected_services')
        .select('display_name, email, is_premium, product, created_at')
        .eq('user_id', authUser.id)
        .eq('service_name', 'spotify')
        .single();
      
      if (data && !error) {
        setSpotifyData(data);
        setServices(prevServices => 
          prevServices.map(service => 
            service.id === 'spotify' 
              ? { ...service, connected: true, status: 'connected' } 
              : service
          )
        );
      }
    };
    
    fetchSpotifyStatus();
  }, [authUser?.id]);
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });
  
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const code = query.get('code');
    const state = query.get('state');
    
    if (code && state) {
      setSpotifyConnecting(true);
      
      handleSpotifyCallback(code, state)
        .then(result => {
          if (result.success) {
            setServices(prevServices => 
              prevServices.map(service => 
                service.id === 'spotify' 
                  ? { ...service, connected: true, status: 'connected' } 
                  : service
              )
            );
          }
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setSpotifyConnecting(false);
        });
    }
  }, [location]);
  
  function onSubmit(data: ProfileFormValues) {
    setLoading(true);
    
    setTimeout(() => {
      updateUserProfile({
        full_name: data.name,
      });
      
      toast.success("Profile updated successfully");
      setLoading(false);
    }, 1000);
  }
  
  function onPasswordSubmit(data: PasswordFormValues) {
    setPasswordLoading(true);
    
    setTimeout(() => {
      toast.success("Password updated successfully");
      setPasswordLoading(false);
      setPasswordFormOpen(false);
      passwordForm.reset();
    }, 1500);
  }
  
  function handleDeleteAccount() {
    toast.success("Account scheduled for deletion. You will receive a confirmation email.");
    setDeleteAccountDialogOpen(false);
  }
  
  const handleConnectService = (serviceId: string) => {
    if (serviceId === 'spotify') {
      initiateSpotifyAuth();
    } else {
      setServices(prevServices => 
        prevServices.map(service => 
          service.id === serviceId 
            ? { ...service, status: 'pending' } 
            : service
        )
      );
      
      setTimeout(() => {
        setServices(prevServices => 
          prevServices.map(service => 
            service.id === serviceId 
              ? { ...service, connected: true, status: 'connected' } 
              : service
          )
        );
        
        toast.success(`Connected to ${serviceId === 'applemusic' ? 'Apple Music' : serviceId} successfully`);
      }, 2000);
    }
  };
  
  const handleDisconnectService = async (serviceId: string) => {
    if (serviceId === 'spotify' && authUser?.id) {
      try {
        const { error } = await supabase
          .from('connected_services')
          .delete()
          .eq('user_id', authUser.id)
          .eq('service_name', 'spotify');
        
        if (error) throw error;
        
        setSpotifyData(null);
        setServices(prevServices => 
          prevServices.map(service => 
            service.id === serviceId 
              ? { ...service, connected: false, status: 'disconnected' } 
              : service
          )
        );
        toast.success('Disconnected from Spotify');
      } catch (error) {
        console.error('Error disconnecting Spotify:', error);
        toast.error('Failed to disconnect Spotify');
      }
    } else {
      setServices(prevServices => 
        prevServices.map(service => 
          service.id === serviceId 
            ? { ...service, connected: false, status: 'disconnected' } 
            : service
        )
      );
      toast.success(`Disconnected from ${serviceId === 'applemusic' ? 'Apple Music' : serviceId}`);
    }
  };
  
  const handleToggleNotification = (key: string) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof notifications]
    }));
    
    toast.success("Notification preference updated");
  };
  
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <AnimatedTransition>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        
        <main className="flex-grow pt-24 pb-12">
          <div className="container px-4 mx-auto max-w-5xl">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="mb-6"
            >
              <h1 className="text-3xl font-bold">Account Settings</h1>
              <p className="text-muted-foreground">Manage your account preferences and profile</p>
            </motion.div>
            
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="profile"><UserRound className="w-4 h-4 mr-2" /> Profile</TabsTrigger>
                <TabsTrigger value="account"><Shield className="w-4 h-4 mr-2" /> Account</TabsTrigger>
                <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2" /> Notifications</TabsTrigger>
                <TabsTrigger value="connections"><Smartphone className="w-4 h-4 mr-2" /> Connections</TabsTrigger>
                <TabsTrigger value="billing"><CreditCard className="w-4 h-4 mr-2" /> Billing</TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="col-span-2">
                    <CardHeader>
                      <CardTitle>Profile Information</CardTitle>
                      <CardDescription>
                        Update your account information and how others see you on SoundTrump
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Your name" {...field} />
                                </FormControl>
                                <FormDescription>
                                  This is your public display name.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input placeholder="email@example.com" {...field} disabled />
                                </FormControl>
                                <FormDescription>
                                  <div className="flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    <span>Email cannot be changed</span>
                                  </div>
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <Button type="submit" className="w-full md:w-auto" disabled={loading}>
                            {loading ? "Saving..." : "Save changes"}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Account Status</CardTitle>
                      <CardDescription>
                        Your current membership and ranking status
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h3 className="text-sm font-medium mb-1">Membership Tier</h3>
                        <Badge 
                          variant={user?.role?.tier === "Premium" ? "default" : "outline"}
                          className={user?.role?.tier === "Premium" ? "bg-sound-light" : ""}
                        >
                          {user?.role?.tier || "Free"}
                        </Badge>
                        {user?.role?.tier !== "Premium" && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Upgrade to Premium to unlock additional features and rewards
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">User Status</h3>
                        <Badge 
                          variant={user?.role?.status === "Influencer" ? "default" : "outline"}
                          className={user?.role?.status === "Influencer" ? "bg-purple-500" : ""}
                        >
                          {user?.role?.status || "Normal"}
                        </Badge>
                        {user?.role?.status !== "Influencer" && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Reach 500 referrals to become an Influencer and earn 2x rewards
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Member Since</h3>
                        <p className="text-sm">June 12, 2023</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="account">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Security</CardTitle>
                    <CardDescription>
                      Manage your account security and privacy settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-4">
                        <Key className="h-6 w-6 text-muted-foreground" />
                        <div>
                          <h3 className="font-medium">Password</h3>
                          <p className="text-sm text-muted-foreground">
                            Last changed 3 months ago
                          </p>
                        </div>
                      </div>
                      <Dialog open={passwordFormOpen} onOpenChange={setPasswordFormOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">Change password</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Change your password</DialogTitle>
                            <DialogDescription>
                              Make sure your new password is secure and you'll remember it.
                            </DialogDescription>
                          </DialogHeader>
                          
                          <Form {...passwordForm}>
                            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                              <FormField
                                control={passwordForm.control}
                                name="currentPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Current Password</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder="Enter current password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={passwordForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder="Enter new password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={passwordForm.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Confirm New Password</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder="Confirm new password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <DialogFooter className="mt-6">
                                <Button 
                                  variant="outline" 
                                  type="button" 
                                  onClick={() => setPasswordFormOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={passwordLoading}>
                                  {passwordLoading ? "Updating..." : "Update Password"}
                                </Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-t">
                      <div className="flex items-center gap-4">
                        <Lock className="h-6 w-6 text-muted-foreground" />
                        <div>
                          <h3 className="font-medium">Two-factor authentication</h3>
                          <p className="text-sm text-muted-foreground">
                            Add an extra layer of security to your account
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => toast.success("This feature will be available soon")}>
                        Set up
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-t">
                      <div className="flex items-center gap-4">
                        <Shield className="h-6 w-6 text-muted-foreground" />
                        <div>
                          <h3 className="font-medium">Account Privacy</h3>
                          <p className="text-sm text-muted-foreground">
                            Control how your profile is seen by others
                          </p>
                        </div>
                      </div>
                      <Switch 
                        checked={true} 
                        onCheckedChange={() => toast.success("Privacy settings updated")}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-t">
                      <div className="flex items-center gap-4">
                        <Trash className="h-6 w-6 text-destructive" />
                        <div>
                          <h3 className="font-medium">Delete Account</h3>
                          <p className="text-sm text-muted-foreground">
                            Permanently delete your account and all data
                          </p>
                        </div>
                      </div>
                      <Dialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="destructive">Delete Account</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete your account</DialogTitle>
                            <DialogDescription>
                              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                            </DialogDescription>
                          </DialogHeader>
                          
                          <Alert variant="destructive" className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Warning</AlertTitle>
                            <AlertDescription>
                              You will lose all your rewards, badges, and history. Your referral links will no longer work.
                            </AlertDescription>
                          </Alert>
                          
                          <DialogFooter className="mt-6">
                            <Button 
                              variant="outline" 
                              onClick={() => setDeleteAccountDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              variant="destructive" 
                              onClick={handleDeleteAccount}
                            >
                              Delete Account
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>
                      Manage how and when we contact you
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium mb-2">Notification Channels</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Select how you'd like to receive notifications
                        </p>
                        <ToggleGroup 
                          type="single" 
                          value={notificationChannel}
                          onValueChange={(value) => {
                            if (value) setNotificationChannel(value);
                            toast.success(`Notifications will be sent via ${value}`);
                          }}
                          className="justify-start"
                        >
                          <ToggleGroupItem value="email" aria-label="Email notifications">
                            <Mail className="mr-2 h-4 w-4" />
                            Email
                          </ToggleGroupItem>
                          <ToggleGroupItem value="push" aria-label="Push notifications">
                            <Bell className="mr-2 h-4 w-4" />
                            Push
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                      
                      <div className="border-t pt-6">
                        <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <label 
                                htmlFor="email-updates" 
                                className="text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                Account Updates
                              </label>
                              <p className="text-sm text-muted-foreground">
                                Receive emails about your account activity
                              </p>
                            </div>
                            <Switch 
                              id="email-updates"
                              checked={notifications.emailUpdates}
                              onCheckedChange={() => handleToggleNotification('emailUpdates')}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <label 
                                htmlFor="marketing-emails" 
                                className="text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                Marketing Emails
                              </label>
                              <p className="text-sm text-muted-foreground">
                                Receive emails about new features and offers
                              </p>
                            </div>
                            <Switch 
                              id="marketing-emails"
                              checked={notifications.marketingEmails}
                              onCheckedChange={() => handleToggleNotification('marketingEmails')}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={() => toast.success("All notification preferences saved")}
                      className="w-full sm:w-auto"
                    >
                      Save preferences
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="connections">
                <Card>
                  <CardHeader>
                    <CardTitle>Connected Services</CardTitle>
                    <CardDescription>
                      Manage connected music streaming services and social accounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {services.map((service) => (
                        <div key={service.id} className="flex items-center justify-between py-3 border-b last:border-0">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                              {service.icon}
                            </div>
                            <div>
                              <h3 className="font-medium flex items-center">
                                {service.name}
                                {service.connected && (
                                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                                    Connected
                                  </Badge>
                                )}
                                {service.id === 'spotify' && spotifyData?.is_premium && (
                                  <Badge className="ml-2 bg-[#1DB954] text-white">
                                    Premium
                                  </Badge>
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {service.connected
                                  ? service.id === 'spotify' && spotifyData
                                    ? `${spotifyData.display_name || spotifyData.email} • Connected ${new Date(spotifyData.created_at!).toLocaleDateString()}`
                                    : `Connected since ${new Date().toLocaleDateString()}`
                                  : service.status === 'pending' || spotifyConnecting
                                  ? "Connection in progress..." 
                                  : "Not connected"}
                              </p>
                            </div>
                          </div>
                          {service.connected ? (
                            <div className="flex items-center gap-2">
                              {service.id === 'spotify' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                >
                                  <Link to="/spotify-history">View History</Link>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDisconnectService(service.id)}
                              >
                                Disconnect
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant={service.status === 'pending' || spotifyConnecting ? "outline" : "default"}
                              size="sm"
                              disabled={service.status === 'pending' || spotifyConnecting}
                              onClick={() => handleConnectService(service.id)}
                              className={service.status === 'pending' || spotifyConnecting ? 'opacity-50' : ''}
                            >
                              {service.status === 'pending' || spotifyConnecting ? "Connecting..." : "Connect"}
                            </Button>
                          )}
                        </div>
                      ))}
                      
                      <div className="mt-6">
                        <h3 className="text-lg font-medium mb-4">Connect Another Service</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Button variant="outline" className="justify-start" onClick={() => toast.success("This feature will be available soon")}>
                            <LinkIcon className="mr-2 h-4 w-4" />
                            YouTube Music
                          </Button>
                          <Button variant="outline" className="justify-start" onClick={() => toast.success("This feature will be available soon")}>
                            <LinkIcon className="mr-2 h-4 w-4" />
                            SoundCloud
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="billing">
                <Card>
                  <CardHeader>
                    <CardTitle>Billing and Payments</CardTitle>
                    <CardDescription>
                      Manage your billing information and view payment history
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No billing information</h3>
                      <p className="text-sm text-muted-foreground max-w-md mb-6">
                        You're currently on the free plan. Upgrade to Premium to unlock additional features and rewards.
                      </p>
                      <Button onClick={() => toast.success("Premium subscription options coming soon!")}>
                        Upgrade to Premium
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        
        <Footer />
      </div>
    </AnimatedTransition>
  );
};

export default Settings;
