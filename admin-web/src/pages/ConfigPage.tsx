import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { GlobalConfig, ModLoaderType } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';
import {
  Settings2,
  Save,
  CheckCircle2,
  AlertCircle,
  Layers,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const ConfigPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [mcVersion, setMcVersion] = useState('1.21.1');
  const [loaderType, setLoaderType] = useState<ModLoaderType>('NEOFORGE');
  const [loaderVersion, setLoaderVersion] = useState('21.1.248');

  // Available options loaded from APIs
  const [mojangVersions, setMojangVersions] = useState<string[]>([]);
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingLoaders, setLoadingLoaders] = useState(false);

  // 1. Initial Load: Get saved config + fetch Mojang releases
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingVersions(true);
        const [savedConfig, mojangList] = await Promise.all([
          adminApi.getGlobalConfig().catch(() => null),
          adminApi.fetchMojangVersions().catch(() => ['1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5']),
        ]);

        setMojangVersions(mojangList);

        if (savedConfig) {
          setMcVersion(savedConfig.minecraftVersion);
          setLoaderType(savedConfig.loaderType);
          setLoaderVersion(savedConfig.loaderVersion);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load initial configuration');
      } finally {
        setLoading(false);
        setLoadingVersions(false);
      }
    };

    init();
  }, []);

  // 2. When mcVersion or loaderType changes, dynamically fetch compatible loader versions
  useEffect(() => {
    if (!mcVersion) return;

    if (loaderType === 'VANILLA') {
      setLoaderVersions([]);
      setLoaderVersion('None');
      return;
    }

    let isMounted = true;
    const fetchLoaders = async () => {
      setLoadingLoaders(true);
      try {
        let list: string[] = [];
        if (loaderType === 'NEOFORGE') {
          list = await adminApi.fetchNeoForgeLoaderVersions(mcVersion);
        } else if (loaderType === 'FABRIC') {
          list = await adminApi.fetchFabricLoaderVersions(mcVersion);
        } else if (loaderType === 'FORGE') {
          list = await adminApi.fetchForgeLoaderVersions(mcVersion);
        }

        if (isMounted) {
          setLoaderVersions(list);
          // If current loaderVersion is empty or not in the list, default to the latest available
          if (list.length > 0 && (!loaderVersion || loaderVersion === 'None' || !list.includes(loaderVersion))) {
            setLoaderVersion(list[0]);
          }
        }
      } catch (e) {
        console.error('Failed to fetch loader versions:', e);
      } finally {
        if (isMounted) setLoadingLoaders(false);
      }
    };

    fetchLoaders();
    return () => {
      isMounted = false;
    };
  }, [mcVersion, loaderType]);

  // Determine required Java version automatically based on MC version
  const getAutoJavaVersion = (ver: string): number => {
    const parts = ver.split('.');
    if (parts.length >= 2) {
      const minor = parseInt(parts[1], 10);
      const patch = parseInt(parts[2] || '0', 10);
      if (minor > 20 || (minor === 20 && patch >= 5)) return 21;
      if (minor >= 18) return 17;
      if (minor >= 17) return 16;
    }
    return 8;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSuccess(false);

    const javaVer = getAutoJavaVersion(mcVersion);

    try {
      await adminApi.updateGlobalConfig({
        minecraftVersion: mcVersion.trim(),
        loaderType,
        loaderVersion: loaderType === 'VANILLA' ? 'None' : loaderVersion.trim(),
        javaVersion: javaVer,
        jvmArgs: '-XX:+UseG1GC',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#df9168]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#df9168] mb-1">
            <Settings2 className="w-4 h-4" />
            <span>Game Engine</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">
            Game Configuration
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Select the Minecraft version and Mod Loader. All versions are fetched directly from official release APIs.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Game configuration updated successfully!</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="p-8 rounded-3xl bg-[#12141c] border border-white/10 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="p-2.5 rounded-xl bg-[#d97757]/20 text-[#df9168]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Minecraft & Mod Loader
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Choose the required game version and mod loader engine
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* 1. Minecraft Version (Searchable Select from Mojang API) */}
            <div>
              <SearchableSelect
                label="Minecraft Version"
                value={mcVersion}
                onChange={setMcVersion}
                options={mojangVersions}
                placeholder="Search Minecraft version (e.g. 1.21.1, 1.20.1)..."
                loading={loadingVersions}
                allowCustom={true}
              />
            </div>

            {/* 2. Mod Loader Type (Clean Pill Selectors) */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Mod Loader Engine
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'NEOFORGE', label: 'NeoForge' },
                  { key: 'FABRIC', label: 'Fabric' },
                  { key: 'FORGE', label: 'Forge' },
                  { key: 'VANILLA', label: 'Vanilla' },
                ].map((loader) => {
                  const isSelected = loaderType === loader.key;
                  return (
                    <button
                      type="button"
                      key={loader.key}
                      onClick={() => setLoaderType(loader.key as ModLoaderType)}
                      className={`py-3 px-4 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all border text-center ${
                        isSelected
                          ? 'bg-[#d97757] text-white border-[#e89d75] shadow-[0_0_15px_rgba(217,119,87,0.3)]'
                          : 'bg-slate-900/80 text-slate-300 hover:text-white border-white/10 hover:border-white/20'
                      }`}
                    >
                      {loader.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Loader Version (Searchable Select from Loader API) */}
            {loaderType !== 'VANILLA' && (
              <div>
                <SearchableSelect
                  label={`${loaderType === 'NEOFORGE' ? 'NeoForge' : loaderType === 'FABRIC' ? 'Fabric' : 'Forge'} Version`}
                  value={loaderVersion}
                  onChange={setLoaderVersion}
                  options={loaderVersions}
                  placeholder={`Select ${loaderType} version for MC ${mcVersion}...`}
                  loading={loadingLoaders}
                  allowCustom={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest text-white terracotta-gradient hover:brightness-110 shadow-[0_0_25px_rgba(217,119,87,0.35)] transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
