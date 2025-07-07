/* global process */
/* eslint-env node */

/*
 * This file runs in a Node context (it's NOT transpiled by Babel), so use only
 * the ES6 features that are supported by your Node version. https://node.green/
 */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

import { configure } from "quasar/wrappers"
import path from "node:path"
import "dotenv/config"
import fs from "fs"
import routeData from "./src/router/routeData.json"
import viteCompression from "vite-plugin-compression"

const __dirname = path.resolve()

export default configure(function (/* ctx */) {
  return {
    // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
    preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    boot: ["boot", "componentDefaults", "vueQuery"],
    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: ["app.sass"],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      // 'ionicons-v4',
      // 'mdi-v7',
      "fontawesome-v6",
      // 'eva-icons',
      // 'themify',
      // 'line-awesome',
      // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!
      "material-symbols-outlined",
      "roboto-font", // optional, you are not bound to it
      "material-icons", // optional, you are not bound to it
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#build
    build: {
      minify: "terser",
      sourcemap: false,
      cssCodeSplit: true,
      extractCSS: true,

      htmlMinifyOptions: { minifyJS: true, minifyCSS: true },

      target: {
        browser: ["es2022", "firefox115", "chrome115", "safari14"],
        node: "node22",
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["vue", "vue-router", "pinia"],
          },
        },
      },
      terserOptions: {
        compress: {
          drop_console: true,
        },
      },
      vitePlugins: [
        viteCompression({
          algorithm: "gzip",
          ext: ".gz",
          deleteOriginFile: false,
        }),
      ],
      vueRouterMode: "history",
      // vitePlugins: [
      //   ["vite-tsconfig-paths", {
      //     // projects: ['./tsconfig.json', '../../tsconfig.json'] // if you have multiple tsconfig files (e.g. in a monorepo)
      //   }]
      // ],
      extendViteConf(viteConf, { isServer, isClient }) {
        viteConf.logLevel = "error"

        Object.assign(viteConf.resolve.alias, {
          lib: path.join(__dirname, "./src/lib"),
          src: path.join(__dirname, "./src"),
        })

        viteConf.define = {
          global: "globalThis",
          "process.env": {},
        }
        // viteConf.server.allowedHosts = ["51fb-2405-9800-b970-84dc-e8cd-730-96cf-b38.ngrok-free.app"]

        // Only keep essential polyfills that might be needed by other packages
        viteConf.resolve = {
          ...viteConf.resolve,
          alias: {
            ...viteConf.resolve.alias,
            buffer: "buffer",
          },
        }

        viteConf.optimizeDeps = {
          ...viteConf.optimizeDeps,
          include: [],
          esbuildOptions: {
            target: "esnext",
          },
        }
        if (process.env.NODE_ENV === "development") {
          // fix for bug https://github.com/decentralized-identity/ethr-did-resolver/issues/186
          console.log("Overriding ethr-did-resolver path")
          viteConf.resolve.alias["ethr-did-resolver"] = path.resolve("./node_modules/ethr-did-resolver/src/index.ts")
        }
      },
      // vueRouterBase,
      // vueDevtools,
      // vueOptionsAPI: false,

      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      // publicPath: '/',
      // analyze: true,
      // env: {},
      // rawDefine: {}
      // ignorePublicFolder: true,
      // minify: false,
      // polyfillModulePreload: true,
      // distDir

      // extendViteConf (viteConf) {},
      viteVuePluginOptions: {
        logLevel: "error", // Only display errors in the console
      },

      // vitePlugins: [
      //   // ["vite-plugin-checker", {
      //   //   vueTsc: {
      //   //     tsconfigPath: "tsconfig.vue-tsc.json"
      //   //   },
      //   //   eslint: {
      //   //     lintCommand: "eslint \"./**/*.{js,ts,mjs,cjs,vue}\""
      //   //   }
      //   // }, { server: false }]
      // ],
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
    devServer: {
      history: true,
      // https: true
      open: false, // opens browser window automatically
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
    framework: {
      config: {
        dark: true,
      },

      // iconSet: 'material-icons', // Quasar icon set
      // lang: 'en-US', // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: ["Dialog", "LocalStorage", "SessionStorage", "Loading", "Notify", "LoadingBar"],
    },

    // animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#sourcefiles
    // sourceFiles: {
    //   rootComponent: 'src/App.vue',
    //   router: 'src/router/index',
    //   store: 'src/store/index',
    //   registerServiceWorker: 'src-pwa/register-service-worker',
    //   serviceWorker: 'src-pwa/custom-service-worker',
    //   pwaManifestFile: 'src-pwa/manifest.json',
    //   electronMain: 'src-electron/electron-main',
    //   electronPreload: 'src-electron/electron-preload'
    // },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      // ssrPwaHtmlFilename: 'offline.html', // do NOT use index.html as name!
      // will mess up SSR

      // extendSSRWebserverConf (esbuildConf) {},
      // extendPackageJson (json) {},

      pwa: false,

      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)
      extendSSRWebserverConf(config) {
        // config.external = ["@simplewebauthn/browser"]
      },
      middlewares: [
        "render", // keep this as last one
      ],
    },
    ssg: {
      includeStaticRoutes: false,
      exclude: ["/admin", "/forge", "/browse", "/addPoints", "/login", "/tos", "/create"],
    },
    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: "generateSW", // or 'injectManifest'
      injectPwaMetaTags: true,
      swFilename: "sw.js",
      manifestFilename: "manifest.json",
      useCredentialsForManifestTag: false,
      // useFilenameHashes: true,
      // extendGenerateSWOptions (cfg) {}
      // extendInjectManifestOptions (cfg) {},
      // extendManifestJson (json) {}
      // extendPWACustomSWConf (esbuildConf) {}
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {
      // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true,
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf)
      // extendElectronPreloadConf (esbuildConf)

      inspectPort: 5858,

      bundler: "packager", // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',
        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration/configuration

        appId: "fiddl.art",
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    bex: {
      contentScripts: ["my-content-script"],
    },
  }
})
