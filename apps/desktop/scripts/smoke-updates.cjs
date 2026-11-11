// Exercise the shipped updater bundle with real Electron and real release bytes, without installing anything.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");

if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const qa = fs.mkdtempSync(path.join(os.tmpdir(), "heymoa-update-smoke-"));
  try {
    fs.writeFileSync(
      path.join(qa, "package.json"),
      JSON.stringify({
        name: "heymoa-update-qa",
        version: "0.0.1",
        main: __filename,
      })
    );
    const directory = path.resolve(process.argv[2] ?? "release");
    const result = spawnSync(require("electron"), [qa, directory], {
      stdio: "inherit",
      timeout: 180_000,
      env: { ...process.env, HEYMOA_UPDATE_QA_PROFILE: qa },
    });
    process.exitCode = result.status ?? 1;
  } finally {
    fs.rmSync(qa, { recursive: true, force: true });
  }
} else {
  const { app } = require("electron");
  app.setPath("userData", process.env.HEYMOA_UPDATE_QA_PROFILE);
  const timeout = setTimeout(() => app.exit(1), 150_000);
  app
    .whenReady()
    .then(async () => {
      const http = require("node:http");
      const directory = path.resolve(process.argv[2]);
      const resources =
        process.platform === "darwin"
          ? path.join(directory, "mac-arm64/HeyMoa.app/Contents/Resources")
          : path.join(directory, "win-unpacked/resources");
      const archive = path.join(resources, "app.asar");
      const { autoUpdater } = require(
        path.join(archive, "dist/update-runtime.js")
      );
      const { DesktopUpdates } = require(path.join(archive, "dist/updates.js"));
      assert.match(
        fs.readFileSync(path.join(resources, "app-update.yml"), "utf8"),
        /https:\/\/github.com\/team-minswon\/homebrew-tap\/releases\/latest\/download/
      );
      // The test serves only local build artifacts; production still uses its bundled HTTPS feed.
      const server = http.createServer((request, response) => {
        const name = decodeURIComponent(
          new URL(request.url, "http://localhost").pathname.slice(1)
        );
        if (
          !/^(?:latest(?:-mac)?\.yml|HeyMoa-[\w.-]+\.(?:zip|exe|dmg)(?:\.blockmap)?)$/.test(
            name
          )
        ) {
          response.writeHead(404).end();
          return;
        }
        const file = path.join(directory, name);
        if (!fs.existsSync(file)) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, { "Content-Length": fs.statSync(file).size });
        fs.createReadStream(file).pipe(response);
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const qaConfig = path.join(
        process.env.HEYMOA_UPDATE_QA_PROFILE,
        "dev-app-update.yml"
      );
      const cache = path.relative(
        autoUpdater.app.baseCachePath,
        path.join(process.env.HEYMOA_UPDATE_QA_PROFILE, "cache")
      );
      fs.writeFileSync(
        qaConfig,
        fs
          .readFileSync(path.join(resources, "app-update.yml"), "utf8")
          .replace(
            /^updaterCacheDirName:.*$/m,
            `updaterCacheDirName: ${JSON.stringify(cache)}`
          )
      );
      autoUpdater.updateConfigPath = qaConfig;
      autoUpdater.forceDevUpdateConfig = true;
      autoUpdater.disableDifferentialDownload = true;
      autoUpdater.setFeedURL({
        provider: "generic",
        url: `http://127.0.0.1:${server.address().port}`,
      });
      let safe = false,
        installs = 0;
      // Test the installation handoff, never replace the CI runner's Electron application.
      autoUpdater.quitAndInstall = (silent, relaunch) => {
        assert.equal(silent, true);
        assert.equal(relaunch, true);
        installs++;
      };
      const model = new DesktopUpdates(autoUpdater, {
        currentVersion: app.getVersion(),
        available: true,
        automatic: false,
        safe: () => safe,
        prepareInstall: () => safe,
        cancelInstall() {},
        saveAutomatic: async () => {},
        changed() {},
      });
      await model.check();
      assert.equal(
        model.state().status,
        "ready",
        "real update metadata, bundle and installer download must succeed"
      );
      model.restart();
      assert.equal(installs, 0);
      safe = true;
      model.restart();
      assert.equal(installs, 1);
      console.log(
        "Packaged updater smoke passed: real download, integrity checks and guarded handoff; no software installed."
      );
      clearTimeout(timeout);
      app.exit(0);
    })
    .catch((error) => {
      console.error(error);
      app.exit(1);
    });
}
