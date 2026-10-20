const [major, minor] = process.versions.node.split(".").map(Number);
const tooOld = major < 20 || (major === 20 && minor < 9);

if (tooOld) {
  console.error(
    `Arbour needs Node.js 20.9 or newer (Next.js 16). Current version: ${process.versions.node}.`,
  );
  console.error("Run `nvm use` in the repository root, then try again.");
  process.exit(1);
}
