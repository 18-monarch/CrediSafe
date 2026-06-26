# npm install fix

This package uses only the public npm registry.

Recommended environment:

- Node.js 20.9 or newer
- npm bundled with Node.js LTS

Clean install on Windows PowerShell:

```powershell
node -v
npm -v
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm cache verify
npm config set registry https://registry.npmjs.org/
npm install
```

If npm itself still throws `Exit handler never called`, install Node.js 20 LTS and repeat the clean install.
