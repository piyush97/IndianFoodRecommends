// TypeScript 7 ships no JS API; typescript-eslint still needs one.
// Give it the official TS 6 API package instead of the root typescript@7.
function readPackage(pkg) {
  if (pkg.name === "typescript-eslint" || pkg.name?.startsWith("@typescript-eslint/")) {
    if (pkg.peerDependencies?.typescript) {
      delete pkg.peerDependencies.typescript;
      pkg.dependencies = { ...pkg.dependencies, typescript: "npm:@typescript/typescript6@6.0.2" };
    }
  }
  return pkg;
}
module.exports = { hooks: { readPackage } };
