/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInAnonymously, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  UserProfile, 
  Room, 
  Schedule, 
  UsageLog, 
  OperationType, 
  FirestoreErrorInfo 
} from './types';
import { 
  LayoutDashboard, 
  QrCode, 
  History, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  Download,
  Users,
  DoorOpen,
  Clock,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line
} from 'recharts';
import { format, differenceInMinutes } from 'date-fns';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error Handler
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || '',
      email: auth.currentUser?.email || '',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || '',
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  const errorString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorString);
  throw new Error(errorString);
}

// Components
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-black text-white hover:bg-zinc-800',
      secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
      outline: 'border border-zinc-200 bg-transparent hover:bg-zinc-50',
      ghost: 'bg-transparent hover:bg-zinc-100 text-zinc-600',
      danger: 'bg-red-500 text-white hover:bg-red-600',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-xl border border-zinc-200 bg-white p-6 shadow-sm', className)} {...props}>
    {children}
  </div>
);

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      'flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
);

const Select = ({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      'flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </select>
);

// Main App
export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'history' | 'management'>('dashboard');
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [loginScanning, setLoginScanning] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  
  // Data State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [activeSemester, setActiveSemester] = useState<'1st' | '2nd' | 'Summer'>('1st');
  const [activeYear] = useState(2026);

  // Seed Rooms M101-M110
  useEffect(() => {
    if (profile?.role === 'Administrator' || profile?.role === 'Facility Manager') {
      const seedRooms = async () => {
        const roomNames = ['M101', 'M102', 'M103', 'M104', 'M105', 'M106', 'M107', 'M108', 'M109', 'M110'];
        for (const name of roomNames) {
          const exists = rooms.some(r => r.name === name);
          if (!exists) {
            const roomRef = doc(collection(db, 'rooms'));
            await setDoc(roomRef, {
              id: roomRef.id,
              name,
              building: 'Main',
              capacity: 40
            });
          }
        }
      };
      seedRooms();
    }
  }, [profile, rooms.length]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (profileDoc.exists()) {
            setProfile(profileDoc.data() as UserProfile);
          }
          // Note: Profile creation is handled in handleSignIn for new anonymous users
          
          if (pendingRoomId) {
            setActiveTab('scanner');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [pendingRoomId]);

  // Login Scanner Effect
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (loginScanning && !user) {
      scanner = new Html5QrcodeScanner('login-reader', { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        setPendingRoomId(decodedText);
        setLoginScanning(false);
        scanner?.clear();
      }, () => {});
    }
    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [loginScanning, user]);

  // Data Listeners
  useEffect(() => {
    if (!user) {
      // Still fetch rooms for the login scanner to validate if needed
      const roomsUnsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
        setRooms(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'rooms'));
      return () => roomsUnsub();
    }

    const roomsUnsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      setRooms(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'rooms'));

    const schedulesUnsub = onSnapshot(
      query(collection(db, 'schedules'), where('semester', '==', activeSemester), where('year', '==', activeYear)),
      (snapshot) => {
        setSchedules(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Schedule)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'schedules')
    );

    const isAdmin = profile?.role === 'Administrator' || profile?.role === 'Facility Manager';
    const logsQuery = isAdmin 
      ? query(collection(db, 'usageLogs'), where('semester', '==', activeSemester), where('year', '==', activeYear), orderBy('entryTime', 'desc'))
      : query(collection(db, 'usageLogs'), where('userId', '==', user.uid), where('semester', '==', activeSemester), where('year', '==', activeYear), orderBy('entryTime', 'desc'));

    const logsUnsub = onSnapshot(
      logsQuery,
      (snapshot) => {
        setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UsageLog)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'usageLogs')
    );

    return () => {
      roomsUnsub();
      schedulesUnsub();
      logsUnsub();
    };
  }, [user, activeSemester, activeYear]);

  const handleSignIn = async () => {
    if (!emailInput) {
      setEmailError('Please enter your institutional email.');
      return;
    }
    if (!emailInput.endsWith('@neu.edu.ph')) {
      setEmailError('Please use your @neu.edu.ph email address.');
      return;
    }
    setEmailError(null);

    try {
      const result = await signInAnonymously(auth);
      const firebaseUser = result.user;
      
      // Create or update profile immediately
      const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!profileDoc.exists()) {
        const isAdmin = emailInput === 'anthonvan.calban@neu.edu.ph';
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: emailInput,
          displayName: emailInput.split('@')[0],
          role: isAdmin ? 'Administrator' : 'Professor',
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
        setProfile(newProfile);
      } else {
        // Update email if it changed (though unlikely for same UID)
        await updateDoc(doc(db, 'users', firebaseUser.uid), { email: emailInput });
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/admin-restricted-operation') {
        setEmailError('Anonymous Authentication is disabled in Firebase. Please enable it in the Firebase Console (Authentication > Sign-in method).');
      } else {
        setEmailError('Failed to sign in. Please try again.');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-black" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12">
        <div className="w-full max-w-xl">
          <div className="space-y-12 text-center">
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="rounded-3xl bg-black p-5 text-white shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                  <DoorOpen className="h-12 w-12" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-6xl font-black tracking-tighter text-zinc-900 sm:text-7xl">
                  RoomFlow
                </h1>
                <p className="text-xl text-zinc-500 max-w-md mx-auto font-medium">
                  The professional standard for university facility usage and academic analytics.
                </p>
              </div>
            </div>

            <Card className="p-10 shadow-2xl border-0 bg-white ring-1 ring-zinc-100 rounded-[2.5rem] space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">
                    Institutional Email
                  </label>
                  <Input 
                    type="email" 
                    placeholder="name@neu.edu.ph" 
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    className={cn(
                      "py-7 text-lg rounded-2xl border-2 transition-all",
                      emailError ? "border-red-200 bg-red-50" : "border-zinc-100 focus:border-zinc-900"
                    )}
                  />
                  {emailError && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-red-500 ml-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {emailError}
                      </p>
                      {emailError.includes('Anonymous Authentication') && (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Quick Fix Required:</p>
                          <ol className="text-[10px] text-amber-700 space-y-1 list-decimal ml-4 font-medium">
                            <li>Open <a href="https://console.firebase.google.com/" target="_blank" className="underline font-bold">Firebase Console</a></li>
                            <li>Go to <b>Authentication</b> &gt; <b>Sign-in method</b></li>
                            <li>Click <b>Add new provider</b> &gt; <b>Anonymous</b></li>
                            <li>Toggle <b>Enable</b> and click <b>Save</b></li>
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-2">
                  <Button onClick={handleSignIn} className="w-full py-8 text-2xl font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all h-auto rounded-2xl bg-black text-white">
                    Continue to Sign In
                  </Button>
                  <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 uppercase tracking-[0.2em] font-black">
                    <div className="h-[1px] w-8 bg-zinc-200" />
                    No Password Required
                    <div className="h-[1px] w-8 bg-zinc-200" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-50">
                {pendingRoomId ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-700 border border-emerald-100 shadow-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Room Identified: {rooms.find(r => r.id === pendingRoomId || r.name === pendingRoomId)?.name || pendingRoomId}
                    <button onClick={() => setPendingRoomId(null)} className="ml-2 text-emerald-400 hover:text-emerald-600">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : loginScanning ? (
                  <div className="space-y-4">
                    <div id="login-reader" className="overflow-hidden rounded-3xl ring-1 ring-zinc-200 shadow-inner" />
                    <Button variant="ghost" onClick={() => setLoginScanning(false)} className="w-full">
                      Cancel Scanner
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={() => setLoginScanning(true)} 
                    className="w-full gap-3 py-8 border-2 border-dashed h-auto text-lg font-bold rounded-2xl hover:bg-zinc-50 transition-all"
                  >
                    <QrCode className="h-6 w-6 text-zinc-400" />
                    Scan Room QR to Start
                  </Button>
                )}
              </div>

            </Card>

            <div className="flex justify-center gap-8 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300">
              <span>Main Building</span>
              <span>•</span>
              <span>Computer Labs</span>
              <span>•</span>
              <span>M101-M110</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-zinc-200 bg-white">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center px-6 border-b border-zinc-100">
            <span className="text-xl font-bold tracking-tight">RoomFlow</span>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            <NavItem 
              icon={<LayoutDashboard className="h-5 w-5" />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <NavItem 
              icon={<QrCode className="h-5 w-5" />} 
              label="Scanner" 
              active={activeTab === 'scanner'} 
              onClick={() => setActiveTab('scanner')} 
            />
            <NavItem 
              icon={<DoorOpen className="h-5 w-5" />} 
              label="Rooms" 
              active={activeTab === 'rooms'} 
              onClick={() => setActiveTab('rooms')} 
            />
            <NavItem 
              icon={<History className="h-5 w-5" />} 
              label="Logs" 
              active={activeTab === 'history'} 
              onClick={() => setActiveTab('history')} 
            />
            {(profile?.role === 'Administrator' || profile?.role === 'Facility Manager') && (
              <NavItem 
                icon={<Settings className="h-5 w-5" />} 
                label="Management" 
                active={activeTab === 'management'} 
                onClick={() => setActiveTab('management')} 
              />
            )}
          </nav>
          <div className="border-t border-zinc-200 p-4">
            <div className="flex items-center gap-3 px-2 py-3">
              <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-600">
                {profile?.displayName?.[0]}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{profile?.displayName}</p>
                <p className="truncate text-xs text-zinc-500">{profile?.role}</p>
              </div>
              <button onClick={handleSignOut} className="text-zinc-400 hover:text-zinc-900">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight capitalize">{activeTab}</h2>
            <p className="text-zinc-500">Manage and monitor room activities.</p>
          </div>
          <div className="flex items-center gap-4">
            <Select 
              value={activeSemester} 
              onChange={(e) => setActiveSemester(e.target.value as any)}
              className="w-32"
            >
              <option value="1st">1st Sem</option>
              <option value="2nd">2nd Sem</option>
              <option value="Summer">Summer</option>
            </Select>
            <div className="h-10 w-[1px] bg-zinc-200" />
            <span className="text-sm font-medium text-zinc-600">{activeYear} Semester</span>
          </div>
        </header>

        {activeTab === 'dashboard' && <DashboardView rooms={rooms} logs={logs} schedules={schedules} />}
        {activeTab === 'rooms' && <RoomsView rooms={rooms} />}
        {activeTab === 'scanner' && (
          <ScannerView 
            rooms={rooms} 
            schedules={schedules} 
            profile={profile!} 
            initialRoomId={pendingRoomId} 
            onClearInitial={() => setPendingRoomId(null)}
            activeSemester={activeSemester}
          />
        )}
        {activeTab === 'history' && <HistoryView logs={logs} rooms={rooms} schedules={schedules} />}
        {activeTab === 'management' && <ManagementView rooms={rooms} schedules={schedules} />}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function DashboardView({ rooms, logs, schedules }: { rooms: Room[]; logs: UsageLog[]; schedules: Schedule[] }) {
  const stats = useMemo(() => {
    const totalHours = logs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0) / 60;
    const activeRooms = new Set(logs.map(l => l.roomId)).size;
    
    const usageByRoom = rooms.map(room => {
      const roomLogs = logs.filter(l => l.roomId === room.id);
      const hours = roomLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0) / 60;
      return { name: room.name, hours: Math.round(hours * 10) / 10 };
    }).sort((a, b) => b.hours - a.hours);

    const usageByHour = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }));
    logs.forEach(log => {
      const hour = new Date(log.entryTime).getHours();
      usageByHour[hour].count++;
    });

    return { totalHours, activeRooms, usageByRoom, usageByHour };
  }, [rooms, logs]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard icon={<Clock className="h-5 w-5" />} label="Total Usage Hours" value={Math.round(stats.totalHours)} subtext="Across all facilities" />
        <StatCard icon={<DoorOpen className="h-5 w-5" />} label="Active Rooms" value={stats.activeRooms} subtext={`Out of ${rooms.length} total`} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Sessions" value={logs.length} subtext="This semester" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <h3 className="mb-6 text-lg font-semibold">Usage by Room (Hours)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.usageByRoom}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <Tooltip 
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                />
                <Bar dataKey="hours" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="col-span-1">
          <h3 className="mb-6 text-lg font-semibold">Peak Usage Times</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.usageByHour}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                />
                <Line type="monotone" dataKey="count" stroke="#18181b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtext }: { icon: React.ReactNode; label: string; value: string | number; subtext: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="rounded-lg bg-zinc-100 p-3 text-zinc-900">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-500">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-xs text-zinc-400">{subtext}</span>
        </div>
      </div>
    </Card>
  );
}

