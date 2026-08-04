import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicBase = path.resolve(__dirname, '../../public');

function resolveDir(preferred, aliases = []) {
  const fullPreferred = path.join(publicBase, preferred);
  if (fs.existsSync(fullPreferred)) {
    return fullPreferred;
  }
  for (const alias of aliases) {
    const fullAlias = path.join(publicBase, alias);
    if (fs.existsSync(fullAlias)) {
      return fullAlias;
    }
  }
  return fullPreferred;
}

/**
 * Global configuration settings for the Minecraft Launcher server.
 */
const config = {
  // Server network settings
  port: process.env.PORT || 3000,
  host: process.env.HOST || '127.0.0.1',

  // Directory paths
  modsDir: resolveDir('mods'),
  resourcepacksDir: resolveDir('resourcepacks', ['resoursepack', 'resoursepacks', 'resourcepack']),
  shaderpacksDir: resolveDir('shaderpacks', ['shaderpack', 'shaders']),

  // Static route prefixes for serving files
  staticModsRoute: '/mods',
  staticResourcepacksRoute: '/resourcepacks',
  staticShaderpacksRoute: '/shaderpacks',
};

export default config;
