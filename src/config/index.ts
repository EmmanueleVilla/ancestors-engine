export type BuildProfile = 'public' | 'private';

export interface BuildConfig {
  dataDir: string;
  assetsDir: string;
  outDir: string;
  profile: BuildProfile;
  clean: boolean;
  verbose: boolean;
  strict: boolean;
}

export const DEFAULT_CONFIG: BuildConfig = {
  dataDir: './data',
  assetsDir: './assets',
  outDir: './dist',
  profile: 'public',
  clean: true,
  verbose: false,
  strict: false,
};
