'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function UserDebugPage() {
  const { user } = useAuth();
  const [firestoreData, setFirestoreData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchFirestoreData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.id));
      if (userDoc.exists()) {
        setFirestoreData(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFirestoreData();
  }, [user?.id]);

  useEffect(() => {
    console.log('[DEBUG] USER DEBUG PAGE - User object:', user);
    console.log('[DEBUG] USER DEBUG PAGE - InstructorId:', user?.instructorId);
  }, [user]);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">User Debug Information</h1>

      <div className="grid gap-6">
        {/* Auth Context User */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            [AUTH] Auth Context User Object
            <Button onClick={fetchFirestoreData} size="sm" variant="outline">
              Refresh
            </Button>
          </h2>
          
          <div className="mb-4">
            <div className="text-sm font-mono bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {user ? (
                <pre>{JSON.stringify(user, null, 2)}</pre>
              ) : (
                <p className="text-red-600">No user logged in</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 bg-blue-50 rounded">
              <div className="text-sm text-gray-600">User ID</div>
              <div className="font-mono text-sm">{user?.id || 'N/A'}</div>
            </div>
            <div className="p-3 bg-blue-50 rounded">
              <div className="text-sm text-gray-600">Email</div>
              <div className="font-mono text-sm">{user?.email || 'N/A'}</div>
            </div>
            <div className="p-3 bg-blue-50 rounded">
              <div className="text-sm text-gray-600">Display Name</div>
              <div className="font-mono text-sm">{user?.displayName || 'N/A'}</div>
            </div>
            <div className={`p-3 rounded ${user?.instructorId ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-sm text-gray-600">Instructor ID</div>
              <div className="font-mono text-sm font-bold">
                {user?.instructorId || '[MISSING]'}
              </div>
            </div>
          </div>
        </Card>

        {/* Firestore Data */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">[FIRESTORE] Firestore User Document</h2>
          
          {loading ? (
            <p>Loading...</p>
          ) : firestoreData ? (
            <>
              <div className="text-sm font-mono bg-gray-100 p-4 rounded overflow-auto max-h-96 mb-4">
                <pre>{JSON.stringify(firestoreData, null, 2)}</pre>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-purple-50 rounded">
                  <div className="text-sm text-gray-600">Full Name</div>
                  <div className="font-mono text-sm">{firestoreData.fullName || 'N/A'}</div>
                </div>
                <div className={`p-3 rounded ${firestoreData.instructorId ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="text-sm text-gray-600">Instructor ID (Firestore)</div>
                  <div className="font-mono text-sm font-bold">
                    {firestoreData.instructorId || '[MISSING IN FIRESTORE]'}
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded">
                  <div className="text-sm text-gray-600">Role</div>
                  <div className="font-mono text-sm">{firestoreData.role || 'N/A'}</div>
                </div>
                <div className="p-3 bg-purple-50 rounded">
                  <div className="text-sm text-gray-600">Created At</div>
                  <div className="font-mono text-sm">
                    {firestoreData.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-red-600">No Firestore data found</p>
          )}
        </Card>

        {/* Diagnosis */}
        <Card className="p-6 border-2 border-blue-500">
          <h2 className="text-xl font-bold mb-4">[DIAGNOSIS] Diagnosis</h2>
          
          {!user ? (
            <div className="p-4 bg-red-50 rounded">
              <p className="text-red-800">[ERROR] No user logged in</p>
            </div>
          ) : !firestoreData?.instructorId ? (
            <div className="p-4 bg-red-50 rounded">
              <p className="text-red-800 font-bold mb-2">[ERROR] Instructor ID is MISSING from Firestore!</p>
              <p className="text-sm">The user document in Firestore does not have an instructorId field.</p>
              <p className="text-sm mt-2">Solution: Go to <a href="/diagnostics" className="underline text-blue-600">/diagnostics</a> and click "Fix Instructor ID"</p>
            </div>
          ) : !user.instructorId ? (
            <div className="p-4 bg-yellow-50 rounded">
              <p className="text-yellow-800 font-bold mb-2">[WARNING] Instructor ID exists in Firestore but NOT loaded in Auth Context!</p>
              <p className="text-sm">Firestore has: <code className="bg-white px-2 py-1 rounded">{firestoreData.instructorId}</code></p>
              <p className="text-sm mt-2">Solution: Log out and log back in, or clear cache at <a href="/clear-cache" className="underline text-blue-600">/clear-cache</a></p>
            </div>
          ) : user.instructorId === firestoreData.instructorId ? (
            <div className="p-4 bg-green-50 rounded">
              <p className="text-green-800 font-bold mb-2">[SUCCESS] Everything looks good!</p>
              <p className="text-sm">Instructor ID: <code className="bg-white px-2 py-1 rounded font-bold">{user.instructorId}</code></p>
              <p className="text-sm mt-2">You should be able to create classes and exams with this instructor ID.</p>
            </div>
          ) : (
            <div className="p-4 bg-red-50 rounded">
              <p className="text-red-800 font-bold">[ERROR] Mismatch detected!</p>
              <p className="text-sm">Auth Context: {user.instructorId}</p>
              <p className="text-sm">Firestore: {firestoreData.instructorId}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
