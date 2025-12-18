
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Users, Trophy, Coins, Music, Star, Gift, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { AnimatedTransition } from '@/components/ui/AnimatedTransition';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { checkAndApplyReferralFromUrl } from '@/lib/api/referrals';
import { toast } from '@/lib/toast';

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Check for referral code in URL and show notification
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    
    if (referralCode) {
      if (isAuthenticated) {
        // If already logged in, apply immediately
        checkAndApplyReferralFromUrl().then((result) => {
          if (result?.success) {
            toast.success(result.message);
          } else if (result?.message) {
            toast.error(result.message);
          }
        });
      } else {
        // Show message to sign up
        toast.success('Referral code detected! Sign up to earn bonus rewards!');
      }
    }
  }, [isAuthenticated]);

  const handleGetStarted = () => {
    // Preserve referral code when navigating to login
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate(referralCode ? `/login?ref=${referralCode}` : '/login');
    }
  };

  return (
    <AnimatedTransition>
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        
        {/* Hero Section */}
        <section className="flex-grow pt-24 pb-12 px-4">
          <div className="container mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <Badge variant="secondary" className="mb-4 bg-primary text-primary-foreground border-0">
                <Star className="w-4 h-4 mr-2" />
                Earn Crypto Rewards
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
                Turn Your Music 
                <br />
                Into <span className="text-accent">Money</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Complete simple music tasks, refer friends, and earn ST Coins. 
                Your gateway to the future of music rewards.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  onClick={handleGetStarted}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-3 rounded-full"
                >
                  {isAuthenticated ? 'Go to Dashboard' : 'Start Earning Now'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => navigate('/how-it-works')}
                  className="border-border text-foreground hover:bg-muted px-8 py-3 rounded-full"
                >
                  Learn More
                </Button>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16"
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-accent mb-2">10,000+</div>
                <div className="text-muted-foreground">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">$50K+</div>
                <div className="text-muted-foreground">Rewards Paid</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-accent mb-2">500+</div>
                <div className="text-muted-foreground">Daily Tasks</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                How You <span className="text-accent">Earn</span>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Multiple ways to earn ST Coins and build your crypto portfolio
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <Card className="bg-card border-border hover:border-primary/40 transition-all duration-300">
                  <CardHeader>
                    <Music className="w-8 h-8 text-primary mb-2" />
                    <CardTitle className="text-foreground">Music Tasks</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Complete simple music-related tasks and earn ST Coins
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card className="bg-card border-border hover:border-accent/40 transition-all duration-300">
                  <CardHeader>
                    <Users className="w-8 h-8 text-accent mb-2" />
                    <CardTitle className="text-foreground">Referral Program</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Invite friends and earn 10 ST Coins for each referral
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <Card className="bg-card border-border hover:border-primary/40 transition-all duration-300">
                  <CardHeader>
                    <Trophy className="w-8 h-8 text-primary mb-2" />
                    <CardTitle className="text-foreground">Leaderboard</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Compete with others and earn bonus rewards
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Card className="bg-card border-border hover:border-accent/40 transition-all duration-300">
                  <CardHeader>
                    <Gift className="w-8 h-8 text-accent mb-2" />
                    <CardTitle className="text-foreground">Redeem Rewards</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Exchange your ST Coins for real crypto and prizes
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-card rounded-2xl p-8 border border-border"
            >
              <Zap className="w-16 h-16 text-accent mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                Ready to Start <span className="text-accent">Earning?</span>
              </h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of users who are already earning crypto rewards through music. 
                It's free to start and takes less than 2 minutes to sign up.
              </p>
              <Button 
                size="lg" 
                onClick={handleGetStarted}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-3 rounded-full"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Join SoundTrump Now'}
                <Coins className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </AnimatedTransition>
  );
};

export default Index;
