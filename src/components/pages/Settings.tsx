'use client';

import { Card } from '@/components/ui/card';
import { Settings as SettingsIcon, Bell, Lock, Database } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure system preferences and account settings.</p>
      </div>

      {/* General Settings */}
      <Card className="p-6 border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">General Settings</h2>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Institution Name</label>
            <input 
              type="text" 
              defaultValue="University of Science and Technology" 
              className="w-full px-4 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Default Passing Grade</label>
            <input 
              type="number" 
              min="0" 
              max="100"
              defaultValue="60" 
              className="w-full px-4 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Timezone</label>
            <select className="w-full px-4 py-2 border rounded-md bg-background">
              <option>UTC-8:00 (Philippine Time)</option>
              <option>UTC+0:00 (GMT)</option>
              <option>UTC+8:00 (Singapore)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Current Date</label>
            <input 
              type="date" 
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border rounded-md bg-background"
            />
          </div>

          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90">
            Save Changes
          </button>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6 border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <Bell className="w-5 h-5 text-orange-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Notification Settings</h2>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Email notifications for new exam submissions', checked: true },
            { label: 'Notify on grading completion', checked: true },
            { label: 'Daily summary reports', checked: false },
            { label: 'System maintenance alerts', checked: true }
          ].map((setting, idx) => (
            <label key={idx} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted/30 rounded">
              <input 
                type="checkbox" 
                defaultChecked={setting.checked}
                className="w-4 h-4"
              />
              <span className="text-sm text-foreground">{setting.label}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Security Settings */}
      <Card className="p-6 border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <Lock className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Security Settings</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Change Password</label>
            <button className="px-4 py-2 border rounded-md font-semibold hover:bg-muted/30">
              Update Password
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Two-Factor Authentication</label>
            <button className="px-4 py-2 border rounded-md font-semibold hover:bg-muted/30">
              Enable 2FA
            </button>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Last login:</strong> Feb 3, 2026 at 10:30 AM
            </p>
          </div>
        </div>
      </Card>

      {/* Data Management */}
      <Card className="p-6 border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Database className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Data Management</h2>
        </div>

        <div className="space-y-3">
          <div className="p-4 border rounded-lg">
            <p className="text-sm font-medium text-foreground mb-2">System Storage</p>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
              <div className="h-full bg-blue-500" style={{ width: '62%' }} />
            </div>
            <p className="text-xs text-muted-foreground">6.2 GB / 10 GB used</p>
          </div>

          <button className="w-full px-4 py-2 border rounded-md font-semibold hover:bg-muted/30">
            Download Data Backup
          </button>

          <button className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-md font-semibold hover:bg-red-50">
            Clear Cache
          </button>
        </div>
      </Card>

      {/* API Settings (Optional) */}
      <Card className="p-6 border">
        <h2 className="text-xl font-bold text-foreground mb-4">API & Integrations</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Manage API keys and third-party integrations.
        </p>
        <button className="px-4 py-2 border rounded-md font-semibold hover:bg-muted/30">
          View API Documentation
        </button>
      </Card>
    </div>
  );
}
