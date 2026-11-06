import { app } from 'electron';
import { getForkPreviewUserDataPath, isForkPreviewRuntime } from './fork-preview-runtime';
import { getElectronUserDataPath } from '@iptvnator/shared/database';
import { selectLegacyProfile } from './legacy-profile';
import { activateSourceServerProfile } from './source-server-config';

activateSourceServerProfile();

// Capture productName before main.ts sets the stable app name. In packaged
// fork preview installers, never inspect or migrate the production profile.
export const isForkPreviewBuild = isForkPreviewRuntime(
    app.isPackaged,
    app.getName()
);
const override = getElectronUserDataPath();
const appDataPath = app.getPath('appData');
const current = override ??
    (isForkPreviewBuild
        ? getForkPreviewUserDataPath(appDataPath)
        : app.getPath('userData'));
const legacy = isForkPreviewBuild
    ? null
    : selectLegacyProfile(
          process.env.IPTVNATOR_E2E_DATA_DIR?.trim() || appDataPath,
          current
      );
if (legacy || override || isForkPreviewBuild) {
    app.setPath('userData', legacy ?? current);
}