function ScannerView({ 
  rooms, 
  schedules, 
  profile, 
  initialRoomId, 
  onClearInitial,
  activeSemester
}: { 
  rooms: Room[]; 
  schedules: Schedule[]; 
  profile: UserProfile; 
  initialRoomId?: string | null;
  onClearInitial?: () => void;
  activeSemester: '1st' | '2nd' | 'Summer';
}) {
  const [scanning, setScanning] = useState(false);
  const [scannedRoom, setScannedRoom] = useState<Room | null>(null);
  const [activeSession, setActiveSession] = useState<UsageLog | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Handle initial room from login scan
  useEffect(() => {
    if (initialRoomId) {
      const room = rooms.find(r => r.id === initialRoomId || r.name === initialRoomId);
      if (room) {
        setScannedRoom(room);
      }
    }
  }, [initialRoomId, rooms]);

  useEffect(() => {
    const q = query(
      collection(db, 'usageLogs'), 
      where('userId', '==', profile.uid), 
      where('exitTime', '==', null)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UsageLog);
      } else {
        setActiveSession(null);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'usageLogs/active'));
    return unsub;
  }, [profile.uid]);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (scanning) {
      scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 }, false);
      scanner.render(onScanSuccess, onScanError);
    }
    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scanning]);

  function onScanSuccess(decodedText: string) {
    const room = rooms.find(r => r.id === decodedText || r.name === decodedText);
    if (room) {
      setScannedRoom(room);
      setScanning(false);
    } else {
      setStatus({ type: 'error', message: 'Invalid QR Code. Room not found.' });
    }
  }

  function onScanError() {}

  const handleEntry = async () => {
    if (!scannedRoom) return;
    const now = new Date();
    const day = now.getDay();
    const timeStr = format(now, 'HH:mm');
    
    const currentSubject = schedules.find(s => 
      s.roomId === scannedRoom.id && 
      s.dayOfWeek === day &&
      timeStr >= s.startTime &&
      timeStr <= s.endTime
    );

    try {
      const logData = {
        roomId: scannedRoom.id,
        userId: profile.uid,
        subjectId: currentSubject?.id || null,
        entryTime: now.toISOString(),
        exitTime: null,
        semester: currentSubject?.semester || activeSemester,
        year: now.getFullYear(),
      };
      await addDoc(collection(db, 'usageLogs'), logData);
      setStatus({ type: 'success', message: `Successfully entered ${scannedRoom.name}` });
      setScannedRoom(null);
      onClearInitial?.();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'usageLogs');
    }
  };

  const handleExit = async () => {
    if (!activeSession) return;
    const now = new Date();
    const entry = new Date(activeSession.entryTime);
    const duration = differenceInMinutes(now, entry);

    try {
      await updateDoc(doc(db, 'usageLogs', activeSession.id), {
        exitTime: now.toISOString(),
        durationMinutes: duration
      });
      setStatus({ type: 'success', message: 'Successfully logged exit.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `usageLogs/${activeSession.id}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {status && (
        <div className={cn(
          'flex items-center justify-between rounded-lg p-4 text-sm font-medium',
          status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 
          status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
        )}>
          <div className="flex items-center gap-2">
            {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {status.message}
          </div>
          <button onClick={() => setStatus(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {activeSession ? (
        <Card className="text-center space-y-6 py-12">
          <div className="mx-auto h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <Clock className="h-10 w-10 text-emerald-600 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Active Session</h3>
            <p className="text-zinc-500">You are currently logged into {rooms.find(r => r.id === activeSession.roomId)?.name || 'a room'}.</p>
            <p className="text-sm font-mono text-zinc-400">Started at {format(new Date(activeSession.entryTime), 'hh:mm a')}</p>
          </div>
          <Button variant="danger" onClick={handleExit} className="w-full max-w-xs py-6 text-lg">
            End Session
          </Button>
        </Card>
      ) : scannedRoom ? (
        <Card className="text-center space-y-6 py-12">
          <div className="mx-auto h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center">
            <DoorOpen className="h-10 w-10 text-zinc-900" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">{scannedRoom.name}</h3>
            <p className="text-zinc-500">{scannedRoom.building} • Capacity: {scannedRoom.capacity}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={handleEntry} className="w-full py-6 text-lg">
              Confirm Entry
            </Button>
            <Button variant="outline" onClick={() => { setScannedRoom(null); onClearInitial?.(); }}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="text-center space-y-8 py-12">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Ready to Scan</h3>
            <p className="text-zinc-500">Scan the QR code located at the room entrance.</p>
          </div>
          
          {scanning ? (
            <div id="reader" className="overflow-hidden rounded-xl border-2 border-dashed border-zinc-200" />
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="relative h-48 w-48 rounded-2xl border-2 border-zinc-200 flex items-center justify-center bg-zinc-50">
                <QrCode className="h-24 w-24 text-zinc-200" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Button onClick={() => setScanning(true)} className="gap-2">
                    <QrCode className="h-4 w-4" />
                    Open Scanner
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function RoomsView({ rooms }: { rooms: Room[] }) {
  const [viewingQR, setViewingQR] = useState<Room | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {rooms.map(room => (
          <Card key={room.id} className="group relative overflow-hidden p-0">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-zinc-100 p-3 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <DoorOpen className="h-6 w-6" />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-zinc-100"
                  onClick={() => setViewingQR(room)}
                >
                  <QrCode className="h-5 w-5" />
                </Button>
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-bold tracking-tight">{room.name}</h4>
                <p className="text-sm text-zinc-500">{room.building} Building</p>
              </div>
              <div className="mt-6 flex items-center gap-4 text-xs font-medium text-zinc-400">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {room.capacity} Seats
                </div>
                <div className="h-3 w-[1px] bg-zinc-200" />
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Available
                </div>
              </div>
            </div>
            <div className="bg-zinc-50 px-6 py-3 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Facility ID: {room.id.slice(0, 8)}</span>
              <ChevronRight className="h-4 w-4 text-zinc-300" />
            </div>
          </Card>
        ))}
      </div>

      {viewingQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm"
          >
            <Card className="text-center space-y-6 shadow-2xl border-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Room QR Code</h3>
                <button onClick={() => setViewingQR(null)} className="text-zinc-400 hover:text-zinc-900 p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-8 bg-white rounded-3xl border-2 border-zinc-100 shadow-inner flex justify-center">
                <QRCodeSVG value={viewingQR.id} size={240} level="H" includeMargin={true} />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black tracking-tight">{viewingQR.name}</p>
                <p className="text-sm text-zinc-500 font-medium">{viewingQR.building} Building • Facility Access</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => window.print()} variant="outline" className="gap-2 rounded-xl">
                  <Download className="h-4 w-4" />
                  Print
                </Button>
                <Button onClick={() => setViewingQR(null)} className="bg-black text-white hover:bg-zinc-800 rounded-xl">
                  Close
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function HistoryView({ logs, rooms, schedules }: { logs: UsageLog[]; rooms: Room[]; schedules: Schedule[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => {
    const room = rooms.find(r => r.id === log.roomId);
    const subject = schedules.find(s => s.id === log.subjectId);
    return (
      room?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject?.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const exportToCSV = () => {
    const headers = ['Room', 'Subject', 'Entry Time', 'Exit Time', 'Duration (Min)', 'Semester'];
    const rows = filteredLogs.map(log => [
      rooms.find(r => r.id === log.roomId)?.name || 'Unknown',
      schedules.find(s => s.id === log.subjectId)?.subject || 'N/A',
      format(new Date(log.entryTime), 'yyyy-MM-dd HH:mm'),
      log.exitTime ? format(new Date(log.exitTime), 'yyyy-MM-dd HH:mm') : 'Active',
      log.durationMinutes || 0,
      log.semester
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `room_usage_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input 
            placeholder="Search by room or subject..." 
            className="pl-10" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2" onClick={exportToCSV}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-6 py-4 font-medium">Room</th>
              <th className="px-6 py-4 font-medium">Subject</th>
              <th className="px-6 py-4 font-medium">Entry</th>
              <th className="px-6 py-4 font-medium">Exit</th>
              <th className="px-6 py-4 font-medium text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-900">
                  {rooms.find(r => r.id === log.roomId)?.name || 'Unknown'}
                </td>
                <td className="px-6 py-4 text-zinc-600">
                  {schedules.find(s => s.id === log.subjectId)?.subject || 'Manual Entry'}
                </td>
                <td className="px-6 py-4 text-zinc-500">
                  {format(new Date(log.entryTime), 'MMM d, hh:mm a')}
                </td>
                <td className="px-6 py-4 text-zinc-500">
                  {log.exitTime ? format(new Date(log.exitTime), 'hh:mm a') : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-zinc-500">
                  {log.durationMinutes ? `${log.durationMinutes}m` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ManagementView({ rooms, schedules }: { rooms: Room[]; schedules: Schedule[] }) {
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', building: '', capacity: 30 });

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const roomRef = doc(collection(db, 'rooms'));
      await setDoc(roomRef, { ...newRoom, id: roomRef.id });
      setNewRoom({ name: '', building: '', capacity: 30 });
      setShowAddRoom(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rooms');
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Room Management</h3>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAddRoom(!showAddRoom)}>
            <Plus className="h-4 w-4" />
            Add Room
          </Button>
        </div>

        {showAddRoom && (
          <Card className="space-y-4">
            <form onSubmit={handleAddRoom} className="space-y-4">
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500">Room Name</label>
                  <Input 
                    value={newRoom.name} 
                    onChange={e => setNewRoom({...newRoom, name: e.target.value})} 
                    placeholder="e.g. CL-101" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500">Building</label>
                  <Input 
                    value={newRoom.building} 
                    onChange={e => setNewRoom({...newRoom, building: e.target.value})} 
                    placeholder="e.g. Science Bldg" 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500">Capacity</label>
                <Input 
                  type="number" 
                  value={newRoom.capacity} 
                  onChange={e => setNewRoom({...newRoom, capacity: parseInt(e.target.value)})} 
                  required 
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Save Room</Button>
                <Button type="button" variant="ghost" onClick={() => setShowAddRoom(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-3">
          {rooms.map(room => (
            <Card key={room.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-zinc-100 p-2">
                  <DoorOpen className="h-5 w-5 text-zinc-600" />
                </div>
                <div>
                  <p className="font-medium">{room.name}</p>
                  <p className="text-xs text-zinc-500">{room.building} • {room.capacity} Seats</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-400">{room.id.slice(0, 8)}</span>
                <ChevronRight className="h-4 w-4 text-zinc-300" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Schedules</h3>
        <div className="space-y-3">
          {schedules.map(schedule => (
            <Card key={schedule.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                  {schedule.subject}
                </span>
                <span className="text-xs text-zinc-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][schedule.dayOfWeek]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Clock className="h-3 w-3" />
                  {schedule.startTime} - {schedule.endTime}
                </div>
                <div className="text-xs font-medium text-zinc-900">
                  {rooms.find(r => r.id === schedule.roomId)?.name}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
