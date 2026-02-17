"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  FolderOpen,
  Globe,
  KeyRound,
  Palette,
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Clock,
  Info,
  Shield,
  Server,
  Database,
  HardDrive,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { healthApi } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Theme = "light" | "dark" | "system";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    healthApi
      .check()
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] =
    [
      { value: "light", label: "Light", icon: <Sun className="size-4" /> },
      { value: "dark", label: "Dark", icon: <Moon className="size-4" /> },
      {
        value: "system",
        label: "System",
        icon: <Monitor className="size-4" />,
      },
    ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="size-6" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Application configuration and preferences
        </p>
      </div>

      <div className="grid gap-6">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-5 text-blue-500" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Backend API connection settings and status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                  <Globe className="size-3.5" />
                  API Base URL
                </label>
                <div className="bg-muted rounded-md border px-3 py-2 font-mono text-sm">
                  {API_BASE_URL}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                  <HardDrive className="size-3.5" />
                  Backend Status
                </label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  {backendStatus === "checking" && (
                    <>
                      <RefreshCw className="text-muted-foreground size-3.5 animate-spin" />
                      <span className="text-muted-foreground">
                        Checking...
                      </span>
                    </>
                  )}
                  {backendStatus === "online" && (
                    <>
                      <span className="size-2 rounded-full bg-green-500" />
                      <span className="text-green-600 dark:text-green-400">
                        Online
                      </span>
                    </>
                  )}
                  {backendStatus === "offline" && (
                    <>
                      <span className="size-2 rounded-full bg-red-500" />
                      <span className="text-red-600 dark:text-red-400">
                        Offline
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                <KeyRound className="size-3.5" />
                Nexusmods API Key
              </label>
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Shield className="text-muted-foreground size-3.5" />
                <span className="text-muted-foreground">
                  Configured via environment variable
                </span>
                <Badge variant="secondary" className="ml-auto">
                  Server-side
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <Info className="mt-0.5 size-3 shrink-0" />
                The API key is set in the backend&apos;s{" "}
                <code className="bg-muted rounded px-1">.env</code> file and
                never exposed to the frontend for security.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                <Database className="size-3.5" />
                API Endpoints
              </label>
              <div className="bg-muted space-y-1 rounded-md border p-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="w-12 justify-center text-xs font-semibold text-green-600 dark:text-green-400"
                  >
                    GET
                  </Badge>
                  <span>/api/mods/</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="w-12 justify-center text-xs font-semibold text-blue-600 dark:text-blue-400"
                  >
                    POST
                  </Badge>
                  <span>/api/mods/</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="w-12 justify-center text-xs font-semibold text-green-600 dark:text-green-400"
                  >
                    GET
                  </Badge>
                  <span>/api/local-files/</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="w-12 justify-center text-xs font-semibold text-blue-600 dark:text-blue-400"
                  >
                    POST
                  </Badge>
                  <span>/api/local-files/scan</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="w-12 justify-center text-xs font-semibold text-green-600 dark:text-green-400"
                  >
                    GET
                  </Badge>
                  <span>/api/updates/check</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Directory Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="size-5 text-amber-500" />
              Directory Configuration
            </CardTitle>
            <CardDescription>
              Local mods directory path and file scanning settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                <FolderOpen className="size-3.5" />
                Mods Directory
              </label>
              <div className="bg-muted rounded-md border px-3 py-2 font-mono text-sm">
                Configured in backend settings
              </div>
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <Info className="mt-0.5 size-3 shrink-0" />
                The mods directory path is set in the backend configuration.
                Use the Local Files page to scan and view files.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground text-sm font-medium">
                Supported File Types
              </label>
              <div className="flex flex-wrap gap-2">
                {[".zip", ".rar", ".7z", ".pak", ".arc"].map((ext) => (
                  <Badge key={ext} variant="secondary">
                    {ext}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-5 text-purple-500" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-muted-foreground text-sm font-medium">
                Theme
              </label>
              <div className="flex gap-2">
                {mounted &&
                  themeOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={
                        theme === option.value ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setTheme(option.value)}
                      className="flex items-center gap-2"
                    >
                      {option.icon}
                      {option.label}
                    </Button>
                  ))}
                {!mounted && (
                  <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
                )}
              </div>
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <Info className="mt-0.5 size-3 shrink-0" />
                Your theme preference is saved locally in your browser.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Update Check Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="size-5 text-green-500" />
              Update Checking
            </CardTitle>
            <CardDescription>
              Configure how mod updates are checked
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-sm font-medium">
                  Check Mode
                </label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Clock className="text-muted-foreground size-3.5" />
                  <span>Manual Only</span>
                  <Badge variant="secondary" className="ml-auto">
                    Current
                  </Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-sm font-medium">
                  Rate Limiting
                </label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Shield className="text-muted-foreground size-3.5" />
                  <span>Nexusmods API limits apply</span>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-medium">
                How update checking works
              </h4>
              <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>
                  Navigate to the <strong>Dashboard</strong> or{" "}
                  <strong>Mods</strong> page
                </li>
                <li>
                  Click <strong>&quot;Check for Updates&quot;</strong> to query
                  the Nexusmods API
                </li>
                <li>
                  Mods with available updates will show an update badge
                </li>
                <li>
                  Click the download link to get the latest version from
                  Nexusmods
                </li>
              </ol>
            </div>

            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <Info className="mt-0.5 size-3 shrink-0" />
              The Nexusmods API has rate limits. Updates are checked manually
              to respect these limits and avoid excessive API calls.
            </p>
          </CardContent>
        </Card>

        {/* About Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-5 text-sky-500" />
              About
            </CardTitle>
            <CardDescription>
              Application information and resources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Frontend
                </span>
                <p className="text-sm font-medium">Next.js + React</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Backend
                </span>
                <p className="text-sm font-medium">FastAPI + Python</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Data Source
                </span>
                <p className="text-sm font-medium">Nexusmods API</p>
              </div>
            </div>
            <div className="border-t pt-4">
              <a
                href="https://www.nexusmods.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
              >
                <ExternalLink className="size-3.5" />
                Visit Nexusmods
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
