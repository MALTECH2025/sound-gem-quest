import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Mail, Lock, User, UserPlus, LogIn, Gift } from 'lucide-react';
import { AnimatedTransition } from '@/components/ui/AnimatedTransition';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Login = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get referral code from URL
  const referralCode = searchParams.get('ref');
  
  // Store referral code in localStorage when present
  useEffect(() => {
    if (referralCode) {
      console.log('Referral code detected on login page:', referralCode);
      localStorage.setItem('pendingReferralCode', referralCode.toUpperCase());
      // Default to register tab when referral code is present
      setActiveTab('register');
    }
  }, [referralCode]);
  
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await register(email, password, { username });
      if (result.success) {
        toast.success('Account created! Please check your email to verify your account.');
        setActiveTab('login');
        setUsername('');
        setPassword('');
      }
    } catch (error) {
      console.error('Register error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error('Please enter your email address');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      });
      
      if (error) {
        console.error('Password reset error:', error.message);
        toast.error(error.message);
        return;
      }
      
      toast.success('Password reset email sent! Check your inbox.');
      setResetEmail('');
      setActiveTab('login');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleLoginWithGoogle = async () => {
    toast.info('Google login will be available soon!');
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sound-medium border-t-sound-light rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // Don't render login page if user is already authenticated
  if (isAuthenticated) {
    return null;
  }
  
  return (
    <AnimatedTransition>
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/50">
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-12">
          <Link to="/" className="flex items-center mb-8">
            <img 
              src="/lovable-uploads/d171e28f-9cf9-4701-a3d8-bd8c580e00d9.png" 
              alt="SoundTrump" 
              className="w-10 h-10 mr-2"
            />
            <span className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-sound-light to-sound-accent">
              SoundTrump
            </span>
          </Link>
          
          <Card className="w-full max-w-md shadow-lg">
            {referralCode && (
              <Alert className="m-4 mb-0 border-primary/30 bg-primary/10">
                <Gift className="h-4 w-4 text-primary" />
                <AlertDescription className="text-foreground">
                  You've been referred! Sign up to earn <strong>10 bonus ST Coins</strong>!
                </AlertDescription>
              </Alert>
            )}
            
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold">
                {activeTab === 'login' && 'Welcome back'}
                {activeTab === 'register' && (referralCode ? 'Join & Earn Rewards!' : 'Create an account')}
                {activeTab === 'reset' && 'Reset your password'}
              </CardTitle>
              <CardDescription>
                {activeTab === 'login' && 'Enter your credentials to sign in to your account'}
                {activeTab === 'register' && (referralCode ? 'Your friend invited you to earn crypto rewards!' : 'Fill in the form below to create your account')}
                {activeTab === 'reset' && 'Enter your email to receive a password reset link'}
              </CardDescription>
            </CardHeader>
            
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'register' | 'reset')}>
              <div className="px-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
              </div>
              
              <CardContent className="p-6">
                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="your@email.com" 
                          className="pl-10"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)} 
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Button 
                          variant="link" 
                          className="px-0 h-auto text-xs"
                          type="button"
                          onClick={() => setActiveTab('reset')}
                        >
                          Forgot password?
                        </Button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        <Input 
                          id="password" 
                          type="password" 
                          placeholder="••••••••" 
                          className="pl-10"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)} 
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      ) : (
                        <LogIn className="w-4 h-4 mr-2" />
                      )}
                      Sign In
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="register" className="mt-0">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        <Input 
                          id="register-email" 
                          type="email" 
                          placeholder="your@email.com" 
                          className="pl-10"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)} 
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="username">Username (optional)</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        <Input 
                          id="username" 
                          type="text" 
                          placeholder="soundfan123" 
                          className="pl-10"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)} 
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        <Input 
                          id="register-password" 
                          type="password" 
                          placeholder="••••••••" 
                          className="pl-10"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)} 
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      Create Account
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="reset" className="mt-0">
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        <Input 
                          id="reset-email" 
                          type="email" 
                          placeholder="your@email.com" 
                          className="pl-10"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)} 
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      ) : (
                        <Mail className="w-4 h-4 mr-2" />
                      )}
                      Send Reset Link
                    </Button>

                    <Button 
                      variant="ghost" 
                      className="w-full" 
                      type="button"
                      onClick={() => setActiveTab('login')}
                    >
                      Back to Login
                    </Button>
                  </form>
                </TabsContent>
                
                {(activeTab === 'login' || activeTab === 'register') && (
                  <>
                    <div className="mt-4 relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator className="w-full" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={handleLoginWithGoogle}
                        type="button"
                      >
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                          />
                        </svg>
                        Google
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Tabs>
            
            <CardFooter className="flex justify-center p-6 pt-0">
              <Button variant="link" asChild>
                <Link to="/" className="flex items-center text-sm">
                  Back to home
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AnimatedTransition>
  );
};

export default Login;
