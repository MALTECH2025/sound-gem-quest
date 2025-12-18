
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Users, ListChecks, ChevronRight, Music } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { AnimatedTransition } from '@/components/ui/AnimatedTransition';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

const AdminLayout = ({ children, title = "Dashboard", description }: AdminLayoutProps) => {
  const adminNavItems = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: <LayoutDashboard className="w-4 h-4 mr-2" />
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: <Users className="w-4 h-4 mr-2" />
    },
    {
      name: 'Tasks',
      href: '/admin/tasks',
      icon: <ListChecks className="w-4 h-4 mr-2" />
    },
    {
      name: 'Spotify Stats',
      href: '/admin/spotify',
      icon: <Music className="w-4 h-4 mr-2" />
    }
  ];

  return (
    <AnimatedTransition>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        
        <main className="flex-grow pt-24 pb-12">
          <div className="container px-4 mx-auto">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Admin sidebar */}
              <div className="w-full md:w-64 shrink-0">
                <div className="sticky top-24 bg-card border rounded-lg p-4 shadow-sm">
                  <h3 className="font-semibold text-lg mb-4">Admin Panel</h3>
                  <Separator className="mb-4" />
                  
                  <nav className="space-y-2">
                    {adminNavItems.map((item) => (
                      <Link key={item.href} to={item.href}>
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start"
                        >
                          {item.icon}
                          {item.name}
                        </Button>
                      </Link>
                    ))}
                  </nav>
                </div>
              </div>
              
              {/* Main content */}
              <div className="flex-1">
                <div className="mb-6">
                  <div className="flex items-center text-muted-foreground text-sm mb-2">
                    <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
                    <ChevronRight className="w-4 h-4 mx-1" />
                    <Link to="/admin" className="hover:text-foreground">Admin</Link>
                    {title !== 'Dashboard' && (
                      <>
                        <ChevronRight className="w-4 h-4 mx-1" />
                        <span className="text-foreground">{title}</span>
                      </>
                    )}
                  </div>
                  
                  <h1 className="text-3xl font-bold">{title}</h1>
                  {description && (
                    <p className="text-muted-foreground mt-1">{description}</p>
                  )}
                </div>
                
                {children}
              </div>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>
    </AnimatedTransition>
  );
};

export default AdminLayout;
